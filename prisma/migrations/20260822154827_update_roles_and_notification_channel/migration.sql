/*
  Warnings:

  - The values [BOTH] on the enum `NotificationChannel` will be removed. If these variants are still used in the database, this will fail.
  - The values [STUDENT,TEACHER,ADMIN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `reminderKey` on the `SentReminder` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `WhatsappQueue` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `WhatsappQueue` table. All the data in the column will be lost.
  - Added the required column `offset` to the `SentReminder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetId` to the `SentReminder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `WhatsappQueue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationChannel_new" AS ENUM ('EMAIL', 'WHATSAPP', 'NONE');
ALTER TABLE "public"."User" ALTER COLUMN "notificationChannel" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "notificationChannel" TYPE "NotificationChannel_new" USING ("notificationChannel"::text::"NotificationChannel_new");
ALTER TYPE "NotificationChannel" RENAME TO "NotificationChannel_old";
ALTER TYPE "NotificationChannel_new" RENAME TO "NotificationChannel";
DROP TYPE "public"."NotificationChannel_old";
ALTER TABLE "User" ALTER COLUMN "notificationChannel" SET DEFAULT 'EMAIL';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('INDIVIDUAL', 'CLASS');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'INDIVIDUAL';
COMMIT;

-- DropIndex
DROP INDEX "SentReminder_userId_reminderKey_key";

-- AlterTable
ALTER TABLE "SentReminder" DROP COLUMN "reminderKey",
ADD COLUMN     "offset" INTEGER NOT NULL,
ADD COLUMN     "targetId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'INDIVIDUAL',
ALTER COLUMN "remindersEnabled" SET DEFAULT false,
ALTER COLUMN "scheduleReminderOffsets" SET DEFAULT ARRAY[360, 180, 60]::INTEGER[],
ALTER COLUMN "taskReminderOffsets" SET DEFAULT ARRAY[1440, 720]::INTEGER[],
ALTER COLUMN "notificationChannel" SET DEFAULT 'EMAIL',
ALTER COLUMN "emailVerified" SET DEFAULT true;

-- AlterTable
ALTER TABLE "WhatsappQueue" DROP COLUMN "scheduledAt",
DROP COLUMN "userId",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "isHidetag" BOOLEAN NOT NULL DEFAULT false;
