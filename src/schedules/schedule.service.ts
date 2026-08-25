import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

  private async checkConflict(
    scheduleId: string,
    date: string,
    type: string,
    newStartTime?: string,
    newEndTime?: string,
    exceptionId?: string,
  ) {
    if (type !== 'MOVED') return;
    if (!newStartTime || !newEndTime) return;

    const newStart = parseTimeToMinutes(newStartTime);
    const newEnd = parseTimeToMinutes(newEndTime);

    // Get current schedule details to find semester
    const currentSchedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            semesterId: true,
          },
        },
      },
    });
    if (!currentSchedule) return;

    // Get all schedules in this semester
    const allSchedules = await this.prisma.schedule.findMany({
      where: {
        course: {
          semesterId: currentSchedule.course.semesterId,
        },
      },
      include: {
        course: true,
        exceptions: true,
      },
    });

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

    for (const s of allSchedules) {
      // Skip checking against the same schedule
      if (s.id === scheduleId) continue;

      // Check if this schedule runs on the target day of week
      if (s.dayOfWeek === dayOfWeek) {
        // Find if this schedule has an exception on this date
        const otherExc = s.exceptions.find((e) => e.date === date && e.id !== exceptionId);

        let isCancelled = false;
        let start = parseTimeToMinutes(s.startTime);
        let end = parseTimeToMinutes(s.endTime);

        if (otherExc) {
          if (otherExc.type === 'CANCELLED') {
            isCancelled = true;
          } else if (otherExc.type === 'MOVED') {
            if (otherExc.newStartTime) start = parseTimeToMinutes(otherExc.newStartTime);
            if (otherExc.newEndTime) end = parseTimeToMinutes(otherExc.newEndTime);
          }
        }

        if (!isCancelled) {
          // Check overlap: newStart < end && start < newEnd
          if (newStart < end && start < newEnd) {
            throw new BadRequestException(
              `Jadwal bentrok dengan mata kuliah ${s.course.name} (${otherExc?.newStartTime || s.startTime} - ${otherExc?.newEndTime || s.endTime})`
            );
          }
        }
      }
    }
  }

  private async notifyScheduleChange(
    scheduleId: string,
    exception: any,
    changeType: 'CREATED' | 'UPDATED' | 'DELETED',
  ) {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          course: {
            include: {
              semester: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });
      if (!schedule) return;

      const user = schedule.course.semester.user;
      let targetJid: string | null = null;
      let isHidetag = false;

      if (user.role === 'CLASS' && user.whatsappGroupId) {
        targetJid = user.whatsappGroupId;
        isHidetag = true;
      } else if (user.role === 'INDIVIDUAL' && user.whatsappNumber) {
        targetJid = `${user.whatsappNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        isHidetag = false;
      }

      if (!targetJid) return;

      let messageText = '';
      const formattedDate = new Date(exception.date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (changeType === 'DELETED') {
        messageText = `📢 *INFO PERUBAHAN JADWAL*\n\nJadwal kuliah untuk mata kuliah *${schedule.course.name}* pada hari *${formattedDate}* telah dikembalikan ke jadwal normal (${schedule.startTime} - ${schedule.endTime} di ${schedule.room || '-'}).`;
      } else {
        if (exception.type === 'CANCELLED') {
          messageText = `📢 *INFO KELAS BATAL*\n\nKuliah *${schedule.course.name}* pada hari *${formattedDate}* (${schedule.startTime} - ${schedule.endTime}) ditiadakan/dibatalkan.`;
        } else if (exception.type === 'MOVED') {
          messageText = `📢 *INFO PEMINDAHAN JADWAL*\n\nKuliah *${schedule.course.name}* pada hari *${formattedDate}* telah dipindahkan:\n`;
          messageText += `• Jam semula: ${schedule.startTime} - ${schedule.endTime}\n`;
          messageText += `• Jam baru: ${exception.newStartTime || schedule.startTime} - ${exception.newEndTime || schedule.endTime}\n`;
          if (exception.newRoom && exception.newRoom !== schedule.room) {
            messageText += `• Ruangan baru: ${exception.newRoom}\n`;
          }
        } else if (exception.type === 'NOTE') {
          messageText = `📢 *INFO PENTING KELAS*\n\nCatatan informasi untuk kuliah *${schedule.course.name}* pada hari *${formattedDate}*:\n`;
        }

        if (exception.note) {
          messageText += `\n*Catatan*: ${exception.note}`;
        }
      }

      await this.prisma.whatsappQueue.create({
        data: {
          groupId: targetJid,
          message: messageText,
          isHidetag,
        },
      });
    } catch (err) {
      console.error('Failed to send schedule change notification to WhatsApp:', err);
    }
  }

  async createException(scheduleId: string, dto: CreateExceptionDto) {
    await this.checkConflict(scheduleId, dto.date, dto.type || 'CANCELLED', dto.newStartTime, dto.newEndTime);
    const exc = await this.prisma.scheduleException.upsert({
      where: { scheduleId_date: { scheduleId, date: dto.date } },
      create: { ...dto, scheduleId },
      update: { ...dto },
    });
    await this.notifyScheduleChange(scheduleId, exc, 'CREATED');
    return exc;
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
    await this.checkConflict(
      exc.scheduleId,
      exc.date,
      dto.type || exc.type,
      dto.newStartTime || exc.newStartTime || undefined,
      dto.newEndTime || exc.newEndTime || undefined,
      id,
    );
    const updated = await this.prisma.scheduleException.update({ where: { id }, data: dto });
    await this.notifyScheduleChange(updated.scheduleId, updated, 'UPDATED');
    return updated;
  }

  async removeException(id: string) {
    const exc = await this.prisma.scheduleException.findUnique({ where: { id } });
    if (!exc) throw new NotFoundException('Exception not found');
    const deleted = await this.prisma.scheduleException.delete({ where: { id } });
    await this.notifyScheduleChange(deleted.scheduleId, deleted, 'DELETED');
    return deleted;
  }
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
