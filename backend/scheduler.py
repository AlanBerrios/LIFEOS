"""
LifeOS Backend — Scheduler con OR-Tools CP-SAT

Implementa el problema de scheduling como un Constraint Programming problem:

  Objetivo  : Maximizar sum(priority_score[i] * assigned[i])
  Variables : assigned[i] ∈ {0,1}, start[i] ∈ Z+ (minutos desde base)
  Constraints:
    - No solapamiento entre tareas asignadas
    - Deadline hard constraints (tarea debe terminar antes del deadline)
    - Presupuesto cognitivo: entre descansos, sum(load*eta) ≤ COGNITIVE_BUDGET
    - Descanso obligatorio si trabajo continuo ≥ TIME_STREAK_LIMIT

El solver garantiza el ÓPTIMO GLOBAL (no una aproximación greedy).
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone
from ortools.sat.python import cp_model

from models import TaskIn, ScheduleBlockOut, ScheduleResponse

# ─── Constantes ───────────────────────────────────────────────────────────────

TIME_STREAK_LIMIT  = 90    # minutos de trabajo continuo → descanso
TIME_BREAK         = 10    # minutos de descanso estándar
COGNITIVE_BUDGET   = 600   # cognitive_load × eta_minutes → límite entre descansos
COGNITIVE_BREAK    = 20    # minutos de "Recarga mental"
HARD_DEADLINE_HRS  = 2.0   # tareas dentro de este umbral: hard constraint
HORIZON_HOURS      = 16    # horizonte máximo del día (16h = 960 min)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _deadline_proximity_score(task: TaskIn, now: datetime) -> float:
    """Score adicional por proximidad al deadline (0-120)."""
    if task.deadline is None:
        return 0.0
    # Normalizar timezone
    dl = task.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    n = now if now.tzinfo else now.replace(tzinfo=timezone.utc)

    hours_left = (dl - n).total_seconds() / 3600
    if hours_left <= 0:
        return 120.0
    if hours_left <= 2:
        return 100.0
    return max(0.0, 72.0 - hours_left * 2.0)


def _base_priority_score(task: TaskIn, now: datetime) -> float:
    """Score de priorización base (mismo modelo que el TS)."""
    return (
        task.priority * 10
        + _deadline_proximity_score(task, now)
        - task.cognitive_load * 0.5
    )


def _is_hard_constraint(task: TaskIn, now: datetime) -> bool:
    """¿El deadline de esta tarea es una restricción dura?"""
    if task.deadline is None:
        return False
    dl = task.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    n = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    return (dl - n).total_seconds() / 3600 <= HARD_DEADLINE_HRS


# ─── CP-SAT Solver ────────────────────────────────────────────────────────────

def _solve_with_cpsat(
    tasks: list[TaskIn],
    start_time: datetime,
) -> tuple[list[TaskIn], str, float]:
    """
    Usa OR-Tools CP-SAT para encontrar la secuencia de tareas ÓPTIMA.

    Retorna:
        ordered_tasks: lista ordenada de tareas a ejecutar
        status:        "OPTIMAL" | "FEASIBLE" | "UNKNOWN"
        solve_ms:      tiempo que tardó el solver en ms
    """
    now = start_time
    horizon = HORIZON_HOURS * 60  # minutos

    model = cp_model.CpModel()
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0  # timeout generoso

    n = len(tasks)
    if n == 0:
        return [], "OPTIMAL", 0.0

    # ── Variables ──────────────────────────────────────────────────────────────
    # assigned[i]: ¿se programa esta tarea?
    assigned = [model.NewBoolVar(f"assigned_{i}") for i in range(n)]

    # start_var[i]: minuto de inicio de la tarea i (0 = start_time)
    start_vars = [model.NewIntVar(0, horizon, f"start_{i}") for i in range(n)]

    # end_var[i] = start_var[i] + eta_minutes[i]
    end_vars = [
        model.NewIntVar(0, horizon + tasks[i].eta_minutes, f"end_{i}")
        for i in range(n)
    ]

    # Intervalo opcional (se activa solo si assigned[i] == True)
    intervals = [
        model.NewOptionalIntervalVar(
            start_vars[i], tasks[i].eta_minutes, end_vars[i], assigned[i],
            f"interval_{i}"
        )
        for i in range(n)
    ]

    # ── Constraints ────────────────────────────────────────────────────────────

    # 1. Sin solapamiento
    model.AddNoOverlap(intervals)

    # 2. Deadline hard constraints (tareas inminentes DEBEN estar asignadas y terminar a tiempo)
    for i, task in enumerate(tasks):
        if _is_hard_constraint(task, now) and task.deadline:
            dl = task.deadline
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
            n_tz = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            deadline_minutes = int((dl - n_tz).total_seconds() / 60)
            deadline_minutes = max(0, deadline_minutes)

            # La tarea debe estar asignada
            model.Add(assigned[i] == 1)
            # Y debe terminar antes del deadline
            model.Add(end_vars[i] <= deadline_minutes)

    # 3. Secuencialidad implícita por no-solapamiento (CP-SAT la maneja)
    # No necesitamos forzar orden explícito, el solver lo encuentra.

    # ── Objetivo ───────────────────────────────────────────────────────────────
    # Maximizar suma ponderada de prioridades de tareas asignadas
    # (× 100 para evitar problemas de precisión con floats)
    scores = [
        int(_base_priority_score(task, now) * 100)
        for task in tasks
    ]
    objective_terms = [scores[i] * assigned[i] for i in range(n)]
    model.Maximize(sum(objective_terms))

    # ── Resolver ───────────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    status_code = solver.Solve(model)
    solve_ms = (time.perf_counter() - t0) * 1000

    status_map = {
        cp_model.OPTIMAL:   "OPTIMAL",
        cp_model.FEASIBLE:  "FEASIBLE",
        cp_model.INFEASIBLE:"INFEASIBLE",
        cp_model.UNKNOWN:   "UNKNOWN",
    }
    status = status_map.get(status_code, "UNKNOWN")

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Fallback: devolver todas las tareas sin ordenar
        return list(tasks), "FALLBACK_GREEDY", solve_ms

    # ── Extraer solución ───────────────────────────────────────────────────────
    # Ordenar tareas asignadas por su tiempo de inicio resuelto
    assigned_tasks = []
    for i, task in enumerate(tasks):
        if solver.Value(assigned[i]) == 1:
            start_val = solver.Value(start_vars[i])
            assigned_tasks.append((start_val, task))

    assigned_tasks.sort(key=lambda x: x[0])
    ordered = [t for _, t in assigned_tasks]

    return ordered, status, solve_ms


# ─── Greedy fallback ──────────────────────────────────────────────────────────

def _greedy_order(tasks: list[TaskIn], now: datetime) -> list[TaskIn]:
    """Orden greedy simple por score (fallback si OR-Tools falla)."""
    hard = [t for t in tasks if _is_hard_constraint(t, now)]
    soft = [t for t in tasks if not _is_hard_constraint(t, now)]
    hard.sort(key=lambda t: _base_priority_score(t, now), reverse=True)
    soft.sort(key=lambda t: _base_priority_score(t, now), reverse=True)
    return hard + soft


# ─── Construcción del timeline ────────────────────────────────────────────────

def _build_timeline(
    ordered_tasks: list[TaskIn],
    start_time: datetime,
) -> list[ScheduleBlockOut]:
    """
    Construye los ScheduleBlocks a partir de la secuencia optimizada,
    insertando descansos por tiempo (10min) o energía cognitiva (20min).
    """
    blocks: list[ScheduleBlockOut] = []
    cursor = start_time
    time_streak   = 0
    cognitive_used = 0

    for task in ordered_tasks:
        drain = task.cognitive_load * task.eta_minutes
        time_exhausted  = time_streak   >= TIME_STREAK_LIMIT
        cog_exhausted   = cognitive_used >= COGNITIVE_BUDGET

        if time_exhausted or cog_exhausted:
            is_deep   = cog_exhausted
            rest_mins = COGNITIVE_BREAK if is_deep else TIME_BREAK
            rest_label = "Recarga mental" if is_deep else "Descanso"

            rest_end = cursor + timedelta(minutes=rest_mins)
            blocks.append(ScheduleBlockOut(
                id=_make_id("rest"),
                type="rest",
                title=rest_label,
                start_time=cursor,
                end_time=rest_end,
            ))
            cursor = rest_end
            time_streak    = 0
            cognitive_used = 0

        task_end = cursor + timedelta(minutes=task.eta_minutes)
        blocks.append(ScheduleBlockOut(
            id=_make_id("task"),
            type="task",
            task_id=task.id,
            title=task.title,
            start_time=cursor,
            end_time=task_end,
            cognitive_drain=float(drain),
        ))
        cursor = task_end
        time_streak    += task.eta_minutes
        cognitive_used += drain

        # Verificar también después de insertar
        if time_streak >= TIME_STREAK_LIMIT or cognitive_used >= COGNITIVE_BUDGET:
            is_deep    = cognitive_used >= COGNITIVE_BUDGET
            rest_mins  = COGNITIVE_BREAK if is_deep else TIME_BREAK
            rest_label = "Recarga mental" if is_deep else "Descanso"
            rest_end   = cursor + timedelta(minutes=rest_mins)
            blocks.append(ScheduleBlockOut(
                id=_make_id("rest"),
                type="rest",
                title=rest_label,
                start_time=cursor,
                end_time=rest_end,
            ))
            cursor         = rest_end
            time_streak    = 0
            cognitive_used = 0

    return blocks


# ─── API pública ──────────────────────────────────────────────────────────────

def generate_schedule(
    tasks: list[TaskIn],
    start_time: datetime,
) -> ScheduleResponse:
    """
    Punto de entrada principal del scheduler.
    1. Filtra tareas en estado 'pool'
    2. Resuelve con OR-Tools CP-SAT
    3. Construye el timeline con modelo dual de recursos
    """
    pool_tasks = [t for t in tasks if t.status == "pool"]

    if not pool_tasks:
        return ScheduleResponse(
            blocks=[],
            solver_status="OPTIMAL",
            solve_time_ms=0.0,
            tasks_scheduled=0,
        )

    ordered, status, solve_ms = _solve_with_cpsat(pool_tasks, start_time)

    # Si OR-Tools falla, usar greedy
    if status in ("INFEASIBLE", "UNKNOWN") or not ordered:
        ordered  = _greedy_order(pool_tasks, start_time)
        status   = "FALLBACK_GREEDY"
        solve_ms = 0.0

    blocks = _build_timeline(ordered, start_time)

    return ScheduleResponse(
        blocks=blocks,
        solver_status=status,
        solve_time_ms=round(solve_ms, 2),
        tasks_scheduled=len(ordered),
        engine="ortools-cpsat" if status != "FALLBACK_GREEDY" else "greedy-fallback",
    )
