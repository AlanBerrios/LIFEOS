import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import type { LifeStore } from '../lifeStore.types';
import type { Alarm, DailyRoutine, QuickNote, StaticEvent, TravelLog } from '../../types';
import { cancelNotificationsByIds, scheduleAlarm } from '../../services/notifications';

const ALARM_PERMISSION_ERROR = 'No se pudo programar la alarma. Verifica permisos de notificaciones.';

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
  },

  updateNote: (id: string, updates: Partial<QuickNote>) => {
    set((state) => ({
      notes: state.notes.map((note) => (note.id === id ? { ...note, ...updates } : note))
    }));
  },

  deleteNote: (id: string) => {
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id)
    }));
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
      events: [...state.events, { id: createId('evt'), ...event }]
    }));
  },

  updateEvent: (id: string, updates: Partial<StaticEvent>) => {
    set((state) => ({
      events: state.events.map((event) => (event.id === id ? { ...event, ...updates } : event))
    }));
  },

  setEvents: (events: StaticEvent[]) => {
    set({ events });
  },

  deleteEvent: (id: string) => {
    set((state) => ({
      events: state.events.filter((event) => event.id !== id)
    }));
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
