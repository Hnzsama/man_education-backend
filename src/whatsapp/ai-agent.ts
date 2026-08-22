import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apiKey = process.env.GEMINI_API_KEY;

// Define tools according to the spec
const functionDeclarations = [
  {
    name: 'createTask',
    description: 'Membuat tugas baru dari input bebas mahasiswa. Panggil ini setiap kali user menyebut ada tugas baru, PR, laporan, atau deadline apapun.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Judul singkat tugas' },
        courseId: { type: 'STRING', description: 'Cocokkan dari daftar course di context. Kosongkan jika tidak yakin.' },
        courseNameRaw: { type: 'STRING', description: 'Nama mata kuliah persis seperti disebut user, untuk fallback jika courseId tidak ketemu' },
        deadline: { type: 'STRING', description: 'ISO datetime, hasil interpretasi dari "jumat malam jam 11" dsb berdasarkan "now" di context' },
        description: { type: 'STRING' },
        isGroupTask: { type: 'BOOLEAN', description: 'Apakah tugas kelompok' },
        myPart: { type: 'STRING', description: 'Bagian yang dikerjakan user sendiri, jika isGroupTask true' },
        weightPercentage: { type: 'NUMBER', description: 'Bobot nilai tugas ini, jika disebutkan' },
        priority: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        submissionMethod: { type: 'STRING', enum: ['GFORM', 'EMAIL', 'LMS', 'UPLOAD', 'OFFLINE'] },
        submissionLink: { type: 'STRING' }
      },
      required: ['title', 'deadline']
    }
  },
  {
    name: 'updateTask',
    description: 'Mengubah field tugas yang sudah ada (deadline, judul, bobot, dll). WAJIB konfirmasi ke user sebelum dipanggil.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING' },
        fields: {
          type: 'OBJECT',
          description: 'Hanya field yang berubah, subset dari field createTask'
        }
      },
      required: ['taskId', 'fields']
    }
  },
  {
    name: 'updateTaskStatus',
    description: 'Menandai progres tugas: belum dikerjakan / sedang dikerjakan / selesai. Panggil saat user bilang "udah kelar", "lagi ngerjain", dsb.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING' },
        status: { type: 'STRING', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] }
      },
      required: ['taskId', 'status']
    }
  },
  {
    name: 'deleteTask',
    description: 'Menghapus tugas. WAJIB konfirmasi eksplisit sebelum dipanggil — ini destruktif.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'listTasks',
    description: 'Mengambil daftar tugas. Panggil saat user tanya "tugas apa aja yang belum kelar", "ada tugas apa minggu ini", dll.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'ALL'] },
        withinDays: { type: 'NUMBER', description: 'Batasi ke deadline dalam N hari ke depan' },
        courseId: { type: 'STRING' }
      }
    }
  },
  {
    name: 'addChecklistItems',
    description: 'Menambahkan satu atau beberapa sub-langkah ke tugas. Jika user hanya bilang "buatin checklist buat tugas ini" tanpa merinci, susun breakdown wajar berdasarkan judul/deskripsi tugas (misal: cari referensi, kerjakan, cek ulang, submit), lalu panggil function ini.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING' },
        items: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['taskId', 'items']
    }
  },
  {
    name: 'toggleChecklistItem',
    description: 'Menandai sub-langkah checklist selesai/belum. Panggil saat user bilang "checklist referensi udah", dll.',
    parameters: {
      type: 'OBJECT',
      properties: {
        itemId: { type: 'STRING' },
        done: { type: 'BOOLEAN' }
      },
      required: ['itemId', 'done']
    }
  },
  {
    name: 'createScheduleException',
    description: 'Mencatar perubahan jadwal kelas tertentu (dibatalkan, dipindah waktu/ruang/online, atau sekadar catatan). Panggil setiap kali user bilang ada kelas yang diganti/libur/pindah.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scheduleId: { type: 'STRING', description: 'Cocokkan dari activeSchedules di context berdasarkan course & hari yang disebut' },
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        type: { type: 'STRING', enum: ['CANCELLED', 'MOVED', 'NOTE'] },
        newStartTime: { type: 'STRING', description: 'HH:mm' },
        newEndTime: { type: 'STRING', description: 'HH:mm' },
        newRoom: { type: 'STRING' },
        newLink: { type: 'STRING' },
        note: { type: 'STRING' }
      },
      required: ['scheduleId', 'date', 'type']
    }
  },
  {
    name: 'listTodayScheduleChanges',
    description: 'Mengambil semua ScheduleException untuk hari ini. Dipakai untuk highlight H-0.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getDailySummary',
    description: 'Mengambil data gabungan: jadwal hari ini/besok + tugas dengan deadline dekat + perubahan jadwal H-0. Panggil saat user minta "summary hari ini", atau dipanggil otomatis oleh cron pagi/malam.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', enum: ['TODAY', 'TOMORROW'] }
      }
    }
  },
  {
    name: 'snoozeReminder',
    description: 'Menunda pengingat tugas tertentu ke waktu lain TANPA mengubah deadline asli. Panggil saat user bilang "ingetin lagi besok aja", "nanti sore aja deh".',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING' },
        remindAgainAt: { type: 'STRING', description: 'ISO datetime' }
      },
      required: ['taskId', 'remindAgainAt']
    }
  },
  {
    name: 'setQuietHours',
    description: 'Mengatur jam tenang — reminder non-darurat tidak dikirim di rentang ini. Panggil saat user bilang "jangan ganggu aku diatas jam 10 malam" dsb.',
    parameters: {
      type: 'OBJECT',
      properties: {
        quietHoursStart: { type: 'STRING', description: 'HH:mm' },
        quietHoursEnd: { type: 'STRING', description: 'HH:mm' }
      },
      required: ['quietHoursStart', 'quietHoursEnd']
    }
  },
  {
    name: 'getBusyWeekCheck',
    description: 'Mengecek apakah 7 hari ke depan tergolong padat (>=3 deadline berdekatan). Dipanggil oleh cron mingguan atau saat user tanya "minggu ini/depan padat gak".',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];

// Context retriever helper
async function getUserContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      semesters: {
        where: { isActive: true },
        include: {
          courses: {
            include: {
              schedules: {
                include: { exceptions: true }
              }
            }
          }
        }
      }
    }
  });

  if (!user) return null;

  // Resolve semester courses and schedules (support class inheritance)
  let activeSemester = user.semesters[0];
  let courses: any[] = [];
  let schedules: any[] = [];

  if (user.joinedClassId) {
    const classCoordinator = await prisma.user.findUnique({
      where: { id: user.joinedClassId },
      include: {
        semesters: {
          where: { isActive: true },
          include: {
            courses: {
              include: {
                schedules: {
                  include: { exceptions: true }
                }
              }
            }
          }
        }
      }
    });
    if (classCoordinator?.semesters[0]) {
      activeSemester = classCoordinator.semesters[0];
    }
  }

  if (activeSemester) {
    courses = activeSemester.courses.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name
    }));

    activeSemester.courses.forEach(c => {
      c.schedules.forEach(s => {
        schedules.push({
          id: s.id,
          courseId: s.courseId,
          courseName: c.name,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room || '-',
          link: s.link || '-',
          exceptions: s.exceptions
        });
      });
    });
  }

  return {
    userId: user.id,
    now: new Date().toISOString(),
    courses,
    activeSchedules: schedules
  };
}

// Main processing loop
export async function processAgentMessage(remoteJid: string, text: string, sock: any) {
  if (!apiKey) {
    console.error('Gemini API key is not configured');
    return;
  }

  const cleanNumber = remoteJid.split('@')[0];
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { whatsappNumber: cleanNumber },
        { whatsappJid: remoteJid },
      ]
    }
  });

  if (!user) {
    // Allow unregistered users to discover their JID
    const lowerText = text.trim().toLowerCase();
    const isAskingJid = lowerText.includes('jid') || lowerText.includes('id saya') || lowerText.includes('nomor saya') || lowerText.includes('siapa aku') || lowerText === 'id';

    if (isAskingJid) {
      await sock.sendMessage(remoteJid, {
        text: `Info WA kamu:\n\n📱 *Nomor:* ${cleanNumber}\n🔗 *JID/LID:* ${remoteJid}\n\nDaftarkan salah satu (atau keduanya) di profil Man Education kamu:\n👉 Buka aplikasi → Profil → WhatsApp Number / WhatsApp JID → Simpan.\n\nSetelah terdaftar, kamu bisa langsung ngobrol dengan saya.`
      });
    } else {
      await sock.sendMessage(remoteJid, {
        text: `Hei! Nomor WA kamu belum terdaftar di Man Education.\n\nDaftarkan dulu:\n1. Buka aplikasi Man Education\n2. Pergi ke menu Profil\n3. Isi kolom *WhatsApp Number* dengan nomor kamu, atau kolom *WhatsApp JID* dengan full JID kamu\n4. Simpan\n\nKetik *"id saya"* atau *"jid"* untuk melihat nomor & JID kamu.`
      });
    }
    return;
  }

  // Get active user context
  const context = await getUserContext(user.id);
  const nowStr = new Date().toISOString();

  // Retrieve last 10 turns of conversation history
  const turns = await prisma.conversationTurn.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    take: 10
  });

  const contents: any[] = [];
  
  // Format past turns for Gemini api
  turns.forEach(t => {
    if (t.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: t.content }] });
    } else if (t.role === 'model') {
      try {
        const parsed = JSON.parse(t.content);
        if (parsed.functionCalls) {
          contents.push({ role: 'model', parts: parsed.functionCalls.map((fc: any) => ({ functionCall: fc })) });
        } else {
          contents.push({ role: 'model', parts: [{ text: t.content }] });
        }
      } catch {
        contents.push({ role: 'model', parts: [{ text: t.content }] });
      }
    } else if (t.role === 'function') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: t.name || '',
            response: JSON.parse(t.content)
          }
        }]
      });
    }
  });

  // Append new user message
  contents.push({ role: 'user', parts: [{ text: `${text}\n\nContext:\n${JSON.stringify(context, null, 2)}` }] });

  // Save new user turn
  await prisma.conversationTurn.create({
    data: {
      userId: user.id,
      role: 'user',
      content: text
    }
  });

  let responseText = '';
  try {
    const response = await fetchGemini(contents);
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const functionCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
    const textPart = parts.find((p: any) => p.text)?.text;

    if (functionCalls.length > 0) {
      // Save model turn containing function calls
      await prisma.conversationTurn.create({
        data: {
          userId: user.id,
          role: 'model',
          content: JSON.stringify({ functionCalls })
        }
      });

      // Handle each function call
      for (const fc of functionCalls) {
        console.log(`[AGENT TOOL] Invoking ${fc.name} with args:`, fc.args);
        
        // Handle confirmation logic for updates/deletes if not confirmed
        const isUpdateOrDelete = ['updateTask', 'deleteTask', 'createScheduleException'].includes(fc.name);
        const lastUserTurn = turns[turns.length - 1]?.content?.toLowerCase() || '';
        const isConfirmed = ['ya', 'iya', 'oke', 'benar', 'yes', 'ok'].some(w => lastUserTurn.includes(w));

        if (isUpdateOrDelete && !isConfirmed) {
          responseText = `Apakah kamu yakin ingin melakukan perubahan ini? Silakan konfirmasi dengan membalas "Ya" atau "Iya".`;
          await sock.sendMessage(remoteJid, { text: responseText });
          await prisma.conversationTurn.create({
            data: {
              userId: user.id,
              role: 'model',
              content: responseText
            }
          });
          return;
        }

        // Execute function
        const result = await executeTool(fc.name, fc.args, user.id);
        
        // Save function response turn
        await prisma.conversationTurn.create({
          data: {
            userId: user.id,
            role: 'function',
            name: fc.name,
            content: JSON.stringify(result)
          }
        });

        // Feed function response back to Gemini to get natural answer
        const followUpContents = [
          ...contents,
          { role: 'model', parts: [{ functionCall: fc }] },
          {
            role: 'function',
            parts: [{
              functionResponse: {
                name: fc.name,
                response: result
              }
            }]
          }
        ];

        const followUpRes = await fetchGemini(followUpContents);
        responseText = followUpRes.candidates?.[0]?.content?.parts?.[0]?.text || 'Selesai dijalankan.';
      }
    } else {
      responseText = textPart || 'Maaf, saya tidak mengerti maksud Anda.';
    }

    // Save final model response
    await prisma.conversationTurn.create({
      data: {
        userId: user.id,
        role: 'model',
        content: responseText
      }
    });

    // Send final message to user via WhatsApp
    await sock.sendMessage(remoteJid, { text: responseText });

    // Prune turns older than 10 per user
    const totalTurns = await prisma.conversationTurn.count({ where: { userId: user.id } });
    if (totalTurns > 15) {
      const oldest = await prisma.conversationTurn.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' }
      });
      if (oldest) {
        await prisma.conversationTurn.delete({ where: { id: oldest.id } });
      }
    }

  } catch (err: any) {
    console.error('[AGENT ERR] Failed to process agent conversation:', err);
    await sock.sendMessage(remoteJid, { text: 'Terjadi kesalahan sistem saat memproses pesan Anda. Coba lagi nanti.' });
  }
}

// Fetch helper to Gemini REST API
async function fetchGemini(contents: any[]) {
  const systemInstruction = `Kamu adalah asisten pribadi mahasiswa via WhatsApp. Tugas kamu: mencatat, mengubah, dan mengingatkan soal tugas kuliah & jadwal — TIDAK LEBIH.

ATURAN:
1. Selalu gunakan function call untuk apapun yang mengubah data (create/update/delete). Jangan pernah bilang "sudah saya tambahkan" tanpa benar-benar memanggil function.
2. Untuk aksi yang mengubah/menghapus data yang SUDAH ADA (update deadline, delete task, ubah jadwal), tampilkan dulu ringkasan perubahan dan minta konfirmasi eksplisit ("konfirmasi?" / "yakin?") sebelum memanggil function. User harus balas ya/iya/oke/benar dulu di giliran berikutnya.
3. Untuk aksi CREATE baru (tugas baru, checklist item baru), langsung eksekusi, lalu balas ringkas hasilnya. Tidak perlu konfirmasi kecuali datanya ambigu.
4. Kalau info kurang (deadline tidak jelas, course tidak ketemu di daftar), TANYA balik, jangan menebak dan langsung create.
5. Course/mata kuliah harus dicocokkan ke daftar course user yang diberikan di context. Kalau tidak ketemu yang mirip, tanya dulu apakah ini course baru.
6. Gaya bahasa: santai, singkat, seperti chat ke teman — bukan seperti bot formal. Tidak usah pakai emoji berlebihan.
7. Tanggal & waktu "sekarang" akan selalu diberikan di context — pakai itu sebagai acuan untuk menafsirkan "besok", "jumat depan", "nanti malam", dst.
8. Kamu hanya boleh membaca/mengubah data milik user yang sedang chat (userId di context). Jangan pernah mengakses data user lain.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  return res.json();
}

// Tool Executor implementation
async function executeTool(name: string, args: any, userId: string) {
  try {
    switch (name) {
      case 'createTask': {
        let courseId = args.courseId || null;
        if (!courseId && args.courseNameRaw) {
          // Resolve course name
          const match = await prisma.course.findFirst({
            where: {
              semester: { userId, isActive: true },
              name: { contains: args.courseNameRaw, mode: 'insensitive' }
            }
          });
          if (match) courseId = match.id;
        }

        const task = await prisma.task.create({
          data: {
            userId,
            courseId,
            title: args.title,
            description: args.description || null,
            deadline: new Date(args.deadline),
            isGroupTask: args.isGroupTask || false,
            myPart: args.myPart || null,
            weightPercentage: args.weightPercentage || null,
            priority: args.priority || 'MEDIUM',
            submissionMethod: args.submissionMethod || 'OFFLINE',
            submissionLink: args.submissionLink || null
          }
        });
        return { success: true, taskId: task.id, message: 'Tugas berhasil dibuat.' };
      }

      case 'updateTask': {
        const updateData: any = {};
        const f = args.fields || {};
        if (f.title !== undefined) updateData.title = f.title;
        if (f.description !== undefined) updateData.description = f.description;
        if (f.deadline !== undefined) updateData.deadline = new Date(f.deadline);
        if (f.isGroupTask !== undefined) updateData.isGroupTask = f.isGroupTask;
        if (f.myPart !== undefined) updateData.myPart = f.myPart;
        if (f.weightPercentage !== undefined) updateData.weightPercentage = f.weightPercentage;
        if (f.priority !== undefined) updateData.priority = f.priority;
        if (f.submissionMethod !== undefined) updateData.submissionMethod = f.submissionMethod;
        if (f.submissionLink !== undefined) updateData.submissionLink = f.submissionLink;

        if (updateData.deadline) {
          await prisma.sentReminder.deleteMany({
            where: { targetId: args.taskId }
          });
        }

        await prisma.task.updateMany({
          where: { id: args.taskId, userId },
          data: updateData
        });
        return { success: true, message: 'Tugas berhasil diperbarui.' };
      }

      case 'updateTaskStatus': {
        await prisma.task.updateMany({
          where: { id: args.taskId, userId },
          data: {
            status: args.status,
            completedAt: args.status === 'DONE' ? new Date() : null
          }
        });
        return { success: true, message: `Status tugas diperbarui menjadi ${args.status}.` };
      }

      case 'deleteTask': {
        await prisma.task.deleteMany({
          where: { id: args.taskId, userId }
        });
        return { success: true, message: 'Tugas berhasil dihapus.' };
      }

      case 'listTasks': {
        const statusClause = args.status === 'ALL' ? undefined : (args.status || 'PENDING');
        const tasks = await prisma.task.findMany({
          where: {
            userId,
            status: statusClause,
            courseId: args.courseId || undefined
          },
          include: { course: true, checklist: true },
          orderBy: { deadline: 'asc' }
        });
        
        let filtered = tasks;
        if (args.withinDays) {
          const limit = new Date();
          limit.setDate(limit.getDate() + args.withinDays);
          filtered = tasks.filter(t => new Date(t.deadline) <= limit);
        }

        return filtered.map(t => ({
          id: t.id,
          title: t.title,
          course: t.course?.name || null,
          deadline: t.deadline.toISOString(),
          status: t.status,
          priority: t.priority,
          isGroupTask: t.isGroupTask,
          myPart: t.myPart,
          checklistCount: t.checklist.length,
          checklistCompleted: t.checklist.filter(c => c.isCompleted).length
        }));
      }

      case 'addChecklistItems': {
        const items = args.items || [];
        const task = await prisma.task.findFirst({ where: { id: args.taskId, userId } });
        if (!task) return { success: false, message: 'Tugas tidak ditemukan.' };

        for (const item of items) {
          await prisma.taskChecklistItem.create({
            data: {
              taskId: args.taskId,
              title: item
            }
          });
        }
        return { success: true, message: `${items.length} checklist item ditambahkan.` };
      }

      case 'toggleChecklistItem': {
        const item = await prisma.taskChecklistItem.findFirst({
          where: { id: args.itemId, task: { userId } }
        });
        if (!item) return { success: false, message: 'Checklist item tidak ditemukan.' };

        await prisma.taskChecklistItem.update({
          where: { id: args.itemId },
          data: { isCompleted: args.done }
        });
        return { success: true, message: 'Checklist item diperbarui.' };
      }

      case 'createScheduleException': {
        await prisma.scheduleException.upsert({
          where: {
            scheduleId_date: {
              scheduleId: args.scheduleId,
              date: args.date
            }
          },
          create: {
            scheduleId: args.scheduleId,
            date: args.date,
            type: args.type,
            newStartTime: args.newStartTime || null,
            newEndTime: args.newEndTime || null,
            newRoom: args.newRoom || null,
            newLink: args.newLink || null,
            note: args.note || null
          },
          update: {
            type: args.type,
            newStartTime: args.newStartTime || null,
            newEndTime: args.newEndTime || null,
            newRoom: args.newRoom || null,
            newLink: args.newLink || null,
            note: args.note || null
          }
        });
        return { success: true, message: 'Perubahan jadwal berhasil dicatat.' };
      }

      case 'listTodayScheduleChanges': {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const exceptions = await prisma.scheduleException.findMany({
          where: {
            date: todayStr,
            schedule: { course: { semester: { userId, isActive: true } } }
          },
          include: { schedule: { include: { course: true } } }
        });
        return exceptions.map(e => ({
          courseName: e.schedule.course.name,
          originalTime: `${e.schedule.startTime} - ${e.schedule.endTime}`,
          type: e.type,
          newStartTime: e.newStartTime,
          newEndTime: e.newEndTime,
          newRoom: e.newRoom,
          newLink: e.newLink,
          note: e.note
        }));
      }

      case 'getDailySummary': {
        const targetDate = new Date();
        if (args.target === 'TOMORROW') {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        const targetDayOfWeek = targetDate.getDay();
        const dateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

        // Retrieve semesters & schedules
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            semesters: {
              where: { isActive: true },
              include: { courses: { include: { schedules: { include: { exceptions: { where: { date: dateStr } } } } } } }
            }
          }
        });

        let activeSemester = user?.semesters[0];
        if (user?.joinedClassId) {
          const coordinator = await prisma.user.findUnique({
            where: { id: user.joinedClassId },
            include: {
              semesters: {
                where: { isActive: true },
                include: { courses: { include: { schedules: { include: { exceptions: { where: { date: dateStr } } } } } } }
              }
            }
          });
          if (coordinator?.semesters[0]) activeSemester = coordinator.semesters[0];
        }

        const schedulesToday: any[] = [];
        if (activeSemester) {
          activeSemester.courses.forEach(c => {
            c.schedules.forEach(s => {
              if (s.dayOfWeek === targetDayOfWeek) {
                schedulesToday.push({
                  courseName: c.name,
                  originalTime: `${s.startTime} WIB`,
                  room: s.room || '-',
                  exception: s.exceptions[0] || null
                });
              }
            });
          });
        }

        // Retrieve active tasks deadline today/tomorrow
        const startOfSummary = new Date(targetDate);
        startOfSummary.setHours(0, 0, 0, 0);
        const endOfSummary = new Date(targetDate);
        endOfSummary.setHours(23, 59, 59, 999);

        const tasksSummary = await prisma.task.findMany({
          where: {
            userId,
            deadline: { gte: startOfSummary, lte: endOfSummary },
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          },
          include: { course: true }
        });

        return {
          target: args.target || 'TODAY',
          date: dateStr,
          schedules: schedulesToday,
          tasks: tasksSummary.map(t => ({ title: t.title, course: t.course?.name || 'Umum', deadline: t.deadline.toISOString() }))
        };
      }

      case 'snoozeReminder': {
        await prisma.task.updateMany({
          where: { id: args.taskId, userId },
          data: {
            snoozedUntil: new Date(args.remindAgainAt)
          }
        });
        return { success: true, message: 'Notifikasi pengingat berhasil ditunda.' };
      }

      case 'setQuietHours': {
        await prisma.user.update({
          where: { id: userId },
          data: {
            quietHoursStart: args.quietHoursStart,
            quietHoursEnd: args.quietHoursEnd
          }
        });
        return { success: true, message: `Jam tenang diatur dari ${args.quietHoursStart} sampai ${args.quietHoursEnd}.` };
      }

      case 'getBusyWeekCheck': {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        const count = await prisma.task.count({
          where: {
            userId,
            deadline: { gte: new Date(), lte: nextWeek },
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          }
        });

        return {
          isBusy: count >= 3,
          taskCount: count,
          message: count >= 3 ? 'Minggu depan padat tugas!' : 'Minggu depan aman santai.'
        };
      }

      default:
        return { success: false, message: 'Fungsi tidak dikenal.' };
    }
  } catch (err: any) {
    console.error(`[TOOL ERR] Error running ${name}:`, err);
    return { success: false, error: err.message };
  }
}
