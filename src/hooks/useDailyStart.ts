import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useLifeStore } from '../store/useLifeStore';
import { getTodayStr } from '../utils/date';

interface UseDailyStartReturn {
  shouldShowPrompt: boolean;
  dismissPrompt: () => void;
}

/**
 * Hook que detecta si es inicio del día y maneja el timing del prompt.
 * Sincroniza con AppState para mostrar solo cuando la app pasa a foreground en un nuevo día.
 */
export function useDailyStart(): UseDailyStartReturn {
  const appState = useRef(AppState.currentState);
  const promptShownRef = useRef(false);

  const lastDailyStartDate = useLifeStore((s) => s.settings.last_daily_start_date);
  const updateSettings = useLifeStore((s) => s.updateSettings);

  const today = getTodayStr();
  const isNewDay = !lastDailyStartDate || lastDailyStartDate !== today;

  const shouldShowPrompt = isNewDay && !promptShownRef.current;

  const dismissPrompt = useCallback(() => {
    promptShownRef.current = true;
    // Persistir en settings que ya mostramos el prompt hoy
    updateSettings({ last_daily_start_date: today });
  }, [today, updateSettings]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };

    function handleAppStateChange(nextAppState: AppStateStatus) {
      // Solo resetear el flag si pasamos a foreground desde background/inactive
      if (
        (appState.current.match(/inactive|background/) && nextAppState === 'active') ||
        nextAppState === 'active'
      ) {
        // Si es un día nuevo, permitir mostrar el prompt nuevamente
        if (isNewDay && lastDailyStartDate !== today) {
          promptShownRef.current = false;
        }
      }
      appState.current = nextAppState;
    }
  }, [isNewDay, lastDailyStartDate, today]);

  return {
    shouldShowPrompt,
    dismissPrompt
  };
}

