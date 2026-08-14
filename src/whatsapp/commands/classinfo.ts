import { CommandContext } from './classid';

const API_BASE_URL = 'http://localhost:3001/api';

export const classinfoCommand = {
  name: 'classinfo',
  description: 'Tampilkan informasi lengkap tentang kelas yang terhubung ke grup ini',
  execute: async ({ sock, remoteJid }: CommandContext) => {
    try {
      // Panggil API backend yang aman (tidak terbentur Prisma client initialization)
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
      const activeSemester = classAccount.semesters?.[0];
      const studentCount = classAccount.students?.length || 0;

      let infoText =
        `🏫 *Informasi Kelas: ${classAccount.name}*\n` +
        `🔑 *Kode Kelas:* ${classAccount.classCode || '-'}\n` +
        `👥 *Jumlah Mahasiswa:* ${studentCount} orang\n\n`;

      if (activeSemester) {
        infoText +=
          `📅 *Semester Aktif:* ${activeSemester.name}\n` +
          `📚 *Jumlah Mata Kuliah:* ${activeSemester.courses?.length || 0} matkul\n`;
      } else {
        infoText += `📅 *Semester Aktif:* Belum ada semester aktif.\n`;
      }

      await sock.sendMessage(remoteJid, { text: infoText });
    } catch (error) {
      console.error('[ERR] classinfo failed:', error);
      await sock.sendMessage(remoteJid, {
        text: '❌ Gagal terhubung ke server utama untuk mengambil data kelas.',
      });
    }
  },
};
