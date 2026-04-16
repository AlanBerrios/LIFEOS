"""
LifeOS Backend — FastAPI app

Endpoints:
  GET  /health    → healthcheck
  POST /schedule  → genera el timeline con OR-Tools

Correr con:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import json
import logging
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import CONTRACT_VERSION, ReplanRequest, ScheduleRequest, ScheduleResponse, TaskIn
from scheduler import generate_schedule

logger = logging.getLogger("lifeos.backend")
logging.basicConfig(level=logging.INFO)

LIFEOS_ENV = os.getenv("LIFEOS_ENV", "dev").strip().lower()


DEFAULT_ALLOWED_ORIGINS_BY_ENV: dict[str, list[str]] = {
    "dev": [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "exp://127.0.0.1:19000",
        "exp://localhost:19000",
    ],
    "staging": [
        "https://staging.lifeos.app",
    ],
    "prod": [
        "https://lifeos.app",
    ],
}


def _log_event(event: str, **fields) -> None:
    payload = {
        "event": event,
        "env": LIFEOS_ENV,
        **fields,
    }
    logger.info(json.dumps(payload, default=str, ensure_ascii=True))


def _resolve_allowed_origins() -> list[str]:
    raw = os.getenv("LIFEOS_ALLOWED_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    if LIFEOS_ENV in DEFAULT_ALLOWED_ORIGINS_BY_ENV:
        return DEFAULT_ALLOWED_ORIGINS_BY_ENV[LIFEOS_ENV]

    return DEFAULT_ALLOWED_ORIGINS_BY_ENV["dev"]


ALLOWED_ORIGINS = _resolve_allowed_origins()
_log_event("cors.configured", allowed_origins=ALLOWED_ORIGINS)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LifeOS Scheduler API",
    description="OR-Tools CP-SAT powered scheduling engine for LifeOS",
    version="1.0.0",
)

# Permitir requests desde orígenes controlados por entorno.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    _log_event("health.check")
    return {
        "status": "ok",
        "engine": "ortools-cpsat",
        "environment": LIFEOS_ENV,
        "allowed_origins": ALLOWED_ORIGINS,
    }


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

    _log_event(
        "schedule.request",
        contract_version=request.contract_version,
        tasks_count=len(request.tasks),
        start_time=request.start_time.isoformat(),
    )

    request_started = time.perf_counter()

    try:
        response = generate_schedule(request.tasks, request.start_time)
        request_elapsed_ms = (time.perf_counter() - request_started) * 1000
        _log_event(
            "schedule.success",
            solver_status=response.solver_status,
            solve_time_ms=response.solve_time_ms,
            tasks_scheduled=response.tasks_scheduled,
            request_elapsed_ms=round(request_elapsed_ms, 2),
        )
        return response
    except Exception as exc:
        _log_event("schedule.error", error=str(exc), tasks_count=len(request.tasks))
        logger.exception("Error generating schedule")
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

    _log_event(
        "replan.request",
        contract_version=request.contract_version,
        remaining_tasks_count=len(request.remaining_tasks),
        completed_ids_count=len(request.completed_task_ids),
        start_time=request.start_time.isoformat(),
    )

    completed_ids = set(request.completed_task_ids)
    replannable_tasks: list[TaskIn] = []

    for task in request.remaining_tasks:
        if task.id in completed_ids or task.status == "completed":
            continue

        task_data = task.model_dump() if hasattr(task, "model_dump") else task.dict()
        task_data["status"] = "pool"
        replannable_tasks.append(TaskIn(**task_data))

    request_started = time.perf_counter()

    try:
        response = generate_schedule(replannable_tasks, request.start_time)
        request_elapsed_ms = (time.perf_counter() - request_started) * 1000
        _log_event(
            "replan.success",
            replannable_tasks_count=len(replannable_tasks),
            solver_status=response.solver_status,
            solve_time_ms=response.solve_time_ms,
            tasks_scheduled=response.tasks_scheduled,
            request_elapsed_ms=round(request_elapsed_ms, 2),
        )
        return response
    except Exception as exc:
        _log_event(
            "replan.error",
            error=str(exc),
            replannable_tasks_count=len(replannable_tasks),
        )
        logger.exception("Error generating replan")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
