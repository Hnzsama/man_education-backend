/*
  Warnings:

  - A unique constraint covering the columns `[semesterId,code]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,targetId,offset]` on the table `SentReminder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CustomHoliday" ALTER COLUMN "startDate" SET DATA TYPE TEXT,
ALTER COLUMN "endDate" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ScheduleException" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Course_semesterId_code_key" ON "Course"("semesterId", "code");

-- CreateIndex
CREATE INDEX "Schedule_courseId_dayOfWeek_idx" ON "Schedule"("courseId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Semester_userId_isActive_idx" ON "Semester"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SentReminder_userId_targetId_offset_key" ON "SentReminder"("userId", "targetId", "offset");

-- CreateIndex
CREATE INDEX "Task_userId_status_deadline_idx" ON "Task"("userId", "status", "deadline");

-- CreateIndex
CREATE INDEX "WhatsappQueue_sent_createdAt_idx" ON "WhatsappQueue"("sent", "createdAt");
