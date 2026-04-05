"""
LifeOS Backend — Pydantic models
Refleja exactamente los tipos TypeScript de src/types/index.ts
"""

from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ─── Input models ─────────────────────────────────────────────────────────────

class TaskIn(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    eta_minutes: int = Field(ge=5, le=480)
    priority: Literal[1, 2, 3, 4, 5]
    cognitive_load: int = Field(ge=1, le=10)
    deadline: Optional[datetime] = None
    status: Literal["pool", "scheduled", "completed"]
    created_at: datetime


class ScheduleRequest(BaseModel):
    tasks: list[TaskIn]
    start_time: datetime


# ─── Output models ────────────────────────────────────────────────────────────

class ScheduleBlockOut(BaseModel):
    id: str
    type: Literal["task", "rest", "meal"]
    task_id: Optional[str] = None
    title: str
    start_time: datetime
    end_time: datetime
    cognitive_drain: Optional[float] = None


class ScheduleResponse(BaseModel):
    blocks: list[ScheduleBlockOut]
    solver_status: str           # "OPTIMAL", "FEASIBLE", "FALLBACK_GREEDY"
    solve_time_ms: float
    tasks_scheduled: int
    engine: str = "ortools-cpsat"
