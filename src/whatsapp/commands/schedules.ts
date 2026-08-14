import { CommandContext } from './classid';

const API_BASE_URL = 'http://localhost:3001/api';

const DAYS_MAP: { [key: number]: string } = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

const DAY_NAME_TO_NUM: { [key: string]: number } = {
  '1': 1, 'senin': 1, 'monday': 1,
  '2': 2, 'selasa': 2, 'tuesday': 2,
  '3': 3, 'rabu': 3, 'wednesday': 3,
  '4': 4, 'kamis': 4, 'thursday': 4,
  '5': 5, 'jumat': 5, 'friday': 5,
  '6': 6, 'sabtu': 6, 'saturday': 6,
  '7': 7, 'minggu': 7, 'sunday': 7,
};

export const schedulesCommand = {
  name: 'schedules',
  description: 'Tampilkan jadwal kuliah mingguan atau jadwal hari tertentu',
  execute: async ({ sock, remoteJid, args }: CommandContext) => {
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp-api/class-info/${encodeURIComponent(remoteJid)}`);
      
      if (res.status === 404) {
        await sock.sendMessage(remoteJid, {
          text:
            `⚠️ *Grup Belum Terhubung*\n\n` +
            `Grup ini belum terhubung ke akun kelas mana pun.\n` +
            `Gunakan command \`/classid\` untuk mendapatkan ID grup ini, lalu hubungkan melalui dashboard kelas.`,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const classAccount: any = await res.json();
      const semesters = classAccount.semesters || [];
      const activeSem = semesters.find((s: any) => s.isActive);

      if (!activeSem) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Tidak ada semester aktif saat ini. Silakan aktifkan semester terlebih dahulu melalui dashboard.`,
        });
        return;
      }

      const courses = activeSem.courses || [];
      
      // Extract all schedules
      const allSchedules: any[] = [];
      courses.forEach((c: any) => {
        if (c.schedules) {
          c.schedules.forEach((s: any) => {
            allSchedules.push({
              ...s,
              courseName: c.name,
              courseCode: c.code,
              lecturer: c.lecturer,
            });
          });
        }
      });

      if (allSchedules.length === 0) {
        await sock.sendMessage(remoteJid, {
          text: `🗓️ *Jadwal Kuliah:* Belum ada data jadwal kuliah untuk semester aktif (${activeSem.name}).`,
        });
        return;
      }

      // Group schedules by day of week
      const schedulesByDay: { [key: number]: any[] } = {
        1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: []
      };
      
      allSchedules.forEach((s) => {
        if (schedulesByDay[s.dayOfWeek]) {
          schedulesByDay[s.dayOfWeek].push(s);
        }
      });

      // Sort schedules in each day by start time
      Object.keys(schedulesByDay).forEach((dayKey: any) => {
        schedulesByDay[dayKey].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
      });

      // If no args, list weekly schedules
      if (args.length === 0) {
        let weeklyText = `🗓️ *Jadwal Kuliah Mingguan - ${activeSem.name}*\n\n`;
        
        let hasAnyClasses = false;
        for (let dayNum = 1; dayNum <= 7; dayNum++) {
          const dayScheds = schedulesByDay[dayNum];
          if (dayScheds.length === 0) continue;

          hasAnyClasses = true;
          const dayName = DAYS_MAP[dayNum];
          weeklyText += `*${dayName}:*\n`;
          dayScheds.forEach((s) => {
            const roomLabel = s.room ? ` (R. ${s.room})` : '';
            weeklyText += `  - ${s.startTime} - ${s.endTime} | *${s.courseCode}* - ${s.courseName}${roomLabel}\n`;
          });
          weeklyText += '\n';
        }

        if (!hasAnyClasses) {
          weeklyText += `_(Belum ada jadwal yang diatur)_\n\n`;
        }

        weeklyText += `💡 Ketik \`/schedules <hari>\` untuk melihat detail jadwal hari tersebut (contoh: \`/schedules senin\` atau \`/schedules 1\`).`;
        
        await sock.sendMessage(remoteJid, { text: weeklyText });
        return;
      }

      // If args provided, find day schedule
      const arg = args[0].toLowerCase();
      const targetDayNum = DAY_NAME_TO_NUM[arg];

      if (!targetDayNum || !schedulesByDay[targetDayNum]) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Hari "${arg}" tidak valid. Masukkan nama hari seperti Senin-Minggu atau angka 1-7.`,
        });
        return;
      }

      const dayName = DAYS_MAP[targetDayNum];
      const dayScheds = schedulesByDay[targetDayNum];

      let dayText = `🗓️ *Jadwal Kuliah Hari ${dayName}:*\n\n`;

      if (dayScheds.length === 0) {
        dayText += `Tidak ada jadwal kuliah untuk hari ini. Selamat beristirahat! 🎉`;
      } else {
        dayScheds.forEach((s, idx) => {
          dayText += `${idx + 1}. *${s.courseName}*\n`;
          dayText += `   🔑 Kode: ${s.courseCode}\n`;
          dayText += `   🕒 Waktu: ${s.startTime} - ${s.endTime}\n`;
          if (s.room) {
            dayText += `   📍 Ruangan: ${s.room}\n`;
          }
          if (s.lecturer) {
            dayText += `   👨‍🏫 Dosen: ${s.lecturer}\n`;
          }
          if (s.link) {
            dayText += `   🔗 Link Kelas: ${s.link}\n`;
          }
          dayText += '\n';
        });
      }

      await sock.sendMessage(remoteJid, { text: dayText });
    } catch (error) {
      console.error('[ERR] schedules command failed:', error);
      await sock.sendMessage(remoteJid, {
        text: '❌ Gagal mengambil data jadwal kuliah dari server.',
      });
    }
  },
};
