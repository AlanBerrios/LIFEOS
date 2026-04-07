import * as Notifications from 'expo-notifications';
import type { AppSettings, ScheduleBlock, Task } from '../types';

// ─── Configuración global del handler ─────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

// ─── Primitiva base ───────────────────────────────────────────────────────────

export async function scheduleLocalNotification(
  title: string,
  body: string,
  secondsFromNow: number
): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  if (secondsFromNow <= 0) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, priority: Notifications.AndroidNotificationPriority.HIGH },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.floor(secondsFromNow))
    }
  });
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Notificaciones de inicio de tarea ───────────────────────────────────────

/**
 * Programa notificaciones de inicio para cada bloque de tarea del timeline.
 * Se llama automáticamente al generar el timeline.
 */
export async function scheduleTaskNotifications(
  timeline: ScheduleBlock[],
  tasks: Task[],
  leadMinutes: number
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancelar notificaciones previas de tareas
  await cancelAllNotifications();

  const now = Date.now();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const block of timeline) {
    if (block.type !== 'task' || !block.task_id) continue;
    const task = taskMap.get(block.task_id);
    const notifyAt = block.start_time.getTime() - leadMinutes * 60_000;
    const secondsFromNow = (notifyAt - now) / 1000;

    if (secondsFromNow <= 0) continue; // ya pasó

    const priorityLabel = task?.priority >= 4 ? '🔴 IMPORTANTE — ' : '';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${priorityLabel}Tarea programada`,
        body: `En ${leadMinutes} min: ${block.title}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.floor(secondsFromNow))
      }
    });
  }
}

/**
 * Programa un recordatorio periódico de tareas pendientes.
 * @param intervalMinutes — 0 para desactivar
 */
export async function schedulePendingReminder(
  intervalMinutes: number,
  pendingCount: number
): Promise<void> {
  if (intervalMinutes <= 0 || pendingCount === 0) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Tareas pendientes',
      body: `Tienes ${pendingCount} tarea${pendingCount > 1 ? 's' : ''} sin completar hoy.`,
      sound: false
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalMinutes * 60,
      repeats: true
    }
  });
}

/**
 * Alerta de tarea importante sin completar pasada cierta hora.
 */
export async function scheduleImportantTaskAlert(taskTitle: string): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Notificar a las 21:00 del día si hay tarea de alta prioridad sin completar
  const alertTime = new Date();
  alertTime.setHours(21, 0, 0, 0);
  const secondsFromNow = (alertTime.getTime() - Date.now()) / 1000;
  if (secondsFromNow <= 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Tarea importante pendiente',
      body: `"${taskTitle}" aún no fue completada hoy.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.floor(secondsFromNow)
    }
  });
}
