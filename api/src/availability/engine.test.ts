import { describe, it, expect } from 'vitest';
import { expandRulesToWindows, sliceIntoSlots, WeeklyRule } from './engine';

// Dr. Smith: Wednesdays 9:00–17:00 local. (Wed = dayOfWeek 3)
const wedRule: WeeklyRule = { dayOfWeek: 3, startMinute: 540, endMinute: 1020 };
const NY = 'America/New_York';

describe('expandRulesToWindows — DST correctness', () => {
  it('SUMMER (EDT, UTC-4): 9am NY → 13:00 UTC', () => {
    // July 1, 2026 is a Wednesday, during EDT.
    const windows = expandRulesToWindows(
      [wedRule],
      NY,
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].start.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(windows[0].end.toISOString()).toBe('2026-07-01T21:00:00.000Z');
  });

  it('WINTER (EST, UTC-5): same 9am rule → 14:00 UTC', () => {
    // January 7, 2026 is a Wednesday, during EST.
    const windows = expandRulesToWindows(
      [wedRule],
      NY,
      new Date('2026-01-07T12:00:00Z'),
      new Date('2026-01-07T12:00:00Z'),
    );
    expect(windows).toHaveLength(1);
    // SAME local rule, ONE HOUR LATER in UTC — this is the DST bug, caught.
    expect(windows[0].start.toISOString()).toBe('2026-01-07T14:00:00.000Z');
    expect(windows[0].end.toISOString()).toBe('2026-01-07T22:00:00.000Z');
  });

  it('only emits windows on matching weekdays', () => {
    // A full week: only Wednesday should match.
    const windows = expandRulesToWindows(
      [wedRule],
      NY,
      new Date('2026-06-29T12:00:00Z'), // Monday
      new Date('2026-07-05T12:00:00Z'), // Sunday
    );
    expect(windows).toHaveLength(1);
  });
});

describe('sliceIntoSlots', () => {
  it('cuts an 8-hour window into sixteen 30-min slots', () => {
    const windows = expandRulesToWindows(
      [wedRule],
      NY,
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    const slots = sliceIntoSlots(windows, 30);
    expect(slots).toHaveLength(16); // 8h / 30min
    expect(slots[0].start.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(slots[15].end.toISOString()).toBe('2026-07-01T21:00:00.000Z');
  });

  it('never emits a slot that overruns the window', () => {
    const windows = expandRulesToWindows(
      [wedRule],
      NY,
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    // 50-min service: last full slot must end at or before close (21:00 UTC).
    const slots = sliceIntoSlots(windows, 50);
    const lastEnd = slots[slots.length - 1].end.getTime();
    expect(lastEnd).toBeLessThanOrEqual(new Date('2026-07-01T21:00:00.000Z').getTime());
  });
});