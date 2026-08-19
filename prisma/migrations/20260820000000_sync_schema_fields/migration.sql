-- CreateEnum
CREATE TYPE IF NOT EXISTS "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum  
CREATE TYPE IF NOT EXISTS "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'BOTH');

-- AlterTable: Semester
ALTER TABLE "Semester" ADD COLUMN IF NOT EXISTS "academicStartDate" TIMESTAMP(3);
ALTER TABLE "Semester" ADD COLUMN IF NOT EXISTS "holidayStartDate" TIMESTAMP(3);

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappGroupId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduleReminderOffsets" INTEGER[] DEFAULT ARRAY[30]::INTEGER[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "taskReminderOffsets" INTEGER[] DEFAULT ARRAY[1440]::INTEGER[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "semesterTransitionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "classCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "joinedClassId" TEXT;

-- CreateIndex (unique, ignore if exists)
CREATE UNIQUE INDEX IF NOT EXISTS "User_classCode_key" ON "User"("classCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_whatsappGroupId_key" ON "User"("whatsappGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT IF NOT EXISTS "User_joinedClassId_fkey" 
  FOREIGN KEY ("joinedClassId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: WhatsappQueue
CREATE TABLE IF NOT EXISTS "WhatsappQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SentReminder
CREATE TABLE IF NOT EXISTS "SentReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SentReminder
CREATE UNIQUE INDEX IF NOT EXISTS "SentReminder_userId_reminderKey_key" ON "SentReminder"("userId", "reminderKey");

-- AddForeignKey: SentReminder
ALTER TABLE "SentReminder" ADD CONSTRAINT IF NOT EXISTS "SentReminder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
