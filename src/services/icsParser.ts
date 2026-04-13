import { Alert } from 'react-native';
import { useLifeStore } from '../store/useLifeStore';
import { StaticEvent } from '../types';

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function buildDeterministicEventId(uid: string | undefined, title: string, start: Date, end: Date): string {
  if (uid && uid.trim().length > 0) {
    const normalized = uid.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `ics-${normalized}`;
  }
  const raw = `${title.trim().toLowerCase()}|${start.toISOString()}|${end.toISOString()}`;
  return `ics-${shortHash(raw)}`;
}

function dedupeParsedEvents(events: StaticEvent[]): StaticEvent[] {
  const seen = new Set<string>();
  const deduped: StaticEvent[] = [];

  for (const event of events) {
    const key = `${event.id}|${event.startTime.toISOString()}|${event.endTime.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

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
  const rawLines = icsData.split(/\r?\n/);
  const lines: string[] = [];

  // Unfold folded iCalendar lines (continuations start with space/tab).
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }
  
  let currentEvent: (Partial<StaticEvent> & { uid?: string }) | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { isRecurring: false, color: '#4a90e2' };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.startTime && currentEvent.endTime && currentEvent.title) {
        currentEvent.id = buildDeterministicEventId(
          currentEvent.uid,
          currentEvent.title,
          currentEvent.startTime,
          currentEvent.endTime
        );
        events.push(currentEvent as StaticEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8).trim();
      } else if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4).trim();
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9).trim();
      } else if (line.startsWith('DTSTART')) {
        const dateStr = line.split(':')[1];
        if (dateStr) currentEvent.startTime = parseIcsDate(dateStr);
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.split(':')[1];
        if (dateStr) currentEvent.endTime = parseIcsDate(dateStr);
      } else if (line.startsWith('RRULE:')) {
        currentEvent.isRecurring = true; // Simplistic mark for recurring events
      }
    }
  }

  return dedupeParsedEvents(events);
}

// Parses standard ICS YYYYMMDDTHHMMSSZ formats
function parseIcsDate(dt: string): Date {
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
