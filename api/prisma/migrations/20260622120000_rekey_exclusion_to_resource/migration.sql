-- btree_gist already enabled from Day 5, harmless to assert
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Remove the old provider-keyed constraint (lived on Booking)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap;

-- New rule: no two overlapping units on the SAME RESOURCE.
-- Same seat can't be double-claimed; different seats at the same time are fine.
ALTER TABLE "BookingUnit"
  ADD CONSTRAINT bookingunit_no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startTime", "endTime") WITH &&
  )
  WHERE (status <> 'CANCELLED');