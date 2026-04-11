"""
LifeOS Backend — Pydantic models
Refleja exactamente los tipos TypeScript de src/types/index.ts
"""

from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

CONTRACT_VERSION = "1.0.0"
TaskUrgency = Literal["today", "this_week", "this_month", "someday"]
TaskStatus = Literal["pool", "scheduled", "completed", "in_progress", "skipped", "postponed"]


# ─── Input models ─────────────────────────────────────────────────────────────

class TaskIn(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    eta_minutes: int = Field(ge=5, le=480)
    priority: Literal[1, 2, 3, 4, 5]
    cognitive_load: int = Field(ge=1, le=10)
    deadline: Optional[datetime] = None
    fixed_start: Optional[datetime] = None
    fixed_end: Optional[datetime] = None
    urgency: TaskUrgency = "someday"
    status: TaskStatus
    created_at: datetime


class ScheduleRequest(BaseModel):
    contract_version: str = CONTRACT_VERSION
    tasks: list[TaskIn]
    start_time: datetime


class ReplanRequest(BaseModel):
    contract_version: str = CONTRACT_VERSION
    completed_task_ids: list[str] = Field(default_factory=list)
    failed_task_id: Optional[str] = None
    failed_task_reason: Optional[Literal[
        "distraction",
        "urgent_task",
        "low_energy",
        "blocker",
        "system_issue",
        "need_more_time",
        "blocked",
        "deprioritized",
        "other",
    ]] = None
    remaining_tasks: list[TaskIn]
    start_time: datetime


# ─── Output models ────────────────────────────────────────────────────────────

class ScheduleBlockOut(BaseModel):
    id: str
    type: Literal["task", "rest", "meal", "sleep"]
    task_id: Optional[str] = None
    title: str
    start_time: datetime
    end_time: datetime
    cognitive_drain: Optional[float] = None
    pinned: Optional[bool] = None
    isStaticEvent: Optional[bool] = None


class ScheduleResponse(BaseModel):
    contract_version: str = CONTRACT_VERSION
    blocks: list[ScheduleBlockOut]
    solver_status: str           # "OPTIMAL", "FEASIBLE", "FALLBACK_GREEDY"
    solve_time_ms: float
    tasks_scheduled: int
    engine: str = "ortools-cpsat"
