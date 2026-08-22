-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('GFORM', 'EMAIL', 'LMS', 'UPLOAD', 'OFFLINE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isGroupTask" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "myPart" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3),
ADD COLUMN     "submissionLink" TEXT,
ADD COLUMN     "submissionMethod" "SubmissionMethod" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN     "weightPercentage" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailySummaryTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "quietHoursEnd" TEXT,
ADD COLUMN     "quietHoursStart" TEXT;

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
