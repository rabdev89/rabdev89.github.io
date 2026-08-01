"""Agent trace persistence — records each agent step to Postgres."""

import time
import json
import uuid
from dataclasses import dataclass, field

from documind_agents.db import execute


@dataclass
class TraceCollector:
    """Collects agent step traces during a run, then flushes to DB."""

    message_id: str
    traces: list[dict] = field(default_factory=list)
    _step_starts: dict[str, float] = field(default_factory=dict)

    def start_step(self, agent_name: str, step: str, input_data: object = None) -> None:
        key = f"{agent_name}:{step}"
        self._step_starts[key] = time.monotonic()

    def end_step(
        self,
        agent_name: str,
        step: str,
        output_data: object = None,
        tokens: int = 0,
    ) -> None:
        key = f"{agent_name}:{step}"
        start = self._step_starts.pop(key, time.monotonic())
        latency_ms = int((time.monotonic() - start) * 1000)

        self.traces.append({
            "id": str(uuid.uuid4()),
            "message_id": self.message_id,
            "agent_name": agent_name,
            "step": step,
            "input": _safe_json(output_data),
            "output": _safe_json(output_data),
            "latency_ms": latency_ms,
            "tokens": tokens,
        })

    async def flush(self) -> None:
        if not self.traces:
            return

        values_parts = []
        params: list[object] = []
        idx = 1

        for t in self.traces:
            values_parts.append(
                f"(${idx}, ${idx+1}, ${idx+2}, ${idx+3}, ${idx+4}, ${idx+5}, ${idx+6}, ${idx+7})"
            )
            params.extend([
                t["id"],
                t["message_id"],
                t["agent_name"],
                t["step"],
                t["input"],
                t["output"],
                t["latency_ms"],
                t["tokens"],
            ])
            idx += 8

        await execute(
            f"""INSERT INTO agent_traces (id, message_id, agent_name, step, input, output, latency_ms, tokens)
                VALUES {', '.join(values_parts)}""",
            *params,
        )
        self.traces.clear()


def _safe_json(obj: object) -> str:
    try:
        return json.dumps(obj, default=str)[:10000]
    except Exception:
        return "{}"
