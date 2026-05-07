from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException

from main import health, replan, schedule
from models import CONTRACT_VERSION, ReplanRequest, ScheduleBlockOut, ScheduleRequest, ScheduleResponse, TaskIn


class ApiEndpointsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.start = datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc)

    def _task(self, **overrides) -> TaskIn:
        payload = {
            "id": "task-1",
            "title": "Tarea",
            "description": None,
            "eta_minutes": 30,
            "priority": 4,
            "cognitive_load": 5,
            "deadline": None,
            "fixed_start": None,
            "fixed_end": None,
            "urgency": "today",
            "status": "pool",
            "created_at": self.start,
        }
        payload.update(overrides)
        return TaskIn(**payload)

    def test_health_endpoint(self) -> None:
        body = health()
        self.assertEqual(body["status"], "ok")
        self.assertIn("engine", body)
        self.assertIn("environment", body)

    def test_schedule_normal_case(self) -> None:
        request = ScheduleRequest(
            contract_version=CONTRACT_VERSION,
            start_time=self.start,
            tasks=[
                self._task(id="task-a", title="A"),
                self._task(id="task-b", title="B", priority=3, urgency="this_week"),
            ],
        )

        response = schedule(request)
        self.assertIn(response.solver_status, ["OPTIMAL", "FEASIBLE", "FALLBACK_GREEDY"])
        self.assertGreaterEqual(response.tasks_scheduled, 1)
        self.assertGreaterEqual(len(response.blocks), 1)

    def test_schedule_fixed_window_case(self) -> None:
        fixed_start = self.start + timedelta(minutes=60)
        request = ScheduleRequest(
            contract_version=CONTRACT_VERSION,
            start_time=self.start,
            tasks=[
                self._task(
                    id="fixed-task",
                    fixed_start=fixed_start,
                    eta_minutes=30,
                )
            ],
        )

        response = schedule(request)
        task_block = next(block for block in response.blocks if block.task_id == "fixed-task")
        self.assertEqual(task_block.start_time, fixed_start)

    def test_schedule_conflicting_window_case(self) -> None:
        request = ScheduleRequest(
            contract_version=CONTRACT_VERSION,
            start_time=self.start,
            tasks=[
                self._task(
                    id="conflict-task",
                    eta_minutes=30,
                    fixed_start=self.start + timedelta(minutes=90),
                    fixed_end=self.start + timedelta(minutes=100),
                )
            ],
        )

        with self.assertRaises(HTTPException) as ctx:
            schedule(request)

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("fixed", str(ctx.exception.detail).lower())

    def test_schedule_fallback_case(self) -> None:
        fallback_response = ScheduleResponse(
            blocks=[
                ScheduleBlockOut(
                    id="rest-1",
                    type="rest",
                    title="Descanso",
                    start_time=self.start,
                    end_time=self.start + timedelta(minutes=10),
                )
            ],
            solver_status="FALLBACK_GREEDY",
            solve_time_ms=0.0,
            tasks_scheduled=0,
            engine="greedy-fallback",
        )

        with patch("main.generate_schedule", return_value=fallback_response) as mocked_generate:
            response = schedule(
                ScheduleRequest(
                    contract_version=CONTRACT_VERSION,
                    start_time=self.start,
                    tasks=[self._task(id="fallback-task")],
                )
            )

        self.assertEqual(response.solver_status, "FALLBACK_GREEDY")
        self.assertEqual(response.engine, "greedy-fallback")
        mocked_generate.assert_called_once()

    def test_replan_filters_completed_and_normalizes_to_pool(self) -> None:
        captured = {}

        def fake_generate_schedule(tasks, start_time):
            captured["tasks"] = tasks
            captured["start_time"] = start_time
            return ScheduleResponse(
                blocks=[],
                solver_status="OPTIMAL",
                solve_time_ms=1.0,
                tasks_scheduled=0,
                engine="ortools-cpsat",
            )

        request = ReplanRequest(
            contract_version=CONTRACT_VERSION,
            completed_task_ids=["task-completed"],
            failed_task_id="task-completed",
            failed_task_reason="blocked",
            remaining_tasks=[
                self._task(id="task-completed", status="completed"),
                self._task(id="task-scheduled", status="scheduled", urgency="this_week"),
            ],
            start_time=self.start,
        )

        with patch("main.generate_schedule", side_effect=fake_generate_schedule):
            replan(request)

        self.assertIn("tasks", captured)
        self.assertEqual(len(captured["tasks"]), 1)
        self.assertEqual(captured["tasks"][0].id, "task-scheduled")
        self.assertEqual(captured["tasks"][0].status, "pool")


if __name__ == "__main__":
    unittest.main()
