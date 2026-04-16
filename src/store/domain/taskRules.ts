import { createId } from '../../utils/ids';
import { toDate } from '../../utils/date';
import type { Task } from '../../types';
import type { TaskDraft, TaskUpdate } from '../lifeStore.types';

function cleanText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function clampEtaMinutes(value: number): number {
  return Math.max(5, Math.round(value));
}

export function clampCognitiveLoad(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function createTaskFromDraft(draft: TaskDraft): Task {
  return {
    id: createId('task'),
    title: draft.title.trim(),
    description: cleanText(draft.description),
    emoji: cleanText(draft.emoji),
    color: cleanText(draft.color),
    eta_minutes: clampEtaMinutes(draft.eta_minutes),
    priority: draft.priority,
    cognitive_load: clampCognitiveLoad(draft.cognitive_load),
    deadline: toDate(draft.deadline),
    fixed_start: toDate(draft.fixed_start),
    fixed_end: toDate(draft.fixed_end),
    urgency: draft.urgency,
    status: 'pool',
    created_at: new Date()
  };
}

export function applyTaskUpdate(task: Task, updates: TaskUpdate): Task {
  return {
    ...task,
    title: updates.title?.trim() ?? task.title,
    description:
      updates.description === undefined
        ? task.description
        : cleanText(updates.description),
    emoji:
      updates.emoji === undefined
        ? task.emoji
        : cleanText(updates.emoji),
    color:
      updates.color === undefined
        ? task.color
        : cleanText(updates.color),
    eta_minutes:
      updates.eta_minutes === undefined
        ? task.eta_minutes
        : clampEtaMinutes(updates.eta_minutes),
    priority: updates.priority ?? task.priority,
    cognitive_load:
      updates.cognitive_load === undefined
        ? task.cognitive_load
        : clampCognitiveLoad(updates.cognitive_load),
    deadline:
      updates.deadline === undefined ? task.deadline : toDate(updates.deadline),
    fixed_start:
      updates.fixed_start === undefined ? task.fixed_start : toDate(updates.fixed_start),
    fixed_end:
      updates.fixed_end === undefined ? task.fixed_end : toDate(updates.fixed_end),
    urgency: updates.urgency ?? task.urgency,
    status: updates.status ?? task.status
  };
}

export function setTaskStatus(tasks: Task[], id: string, status: Task['status']): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

export function removeTaskBlocksById<T extends { task_id?: string }>(blocks: T[], taskId: string): T[] {
  return blocks.filter((block) => block.task_id !== taskId);
}

export function computeTaskFocusXp(task: Task): number {
  return (task.priority * 10) + (task.cognitive_load * 2);
}
