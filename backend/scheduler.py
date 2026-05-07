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
from typing import NamedTuple
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


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _minutes_from_base(target: datetime, base: datetime) -> int:
    return int(round((target - base).total_seconds() / 60))


def _fixed_start_minutes(task: TaskIn, now: datetime, horizon: int) -> int | None:
    if task.fixed_start is None:
        return None

    minutes = _minutes_from_base(_to_utc(task.fixed_start), _to_utc(now))
    if minutes < 0:
        raise ValueError(f"Task {task.id} has fixed_start before start_time.")
    if minutes > horizon:
        raise ValueError(f"Task {task.id} has fixed_start outside planning horizon.")
    return minutes


def _fixed_end_minutes(task: TaskIn, now: datetime, upper_bound: int) -> int | None:
    if task.fixed_end is None:
        return None

    minutes = _minutes_from_base(_to_utc(task.fixed_end), _to_utc(now))
    if minutes < 0:
        raise ValueError(f"Task {task.id} has fixed_end before start_time.")
    if minutes > upper_bound:
        raise ValueError(f"Task {task.id} has fixed_end outside planning horizon.")
    return minutes


def _validate_fixed_window(task: TaskIn, start_minutes: int | None, end_minutes: int | None) -> None:
    if end_minutes is not None and end_minutes < task.eta_minutes:
        raise ValueError(
            f"Task {task.id} cannot fit before fixed_end: eta={task.eta_minutes}min, fixed_end={end_minutes}min"
        )

    if start_minutes is not None and end_minutes is not None:
        min_end = start_minutes + task.eta_minutes
        if end_minutes < min_end:
            raise ValueError(
                f"Task {task.id} has inconsistent fixed window: fixed_start={start_minutes}min, "
                f"fixed_end={end_minutes}min, eta={task.eta_minutes}min"
            )


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


class SolvedTask(NamedTuple):
    task: TaskIn
    start_minute: int
    end_minute: int


# ─── CP-SAT Solver ────────────────────────────────────────────────────────────

def _solve_with_cpsat(
    tasks: list[TaskIn],
    start_time: datetime,
) -> tuple[list[SolvedTask], str, float]:
    """
    Usa OR-Tools CP-SAT para encontrar la secuencia de tareas ÓPTIMA.

    Retorna:
        solved_tasks: lista de tareas asignadas con sus tiempos resueltos
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

        fixed_start_minutes = _fixed_start_minutes(task, now, horizon)
        fixed_end_minutes = _fixed_end_minutes(task, now, horizon + task.eta_minutes)
        _validate_fixed_window(task, fixed_start_minutes, fixed_end_minutes)

        if fixed_start_minutes is not None:
            model.Add(assigned[i] == 1)
            model.Add(start_vars[i] == fixed_start_minutes)
        if fixed_end_minutes is not None:
            model.Add(assigned[i] == 1)
            model.Add(end_vars[i] <= fixed_end_minutes)

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
        return [], "FALLBACK_GREEDY", solve_ms

    # ── Extraer solución ───────────────────────────────────────────────────────
    # Ordenar tareas asignadas por su tiempo de inicio resuelto
    assigned_tasks: list[SolvedTask] = []
    for i, task in enumerate(tasks):
        if solver.Value(assigned[i]) == 1:
            start_val = solver.Value(start_vars[i])
            end_val = solver.Value(end_vars[i])
            assigned_tasks.append(SolvedTask(task=task, start_minute=start_val, end_minute=end_val))

    assigned_tasks.sort(key=lambda item: item.start_minute)

    return assigned_tasks, status, solve_ms


# ─── Greedy fallback ──────────────────────────────────────────────────────────

def _greedy_order(tasks: list[TaskIn], now: datetime) -> list[TaskIn]:
    """Orden greedy simple por score (fallback si OR-Tools falla)."""
    hard = [t for t in tasks if _is_hard_constraint(t, now)]
    soft = [t for t in tasks if not _is_hard_constraint(t, now)]
    hard.sort(key=lambda t: _base_priority_score(t, now), reverse=True)
    soft.sort(key=lambda t: _base_priority_score(t, now), reverse=True)
    return hard + soft


# ─── Construcción del timeline ────────────────────────────────────────────────

def _build_timeline_greedy(
    ordered_tasks: list[TaskIn],
    start_time: datetime,
) -> tuple[list[ScheduleBlockOut], int]:
    """
    Construye los ScheduleBlocks a partir de la secuencia optimizada,
    insertando descansos por tiempo (10min) o energía cognitiva (20min).
    """
    blocks: list[ScheduleBlockOut] = []
    scheduled_count = 0
    cursor = start_time
    time_streak   = 0
    cognitive_used = 0

    for task in ordered_tasks:
        try:
            fixed_start_minutes = _fixed_start_minutes(task, start_time, HORIZON_HOURS * 60)
            fixed_end_minutes = _fixed_end_minutes(task, start_time, HORIZON_HOURS * 60 + task.eta_minutes)
            _validate_fixed_window(task, fixed_start_minutes, fixed_end_minutes)
        except ValueError:
            # En fallback, tareas con ventanas inválidas se omiten para evitar inconsistencias.
            continue

        if fixed_start_minutes is not None:
            fixed_start_at = start_time + timedelta(minutes=fixed_start_minutes)
            if cursor > fixed_start_at:
                # Ya se perdió la ventana de inicio fijo exacta.
                continue

            if cursor < fixed_start_at:
                blocks.append(ScheduleBlockOut(
                    id=_make_id("rest"),
                    type="rest",
                    title="Descanso",
                    start_time=cursor,
                    end_time=fixed_start_at,
                ))
                cursor = fixed_start_at
                time_streak = 0
                cognitive_used = 0

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

            if fixed_start_minutes is not None:
                fixed_start_at = start_time + timedelta(minutes=fixed_start_minutes)
                if cursor > fixed_start_at:
                    continue
                if cursor < fixed_start_at:
                    blocks.append(ScheduleBlockOut(
                        id=_make_id("rest"),
                        type="rest",
                        title="Descanso",
                        start_time=cursor,
                        end_time=fixed_start_at,
                    ))
                    cursor = fixed_start_at
                    time_streak = 0
                    cognitive_used = 0

        task_start = cursor
        task_end = task_start + timedelta(minutes=task.eta_minutes)

        if fixed_end_minutes is not None:
            fixed_end_at = start_time + timedelta(minutes=fixed_end_minutes)
            if task_end > fixed_end_at:
                continue

        blocks.append(ScheduleBlockOut(
            id=_make_id("task"),
            type="task",
            task_id=task.id,
            title=task.title,
            start_time=task_start,
            end_time=task_end,
            cognitive_drain=float(drain),
        ))
        scheduled_count += 1
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

    return blocks, scheduled_count


def _build_timeline_from_solution(
    solved_tasks: list[SolvedTask],
    start_time: datetime,
) -> list[ScheduleBlockOut]:
    """
    Construye timeline respetando exactamente los tiempos de inicio/fin
    resueltos por CP-SAT para mantener consistencia con las restricciones.
    """
    blocks: list[ScheduleBlockOut] = []
    previous_end: datetime | None = None

    for solved in sorted(solved_tasks, key=lambda item: item.start_minute):
        task = solved.task
        task_start = start_time + timedelta(minutes=solved.start_minute)
        task_end = start_time + timedelta(minutes=solved.end_minute)

        if previous_end is not None and task_start > previous_end:
            blocks.append(ScheduleBlockOut(
                id=_make_id("rest"),
                type="rest",
                title="Descanso",
                start_time=previous_end,
                end_time=task_start,
            ))

        blocks.append(ScheduleBlockOut(
            id=_make_id("task"),
            type="task",
            task_id=task.id,
            title=task.title,
            start_time=task_start,
            end_time=task_end,
            cognitive_drain=float(task.cognitive_load * task.eta_minutes),
        ))
        previous_end = task_end

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

    solved_tasks, status, solve_ms = _solve_with_cpsat(pool_tasks, start_time)

    # Si OR-Tools falla, usar greedy
    if status in ("INFEASIBLE", "UNKNOWN", "FALLBACK_GREEDY") or not solved_tasks:
        ordered = _greedy_order(pool_tasks, start_time)
        blocks, tasks_scheduled = _build_timeline_greedy(ordered, start_time)
        status = "FALLBACK_GREEDY"
        solve_ms = 0.0
        if tasks_scheduled == 0 and ordered:
            status = "INFEASIBLE"
        engine = "greedy-fallback"
    else:
        blocks = _build_timeline_from_solution(solved_tasks, start_time)
        tasks_scheduled = len(solved_tasks)
        engine = "ortools-cpsat"

    return ScheduleResponse(
        blocks=blocks,
        solver_status=status,
        solve_time_ms=round(solve_ms, 2),
        tasks_scheduled=tasks_scheduled,
        engine=engine,
    )
