-- CreateTable
CREATE TABLE "CustomHoliday" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomHoliday_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomHoliday" ADD CONSTRAINT "CustomHoliday_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
