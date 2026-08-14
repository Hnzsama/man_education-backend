import { CommandContext } from './classid';

const API_BASE_URL = 'http://localhost:3001/api';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const semestersCommand = {
  name: 'semesters',
  description: 'Tampilkan daftar semester atau detail semester tertentu',
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

      if (semesters.length === 0) {
        await sock.sendMessage(remoteJid, {
          text: `📅 *Semester:* Belum ada data semester yang dibuat untuk kelas ini.`,
        });
        return;
      }

      // Sort semesters by start date ascending
      semesters.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // If no args, list semesters
      if (args.length === 0) {
        let listText = `📅 *Daftar Semester - ${classAccount.name}*\n\n`;
        semesters.forEach((sem: any, index: number) => {
          const status = sem.isActive ? ' 🟢 *[AKTIF]*' : '';
          listText += `${index + 1}. *${sem.name}*${status}\n`;
          listText += `   🗓️ ${formatDate(sem.startDate)} - ${formatDate(sem.endDate)}\n\n`;
        });
        listText += `💡 Ketik \`/semesters <nomor>\` untuk melihat detail mata kuliah pada semester tersebut (contoh: \`/semesters 1\`).`;
        
        await sock.sendMessage(remoteJid, { text: listText });
        return;
      }

      // If args provided, show detail of semesters[index - 1]
      const index = parseInt(args[0], 10);
      if (isNaN(index) || index < 1 || index > semesters.length) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Nomor semester tidak valid. Ketik \`/semesters\` untuk melihat daftar nomor yang tersedia.`,
        });
        return;
      }

      const sem = semesters[index - 1];
      const courses = sem.courses || [];
      const statusLabel = sem.isActive ? 'Aktif 🟢' : 'Tidak Aktif ⚪';

      let detailText =
        `📅 *Detail Semester: ${sem.name}*\n` +
        `🗓️ *Periode:* ${formatDate(sem.startDate)} - ${formatDate(sem.endDate)}\n` +
        `⚙️ *Status:* ${statusLabel}\n\n` +
        `📚 *Mata Kuliah Terdaftar (${courses.length} matkul):*\n`;

      if (courses.length === 0) {
        detailText += `_(Belum ada mata kuliah yang didaftarkan)_`;
      } else {
        courses.forEach((c: any) => {
          detailText += `- *[${c.code}]* ${c.name} (${c.credits} SKS)\n`;
          if (c.lecturer) {
            detailText += `  👨‍🏫 Dosen: ${c.lecturer}\n`;
          }
        });
      }

      await sock.sendMessage(remoteJid, { text: detailText });
    } catch (error) {
      console.error('[ERR] semesters command failed:', error);
      await sock.sendMessage(remoteJid, {
        text: '❌ Gagal mengambil data semester dari server.',
      });
    }
  },
};
