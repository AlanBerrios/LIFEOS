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

// Init notification handler as early as possible
initNotifications();

export default function RootLayout(): ReactElement {

  useEffect(() => {
    void requestNotificationPermission();
    void registerScreenTimeBackgroundTask();
    useLifeStore.getState().restoreMealTimer();

    const importNotifs = async () => {
      const Notifications = await import('expo-notifications');
      Notifications.addNotificationResponseReceivedListener((resp) => {
        const actionId = resp.actionIdentifier;
        if (actionId === 'snooze') {
          // Re-trigger after 5 mins silently
          const taskName = resp.notification.request.content.body?.split(': ')[1] || 'Tu tarea';
          import('../src/services/notifications').then((module) => {
            module.scheduleDistractionWarning(taskName, 5);
          });
        } else if (actionId === 'start_task') {
          // Navigating to Home is default because the app opens
        }
      });
    };
    importNotifs();

    // Escuchar el estado de la app (foreground/background) para tracker Nativo
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkScreenTimeDistraction(nextState);
        void checkGeofenceState();
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
