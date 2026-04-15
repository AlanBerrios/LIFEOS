import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import type { LifeStore } from '../lifeStore.types';
import type { Alarm, DailyRoutine, QuickNote, StaticEvent, TravelLog } from '../../types';
import { cancelNotificationsByIds, rescheduleAll, scheduleAlarm } from '../../services/notifications';

const ALARM_PERMISSION_ERROR = 'No se pudo programar la alarma. Verifica permisos de notificaciones.';

function eventDedupeKey(event: StaticEvent): string {
  const title = event.title.trim().toLowerCase();
  const location = (event.location ?? '').trim().toLowerCase();
  const emoji = (event.emoji ?? '').trim().toLowerCase();
  const color = (event.color ?? '').trim().toLowerCase();
  const start = event.startTime.toISOString();
  const end = event.endTime.toISOString();
  return `${title}|${location}|${emoji}|${color}|${start}|${end}`;
}

function dedupeEvents(events: StaticEvent[]): StaticEvent[] {
  const seen = new Set<string>();
  const deduped: StaticEvent[] = [];

  for (const event of events) {
    const key = eventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

export const createContentSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'addNote' | 'updateNote' | 'deleteNote' | 'addAlarm' | 'toggleAlarm' | 'deleteAlarm' |
  'addEvent' | 'updateEvent' | 'setEvents' | 'deleteEvent' | 'updateRoutineDay' | 'addTravelLog'
>> = (set, get) => ({
  addNote: (note) => {
    set((state) => ({
      notes: [
        {
          id: createId('note'),
          ...note,
          createdAt: new Date()
        },
        ...state.notes
      ]
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de notas:', error));
  },

  updateNote: (id: string, updates: Partial<QuickNote>) => {
    set((state) => ({
      notes: state.notes.map((note) => (note.id === id ? { ...note, ...updates } : note))
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de notas:', error));
  },

  deleteNote: (id: string) => {
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id)
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de notas:', error));
  },

  addAlarm: async (alarm) => {
    if (!alarm.days.length) {
      throw new Error('Selecciona al menos un día para la alarma.');
    }

    const notificationIds = await scheduleAlarm(alarm.time, alarm.label, alarm.days);
    if (notificationIds.length === 0) {
      throw new Error(ALARM_PERMISSION_ERROR);
    }

    set((state) => ({
      alarms: [
        ...state.alarms,
        {
          id: createId('alarm'),
          ...alarm,
          enabled: true,
          notificationIds
        }
      ]
    }));
  },

  toggleAlarm: async (id: string, enabled: boolean) => {
    const target = get().alarms.find((alarm) => alarm.id === id);
    if (!target) return;

    if (enabled) {
      const notificationIds = await scheduleAlarm(target.time, target.label, target.days);
      if (notificationIds.length === 0) {
        throw new Error(ALARM_PERMISSION_ERROR);
      }

      set((state) => ({
        alarms: state.alarms.map((alarm) =>
          alarm.id === id ? { ...alarm, enabled: true, notificationIds } : alarm
        )
      }));
      return;
    }

    await cancelNotificationsByIds(target.notificationIds ?? []);
    set((state) => ({
      alarms: state.alarms.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled: false, notificationIds: [] } : alarm
      )
    }));
  },

  deleteAlarm: async (id: string) => {
    const target = get().alarms.find((alarm) => alarm.id === id);
    await cancelNotificationsByIds(target?.notificationIds ?? []);
    set((state) => ({
      alarms: state.alarms.filter((alarm) => alarm.id !== id)
    }));
  },

  addEvent: (event) => {
    set((state) => ({
      events: dedupeEvents([
        ...state.events,
        {
          id: createId('evt'),
          ...event,
          emoji: event.emoji?.trim() || undefined,
          color: event.color?.trim() || undefined
        }
      ])
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de eventos:', error));
  },

  updateEvent: (id: string, updates: Partial<StaticEvent>) => {
    set((state) => ({
      events: dedupeEvents(state.events.map((event) => (
        event.id === id
          ? {
              ...event,
              ...updates,
              emoji: updates.emoji === undefined ? event.emoji : updates.emoji.trim() || undefined,
              color: updates.color === undefined ? event.color : updates.color.trim() || undefined
            }
          : event
      )))
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de eventos:', error));
  },

  setEvents: (events: StaticEvent[]) => {
    set({ events: dedupeEvents(events) });

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de eventos:', error));
  },

  deleteEvent: (id: string) => {
    set((state) => ({
      events: state.events.filter((event) => event.id !== id)
    }));

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
      .catch((error) => console.log('[LifeOS] Error al resincronizar notificaciones de eventos:', error));
  },

  updateRoutineDay: async (dayOfWeek: number, updates: Partial<DailyRoutine>) => {
    set((state) => ({
      routines: state.routines.map((routine) => (routine.dayOfWeek === dayOfWeek ? { ...routine, ...updates } : routine))
    }));

    if (dayOfWeek === new Date().getDay()) {
      await get().generateTimeline(new Date());
    }
  },

  addTravelLog: (type: TravelLog['type']) => {
    set((state) => {
      const now = new Date();
      const lastLog = state.travelLogs[state.travelLogs.length - 1];
      const durationMinutes = lastLog && lastLog.timestamp
        ? Math.round((now.getTime() - lastLog.timestamp.getTime()) / 60_000)
        : undefined;

      const newLog: TravelLog = {
        id: createId('travel'),
        type,
        timestamp: now,
        durationMinutes
      };

      return { travelLogs: [...state.travelLogs, newLog] };
    });
  }
});
