import { CommandContext } from './classid';

const API_BASE_URL = 'http://localhost:3001/api';

const PRIORITY_EMOJI: { [key: string]: string } = {
  LOW: '🟢 Low',
  MEDIUM: '🟡 Medium',
  HIGH: '🔴 High',
};

const STATUS_EMOJI: { [key: string]: string } = {
  PENDING: '⏳ Pending',
  IN_PROGRESS: '⚙️ In Progress',
  DONE: '✅ Done',
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getDaysRemaining = (dateStr: string) => {
  const deadline = new Date(dateStr).getTime();
  const now = new Date().getTime();
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `lewat ${Math.abs(diffDays)} hari`;
  } else if (diffDays === 0) {
    return 'hari ini';
  } else {
    return `${diffDays} hari lagi`;
  }
};

export const tasksCommand = {
  name: 'tasks',
  description: 'Tampilkan daftar tugas kelas atau detail tugas tertentu',
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
      const tasks = classAccount.tasks || [];

      if (tasks.length === 0) {
        await sock.sendMessage(remoteJid, {
          text: `📝 *Tugas:* Belum ada data tugas untuk kelas ini.`,
        });
        return;
      }

      // Sort tasks by deadline ascending
      tasks.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

      // If no args, list all tasks
      if (args.length === 0) {
        let listText = `📝 *Daftar Tugas Kelas - ${classAccount.name}*\n\n`;
        
        tasks.forEach((t: any, index: number) => {
          const status = STATUS_EMOJI[t.status] || t.status;
          const priority = PRIORITY_EMOJI[t.priority] || t.priority;
          const courseLabel = t.course ? `[${t.course.code}] ` : '';
          
          listText += `${index + 1}. *${t.title}*\n`;
          listText += `   📚 Matkul: ${courseLabel}${t.course ? t.course.name : 'Umum'}\n`;
          listText += `   🗓️ Deadline: ${formatDate(t.deadline)} (${getDaysRemaining(t.deadline)})\n`;
          listText += `   📊 Status: ${status} | Prioritas: ${priority}\n\n`;
        });

        listText += `💡 Ketik \`/tasks <nomor>\` untuk melihat rincian dan deskripsi tugas tersebut (contoh: \`/tasks 1\`).`;
        
        await sock.sendMessage(remoteJid, { text: listText });
        return;
      }

      // If args provided, find task by index
      const index = parseInt(args[0], 10);
      if (isNaN(index) || index < 1 || index > tasks.length) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Nomor tugas tidak valid. Ketik \`/tasks\` untuk melihat daftar tugas yang tersedia.`,
        });
        return;
      }

      const t = tasks[index - 1];
      const status = STATUS_EMOJI[t.status] || t.status;
      const priority = PRIORITY_EMOJI[t.priority] || t.priority;
      const courseLabel = t.course ? `[${t.course.code}] ${t.course.name}` : 'Umum';

      let detailText =
        `📝 *Detail Tugas*\n\n` +
        `📌 *Judul:* ${t.title}\n` +
        `📚 *Mata Kuliah:* ${courseLabel}\n` +
        `🗓️ *Deadline:* ${formatDate(t.deadline)} (${getDaysRemaining(t.deadline)})\n` +
        `⚡ *Prioritas:* ${priority}\n` +
        `⚙️ *Status:* ${status}\n\n` +
        `📖 *Deskripsi:* \n${t.description || '_(Tidak ada deskripsi)_'}`;

      await sock.sendMessage(remoteJid, { text: detailText });
    } catch (error) {
      console.error('[ERR] tasks command failed:', error);
      await sock.sendMessage(remoteJid, {
        text: '❌ Gagal mengambil data tugas dari server.',
      });
    }
  },
};
