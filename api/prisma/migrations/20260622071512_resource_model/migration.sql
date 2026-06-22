-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "holdExpiresAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingUnit" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_providerId_idx" ON "Resource"("providerId");

-- CreateIndex
CREATE INDEX "BookingUnit_bookingId_idx" ON "BookingUnit"("bookingId");

-- CreateIndex
CREATE INDEX "BookingUnit_resourceId_startTime_idx" ON "BookingUnit"("resourceId", "startTime");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingUnit" ADD CONSTRAINT "BookingUnit_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
