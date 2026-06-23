import { describe, it, expect } from 'vitest';
import {
  expandRulesToWindows,
  sliceIntoSlots,
  subtractExceptions,
  computeCapacity,
  computeAvailability,
  WeeklyRule,
  TimeWindow,
  BusyInterval,
} from './engine';

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
describe('subtractExceptions', () => {
  const slots: TimeWindow[] = [
    { start: new Date('2026-07-01T13:00:00Z'), end: new Date('2026-07-01T13:30:00Z') },
    { start: new Date('2026-07-01T13:30:00Z'), end: new Date('2026-07-01T14:00:00Z') },
    { start: new Date('2026-07-01T14:00:00Z'), end: new Date('2026-07-01T14:30:00Z') },
  ];

  it('removes a slot that overlaps an exception', () => {
    const exceptions = [
      { start: new Date('2026-07-01T13:15:00Z'), end: new Date('2026-07-01T13:45:00Z') },
    ];
    const out = subtractExceptions(slots, exceptions);
    expect(out).toHaveLength(1); // first two overlap the block; only 14:00 survives
    expect(out[0].start.toISOString()).toBe('2026-07-01T14:00:00.000Z');
  });

  it('keeps a slot that only touches an exception edge', () => {
    // Exception ends exactly when the first slot starts → not an overlap.
    const exceptions = [
      { start: new Date('2026-07-01T12:30:00Z'), end: new Date('2026-07-01T13:00:00Z') },
    ];
    expect(subtractExceptions(slots, exceptions)).toHaveLength(3);
  });

  it('returns all slots when there are no exceptions', () => {
    expect(subtractExceptions(slots, [])).toHaveLength(3);
  });
});

describe('computeCapacity', () => {
  const slot: TimeWindow[] = [
    { start: new Date('2026-07-01T13:00:00Z'), end: new Date('2026-07-01T13:30:00Z') },
  ];
  const rooms = ['r1', 'r2', 'r3'];

  it('full capacity when nothing is booked', () => {
    const out = computeCapacity(slot, rooms, []);
    expect(out[0].capacity).toBe(3);
  });

  it('reduced capacity when some rooms are booked', () => {
    const busy: BusyInterval[] = [
      { resourceId: 'r1', start: new Date('2026-07-01T13:00:00Z'), end: new Date('2026-07-01T13:30:00Z') },
    ];
    expect(computeCapacity(slot, rooms, busy)[0].capacity).toBe(2);
  });

  it('slot disappears when all rooms are booked', () => {
    const busy: BusyInterval[] = rooms.map((resourceId) => ({
      resourceId,
      start: new Date('2026-07-01T13:00:00Z'),
      end: new Date('2026-07-01T13:30:00Z'),
    }));
    expect(computeCapacity(slot, rooms, busy)).toHaveLength(0);
  });

  it('a booking on an adjacent slot does not reduce capacity', () => {
    // Booked 13:30–14:00 must NOT affect the 13:00–13:30 slot.
    const busy: BusyInterval[] = [
      { resourceId: 'r1', start: new Date('2026-07-01T13:30:00Z'), end: new Date('2026-07-01T14:00:00Z') },
    ];
    expect(computeCapacity(slot, rooms, busy)[0].capacity).toBe(3);
  });
});

describe('computeAvailability — full pipeline', () => {
  const wedRule: WeeklyRule = { dayOfWeek: 3, startMinute: 540, endMinute: 1020 };

  it('runs end to end with capacity', () => {
    const out = computeAvailability({
      rules: [wedRule],
      timezone: 'America/New_York',
      durationMinutes: 30,
      rangeStart: new Date('2026-07-01T12:00:00Z'),
      rangeEnd: new Date('2026-07-01T12:00:00Z'),
      exceptions: [],
      resourceIds: ['r1', 'r2', 'r3'],
      busy: [
        // r1 booked for the first slot only (13:00–13:30 UTC)
        { resourceId: 'r1', start: new Date('2026-07-01T13:00:00Z'), end: new Date('2026-07-01T13:30:00Z') },
      ],
    });
    expect(out).toHaveLength(16);       // 8h / 30min, none fully booked
    expect(out[0].capacity).toBe(2);    // first slot: r1 taken → 2 left
    expect(out[1].capacity).toBe(3);    // second slot: all free
  });
});