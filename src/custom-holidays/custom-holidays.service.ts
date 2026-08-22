import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCustomHolidayDto, UpdateCustomHolidayDto } from './dto/custom-holiday.dto';

@Injectable()
export class CustomHolidaysService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCustomHolidayDto) {
    return this.prisma.customHoliday.create({
      data: {
        userId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true },
    });
    
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }

    return this.prisma.customHoliday.findMany({
      where: { userId: { in: userIds } },
      orderBy: { startDate: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateCustomHolidayDto) {
    const holiday = await this.prisma.customHoliday.findFirst({
      where: { id, userId },
    });

    if (!holiday) {
      throw new NotFoundException('Custom holiday not found');
    }

    return this.prisma.customHoliday.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate || undefined,
        endDate: dto.endDate || undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    const holiday = await this.prisma.customHoliday.findFirst({
      where: { id, userId },
    });

    if (!holiday) {
      throw new NotFoundException('Custom holiday not found');
    }

    await this.prisma.customHoliday.delete({
      where: { id },
    });

    return { message: 'Custom holiday deleted successfully' };
  }
}
