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

describe('DST transition days (US Eastern 2026)', () => {
  // Sunday rule so the transition Sundays match. Sunday = dayOfWeek 0.
  const sunRule: WeeklyRule = { dayOfWeek: 0, startMinute: 540, endMinute: 1020 };
  const NY = 'America/New_York';

  it('spring-forward Sunday (Mar 8): 9am local is still EST→EDT-correct', () => {
    const w = expandRulesToWindows(
      [sunRule], NY,
      new Date('2026-03-08T12:00:00Z'),
      new Date('2026-03-08T12:00:00Z'),
    );
    expect(w).toHaveLength(1);
    // 9am on Mar 8 is AFTER the 2am jump → already EDT (UTC-4) → 13:00 UTC.
    expect(w[0].start.toISOString()).toBe('2026-03-08T13:00:00.000Z');
    // Window is still a normal 8 hours (the jump was at 2am, far from 9–5).
    const hours = (w[0].end.getTime() - w[0].start.getTime()) / 3_600_000;
    expect(hours).toBe(8);
  });

  it('fall-back Sunday (Nov 1): 9am local resolves correctly to EST', () => {
    const w = expandRulesToWindows(
      [sunRule], NY,
      new Date('2026-11-01T12:00:00Z'),
      new Date('2026-11-01T12:00:00Z'),
    );
    expect(w).toHaveLength(1);
    // 9am on Nov 1 is AFTER the 2am fall-back → EST (UTC-5) → 14:00 UTC.
    expect(w[0].start.toISOString()).toBe('2026-11-01T14:00:00.000Z');
    const hours = (w[0].end.getTime() - w[0].start.getTime()) / 3_600_000;
    expect(hours).toBe(8); // still 8 hours of wall-clock work
  });
});

describe('split shift — two rules on the same day', () => {
  const NY = 'America/New_York';
  const morning: WeeklyRule = { dayOfWeek: 3, startMinute: 540, endMinute: 720 };  // 9:00–12:00
  const afternoon: WeeklyRule = { dayOfWeek: 3, startMinute: 780, endMinute: 1020 }; // 13:00–17:00

  it('produces two windows with a gap between them', () => {
    const w = expandRulesToWindows(
      [morning, afternoon], NY,
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    expect(w).toHaveLength(2);
  });

  it('slicing the split shift yields 6 + 8 = 14 half-hour slots, none over lunch', () => {
    const w = expandRulesToWindows(
      [morning, afternoon], NY,
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    const slots = sliceIntoSlots(w, 30);
    expect(slots).toHaveLength(14); // 3h→6 + 4h→8; the 12–1 lunch gap has none
    // No slot should start during lunch (16:00–17:00 UTC = 12:00–13:00 local EDT).
    const lunchSlot = slots.find(
      (s) => s.start.toISOString() === '2026-07-01T16:00:00.000Z',
    );
    expect(lunchSlot).toBeUndefined();
  });
});

describe('non-dividing duration', () => {
  const wedRule: WeeklyRule = { dayOfWeek: 3, startMinute: 540, endMinute: 1020 };
  it('45-min service in an 8h day → 10 full slots, no partial tail', () => {
    const w = expandRulesToWindows(
      [wedRule], 'America/New_York',
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-01T12:00:00Z'),
    );
    const slots = sliceIntoSlots(w, 45);
    expect(slots).toHaveLength(10); // floor(480 / 45)
    // Last slot must end at or before 21:00 UTC (5pm local) — never overrun.
    const lastEnd = slots[slots.length - 1].end.getTime();
    expect(lastEnd).toBeLessThanOrEqual(new Date('2026-07-01T21:00:00Z').getTime());
  });
});

describe('capacity — partial and staggered overlaps', () => {
  const slot: TimeWindow[] = [
    { start: new Date('2026-07-01T13:00:00Z'), end: new Date('2026-07-01T13:30:00Z') },
  ];
  const rooms = ['r1', 'r2', 'r3'];

  it('a booking that only partially overlaps still consumes the room', () => {
    // Booked 13:15–13:45 — overlaps the 13:00–13:30 slot by 15 min → r1 is taken.
    const busy: BusyInterval[] = [
      { resourceId: 'r1', start: new Date('2026-07-01T13:15:00Z'), end: new Date('2026-07-01T13:45:00Z') },
    ];
    expect(computeCapacity(slot, rooms, busy)[0].capacity).toBe(2);
  });

  it('different rooms booked in staggered fashion reduce capacity correctly', () => {
    const busy: BusyInterval[] = [
      { resourceId: 'r1', start: new Date('2026-07-01T12:45:00Z'), end: new Date('2026-07-01T13:15:00Z') }, // overlaps
      { resourceId: 'r2', start: new Date('2026-07-01T13:20:00Z'), end: new Date('2026-07-01T13:50:00Z') }, // overlaps
    ];
    // r1 and r2 both taken (partial overlaps), r3 free → capacity 1.
    expect(computeCapacity(slot, rooms, busy)[0].capacity).toBe(1);
  });

  it('a booking on a DIFFERENT day does not affect this slot', () => {
    const busy: BusyInterval[] = [
      { resourceId: 'r1', start: new Date('2026-07-02T13:00:00Z'), end: new Date('2026-07-02T13:30:00Z') },
    ];
    expect(computeCapacity(slot, rooms, busy)[0].capacity).toBe(3);
  });
});

describe('multi-day range', () => {
  const wedRule: WeeklyRule = { dayOfWeek: 3, startMinute: 540, endMinute: 1020 };
  it('a 2-week range with a Wednesday-only rule yields exactly 2 windows', () => {
    const w = expandRulesToWindows(
      [wedRule], 'America/New_York',
      new Date('2026-07-01T12:00:00Z'), // Wed Jul 1
      new Date('2026-07-14T12:00:00Z'), // Tue Jul 14
    );
    expect(w).toHaveLength(2); // Jul 1 and Jul 8
  });
});