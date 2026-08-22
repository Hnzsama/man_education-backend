import { Module } from '@nestjs/common';
import { CustomHolidaysController } from './custom-holidays.controller';
import { CustomHolidaysService } from './custom-holidays.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CustomHolidaysController],
  providers: [CustomHolidaysService, PrismaService],
  exports: [CustomHolidaysService],
})
export class CustomHolidaysModule {}
