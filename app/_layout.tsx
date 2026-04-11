import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { AppState } from 'react-native';
import { useLifeStore } from '../src/store/useLifeStore';
import {
  initNotifications,
  requestNotificationPermission
} from '../src/services/notifications';
import { checkGeofenceState } from '../src/services/location';
import { checkScreenTimeDistraction, registerScreenTimeBackgroundTask } from '../src/services/screenTime';
import { lifeTheme } from '../src/theme';

try {
  initNotifications();
} catch (e) {
  console.log('Error initNotifications:', e);
}

export default function RootLayout(): ReactElement {

  useEffect(() => {
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
    };
    initApp();

    const importNotifs = async () => {
      const Notifications = await import('expo-notifications');
      Notifications.addNotificationResponseReceivedListener((resp) => {
        const actionId = resp.actionIdentifier;
        const data = resp.notification.request.content.data as { type?: string; taskId?: string };
        if (actionId === 'snooze') {
          // Re-trigger after 5 mins silently
          const taskName = resp.notification.request.content.body?.split(': ')[1] || 'Tu tarea';
          import('../src/services/notifications').then((module) => {
            module.scheduleDistractionWarning(taskName, 5);
          });
        } else if (actionId === 'start_task') {
          // Navigating to Home is default because the app opens
        } else if (data?.type === 'completion_check' && data.taskId) {
          if (actionId === 'done') {
            void useLifeStore.getState().confirmCompletionOK(data.taskId);
          } else if (actionId === 'skip') {
            void useLifeStore.getState().reportTaskSkipped(data.taskId, 'distraction', 'Marcado desde notificación');
          } else if (actionId === 'postpone') {
            const postponedUntil = new Date(Date.now() + 60 * 60_000);
            void useLifeStore.getState().reportTaskPostponed(
              data.taskId,
              'need_more_time',
              'Pospuesto desde notificación',
              postponedUntil
            );
          }
        }
      });
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
      sub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: lifeTheme.colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="transparent" translucent />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
