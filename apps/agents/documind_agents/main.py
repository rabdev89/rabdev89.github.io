"""FastAPI wrapper for the ADK agent service.

Exposes:
  POST /run       — SSE stream of agent events (text + citations + traces)
  POST /messages  — get conversation history
  GET  /health    — liveness check
"""

import json
import re
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from documind_agents.root import root_orchestrator
from documind_agents.db import execute, fetch_all, get_pool
from documind_agents.tracing import TraceCollector


session_service = InMemorySessionService()
runner = Runner(
    agent=root_orchestrator,
    app_name="documind",
    session_service=session_service,
)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    yield
    pool = await get_pool()
    await pool.close()


app = FastAPI(title="DocuMind Agent Service", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "documind-agents"}


@app.post("/run")
async def run(request: Request) -> StreamingResponse:
    body = await request.json()
    workspace_id: str = body["workspace_id"]
    user_id: str = body["user_id"]
    conversation_id: str = body["conversation_id"]
    message: str = body["message"]

    session = await session_service.get_session(
        app_name="documind",
        user_id=user_id,
        session_id=conversation_id,
    )

    if session is None:
        session = await session_service.create_session(
            app_name="documind",
            user_id=user_id,
            session_id=conversation_id,
            state={"workspace_id": workspace_id},
        )

    await _ensure_conversation(conversation_id, workspace_id, user_id, message)

    user_message_id = str(uuid.uuid4())
    await _save_message(user_message_id, conversation_id, "user", message)

    assistant_message_id = str(uuid.uuid4())
    trace_collector = TraceCollector(message_id=assistant_message_id)

    content = types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)],
    )

    async def event_stream() -> AsyncGenerator[str, None]:
        full_text = ""
        current_agent = ""

        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=conversation_id,
                new_message=content,
            ):
                if event.author and event.author != current_agent:
                    if current_agent:
                        trace_collector.end_step(current_agent, "respond")
                    current_agent = event.author
                    trace_collector.start_step(current_agent, "respond")
                    yield _sse_event("agent_step", {"agent": current_agent})

                if not event.content or not event.content.parts:
                    continue

                for part in event.content.parts:
                    if part.text:
                        full_text += part.text
                        yield _sse_event("text", {"text": part.text})

                    if hasattr(part, "function_call") and part.function_call:
                        fc = part.function_call
                        yield _sse_event("tool_call", {
                            "agent": current_agent,
                            "tool": fc.name,
                        })
                        trace_collector.start_step(
                            current_agent, f"tool:{fc.name}"
                        )

                    if hasattr(part, "function_response") and part.function_response:
                        fr = part.function_response
                        trace_collector.end_step(
                            current_agent, f"tool:{fr.name}"
                        )

        except Exception as exc:
            yield _sse_event("error", {"error": str(exc)})

        if current_agent:
            trace_collector.end_step(current_agent, "respond")

        citations = _extract_citations(full_text)
        if citations:
            yield _sse_event("citations", {"citations": citations})

        yield _sse_event("done", {"message_id": assistant_message_id})

        await _save_message(
            assistant_message_id,
            conversation_id,
            "assistant",
            full_text,
            citations,
        )
        await trace_collector.flush()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/messages")
async def get_messages(request: Request) -> list[dict]:
    body = await request.json()
    conversation_id: str = body["conversation_id"]
    workspace_id: str = body["workspace_id"]

    rows = await fetch_all(
        """SELECT id, role, content, citations, created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC""",
        conversation_id,
    )

    return [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "citations": json.loads(r["citations"]) if r["citations"] else None,
            "createdAt": str(r["created_at"]),
        }
        for r in rows
    ]


async def _ensure_conversation(
    conversation_id: str, workspace_id: str, user_id: str, message: str
) -> None:
    existing = await fetch_all(
        "SELECT id, title FROM conversations WHERE id = $1", conversation_id
    )
    if not existing:
        title = _generate_title(message)
        await execute(
            """INSERT INTO conversations (id, workspace_id, user_id, title)
               VALUES ($1, $2, $3, $4)""",
            conversation_id,
            workspace_id,
            user_id,
            title,
        )
    elif existing[0]["title"] == "New conversation":
        title = _generate_title(message)
        await execute(
            "UPDATE conversations SET title = $1 WHERE id = $2",
            title,
            conversation_id,
        )


def _generate_title(message: str) -> str:
    text = message.strip()
    if len(text) <= 50:
        return text
    cut = text[:50].rsplit(" ", 1)
    return (cut[0] if len(cut) > 1 else text[:50]) + "..."


async def _save_message(
    message_id: str,
    conversation_id: str,
    role: str,
    content: str,
    citations: list[dict] | None = None,
) -> None:
    citations_json = json.dumps(citations) if citations else None
    await execute(
        """INSERT INTO messages (id, conversation_id, role, content, citations)
           VALUES ($1, $2, $3, $4, $5)""",
        message_id,
        conversation_id,
        role,
        content,
        citations_json,
    )


def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


CITATION_PATTERN = re.compile(
    r'\[\[page\s+(\d+),\s*section\s+"([^"]*)",\s*filename\s+"([^"]*)"\]\]'
)


def _extract_citations(text: str) -> list[dict]:
    seen = set()
    citations = []
    for match in CITATION_PATTERN.finditer(text):
        page = int(match.group(1))
        section = match.group(2)
        filename = match.group(3)
        key = (page, section, filename)
        if key not in seen:
            seen.add(key)
            citations.append({
                "page": page,
                "section": section,
                "filename": filename,
            })
    return citations
