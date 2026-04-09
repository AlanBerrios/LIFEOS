import { StaticEvent } from '../types';

/**
 * Returns a list of events (original and recurring occurrences) for a specific date.
 */
export function getEventsForDate(events: StaticEvent[], date: Date): StaticEvent[] {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const targetTime = targetDate.getTime();

  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();

  const results: StaticEvent[] = [];

  for (const event of events) {
    const eventStartDate = new Date(event.startTime);
    eventStartDate.setHours(0, 0, 0, 0);
    const eventStartTime = eventStartDate.getTime();

    // 1. Regular event on this exact day
    if (eventStartTime === targetTime) {
      results.push(event);
      continue;
    }

    // 2. If it's earlier than the first occurrence, skip
    if (eventStartTime > targetTime) {
      continue;
    }

    // 3. Check for recurrence
    if (event.recurrence && event.recurrence.frequency !== 'none') {
      const { frequency, daysOfWeek, endDate } = event.recurrence;

      // If past the end date, skip
      if (endDate && new Date(endDate).setHours(0, 0, 0, 0) < targetTime) {
        continue;
      }

      let matches = false;

      if (frequency === 'daily') {
        matches = true;
      } else if (frequency === 'weekly' && daysOfWeek) {
        matches = daysOfWeek.includes(dayOfWeek);
      } else if (frequency === 'monthly') {
        matches = eventStartDate.getDate() === dayOfMonth;
      }

      if (matches) {
        // Construct a "virtual" event instance for this date
        // But keep the original start/end TIMES
        const occurrence = { ...event };
        
        const start = new Date(date);
        start.setHours(event.startTime.getHours(), event.startTime.getMinutes(), 0, 0);
        
        const end = new Date(date);
        end.setHours(event.endTime.getHours(), event.endTime.getMinutes(), 0, 0);
        if (event.endTime.getDate() > event.startTime.getDate()) {
            end.setDate(end.getDate() + 1);
        }

        occurrence.startTime = start;
        occurrence.endTime = end;
        
        results.push(occurrence);
      }
    }
  }

  return results;
}
