import { scheduleRandomHabitReminder, rescheduleAll } from '../../services/notifications';
import type { LifeStore } from '../lifeStore.types';

type StoreSet = (partial: Partial<LifeStore> | ((state: LifeStore) => Partial<LifeStore>)) => void;
type StoreGet = () => LifeStore;

export async function refreshHabitReminderEffect(get: StoreGet, set: StoreSet): Promise<void> {
  const state = get();
  const reminderId = await scheduleRandomHabitReminder(state.habits, state.habitReminderNotificationId);
  set({ habitReminderNotificationId: reminderId });
}

export function triggerNotificationResync(
  get: StoreGet,
  set: StoreSet,
  logContext = 'resincronizar notificaciones'
): void {
  const state = get();
  void rescheduleAll(
    state.timeline,
    state.tasks,
    state.settings,
    state.routines,
    state.events,
    state.notes,
    state.alarms
  )
    .then((syncedAlarms) => set({ alarms: syncedAlarms }))
    .catch((error) => console.log(`[LifeOS] Error al ${logContext}:`, error));
}
