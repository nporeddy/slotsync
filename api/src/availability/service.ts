import { prisma } from "../prisma";
import { redis } from "../redis";
import {
  computeAvailability,
  WeeklyRule,
  TimeWindow,
  BusyInterval,
  AvailableSlot,
} from "./engine";

const CACHE_TTL_SECONDS = 60; // availability changes often; short TTL is fine

export async function getAvailability(params: {
  providerSlug: string;
  serviceId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<AvailableSlot[]> {
  const { providerSlug, serviceId, rangeStart, rangeEnd } = params;

  // ---- Cache check ----
  const cacheKey = `avail:${providerSlug}:${serviceId}:${rangeStart.toISOString()}:${rangeEnd.toISOString()}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    // Stored as ISO strings; revive Date objects.
    const parsed = JSON.parse(cached) as {
      start: string;
      end: string;
      capacity: number;
    }[];
    return parsed.map((s) => ({
      start: new Date(s.start),
      end: new Date(s.end),
      capacity: s.capacity,
    }));
  }

  // ---- Fetch the inputs the engine needs ----
  const provider = await prisma.provider.findUnique({
    where: { slug: providerSlug },
    include: {
      rules: true,
      resources: true,
      exceptions: true,
    },
  });
  if (!provider) throw new Error("Provider not found");

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.providerId !== provider.id) {
    throw new Error("Service not found for this provider");
  }

  // Active booking units that could overlap the window, for this provider's resources.
  const resourceIds = provider.resources.map((r) => r.id);
  const units = await prisma.bookingUnit.findMany({
    where: {
      resourceId: { in: resourceIds },
      status: { not: "CANCELLED" },
      startTime: { lt: rangeEnd },
      endTime: { gt: rangeStart },
    },
    select: { resourceId: true, startTime: true, endTime: true },
  });

  // ---- Shape into the engine's plain types ----
  const rules: WeeklyRule[] = provider.rules.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
  }));

  const exceptions: TimeWindow[] = provider.exceptions.map((e) => ({
    start: e.startTime,
    end: e.endTime,
  }));

  const busy: BusyInterval[] = units.map((u) => ({
    resourceId: u.resourceId,
    start: u.startTime,
    end: u.endTime,
  }));

  // ---- Run the pure engine ----
  const slots = computeAvailability({
    rules,
    timezone: provider.timezone,
    durationMinutes: service.durationMinutes,
    rangeStart,
    rangeEnd,
    exceptions,
    resourceIds,
    busy,
  });

  // ---- Cache and return ----
  await redis.set(cacheKey, JSON.stringify(slots), "EX", CACHE_TTL_SECONDS);
  return slots;
}

// Wipe a provider's cached availability — called whenever their bookings change.
export async function invalidateAvailability(
  providerSlug: string,
): Promise<void> {
  const keys = await redis.keys(`avail:${providerSlug}:*`);
  if (keys.length > 0) await redis.del(...keys);
}
