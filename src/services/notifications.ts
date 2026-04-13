import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Alarm, AppSettings, ScheduleBlock, Task } from '../types';

export const NOTIFICATION_PERMISSION_ERROR = 'NOTIFICATION_PERMISSION_DENIED';

export const NOTIFICATION_TEST_TYPES = [
  'task_start',
  'pending',
  'important',
  'distraction',
  'completion_check',
  'alarm',
  'routine_sleep',
  'routine_meal',
  'event',
  'note'
] as const;

export type NotificationTestType = (typeof NOTIFICATION_TEST_TYPES)[number];

// ─── Init (call once from _layout) ───────────────────────────────────────────

export function initNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });

  Notifications.setNotificationCategoryAsync('distraction_alert', [
    {
      identifier: 'snooze',
      buttonTitle: '⏳ Dame 5 min',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'start_task',
      buttonTitle: '✅ Iniciar Tarea',
      options: { opensAppToForeground: true }
    }
  ]);

  Notifications.setNotificationCategoryAsync('completion_check', [
    {
      identifier: 'done',
      buttonTitle: '✅ Hecho',
      options: { opensAppToForeground: true }
    },
    {
      identifier: 'postpone',
      buttonTitle: '⏳ Posponer',
      options: { opensAppToForeground: true }
    },
    {
      identifier: 'skip',
      buttonTitle: '⏭️ Saltar',
      options: { opensAppToForeground: true }
    }
  ]);

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'LifeOS Alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b5cf6',
      sound: 'default',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM, // Bypasses Silent/DND if configured properly!
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });
  }
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  initNotifications();
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
  if (!granted || secondsFromNow <= 0) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.floor(secondsFromNow))
    }
  });
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Ignore stale IDs that are no longer scheduled.
  }
}

export async function cancelNotificationsByIds(ids: string[] = []): Promise<void> {
  for (const id of ids) {
    await cancelNotification(id);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function dateAfterSeconds(seconds: number): Date {
  const date = new Date();
  date.setSeconds(date.getSeconds() + Math.max(1, seconds));
  return date;
}

export async function triggerNotificationTest(type: NotificationTestType): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const triggerDate = dateAfterSeconds(3);

  const payloadByType: Record<NotificationTestType, Notifications.NotificationRequestInput['content']> = {
    task_start: {
      title: '📌 Test: Tarea programada',
      body: 'En 5 min: Revisar agenda del día.',
      sound: true
    },
    pending: {
      title: '📋 Test: Pendientes',
      body: 'Tienes 3 tareas sin completar.',
      sound: true
    },
    important: {
      title: '⚠️ Test: Tarea importante pendiente',
      body: '"Enviar reporte" sigue pendiente hoy.',
      sound: true
    },
    distraction: {
      title: '👀 Test: Fuga de atención',
      body: 'Llevas 5 min fuera de la app. ¿Retomamos?',
      sound: true,
      categoryIdentifier: 'distraction_alert'
    },
    completion_check: {
      title: '🤔 Test: Completion Check',
      body: 'Terminó el bloque de "Deep Work". ¿Lo completaste?',
      sound: true,
      categoryIdentifier: 'completion_check',
      data: { type: 'completion_check', taskId: 'test-task', blockId: 'test-block' }
    },
    alarm: {
      title: '⏰ Test: Alarma',
      body: 'Esta es una alarma de prueba.',
      sound: true
    },
    routine_sleep: {
      title: '🌙 Test: Rutina sueño',
      body: 'Hora de empezar la desconexión para dormir.',
      sound: true
    },
    routine_meal: {
      title: '🍴 Test: Rutina comida',
      body: 'Bloque de comida de 45 min.',
      sound: true
    },
    event: {
      title: '📌 Test: Evento',
      body: 'Evento de prueba inicia en breve.',
      sound: true,
      data: { type: 'event', id: 'test-event' }
    },
    note: {
      title: '📝 Test: Nota',
      body: 'Recordatorio de nota de prueba.',
      sound: true,
      data: { type: 'note', id: 'test-note' }
    }
  };

  return Notifications.scheduleNotificationAsync({
    content: payloadByType[type],
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'default'
    }
  });
}

// ─── Notificaciones de inicio de tarea ───────────────────────────────────────

export async function scheduleTaskNotifications(
  timeline: ScheduleBlock[],
  tasks: Task[],
  leadMinutes: number
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = Date.now();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const block of timeline) {
    if (block.type !== 'task' || !block.task_id) continue;
    const task = taskMap.get(block.task_id);
    const notifyAt = block.start_time.getTime() - leadMinutes * 60_000;
    const secondsFromNow = (notifyAt - now) / 1000;
    if (secondsFromNow <= 0) continue;

    const isImportant = (task?.priority ?? 0) >= 4;
    
    // Usar Date trigger para precisión absoluta
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isImportant ? '🔴 Tarea importante' : '📌 Tarea programada',
        body: `En ${leadMinutes} min: ${block.title}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notifyAt,
        channelId: 'default'
      }
    });
  }
}

// ─── Recordatorio periódico ───────────────────────────────────────────────────

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
      body: `Tienes ${pendingCount} tarea${pendingCount > 1 ? 's' : ''} sin completar.`,
      sound: false
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalMinutes * 60,
      repeats: true
    }
  });
}

// ─── Alerta tarea importante ──────────────────────────────────────────────────

export async function scheduleImportantTaskAlert(taskTitle: string): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const alertTime = new Date();
  alertTime.setHours(21, 0, 0, 0);
  const secondsFromNow = (alertTime.getTime() - Date.now()) / 1000;
  if (secondsFromNow <= 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Tarea importante pendiente',
      body: `"${taskTitle}" aún no fue completada hoy.`,
      sound: true
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.floor(secondsFromNow)
    }
  });
}

// ─── Distracciones y Fugas de atención ───────────────────────────────────────

export async function scheduleDistractionWarning(
  taskTitle: string,
  timeoutMinutes: number
): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: '👀 Fuga de atención detectada',
      body: `Llevas ${timeoutMinutes} min fuera. ¿Te distrajiste? Tienes que terminar: ${taskTitle}`,
      sound: true,
      categoryIdentifier: 'distraction_alert'
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: timeoutMinutes * 60
    }
  });
}

// ─── Alarmas Tipo Samsung ─────────────────────────────────────────────────────

export async function scheduleAlarm(
  timeStr: string, // "HH:mm"
  label: string,
  days: number[] // 0-6
): Promise<string[]> {
  const granted = await requestNotificationPermission();
  if (!granted) return [];

  const [hours, minutes] = timeStr.split(':').map(Number);
  const notificationIds: string[] = [];

  for (const day of days) {
    // day + 1 because expo-notifications weekday matches Date's getDay() + 1
    // Sunday in JS Date is 0, in Expo weekday is 1.
    const expoWeekday = day + 1;
    
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${label || 'Alarma'}`,
        body: '¡Es hora!',
        sound: true, // Requires custom sound config in app.json for true alarm feel
        vibrate: [0, 500, 1000, 500, 1000] // Custom vibration pattern
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour: hours,
        minute: minutes
      }
    });
    notificationIds.push(id);
  }

  return notificationIds;
}

export async function syncRoutineAlarms(routines: import('../types').DailyRoutine[]) {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  
  // Just schedule the next 7 days statically for simplicity, or use WEEKLY.
  for (const routine of routines) {
    const expoWeekday = routine.dayOfWeek + 1; // 1-7 (Sun=1)
    
    // 🛌 Sleep Notification
    const [sH, sM] = routine.sleepStart.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
       content: { 
         title: '🌙 Preparación para el sueño', 
         body: 'Es hora de empezar a desconectar para descansar bien.', 
         sound: true 
       },
       trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday, hour: sH, minute: sM }
    });

    // 🍽️ Meal Notifications
    for (const meal of routine.meals) {
      if (!meal.time) continue;
      const [mH, mM] = meal.time.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
         content: { 
           title: `🍴 Momento de: ${meal.type}`, 
           body: `Bloque de comida de ${meal.durationMinutes} min. ¡Aprovecha el descanso!`, 
           sound: true 
         },
         trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday, hour: mH, minute: mM }
      });
    }
  }
}

// ─── Alarmas guardadas por el usuario ────────────────────────────────────────

export async function syncSavedAlarms(alarms: Alarm[]): Promise<Alarm[]> {
  const granted = await requestNotificationPermission();
  if (!granted) return alarms;

  const syncedAlarms: Alarm[] = [];

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      syncedAlarms.push({ ...alarm, notificationIds: [] });
      continue;
    }

    const notificationIds = await scheduleAlarm(alarm.time, alarm.label, alarm.days);
    syncedAlarms.push({ ...alarm, notificationIds });
  }

  return syncedAlarms;
}

// ─── Coordinador Central ──────────────────────────────────────────────────────

export async function rescheduleAll(
  timeline: ScheduleBlock[],
  tasks: Task[],
  settings: AppSettings,
  routines: import('../types').DailyRoutine[],
  events: import('../types').StaticEvent[],
  notes: import('../types').QuickNote[],
  alarms: Alarm[] = []
): Promise<Alarm[]> {
  const granted = await requestNotificationPermission();
  if (!granted) return alarms;

  // Paso 1: Limpiar todo
  await cancelAllNotifications();

  // Paso 2: Programar tareas (si habilitado)
  if (settings.notifyTaskStart) {
    await scheduleTaskNotifications(timeline, tasks, settings.notifyTaskStartLeadMinutes);
  }

  // Paso 3: Programar rutinas (comidas y sueño)
  await syncRoutineAlarms(routines);

  // Paso 4: Programar verificaciones de cumplimiento (Tarea 2 de la visión)
  await scheduleCompletionChecks(timeline);

  // Paso 5: Programar eventos estáticos
  await scheduleEventNotifications(events);

  // Paso 6: Programar recordatorios de notas
  await scheduleNoteReminders(notes);

  // Paso 7: Reprogramar alarmas guardadas del usuario y devolver IDs frescos
  return syncSavedAlarms(alarms);
}

// ─── Verificación de cumplimiento ───────────────────────────────────────────

export async function scheduleCompletionChecks(timeline: ScheduleBlock[]): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = Date.now();
  for (const block of timeline) {
    if (block.type !== 'task' || !block.task_id) continue;
    
    // Programar 1 minuto después del fin del bloque
    const notifyAt = block.end_time.getTime() + 60_000;
    if (notifyAt <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🤔 ¿Cómo vas con tu plan?',
        body: `Terminó el tiempo de: ${block.title}. ¿Lo lograste terminar?`,
        data: { type: 'completion_check', taskId: block.task_id, blockId: block.id },
        categoryIdentifier: 'completion_check',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notifyAt
      },
    });
  }
}

// ─── Eventos y Notas ─────────────────────────────────────────────────────────

export async function scheduleEventNotifications(events: import('../types').StaticEvent[]): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = Date.now();
  for (const event of events) {
    const triggerTime = event.startTime.getTime() - (event.reminderMinutes || 0) * 60000;
    if (triggerTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📌 Evento: ${event.title}`,
          body: `Comienza a las ${event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          data: { type: 'event', id: event.id },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime
        },
      });
    }
  }
}

export async function scheduleNoteReminders(notes: import('../types').QuickNote[]): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const now = Date.now();
  for (const note of notes) {
    if (note.reminderAt) {
      const trigger = new Date();

      if (note.reminderAt.includes('T')) {
        const parsed = new Date(note.reminderAt);
        if (Number.isNaN(parsed.getTime())) continue;
        trigger.setTime(parsed.getTime());
      } else {
        const [h, m] = note.reminderAt.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        trigger.setHours(h, m, 0, 0);
      }
      
      if (trigger.getTime() <= now) {
        trigger.setDate(trigger.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📝 Nota: ${note.title || 'Recordatorio'}`,
          body: note.content,
          data: { type: 'note', id: note.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger
        },
      });
    }
  }
}
