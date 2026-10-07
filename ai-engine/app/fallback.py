"""Deterministic fallbacks used when no OpenAI key is configured or the LLM call fails.
They only use data that was supplied and never invent metrics."""
from datetime import datetime, timezone

PRIORITY_WEIGHT = {"critical": 40, "high": 25, "medium": 10, "low": 0}


def _days_until(due):
    if not due:
        return None
    d = datetime.fromisoformat(due.replace("Z", "+00:00"))
    return (d - datetime.now(timezone.utc)).days


def breakdown(task: dict) -> list[str]:
    t = task["title"]
    return [f"Clarify requirements and acceptance criteria for: {t}",
            f"Implement: {t}",
            f"Write tests for: {t}",
            "Open a pull request and request review"]


def prioritize(tasks: list[dict]) -> list[dict]:
    out = []
    for t in tasks:
        score, reasons = PRIORITY_WEIGHT.get(t["priority"], 10), [f"priority is {t['priority']}"]
        days = _days_until(t.get("dueDate"))
        if days is not None:
            if days < 0:
                score += 40; reasons.append(f"overdue by {-days} day(s)")
            elif days <= 3:
                score += 20; reasons.append(f"due in {days} day(s)")
        if t.get("blocked"):
            score += 15; reasons.append("marked blocked - unblocking it should come first")
        if t["status"] == "in_review":
            score += 5; reasons.append("already in review, close to done")
        out.append({"id": t["id"], "title": t["title"], "score": score, "reasons": reasons})
    return sorted(out, key=lambda x: -x["score"])


def summary(name: str, m: dict) -> str:
    s = m.get("byStatus", {})
    parts = [f"{name}: {m['total']} task(s), {m['completionPercent']}% done.",
             "Status breakdown: " + ", ".join(f"{k}={v}" for k, v in s.items()) + "."]
    if m.get("overdue"):
        parts.append(f"{m['overdue']} open task(s) are overdue.")
    if m.get("blocked"):
        parts.append(f"{m['blocked']} open task(s) are marked blocked.")
    if not m["total"]:
        parts = [f"{name} has no tasks yet, so there is nothing to summarize."]
    return " ".join(parts)
