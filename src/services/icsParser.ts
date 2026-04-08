import { Alert } from 'react-native';
import { useLifeStore } from '../store/useLifeStore';
import { StaticEvent } from '../types';

export async function fetchAndParseICS(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo descargar el ICS');
    const text = await res.text();
    
    const events = parseICS(text);
    if (events.length > 0) {
      useLifeStore.getState().setEvents(events);
      Alert.alert('Sincronización Exitosa', `Se han importado ${events.length} eventos estáticos.`);
      return true;
    } else {
      Alert.alert('Calendario Vacío', 'No se encontraron eventos en la URL proveída.');
      return false;
    }
  } catch (error: any) {
    Alert.alert('Error de Sincronización', error.message || 'La URL de ICS es inválida o privada.');
    return false;
  }
}

export function parseICS(icsData: string): StaticEvent[] {
  const events: StaticEvent[] = [];
  const lines = icsData.split(/\r?\n/);
  
  let currentEvent: Partial<StaticEvent> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { id: `ics-${Math.random().toString(36).substring(7)}`, isRecurring: false, color: '#4a90e2' };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.startTime && currentEvent.endTime && currentEvent.title) {
        events.push(currentEvent as StaticEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8).trim();
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9).trim();
      } else if (line.startsWith('DTSTART')) {
        const dateStr = line.split(':')[1];
        if (dateStr) currentEvent.startTime = parseIscDate(dateStr);
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.split(':')[1];
        if (dateStr) currentEvent.endTime = parseIscDate(dateStr);
      } else if (line.startsWith('RRULE:')) {
        currentEvent.isRecurring = true; // Simplistic mark for recurring events
      }
    }
  }

  return events;
}

// Parses standard ICS YYYYMMDDTHHMMSSZ formats
function parseIscDate(dt: string): Date {
  const clean = dt.replace(/Z/g, ''); // Naive parsing, ignoring timezones for simplicity given Expo limitation without heavier libs
  if (clean.length >= 15) { // e.g. 20260408T090000
    const y = parseInt(clean.substring(0, 4));
    const m = parseInt(clean.substring(4, 6)) - 1;
    const d = parseInt(clean.substring(6, 8));
    const h = parseInt(clean.substring(9, 11));
    const min = parseInt(clean.substring(11, 13));
    const s = parseInt(clean.substring(13, 15));
    return new Date(y, m, d, h, min, s);
  } else if (clean.length === 8) { // Only date, e.g. 20260408
    const y = parseInt(clean.substring(0, 4));
    const m = parseInt(clean.substring(4, 6)) - 1;
    const d = parseInt(clean.substring(6, 8));
    const dtFallback = new Date(y, m, d);
    dtFallback.setHours(9, 0, 0); // fallback all-day to 9am
    return dtFallback;
  }
  return new Date(); // fallback
}
