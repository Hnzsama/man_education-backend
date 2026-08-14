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

export const coursesCommand = {
  name: 'courses',
  description: 'Tampilkan daftar mata kuliah semester aktif atau detail mata kuliah tertentu',
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

      if (courses.length === 0) {
        await sock.sendMessage(remoteJid, {
          text: `📚 *Mata Kuliah:* Belum ada data mata kuliah yang terdaftar di semester aktif (${activeSem.name}).`,
        });
        return;
      }

      // If no args, list courses
      if (args.length === 0) {
        let listText = `📚 *Daftar Mata Kuliah - ${activeSem.name} (Aktif)*\n\n`;
        courses.forEach((c: any, index: number) => {
          listText += `${index + 1}. *[${c.code}]* ${c.name} (${c.credits} SKS)\n`;
          if (c.lecturer) {
            listText += `   👨‍🏫 Dosen: ${c.lecturer}\n`;
          }
          listText += '\n';
        });
        listText += `💡 Ketik \`/courses <nomor/kode>\` untuk melihat detail mata kuliah dan jadwalnya (contoh: \`/courses 1\` atau \`/courses ${courses[0].code}\`).`;
        
        await sock.sendMessage(remoteJid, { text: listText });
        return;
      }

      // If args provided, find course by index or code
      const arg = args[0];
      const index = parseInt(arg, 10);
      let course: any = null;

      if (!isNaN(index) && index >= 1 && index <= courses.length) {
        course = courses[index - 1];
      } else {
        course = courses.find((c: any) => c.code.toLowerCase() === arg.toLowerCase());
      }

      if (!course) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Mata kuliah dengan kode atau nomor "${arg}" tidak ditemukan di semester aktif.`,
        });
        return;
      }

      const schedules = course.schedules || [];

      let detailText =
        `📚 *Detail Mata Kuliah*\n\n` +
        `📖 *Nama:* ${course.name}\n` +
        `🔑 *Kode:* ${course.code}\n` +
        `📊 *Bobot SKS:* ${course.credits} SKS\n` +
        `👨‍🏫 *Dosen Pengampu:* ${course.lecturer || '-'}\n\n` +
        `🗓️ *Jadwal Kuliah:* \n`;

      if (schedules.length === 0) {
        detailText += `_(Belum ada jadwal yang diatur)_`;
      } else {
        schedules.forEach((s: any) => {
          const dayName = DAYS_MAP[s.dayOfWeek] || 'Hari Lain';
          const roomLabel = s.room ? ` (Ruang: ${s.room})` : '';
          const linkLabel = s.link ? `\n     🔗 Link: ${s.link}` : '';
          detailText += `- *${dayName}:* ${s.startTime} - ${s.endTime}${roomLabel}${linkLabel}\n`;
        });
      }

      await sock.sendMessage(remoteJid, { text: detailText });
    } catch (error) {
      console.error('[ERR] courses command failed:', error);
      await sock.sendMessage(remoteJid, {
        text: '❌ Gagal mengambil data mata kuliah dari server.',
      });
    }
  },
};
