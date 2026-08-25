-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('FILE', 'LINK', 'NOTE');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "CourseResource" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'DONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseResource_courseId_createdAt_idx" ON "CourseResource"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseResource_taskId_idx" ON "CourseResource"("taskId");

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
