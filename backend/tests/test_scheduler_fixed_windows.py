from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from models import TaskIn
from scheduler import generate_schedule


class SchedulerFixedWindowsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.start = datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc)

    def _task(self, **overrides) -> TaskIn:
        payload = {
            "id": "task-1",
            "title": "Tarea fija",
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

    def test_respects_fixed_start(self) -> None:
        fixed_start = self.start + timedelta(minutes=75)
        task = self._task(id="task-fixed-start", fixed_start=fixed_start)

        response = generate_schedule([task], self.start)
        task_block = next(block for block in response.blocks if block.task_id == task.id)

        self.assertEqual(task_block.start_time, fixed_start)

    def test_respects_fixed_end(self) -> None:
        fixed_end = self.start + timedelta(minutes=120)
        task = self._task(id="task-fixed-end", eta_minutes=40, fixed_end=fixed_end)

        response = generate_schedule([task], self.start)
        task_block = next(block for block in response.blocks if block.task_id == task.id)

        self.assertLessEqual(task_block.end_time, fixed_end)

    def test_invalid_fixed_window_raises(self) -> None:
        fixed_start = self.start + timedelta(minutes=90)
        fixed_end = self.start + timedelta(minutes=100)
        task = self._task(id="task-invalid-window", eta_minutes=30, fixed_start=fixed_start, fixed_end=fixed_end)

        with self.assertRaises(ValueError):
            generate_schedule([task], self.start)


if __name__ == "__main__":
    unittest.main()
