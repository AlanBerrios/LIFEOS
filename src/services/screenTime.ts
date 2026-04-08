import * as UsageStats from 'expo-android-usagestats';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';
import { scheduleDistractionWarning } from './notifications';
import { useLifeStore } from '../store/useLifeStore';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const SCREEN_TIME_TASK = 'BACKGROUND_SCREEN_TIME_TRACKER';

// Common distracting apps
const TRACKED_APPS = [
  'com.instagram.android', // Instagram
  'com.zhiliaoapp.musically', // TikTok
  'com.google.android.youtube', // YouTube
  'com.whatsapp', // WhatsApp
  'com.twitter.android' // X (Twitter)
];

export async function requestUsagePermission() {
  if (Platform.OS !== 'android') return;
  
  Alert.alert(
    'Permiso requerido',
    'Para detectar tu tiempo en IG o TikTok, necesitamos acceso al Uso de Dispositivo.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abrir Configuración',
        onPress: () => {
          IntentLauncher.startActivityAsync('android.settings.USAGE_ACCESS_SETTINGS');
        }
      }
    ]
  );
}

export async function checkScreenTimeDistraction(appState: AppStateStatus) {
  if (Platform.OS !== 'android') return;
  if (appState !== 'active') return;

  try {
    const store = useLifeStore.getState();
    const now = new Date();

    // Find the currently active block
    const currentBlock = store.timeline.find(b => b.start_time <= now && b.end_time >= now);

    // ONLY check for distractions if the user is supposed to be doing a task
    // If they are resting, sleeping, or idle, let them use social media in peace
    if (!currentBlock || currentBlock.type !== 'task') {
      return;
    }

    const activeTasks = store.tasks.filter(t => t.status !== 'completed');
    const hasImportantPending = activeTasks.some(t => t.priority >= 4);

    if (!hasImportantPending) return; // Only distract if there are important things to do

    // Query stats for today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Warning: expo-android-usagestats needs to be used exactly per its docs
    // Fallback naive implementation assuming standard UsageStats bindings
    const stats: any[] = await (UsageStats as any).getUsageStats(startOfDay.getTime(), now.getTime());
    
    if (!stats || !stats.length) return;

    let timeWastedSeconds = 0;
    
    stats.forEach(stat => {
      if (TRACKED_APPS.includes(stat.packageName)) {
        timeWastedSeconds += (stat.totalTimeInForeground || 0) / 1000;
      }
    });

    const wastedMinutes = Math.floor(timeWastedSeconds / 60);

    if (wastedMinutes > store.settings.distractionTimeoutMinutes) {
      const topTask = activeTasks.find(t => t.priority >= 4);
      const title = `Fuga de Atención (${wastedMinutes} min)`;
      const body = `Has estado mucho rato en redes. Recuerda que tienes pendiente: ${topTask?.title}`;
      
      if (AppState.currentState === 'active') {
        Alert.alert('👀 ' + title, body);
      } else {
        const Notifications = require('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          content: { title: '👀 ' + title, body, sound: true },
          trigger: null // instant
        });
      }
    }

  } catch (err) {
    console.log('[LifeOS] Error consultando Usage Stats. Asegúrate de compilar mediante EAS Build y otorgar permisos.', err);
  }
}

// Define the global background task logic
TaskManager.defineTask(SCREEN_TIME_TASK, async () => {
  try {
    await checkScreenTimeDistraction('active'); // pass 'active' to force check inside background context
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerScreenTimeBackgroundTask() {
  if (Platform.OS !== 'android') return;
  try {
    await BackgroundFetch.registerTaskAsync(SCREEN_TIME_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false, // Keep running after app stops if possible
      startOnBoot: true,
    });
    console.log('[LifeOS] Background Screen Time Tracker registered.');
  } catch (err) {
    console.log('[LifeOS] Task Register failed:', err);
  }
}
