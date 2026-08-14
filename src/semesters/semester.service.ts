import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';

@Injectable()
export class SemesterService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSemesterDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'CLASS' && !user.whatsappGroupId) {
      throw new ForbiddenException('Please link your WhatsApp group first before managing semesters.');
    }

    return this.prisma.semester.create({
      data: { ...dto, userId },
      include: { courses: true },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }
    return this.prisma.semester.findMany({
      where: { userId: { in: userIds } },
      include: { courses: { include: { schedules: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async findByIdUser(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedClassId: true }
    });
    const userIds = [userId];
    if (user?.joinedClassId) {
      userIds.push(user.joinedClassId);
    }
    const semester = await this.prisma.semester.findFirst({
      where: { id, userId: { in: userIds } },
      include: { courses: { include: { schedules: true } } },
    });
    if (!semester) throw new NotFoundException('Semester not found');
    return semester;
  }

  async update(userId: string, id: string, dto: UpdateSemesterDto) {
    const semester = await this.prisma.semester.findFirst({ where: { id, userId } });
    if (!semester) throw new NotFoundException('Semester not found');
    return this.prisma.semester.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const semester = await this.prisma.semester.findFirst({ where: { id, userId } });
    if (!semester) throw new NotFoundException('Semester not found');
    return this.prisma.semester.delete({ where: { id } });
  }
}
