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
      const jakartaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD

      // Fetch holidays for the current year
      let isTodayHoliday = false;
      let holidayName = '';
      try {
        const response = await fetch(`https://api-hari-libur.vercel.app/api?year=${currYear}`);
        if (response.ok) {
          const json = await response.json();
          // API returns { status, code, data: [...] } — unwrap
          const holidays: any[] = Array.isArray(json) ? json : (json?.data ?? []);
          const jakartaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
          const todayHoliday = holidays.find((h: any) => h.date === jakartaDateStr);
          if (todayHoliday) {
            isTodayHoliday = true;
            holidayName = todayHoliday.description;
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
                  schedules: { include: { exceptions: true } },
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
          customHolidays: true,
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

        // Fetch coordinator semesters/tasks/holidays if user joined a class
        let userSemesters = user.semesters;
        let userTasks = user.tasks;
        let userCustomHolidays = user.customHolidays;

        if (user.joinedClassId) {
          const coordinator = await this.prisma.user.findUnique({
            where: { id: user.joinedClassId },
            include: {
              semesters: {
                include: {
                  courses: {
                    include: {
                      schedules: { include: { exceptions: true } },
                    },
                  },
                },
              },
              tasks: {
                where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                include: { course: true },
              },
              customHolidays: true,
            },
          });
          if (coordinator) {
            userSemesters = coordinator.semesters;
            userTasks = coordinator.tasks;
            userCustomHolidays = coordinator.customHolidays;
          }
        }

        const activeSem = userSemesters.find((s) => s.isActive);

        // Quiet hours check logic
        const isTimeInQuietHours = (start: string | null, end: string | null): boolean => {
          if (!start || !end) return false;
          const [sh, sm] = start.split(':').map(Number);
          const [eh, em] = end.split(':').map(Number);
          const s = sh * 60 + sm;
          const e = eh * 60 + em;
          const c = currHour * 60 + currMin;
          if (s <= e) return c >= s && c <= e;
          return c >= s || c <= e;
        };

        // Helper function to send notification (supports urgent bypass for quiet hours)
        const sendNotification = async (subject: string, text: string, isUrgent = false) => {
          if (!isUrgent && isTimeInQuietHours(user.quietHoursStart, user.quietHoursEnd)) {
            this.logger.log(`Skipping non-urgent notification for ${user.name} during quiet hours.`);
            return;
          }

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

        // 0. Combined Daily Summary Trigger
        const currTimeStr = `${String(currHour).padStart(2, '0')}:${String(currMin).padStart(2, '0')}`;
        const summaryKey = `daily-summary-${jakartaDateStr}`;
        const summarySent = await this.prisma.sentReminder.findFirst({
          where: { userId: user.id, targetId: summaryKey }
        });

        const dailySummaryTime = user.dailySummaryTime || "07:00";
        const [sumHour, sumMin] = dailySummaryTime.split(':').map(Number);
        const sumTotalMins = sumHour * 60 + sumMin;
        const isSummaryTime = currTotalMins >= sumTotalMins && currTotalMins < sumTotalMins + 5;

        if (isSummaryTime && !summarySent) {
          await this.sendCombinedDailySummary(user, jakartaDateStr);
          await this.prisma.sentReminder.create({
            data: { userId: user.id, targetId: summaryKey, offset: 9999 }
          });
        }

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

        let isTodayCustomHoliday = false;
        let customHolidayName = '';
        if (userCustomHolidays) {
          for (const ch of userCustomHolidays) {
            if (jakartaDateStr >= ch.startDate && jakartaDateStr <= ch.endDate) {
              isTodayCustomHoliday = true;
              customHolidayName = ch.name;
              break;
            }
          }
        }

        // Skip schedules if no active semester or if today is a public/custom holiday
        if (activeSem && !isTodayHoliday && !isTodayCustomHoliday) {
          // 2. Class Schedules Reminders
          for (const course of activeSem.courses) {
            for (const schedule of course.schedules) {
              if (schedule.dayOfWeek !== currDayOfWeek) continue;

              const exception = (schedule as any).exceptions?.find((e: any) => e.date === jakartaDateStr);

              let isCancelled = false;
              let targetStartTime = schedule.startTime;
              let targetEndTime = schedule.endTime;
              let targetRoom = schedule.room;
              let targetLink = schedule.link;
              let noteText = '';

              if (exception) {
                if (exception.type === 'CANCELLED') {
                  isCancelled = true;
                } else if (exception.type === 'MOVED') {
                  targetStartTime = exception.newStartTime || schedule.startTime;
                  targetEndTime = exception.newEndTime || schedule.endTime;
                  targetRoom = exception.newRoom || schedule.room;
                  targetLink = exception.newLink || schedule.link;
                  noteText = exception.note ? `\nCatatan: ${exception.note}` : '';
                } else if (exception.type === 'NOTE') {
                  noteText = exception.note ? `\nCatatan: ${exception.note}` : '';
                }
              }

              if (isCancelled) {
                continue;
              }

              const [schedHour, schedMin] = targetStartTime.split(':').map(Number);
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
                    const roomInfo = targetRoom ? ` di ruang *${targetRoom}*` : '';
                    const linkInfo = targetLink ? `\n🔗 Link Kelas: ${targetLink}` : '';
                    const timeLabel = offset % 60 === 0 ? `${offset / 60} jam` : `${offset} menit`;
                    const movedHeader = exception && exception.type === 'MOVED' ? ' [JADWAL PINDAH]' : '';
                    const subject = `PENGINGAT JADWAL KULIAH${movedHeader}`;
                    const message =
                      `🔔 *PENGINGAT JADWAL KULIAH${movedHeader}* 🔔\n\n` +
                      `Halo ${user.name}, kelas *${course.name}* [${course.code}] akan dimulai dalam *${timeLabel}* (pukul *${targetStartTime} - ${targetEndTime} WIB*)${roomInfo}.\n` +
                      `👨‍🏫 Dosen: ${course.lecturer || '-'}${linkInfo}${noteText}\n\n` +
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

  async sendCombinedDailySummary(user: any, jakartaDateStr: string) {
    try {
      const context = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          semesters: {
            where: { isActive: true },
            include: {
              courses: {
                include: {
                  schedules: {
                    include: {
                      exceptions: { where: { date: jakartaDateStr } }
                    }
                  }
                }
              }
            }
          },
          tasks: {
            where: {
              status: { in: ['PENDING', 'IN_PROGRESS'] },
              deadline: {
                gte: new Date(new Date().setHours(0,0,0,0)),
                lte: new Date(new Date().setDate(new Date().getDate() + 1))
              }
            },
            include: { course: true }
          }
        }
      });

      let activeSemester = context?.semesters[0];
      if (user.joinedClassId) {
        const coordinator = await this.prisma.user.findUnique({
          where: { id: user.joinedClassId },
          include: {
            semesters: {
              where: { isActive: true },
              include: {
                courses: {
                  include: {
                    schedules: {
                      include: {
                        exceptions: { where: { date: jakartaDateStr } }
                      }
                    }
                  }
                }
              }
            }
          }
        });
        if (coordinator?.semesters[0]) activeSemester = coordinator.semesters[0];
      }

      const todayDayOfWeek = new Date().getDay();
      const schedulesToday: any[] = [];
      if (activeSemester) {
        activeSemester.courses.forEach(c => {
          c.schedules.forEach(s => {
            if (s.dayOfWeek === todayDayOfWeek) {
              schedulesToday.push({
                courseName: c.name,
                startTime: s.startTime,
                endTime: s.endTime,
                room: s.room || '-',
                link: s.link || '-',
                exception: s.exceptions[0] || null
              });
            }
          });
        });
      }

      const tasks = context?.tasks || [];

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        this.logger.error('Gemini API key is not configured for daily summary');
        return;
      }

      const prompt = `Buatkan pesan ringkasan harian (Daily Summary) mahasiswa hari ini (${jakartaDateStr}).
Gaya bahasa: santai, singkat, seperti chat ke teman.
Gunakan format markdown WhatsApp (*bold* untuk penekanan).
HIGHLIGHT TERLEBIH DAHULU jika ada perubahan jadwal H-0 (schedules dengan exception) paling awal dan paling menonjol!

Data Jadwal Kuliah Hari Ini:
${JSON.stringify(schedulesToday, null, 2)}

Data Tugas Kuliah (Deadline Hari Ini & Besok):
${JSON.stringify(tasks.map(t => ({ title: t.title, course: t.course?.name || 'Umum', deadline: t.deadline.toISOString() })), null, 2)}`;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || 'Selamat pagi! Tidak ada agenda khusus hari ini.';
        
        if (user.whatsappNumber) {
          const personalJid = `${user.whatsappNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
          await this.prisma.whatsappQueue.create({
            data: {
              groupId: personalJid,
              message: text,
              isHidetag: false,
            }
          });
        }
      }
    } catch (err) {
      this.logger.error('Failed to generate daily combined summary:', err);
    }
  }
}
