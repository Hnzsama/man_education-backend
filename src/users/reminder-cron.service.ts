import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { NodemailerService } from '../auth/nodemailer.service';

@Injectable()
export class ReminderCronService {
  private readonly logger = new Logger(ReminderCronService.name);

  constructor(
    private prisma: PrismaService,
    private nodemailer: NodemailerService,
  ) {}

  @Cron('*/5 * * * *') // Runs every 5 minutes
  async handleReminders() {
    this.logger.log('Running automated reminders check...');

    try {
      const now = new Date();
      // Get current time in Asia/Jakarta (WIB)
      const jakartaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
      const [currHour, currMin] = jakartaTimeStr.split(':').map(Number);
      const [currYear, currMonth, currDay] = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).split('-').map(Number);
      const currTotalMins = currHour * 60 + currMin;

      // Fetch holidays for the current year
      let isTodayHoliday = false;
      let holidayName = '';
      try {
        const response = await fetch(`https://api-hari-libur.vercel.app/api?year=${currYear}`);
        if (response.ok) {
          const holidays = await response.json();
          const jakartaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
          const todayHoliday = holidays.find((h: any) => h.holiday_date === jakartaDateStr);
          if (todayHoliday) {
            isTodayHoliday = true;
            holidayName = todayHoliday.holiday_name;
          }
        }
      } catch (err) {
        this.logger.error('Failed to fetch holidays from API:', err);
      }

      if (isTodayHoliday) {
        this.logger.log(`Today is a public holiday (${holidayName}). Skipping scheduled reminders.`);
      }

      // Map JavaScript Sunday (0) - Saturday (6) to Monday (1) - Sunday (7)
      const jsDay = now.getDay();
      const currDayOfWeek = jsDay === 0 ? 7 : jsDay;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Find all users with reminders enabled
      const users = await this.prisma.user.findMany({
        where: {
          remindersEnabled: true,
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

      for (const user of users) {
        // Skip if channel is NONE
        if (user.notificationChannel === 'NONE') continue;

        // Skip if WhatsApp chosen but missing required fields
        if (user.notificationChannel === 'WHATSAPP') {
          if (user.role === 'CLASS' && !user.whatsappGroupId) continue;
          if (user.role === 'INDIVIDUAL' && !user.whatsappNumber) continue;
        }

        // Fetch coordinator semesters/tasks if user joined a class
        let userSemesters = user.semesters;
        let userTasks = user.tasks;

        if (user.joinedClassId) {
          const coordinator = await this.prisma.user.findUnique({
            where: { id: user.joinedClassId },
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
                where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                include: { course: true },
              },
            },
          });
          if (coordinator) {
            userSemesters = coordinator.semesters;
            userTasks = coordinator.tasks;
          }
        }

        const activeSem = userSemesters.find((s) => s.isActive);

        // Helper function to send notification
        const sendNotification = async (subject: string, text: string) => {
          if (user.notificationChannel === 'EMAIL') {
            const htmlContent = `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #4f46e5; margin-bottom: 20px;">${subject}</h2>
                <div style="font-size: 14px; color: #1f2937; line-height: 1.6; white-space: pre-line;">
                  ${text.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}
                </div>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 15px;">
                  Pemberitahuan otomatis dari Man Education.
                </p>
              </div>
            `;
            await this.nodemailer.sendReminderEmail(user.email, subject, htmlContent);
          } else if (user.notificationChannel === 'WHATSAPP') {
            if (user.role === 'CLASS' && user.whatsappGroupId) {
              await this.prisma.whatsappQueue.create({
                data: {
                  groupId: user.whatsappGroupId,
                  message: text,
                  isHidetag: true,
                },
              });
            } else if (user.role === 'INDIVIDUAL' && user.whatsappNumber) {
              const personalJid = `${user.whatsappNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
              await this.prisma.whatsappQueue.create({
                data: {
                  groupId: personalJid,
                  message: text,
                  isHidetag: false,
                },
              });
            }
          }
        };

        // 1. Semester Transition Notifications
        if (user.semesterTransitionEnabled) {
          for (const sem of userSemesters) {
            const semStartDate = new Date(sem.startDate);
            semStartDate.setHours(0, 0, 0, 0);

            // Check if semester starts today
            if (semStartDate.getTime() === startOfToday.getTime()) {
              const alreadySent = await this.prisma.sentReminder.findFirst({
                where: {
                  userId: user.id,
                  targetId: sem.id,
                  offset: 0,
                  sentAt: { gte: startOfToday },
                },
              });

              if (!alreadySent) {
                const subject = 'PEMBERITAHUAN SEMESTER BARU';
                const message =
                  `🏫 *PEMBERITAHUAN SEMESTER BARU* 🏫\n\n` +
                  `Halo ${user.name}, hari ini resmi memulai *${sem.name}*! \n` +
                  `🗓️ Periode: ${semStartDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d ${new Date(sem.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\n` +
                  `Mari persiapkan diri dan tetap semangat belajarnya! 🎓🚀`;

                await sendNotification(subject, message);

                await this.prisma.sentReminder.create({
                  data: { userId: user.id, targetId: sem.id, offset: 0 },
                });

                this.logger.log(`Semester start reminder sent/queued for user ${user.name}`);
              }
            }
          }
        }

        // Skip schedules if no active semester or if today is a public holiday
        if (activeSem && !isTodayHoliday) {
          // 2. Class Schedules Reminders
          for (const course of activeSem.courses) {
            for (const schedule of course.schedules) {
              if (schedule.dayOfWeek !== currDayOfWeek) continue;

              const [schedHour, schedMin] = schedule.startTime.split(':').map(Number);
              const schedTotalMins = schedHour * 60 + schedMin;

              for (const offset of user.scheduleReminderOffsets) {
                const targetMins = schedTotalMins - offset;

                // If current time is within 5 minutes of target trigger time
                if (currTotalMins >= targetMins && currTotalMins < targetMins + 5) {
                  const alreadySent = await this.prisma.sentReminder.findFirst({
                    where: {
                      userId: user.id,
                      targetId: schedule.id,
                      offset: offset,
                      sentAt: { gte: startOfToday },
                    },
                  });

                  if (!alreadySent) {
                    const roomInfo = schedule.room ? ` di ruang *${schedule.room}*` : '';
                    const linkInfo = schedule.link ? `\n🔗 Link Kelas: ${schedule.link}` : '';
                    const timeLabel = offset % 60 === 0 ? `${offset / 60} jam` : `${offset} menit`;
                    const subject = 'PENGINGAT JADWAL KULIAH';
                    const message =
                      `🔔 *PENGINGAT JADWAL KULIAH* 🔔\n\n` +
                      `Halo ${user.name}, kelas *${course.name}* [${course.code}] akan dimulai dalam *${timeLabel}* (pukul *${schedule.startTime}*)${roomInfo}.\n` +
                      `👨‍&zwj;🏫 Dosen: ${course.lecturer || '-'}${linkInfo}\n\n` +
                      `Harap bersiap-siap dan hadir tepat waktu! 🚀`;

                    await sendNotification(subject, message);

                    await this.prisma.sentReminder.create({
                      data: { userId: user.id, targetId: schedule.id, offset },
                    });

                    this.logger.log(`Schedule reminder (${timeLabel} before) sent/queued for user ${user.name} course ${course.code}`);
                  }
                }
              }
            }
          }
        }

        // 3. Tasks Deadline Reminders
        for (const task of userTasks) {
          const deadlineTime = new Date(task.deadline).getTime();
          const nowTime = now.getTime();
          const diffMins = (deadlineTime - nowTime) / (1000 * 60);

          for (const offset of user.taskReminderOffsets) {
            // If deadline is coming up within target offset (up to 15 mins early)
            if (diffMins > 0 && diffMins <= offset && diffMins > offset - 15) {
              const alreadySent = await this.prisma.sentReminder.findFirst({
                where: {
                  userId: user.id,
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
                const subject = 'PENGINGAT DEADLINE TUGAS';
                const message =
                  `📝 *PENGINGAT DEADLINE TUGAS* 📝\n\n` +
                  `Halo ${user.name}, tugas *"${task.title}"* untuk mata kuliah *${courseInfo}* akan segera berakhir dalam *${timeLabel}*!\n` +
                  `🗓️ Deadline: *${deadlineFormatted} WIB*.\n\n` +
                  `Harap segera dikerjakan dan diselesaikan bagi yang belum! 💪🔥`;

                await sendNotification(subject, message);

                await this.prisma.sentReminder.create({
                  data: { userId: user.id, targetId: task.id, offset },
                });

                this.logger.log(`Task deadline reminder (${timeLabel} before) sent/queued for user ${user.name} task "${task.title}"`);
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
