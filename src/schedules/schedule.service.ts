import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateExceptionDto,
  UpdateExceptionDto,
} from './dto/schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  // ─── Schedule CRUD ────────────────────────────────────────────────────────

  async create(courseId: string, dto: CreateScheduleDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { semester: { include: { user: true } } },
    });
    if (!course) throw new NotFoundException('Course not found');

    const user = course.semester.user;
    if (user && user.role === 'CLASS' && !user.whatsappGroupId) {
      throw new ForbiddenException('Please link your WhatsApp group first before managing schedules.');
    }

    return this.prisma.schedule.create({
      data: { ...dto, courseId },
    });
  }

  async findByCourse(courseId: string) {
    return this.prisma.schedule.findMany({
      where: { courseId },
      include: {
        exceptions: {
          orderBy: { date: 'asc' },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async findOnecourse(courseId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, courseId },
      include: { exceptions: true },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }

  async update(courseId: string, scheduleId: string, dto: UpdateScheduleDto) {
    await this.findOnecourse(courseId, scheduleId);
    return this.prisma.schedule.update({ where: { id: scheduleId }, data: dto });
  }

  async remove(courseId: string, scheduleId: string) {
    await this.findOnecourse(courseId, scheduleId);
    return this.prisma.schedule.delete({ where: { id: scheduleId } });
  }

  // ─── Schedule Exceptions ──────────────────────────────────────────────────

  async createException(scheduleId: string, dto: CreateExceptionDto) {
    // upsert so re-submitting same date just updates it
    return this.prisma.scheduleException.upsert({
      where: { scheduleId_date: { scheduleId, date: dto.date } },
      create: { ...dto, scheduleId },
      update: { ...dto },
    });
  }

  async findExceptions(scheduleId: string) {
    return this.prisma.scheduleException.findMany({
      where: { scheduleId },
      orderBy: { date: 'asc' },
    });
  }

  async updateException(id: string, dto: UpdateExceptionDto) {
    const exc = await this.prisma.scheduleException.findUnique({ where: { id } });
    if (!exc) throw new NotFoundException('Exception not found');
    return this.prisma.scheduleException.update({ where: { id }, data: dto });
  }

  async removeException(id: string) {
    const exc = await this.prisma.scheduleException.findUnique({ where: { id } });
    if (!exc) throw new NotFoundException('Exception not found');
    return this.prisma.scheduleException.delete({ where: { id } });
  }
}
