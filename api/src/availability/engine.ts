import { DateTime } from 'luxon'; // installed Day 14; the import can sit unused for now

// ---- Types ----

export interface WeeklyRule {
  dayOfWeek: number;   // 0 = Sunday … 6 = Saturday
  startMinute: number; // minutes from local midnight, e.g. 540 = 09:00
  endMinute: number;
}

export interface TimeWindow {
  start: Date; // UTC instant
  end: Date;   // UTC instant
}

export interface BusyInterval {
  resourceId: string;
  start: Date; // UTC
  end: Date;   // UTC
}

export interface AvailableSlot {
  start: Date;     // UTC
  end: Date;       // UTC
  capacity: number; // how many resources are free for this slot
}

export function expandRulesToWindows(
  rules: WeeklyRule[],
  timezone: string,
  rangeStart: Date,
  rangeEnd: Date,
): TimeWindow[] {
  const windows: TimeWindow[] = [];

  // Walk day by day IN THE PROVIDER'S ZONE (not UTC) — a "Wednesday rule"
  // means Wednesday on the provider's local calendar.
  let cursor = DateTime.fromJSDate(rangeStart, { zone: timezone }).startOf('day');
  const last = DateTime.fromJSDate(rangeEnd, { zone: timezone }).startOf('day');

  while (cursor.toMillis() <= last.toMillis()) {
    // Luxon weekday: Mon=1…Sun=7.  % 7  →  Sun=0…Sat=6, matching our dayOfWeek.
    const dayOfWeek = cursor.weekday % 7;

    for (const rule of rules) {
      if (rule.dayOfWeek !== dayOfWeek) continue;

      // THE KEY MOVE: build "9:00 local on THIS date" and let Luxon resolve it
      // to a UTC instant using the correct DST offset for that date.
      const start = cursor.set({
        hour: Math.floor(rule.startMinute / 60),
        minute: rule.startMinute % 60,
        second: 0,
        millisecond: 0,
      });
      const end = cursor.set({
        hour: Math.floor(rule.endMinute / 60),
        minute: rule.endMinute % 60,
        second: 0,
        millisecond: 0,
      });

      windows.push({ start: start.toJSDate(), end: end.toJSDate() });
    }

    cursor = cursor.plus({ days: 1 });
  }

  return windows;
}

export function sliceIntoSlots(
  windows: TimeWindow[],
  durationMinutes: number,
): TimeWindow[] {
  const slots: TimeWindow[] = [];
  const slotMs = durationMinutes * 60 * 1000;

  for (const w of windows) {
    let startMs = w.start.getTime();
    const endMs = w.end.getTime();

    // Only emit a slot if a FULL duration fits before the window closes.
    while (startMs + slotMs <= endMs) {
      slots.push({ start: new Date(startMs), end: new Date(startMs + slotMs) });
      startMs += slotMs;
    }
  }

  return slots;
}
export function subtractExceptions(
  slots: TimeWindow[],
  exceptions: TimeWindow[],
): TimeWindow[] {
  if (exceptions.length === 0) return slots;

  return slots.filter((slot) => {
    // Keep the slot only if it overlaps NONE of the exceptions.
    const hitsAnException = exceptions.some(
      (ex) => slot.start < ex.end && slot.end > ex.start,
    );
    return !hitsAnException;
  });
}
export function computeCapacity(
  slots: TimeWindow[],
  resourceIds: string[],
  busy: BusyInterval[],
): AvailableSlot[] {
  const result: AvailableSlot[] = [];

  for (const slot of slots) {
    // A resource is free for this slot if NONE of its busy intervals overlap it.
    const freeCount = resourceIds.filter((resourceId) => {
      const busyForThisResource = busy.filter((b) => b.resourceId === resourceId);
      const isTaken = busyForThisResource.some(
        (b) => slot.start < b.end && slot.end > b.start,
      );
      return !isTaken;
    }).length;

    if (freeCount > 0) {
      result.push({ start: slot.start, end: slot.end, capacity: freeCount });
    }
  }

  return result;
}

export function computeAvailability(input: {
  rules: WeeklyRule[];
  timezone: string;
  durationMinutes: number;
  rangeStart: Date;
  rangeEnd: Date;
  exceptions: TimeWindow[];
  resourceIds: string[];
  busy: BusyInterval[];
}): AvailableSlot[] {
  const windows = expandRulesToWindows(
    input.rules,
    input.timezone,
    input.rangeStart,
    input.rangeEnd,
  );
  const slots = sliceIntoSlots(windows, input.durationMinutes);
  const open = subtractExceptions(slots, input.exceptions);
  return computeCapacity(open, input.resourceIds, input.busy);
}