-- Teach the database's range index how to also check "same provider"
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Forbid two overlapping bookings for the same provider.
-- Cancelled bookings don't count, so a freed slot can be rebooked.
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "providerId" WITH =,
    tstzrange("startTime", "endTime") WITH &&
  )
  WHERE (status <> 'CANCELLED');