import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppSettings, ScheduleBlock, Task } from '../types';

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
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Notificaciones de inicio de tarea ───────────────────────────────────────

export async function scheduleTaskNotifications(
  timeline: ScheduleBlock[],
  tasks: Task[],
  leadMinutes: number
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelAllNotifications();

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
        date: notifyAt,
        exact: true, // Requerido para puntualidad en Android
        channelId: 'default'
      } as any // Force any due to complex TriggerInput union
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

  // Clear everything first to ensure a clean sync state
  await cancelAllNotifications();
  
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
