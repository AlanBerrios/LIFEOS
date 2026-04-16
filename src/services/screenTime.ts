import * as IntentLauncher from 'expo-intent-launcher';
import { AppState, AppStateStatus, Platform } from 'react-native';
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

  useLifeStore.getState().showGlobalAlert(
    'Permiso requerido',
    'Para detectar tu tiempo en IG o TikTok, necesitamos acceso al Uso de Dispositivo.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abrir Configuración',
        onPress: () => {
          void IntentLauncher.startActivityAsync('android.settings.USAGE_ACCESS_SETTINGS');
        }
      }
    ]
  );
}

export async function checkScreenTimeDistraction(appState: AppStateStatus) {
  if (Platform.OS !== 'android') return;
  if (appState !== 'active') return;

  try {
    // Feature temporarily disabled to fix startup crash
    console.log('[LifeOS] ScreenTime checking is currently stubbed for stability.');
    return;

    /*
    const store = useLifeStore.getState();
    const now = new Date();

    const currentBlock = store.timeline.find(b => b.start_time <= now && b.end_time >= now);

    if (!currentBlock || currentBlock.type !== 'task') {
      return;
    }

    const activeTasks = store.tasks.filter(t => t.status !== 'completed');
    const hasImportantPending = activeTasks.some(t => t.priority >= 4);

    if (!hasImportantPending) return;

    // TODO: Implement a stable usage tracker or wait for dependency fix
    */
  } catch (err) {
    console.log('[LifeOS] Error consultando Usage Stats.', err);
  }
}

// Define the global background task logic safely
try {
  TaskManager.defineTask(SCREEN_TIME_TASK, async () => {
    try {
      await checkScreenTimeDistraction('active');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.error('Background fetch failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.log('Error defining task manager:', e);
}

export async function registerScreenTimeBackgroundTask() {
  if (Platform.OS !== 'android') return;
  try {
    await BackgroundFetch.registerTaskAsync(SCREEN_TIME_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[LifeOS] Background Screen Time Tracker registered (stubbed).');
  } catch (err) {
    console.log('[LifeOS] Task Register failed:', err);
  }
}
