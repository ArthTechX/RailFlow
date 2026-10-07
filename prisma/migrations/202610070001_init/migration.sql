-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "PassengerStatus" AS ENUM ('CONFIRMED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Train" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Train_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "arrivalMinutes" INTEGER NOT NULL,
    "departureMinutes" INTEGER NOT NULL,

    CONSTRAINT "TrainStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "berth" TEXT NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journey" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "farePaise" INTEGER NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneySeat" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "passengerId" TEXT,

    CONSTRAINT "JourneySeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "status" "PassengerStatus" NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "checkoutUrl" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "Station"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Train_number_key" ON "Train"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TrainStop_routeId_position_key" ON "TrainStop"("routeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_trainId_name_key" ON "Coach"("trainId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_coachId_number_key" ON "Seat"("coachId", "number");

-- CreateIndex
CREATE INDEX "Journey_sourceId_destinationId_departureAt_idx" ON "Journey"("sourceId", "destinationId", "departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneySeat_passengerId_key" ON "JourneySeat"("passengerId");

-- CreateIndex
CREATE INDEX "JourneySeat_journeyId_passengerId_idx" ON "JourneySeat"("journeyId", "passengerId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneySeat_journeyId_seatId_key" ON "JourneySeat"("journeyId", "seatId");

-- CreateIndex
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_userId_idempotencyKey_key" ON "Booking"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerId_key" ON "Payment"("providerId");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "Train"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainStop" ADD CONSTRAINT "TrainStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainStop" ADD CONSTRAINT "TrainStop_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "Train"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "Train"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneySeat" ADD CONSTRAINT "JourneySeat_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneySeat" ADD CONSTRAINT "JourneySeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneySeat" ADD CONSTRAINT "JourneySeat_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

