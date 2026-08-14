import { CommandContext } from './classid';

export const helpCommand = {
  name: 'help',
  description: 'Tampilkan semua perintah yang tersedia',
  execute: async ({ sock, remoteJid }: CommandContext) => {
    const text =
      `📚 *Daftar Perintah Bot Man-Education*\n\n` +
      `• \`/ping\` - Cek koneksi bot\n` +
      `• \`/classid\` - Dapatkan ID Grup ini untuk dihubungkan ke kelas\n` +
      `• \`/classinfo\` - Tampilkan info kelas, mahasiswa, dan semester aktif\n` +
      `• \`/semesters [no]\` - Tampilkan daftar semester atau detail semester\n` +
      `• \`/courses [kode/no]\` - Tampilkan daftar mata kuliah semester aktif atau detail mata kuliah\n` +
      `• \`/schedules [hari]\` - Tampilkan jadwal kuliah mingguan atau detail hari tertentu\n` +
      `• \`/tasks [no]\` - Tampilkan daftar tugas kelas atau detail tugas tertentu\n` +
      `• \`/help\` - Tampilkan panduan ini`;
    await sock.sendMessage(remoteJid, { text });
  },
};
