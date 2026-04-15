import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { AppState } from 'react-native';
import { useLifeStore } from '../src/store/useLifeStore';
import {
  initNotifications,
  scheduleRandomHabitReminder,
  requestNotificationPermission,
  type NotificationPayloadData
} from '../src/services/notifications';
import { checkGeofenceState } from '../src/services/location';
import { checkScreenTimeDistraction, registerScreenTimeBackgroundTask } from '../src/services/screenTime';
import { useAppTheme } from '../src/theme';
import AppLoadingSplash from '../src/components/AppLoadingSplash';
import { DailyStartPrompt } from '../src/components/DailyStartPrompt';
import { RestDayPrompt } from '../src/components/RestDayPrompt';
import { useDailyStart } from '../src/hooks/useDailyStart';

try {
  initNotifications();
} catch (e) {
  console.log('Error initNotifications:', e);
}

export default function RootLayout(): ReactElement {
  const [isBooting, setIsBooting] = useState(true);
  const [showDailyPrompt, setShowDailyPrompt] = useState(false);
  const [showRestDayPrompt, setShowRestDayPrompt] = useState(false);
  const theme = useAppTheme();
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const router = useRouter();
  const { shouldShowPrompt, dismissPrompt } = useDailyStart();
  const markRestDay = useLifeStore((s) => s.markRestDay);

  useEffect(() => {
    let mounted = true;
    const processedActionKeys = new Set<string>();

    const getTaskIdFromData = (data: NotificationPayloadData): string | undefined => {
      const directTaskId = typeof data.taskId === 'string' ? data.taskId : undefined;
      if (directTaskId) return directTaskId;

      const legacyTaskId = typeof data.task_id === 'string' ? data.task_id : undefined;
      if (legacyTaskId) return legacyTaskId;

      const blockId = typeof data.blockId === 'string' ? data.blockId : undefined;
      if (!blockId) return undefined;

      const block = useLifeStore.getState().timeline.find((item) => item.id === blockId);
      return block?.task_id;
    };

    const processNotificationResponse = async (
      Notifications: typeof import('expo-notifications'),
      resp: import('expo-notifications').NotificationResponse | null
    ) => {
      if (!resp) return;

      const actionId = resp.actionIdentifier;
      if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) return;

      const requestId = resp.notification.request.identifier;
      const actionKey = `${requestId}:${actionId}`;
      if (processedActionKeys.has(actionKey)) return;
      processedActionKeys.add(actionKey);
      if (processedActionKeys.size > 50) {
        const oldest = processedActionKeys.values().next().value;
        if (oldest) processedActionKeys.delete(oldest);
      }

      const rawData = resp.notification.request.content.data;
      const data: NotificationPayloadData =
        rawData && typeof rawData === 'object' ? (rawData as NotificationPayloadData) : {};
      const taskId = getTaskIdFromData(data);

      if (actionId === 'snooze') {
        const taskName =
          (typeof data.taskTitle === 'string' && data.taskTitle.trim()) ||
          resp.notification.request.content.body?.split(': ').at(-1) ||
          'Tu tarea';
        const module = await import('../src/services/notifications');
        await module.scheduleDistractionWarning(taskName, 5, taskId);
        return;
      }

      if (actionId === 'start_task') {
        if (!taskId) return;
        const store = useLifeStore.getState();
        store.startTask(taskId);
        store.startTaskExecution(taskId);
        return;
      }

      if (!taskId) return;

      if (actionId === 'done') {
        await useLifeStore.getState().confirmCompletionOK(taskId);
      } else if (actionId === 'skip') {
        await useLifeStore.getState().reportTaskSkipped(taskId, 'distraction', 'Marcado desde notificación');
      } else if (actionId === 'postpone') {
        const postponedUntil = new Date(Date.now() + 60 * 60_000);
        await useLifeStore.getState().reportTaskPostponed(
          taskId,
          'need_more_time',
          'Pospuesto desde notificación',
          postponedUntil
        );
      }
    };

    const initApp = async () => {
      try {
        await requestNotificationPermission();
      } catch(e) { console.log(e); }
      
      try {
        await registerScreenTimeBackgroundTask();
      } catch(e) { console.log(e); }

      try {
        useLifeStore.getState().restoreMealTimer();
      } catch(e) { console.log(e); }

      try {
        const store = useLifeStore.getState();
        const reminderId = await scheduleRandomHabitReminder(store.habits, store.habitReminderNotificationId);
        useLifeStore.setState({ habitReminderNotificationId: reminderId });
      } catch(e) { console.log(e); }
    };

    const bootstrap = async () => {
      await Promise.allSettled([
        initApp(),
        new Promise((resolve) => setTimeout(resolve, 1400))
      ]);
      if (mounted) setIsBooting(false);
    };
    bootstrap();

    let notifSub: { remove: () => void } | undefined;
    const importNotifs = async () => {
      const Notifications = await import('expo-notifications');
      notifSub = Notifications.addNotificationResponseReceivedListener((resp) => {
        void processNotificationResponse(Notifications, resp);
      });

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      await processNotificationResponse(Notifications, lastResponse);
      if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
        await Notifications.clearLastNotificationResponseAsync();
      }
    };
    importNotifs();

    // Escuchar el estado de la app (foreground/background) para tracker Nativo
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        try { checkScreenTimeDistraction(nextState); } catch(e){}
        try { checkGeofenceState(); } catch(e){}
      }
    });

    return () => {
      mounted = false;
      notifSub?.remove();
      sub.remove();
    };
  }, []);

  // Mostrar daily start prompt cuando se detecta inicio de nuevo día
  useEffect(() => {
    if (shouldShowPrompt && !isBooting) {
      setShowDailyPrompt(true);
    }
  }, [shouldShowPrompt, isBooting]);

  const handleStartDay = () => {
    dismissPrompt();
    setShowDailyPrompt(false);
    // Navegar a la pestaña "Hoy" para empezar el día
    router.push('/(tabs)/index');
  };

  const handleCaptureQuick = () => {
    dismissPrompt();
    setShowDailyPrompt(false);
    // Navegar a la pestaña de tareas para capturar rápidamente
    router.push('/(tabs)/pool');
  };

  const handleRestDay = () => {
    dismissPrompt();
    setShowDailyPrompt(false);
    // Mostrar confirmación de día de descanso
    setShowRestDayPrompt(true);
  };

  const handleConfirmRestDay = () => {
    markRestDay();
    setShowRestDayPrompt(false);
    // Navegar a la pestaña "Hoy" con un plan vacío (no se generan tareas)
    router.push('/(tabs)/index');
  };

  if (isBooting) {
    return <AppLoadingSplash />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>
        <StatusBar style={uiThemeMode === 'dark' ? 'light' : 'dark'} backgroundColor="transparent" translucent />
        <Stack screenOptions={{ headerShown: false }} />
        <DailyStartPrompt
          visible={showDailyPrompt}
          onDismiss={() => setShowDailyPrompt(false)}
          onStartDay={handleStartDay}
          onCaptureQuick={handleCaptureQuick}
          onRestDay={handleRestDay}
        />
        <RestDayPrompt
          visible={showRestDayPrompt}
          onConfirm={handleConfirmRestDay}
          onCancel={() => setShowRestDayPrompt(false)}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
