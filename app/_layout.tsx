import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLifeStore } from '../src/store/useLifeStore';
import { lifeTheme } from '../src/theme';
import { requestNotificationPermission } from '../src/services/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export default function RootLayout(): ReactElement {
  useEffect(() => {
    void requestNotificationPermission();
    useLifeStore.getState().restoreMealTimer();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: lifeTheme.colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: lifeTheme.colors.background },
            headerTintColor: lifeTheme.colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: lifeTheme.colors.background }
          }}
        >
          <Stack.Screen name="index" options={{ title: 'LifeOS' }} />
          <Stack.Screen name="pool" options={{ title: 'Task Pool' }} />
          <Stack.Screen name="stats" options={{ title: 'Estadísticas' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
