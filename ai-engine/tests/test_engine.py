import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.pop("OPENAI_API_KEY", None)
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
H = {"X-Internal-Key": "dev-internal-key"}
T = {"id": "1", "title": "Fix login", "status": "todo", "priority": "high", "blocked": True}


def test_requires_key():
    assert c.post("/v1/breakdown", json={"task": T}).status_code == 401


def test_breakdown_fallback():
    r = c.post("/v1/breakdown", json={"task": T}, headers=H).json()
    assert r["source"] == "fallback" and len(r["subtasks"]) >= 3


def test_prioritize_explains():
    r = c.post("/v1/prioritize", json={"tasks": [T, {**T, "id": "2", "priority": "low", "blocked": False}]}, headers=H).json()
    assert r["ranked"][0]["id"] == "1" and r["ranked"][0]["reasons"]


def test_summary_uses_supplied_metrics():
    m = {"total": 4, "completionPercent": 25, "byStatus": {"done": 1, "todo": 3}, "overdue": 1, "blocked": 0}
    assert "25%" in c.post("/v1/summary", json={"projectName": "X", "metrics": m}, headers=H).json()["summary"]
