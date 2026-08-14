import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReminderCronService {
  private readonly logger = new Logger(ReminderCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('*/5 * * * *') // Runs every 5 minutes
  async handleReminders() {
    this.logger.log('Running automated WhatsApp reminders check...');

    try {
      const now = new Date();
      // Get current time in Asia/Jakarta (WIB)
      const jakartaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
      const [currHour, currMin] = jakartaTimeStr.split(':').map(Number);
      const currTotalMins = currHour * 60 + currMin;

      // Map JavaScript Sunday (0) - Saturday (6) to Monday (1) - Sunday (7)
      const jsDay = now.getDay();
      const currDayOfWeek = jsDay === 0 ? 7 : jsDay;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Find all CLASS users with reminders enabled and linked WhatsApp groups
      const classes = await this.prisma.user.findMany({
        where: {
          role: 'CLASS',
          remindersEnabled: true,
          whatsappGroupId: { not: null },
        },
        include: {
          semesters: {
            include: {
              courses: {
                include: {
                  schedules: true,
                },
              },
            },
          },
          tasks: {
            where: {
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            include: {
              course: true,
            },
          },
        },
      });

      for (const classUser of classes) {
        const activeSem = classUser.semesters.find((s) => s.isActive);
        const groupId = classUser.whatsappGroupId;
        if (!groupId) continue;

        // 1. Semester Transition Notifications
        if (classUser.semesterTransitionEnabled) {
          for (const sem of classUser.semesters) {
            const semStartDate = new Date(sem.startDate);
            semStartDate.setHours(0, 0, 0, 0);
            
            // Check if semester starts today
            if (semStartDate.getTime() === startOfToday.getTime()) {
              const alreadySent = await this.prisma.sentReminder.findFirst({
                where: {
                  userId: classUser.id,
                  targetId: sem.id,
                  offset: 0,
                  sentAt: { gte: startOfToday },
                },
              });

              if (!alreadySent) {
                const message = 
                  `🏫 *PEMBERITAHUAN SEMESTER BARU* 🏫\n\n` +
                  `Halo teman-teman, hari ini kita resmi memulai *${sem.name}*! \n` +
                  `🗓️ Periode: ${semStartDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d ${new Date(sem.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\n` +
                  `Mari persiapkan diri dan tetap semangat belajarnya! 🎓🚀`;

                await this.prisma.whatsappQueue.create({
                  data: { groupId, message, isHidetag: true },
                });

                await this.prisma.sentReminder.create({
                  data: { userId: classUser.id, targetId: sem.id, offset: 0 },
                });

                this.logger.log(`Semester start reminder queued for class ${classUser.name}`);
              }
            }
          }
        }

        // Skip schedules if no active semester
        if (activeSem) {
          // 2. Class Schedules Reminders
          for (const course of activeSem.courses) {
            for (const schedule of course.schedules) {
              if (schedule.dayOfWeek !== currDayOfWeek) continue;

              const [schedHour, schedMin] = schedule.startTime.split(':').map(Number);
              const schedTotalMins = schedHour * 60 + schedMin;

              for (const offset of classUser.scheduleReminderOffsets) {
                const targetMins = schedTotalMins - offset;

                // If current time is within 5 minutes of target trigger time
                if (currTotalMins >= targetMins && currTotalMins < targetMins + 5) {
                  const alreadySent = await this.prisma.sentReminder.findFirst({
                    where: {
                      userId: classUser.id,
                      targetId: schedule.id,
                      offset: offset,
                      sentAt: { gte: startOfToday },
                    },
                  });

                  if (!alreadySent) {
                    const roomInfo = schedule.room ? ` di ruang *${schedule.room}*` : '';
                    const linkInfo = schedule.link ? `\n🔗 Link Kelas: ${schedule.link}` : '';
                    const timeLabel = offset % 60 === 0 ? `${offset / 60} jam` : `${offset} menit`;
                    const message = 
                      `🔔 *PENGINGAT JADWAL KULIAH* 🔔\n\n` +
                      `Halo teman-teman, kelas *${course.name}* [${course.code}] akan dimulai dalam *${timeLabel}* (pukul *${schedule.startTime}*)${roomInfo}.\n` +
                      `👨‍&zwj;🏫 Dosen: ${course.lecturer || '-'}${linkInfo}\n\n` +
                      `Harap bersiap-siap dan hadir tepat waktu! 🚀`;

                    await this.prisma.whatsappQueue.create({
                      data: { groupId, message, isHidetag: true },
                    });

                    await this.prisma.sentReminder.create({
                      data: { userId: classUser.id, targetId: schedule.id, offset },
                    });

                    this.logger.log(`Schedule reminder (${timeLabel} before) queued for course ${course.code}`);
                  }
                }
              }
            }
          }
        }

        // 3. Tasks Deadline Reminders
        for (const task of classUser.tasks) {
          const deadlineTime = new Date(task.deadline).getTime();
          const nowTime = now.getTime();
          const diffMins = (deadlineTime - nowTime) / (1000 * 60);

          for (const offset of classUser.taskReminderOffsets) {
            // If deadline is coming up within target offset (up to 15 mins early)
            if (diffMins > 0 && diffMins <= offset && diffMins > offset - 15) {
              const alreadySent = await this.prisma.sentReminder.findFirst({
                where: {
                  userId: classUser.id,
                  targetId: task.id,
                  offset: offset,
                },
              });

              if (!alreadySent) {
                const courseInfo = task.course ? ` [${task.course.code}] ${task.course.name}` : 'Umum';
                const deadlineFormatted = new Date(task.deadline).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const timeLabel = offset % 60 === 0 ? `${offset / 60} jam` : `${offset} menit`;
                const message = 
                  `📝 *PENGINGAT DEADLINE TUGAS* 📝\n\n` +
                  `Halo teman-teman, tugas *"${task.title}"* untuk mata kuliah *${courseInfo}* akan segera berakhir dalam *${timeLabel}*!\n` +
                  `🗓️ Deadline: *${deadlineFormatted} WIB*.\n\n` +
                  `Harap segera dikerjakan dan diselesaikan bagi yang belum! 💪🔥`;

                await this.prisma.whatsappQueue.create({
                  data: { groupId, message, isHidetag: true },
                });

                await this.prisma.sentReminder.create({
                  data: { userId: classUser.id, targetId: task.id, offset },
                });

                this.logger.log(`Task deadline reminder (${timeLabel} before) queued for task "${task.title}"`);
              }
            }
          }
        }
      }
    } catch (err) {
      this.logger.error('Error handling reminders check:', err);
    }
  }
}
