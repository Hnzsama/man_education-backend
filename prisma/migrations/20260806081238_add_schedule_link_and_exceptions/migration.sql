-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('CANCELLED', 'MOVED', 'NOTE');

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "link" TEXT;

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL DEFAULT 'CANCELLED',
    "newStartTime" TEXT,
    "newEndTime" TEXT,
    "newRoom" TEXT,
    "newLink" TEXT,
    "note" TEXT,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_scheduleId_date_key" ON "ScheduleException"("scheduleId", "date");

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
