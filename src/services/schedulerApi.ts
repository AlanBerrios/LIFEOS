/**
 * LifeOS — Scheduler API client
 *
 * Llama al backend Python (FastAPI + OR-Tools).
 * Si el backend no está disponible lanza un SchedulerApiError
 * para que el store pueda hacer fallback al scheduler local.
 */

import { BACKEND_URL, API_TIMEOUT_MS } from '../config';
import type { ScheduleBlock, Task } from '../types';

export const SCHEDULER_CONTRACT_VERSION = '1.0.0';

// ─── Tipos del response del backend ──────────────────────────────────────────

interface BackendBlock {
  id: string;
    type: 'task' | 'rest' | 'meal' | 'sleep' | 'transit';
  task_id?: string;
  title: string;
  start_time: string;   // ISO string
  end_time: string;     // ISO string
  cognitive_drain?: number;
  pinned?: boolean;
  isStaticEvent?: boolean;
}

export interface ScheduleApiResponse {
  contract_version: string;
  blocks: BackendBlock[];
  solver_status: string;
  solve_time_ms: number;
  tasks_scheduled: number;
  engine: string;
}

interface ReplanRequestPayload {
  contract_version: string;
  completed_task_ids: string[];
  failed_task_id?: string;
  failed_task_reason?: string;
  remaining_tasks: Array<Record<string, unknown>>;
  start_time: string;
}

// ─── Error tipado ─────────────────────────────────────────────────────────────

export class SchedulerApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerApiError';
  }
}

// ─── Fetch con timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Conversión backend → tipos internos ──────────────────────────────────────

function parseBlock(raw: BackendBlock): ScheduleBlock {
  return {
    id: raw.id,
    type: raw.type,
    task_id: raw.task_id,
    title: raw.title,
    start_time: new Date(raw.start_time),
    end_time: new Date(raw.end_time),
    cognitive_drain: raw.cognitive_drain,
    pinned: raw.pinned,
    isStaticEvent: raw.isStaticEvent
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Llama al endpoint /schedule del backend Python.
 * Devuelve los ScheduleBlocks con fechas ya convertidas a Date.
 * Lanza SchedulerApiError si el backend no está disponible o responde con error.
 */
export async function callSchedulerApi(
  tasks: Task[],
  startTime: Date
): Promise<{ blocks: ScheduleBlock[]; meta: Omit<ScheduleApiResponse, 'blocks'> }> {
  const body = {
    contract_version: SCHEDULER_CONTRACT_VERSION,
    tasks: tasks.map((t) => ({
      ...t,
      created_at: t.created_at.toISOString(),
      deadline: t.deadline ? t.deadline.toISOString() : null,
      fixed_start: t.fixed_start ? t.fixed_start.toISOString() : null,
      fixed_end: t.fixed_end ? t.fixed_end.toISOString() : null
    })),
    start_time: startTime.toISOString()
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${BACKEND_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new SchedulerApiError(
      err instanceof Error && err.name === 'AbortError'
        ? 'Backend timeout'
        : 'Backend unreachable'
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new SchedulerApiError(`Backend error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ScheduleApiResponse;
  const blocks = data.blocks.map(parseBlock);
  const { blocks: _ignored, ...meta } = data;

  return { blocks, meta };
}

/**
 * Llama al endpoint /replan del backend para recalcular el resto del dia.
 * Si falla, el caller puede hacer fallback a /schedule o al scheduler local.
 */
export async function callReplanApi(
  tasks: Task[],
  startTime: Date,
  completedTaskIds: string[],
  failedTaskId?: string,
  failedTaskReason?: string
): Promise<{ blocks: ScheduleBlock[]; meta: Omit<ScheduleApiResponse, 'blocks'> }> {
  const payload: ReplanRequestPayload = {
    contract_version: SCHEDULER_CONTRACT_VERSION,
    completed_task_ids: completedTaskIds,
    failed_task_id: failedTaskId,
    failed_task_reason: failedTaskReason,
    remaining_tasks: tasks.map((t) => ({
      ...t,
      created_at: t.created_at.toISOString(),
      deadline: t.deadline ? t.deadline.toISOString() : null,
      fixed_start: t.fixed_start ? t.fixed_start.toISOString() : null,
      fixed_end: t.fixed_end ? t.fixed_end.toISOString() : null
    })),
    start_time: startTime.toISOString()
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${BACKEND_URL}/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    throw new SchedulerApiError(
      err instanceof Error && err.name === 'AbortError'
        ? 'Backend timeout'
        : 'Backend unreachable'
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new SchedulerApiError(`Backend error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ScheduleApiResponse;
  const blocks = data.blocks.map(parseBlock);
  const { blocks: _ignored, ...meta } = data;

  return { blocks, meta };
}

/**
 * Hace un ping al backend para saber si está disponible.
 */
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BACKEND_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
