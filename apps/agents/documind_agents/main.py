"""FastAPI wrapper for the ADK agent service.

Exposes:
  POST /run — SSE stream of agent events
  GET  /health — liveness check
"""

import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from documind_agents.root import root_orchestrator


session_service = InMemorySessionService()
runner = Runner(agent=root_orchestrator, app_name="documind", session_service=session_service)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    yield


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

    content = types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)],
    )

    async def event_stream() -> AsyncGenerator[str, None]:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=conversation_id,
            new_message=content,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        yield part.text

    return StreamingResponse(event_stream(), media_type="text/event-stream")
