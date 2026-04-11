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

from models import CONTRACT_VERSION, ReplanRequest, ScheduleRequest, ScheduleResponse, TaskIn
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
    if request.contract_version != CONTRACT_VERSION:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported contract version: {request.contract_version}"
        )

    try:
        return generate_schedule(request.tasks, request.start_time)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/replan", response_model=ScheduleResponse)
def replan(request: ReplanRequest) -> ScheduleResponse:
    """
    Replanifica el resto del dia cuando una tarea fue saltada o pospuesta.
    - Filtra tareas completadas
    - Normaliza estados a `pool` para re-evaluar la secuencia
    - Reutiliza el scheduler principal desde `start_time` actual
    """
    if request.contract_version != CONTRACT_VERSION:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported contract version: {request.contract_version}"
        )

    completed_ids = set(request.completed_task_ids)
    replannable_tasks: list[TaskIn] = []

    for task in request.remaining_tasks:
        if task.id in completed_ids or task.status == "completed":
            continue

        task_data = task.model_dump() if hasattr(task, "model_dump") else task.dict()
        task_data["status"] = "pool"
        replannable_tasks.append(TaskIn(**task_data))

    try:
        return generate_schedule(replannable_tasks, request.start_time)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
