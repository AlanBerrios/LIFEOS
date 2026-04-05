"""
LifeOS Backend — FastAPI app

Endpoints:
  GET  /health    → healthcheck
  POST /schedule  → genera el timeline con OR-Tools

Correr con:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import ScheduleRequest, ScheduleResponse
from scheduler import generate_schedule

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LifeOS Scheduler API",
    description="OR-Tools CP-SAT powered scheduling engine for LifeOS",
    version="1.0.0",
)

# Permitir requests desde la app móvil (cualquier origen en red local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "engine": "ortools-cpsat"}


@app.post("/schedule", response_model=ScheduleResponse)
def schedule(request: ScheduleRequest) -> ScheduleResponse:
    """
    Recibe las tareas del usuario y devuelve un timeline optimizado.
    El solver OR-Tools CP-SAT garantiza el óptimo global.
    """
    try:
        return generate_schedule(request.tasks, request.start_time)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
