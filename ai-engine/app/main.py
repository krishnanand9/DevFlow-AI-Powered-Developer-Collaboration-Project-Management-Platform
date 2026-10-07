import json
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import fallback

app = FastAPI(title="DevFlow AI Engine", version="1.0.0")
INTERNAL_KEY = os.getenv("AI_INTERNAL_KEY", "dev-internal-key")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MAX_TASKS = 100


def require_key(x_internal_key: str = Header(default="")):
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="invalid internal key")


class Task(BaseModel):
    id: str
    title: str = Field(max_length=200)
    description: str = Field(default="", max_length=10000)
    status: str
    priority: str
    dueDate: str | None = None
    blocked: bool = False
    estimateHours: float | None = None


class BreakdownReq(BaseModel):
    task: Task


class PrioritizeReq(BaseModel):
    tasks: list[Task] = Field(max_length=MAX_TASKS)


class SummaryReq(BaseModel):
    projectName: str
    metrics: dict


def llm_json(system: str, user: str) -> dict | None:
    """Returns parsed JSON from the LLM, or None if unavailable (caller then uses the fallback)."""
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        from openai import OpenAI

        r = OpenAI().chat.completions.create(
            model=MODEL, max_tokens=800, timeout=25,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return json.loads(r.choices[0].message.content)
    except Exception:
        return None


@app.get("/health")
def health():
    return {"status": "ok", "llm_configured": bool(os.getenv("OPENAI_API_KEY"))}


@app.post("/v1/breakdown", dependencies=[Depends(require_key)])
def breakdown(req: BreakdownReq):
    data = llm_json(
        'Break the task into 3-8 concrete engineering subtasks. Reply as JSON: {"subtasks": ["..."]}. Use only the task provided.',
        req.task.model_dump_json(),
    )
    subs = data.get("subtasks") if data else None
    if isinstance(subs, list) and subs and all(isinstance(s, str) for s in subs):
        return {"subtasks": [s[:200] for s in subs[:8]], "source": "ai"}
    return {"subtasks": fallback.breakdown(req.task.model_dump()), "source": "fallback"}


@app.post("/v1/prioritize", dependencies=[Depends(require_key)])
def prioritize(req: PrioritizeReq):
    ranked = fallback.prioritize([t.model_dump() for t in req.tasks])
    # The ranking itself is deterministic (explainable); the LLM only rephrases reasons when available.
    return {"ranked": ranked, "source": "fallback", "note": "Scores combine priority, due date, blocked state and status."}


@app.post("/v1/summary", dependencies=[Depends(require_key)])
def summary(req: SummaryReq):
    data = llm_json(
        'Write a 2-4 sentence project health summary using ONLY the metrics provided. Do not invent numbers. Reply as JSON: {"summary": "..."}.',
        json.dumps({"project": req.projectName, "metrics": req.metrics}),
    )
    if data and isinstance(data.get("summary"), str):
        return {"summary": data["summary"], "source": "ai"}
    return {"summary": fallback.summary(req.projectName, req.metrics), "source": "fallback"}
