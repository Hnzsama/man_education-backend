// Standalone WhatsApp Bot pakai raw Baileys (@whiskeysockets/baileys)
// Jalankan dengan: pnpm run whatsapp
import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import * as path from 'path';
import * as fs from 'fs';
import { commands } from './commands';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { processAgentMessage } from './ai-agent';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AUTH_FOLDER = path.join(process.cwd(), 'whatsapp_session');
const BOT_PREFIX = '/';

if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleMessage(sock: WASocket, remoteJid: string, text: string, rawMessage: any) {
  const cleanText = text.trim();
  if (!cleanText.startsWith(BOT_PREFIX)) return;

  // Parsing command name dan args
  // Contoh: /classinfo arg1 arg2 -> cmdName = "classinfo", args = ["arg1", "arg2"]
  const parts = cleanText.slice(BOT_PREFIX.length).split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Cari command yang sesuai
  const command = commands.find((c) => c.name === cmdName);

  if (command) {
    console.log(`[CMD RUN] Running /${cmdName} for ${remoteJid}`);
    await command.execute({
      sock,
      remoteJid,
      args,
      message: rawMessage,
    });
  } else {
    // Abaikan jika command tidak dikenal agar tidak mengganggu obrolan grup biasa
    console.log(`[CMD IGNORED] Command /${cmdName} not found`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

let retryCount = 0;
const MAX_RETRIES = 5;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`📦 Menggunakan Baileys versi ${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Pairing Code (jika belum terdaftar) ───────────────────────────────────
  if (!state.creds.registered) {
    const phoneNumber = (process.env.WHATSAPP_PAIRING_NUMBER || '').replace(/\D/g, '');
    if (phoneNumber) {
      // Tunggu sebentar agar socket siap sebelum request pairing code
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        const formatted = code.match(/.{1,4}/g)?.join('-') ?? code;
        console.log('\n┌─────────────────────────────────────────┐');
        console.log('│         🔗 WHATSAPP PAIRING CODE         │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  Kode  :  ${formatted.padEnd(30)}│`);
        console.log('├─────────────────────────────────────────┤');
        console.log('│  Cara pakai:                            │');
        console.log('│  1. Buka WhatsApp di HP                 │');
        console.log('│  2. Linked Devices → Link with number   │');
        console.log('│  3. Masukkan kode di atas               │');
        console.log('└─────────────────────────────────────────┘\n');
      } catch (err) {
        console.error('❌ Gagal mendapatkan pairing code:', err);
        console.log('⚠️  Fallback ke QR code...');
        // Fallback: tampilkan QR via connection.update
      }
    } else {
      console.log('ℹ️  WHATSAPP_PAIRING_NUMBER tidak di-set → gunakan QR code');
      console.log('   (Set WHATSAPP_PAIRING_NUMBER=628xxx di .env untuk pakai pairing code)\n');
    }
  }

let queueInterval: NodeJS.Timeout | null = null;

function startQueuePolling(sock: any) {
  if (queueInterval) clearInterval(queueInterval);

  queueInterval = setInterval(async () => {
    try {
      const pendingMessages = await prisma.whatsappQueue.findMany({
        where: { sent: false },
        orderBy: { createdAt: 'asc' },
      });

      for (const msg of pendingMessages) {
        console.log(`[QUEUE] Sending message to ${msg.groupId}...`);

        let sendOptions: any = {};
        
        if (msg.isHidetag) {
          try {
            const metadata = await sock.groupMetadata(msg.groupId);
            if (metadata && metadata.participants) {
              sendOptions.mentions = metadata.participants.map((p: any) => p.id);
            }
          } catch (metaErr) {
            console.error('[QUEUE] Failed to fetch group metadata for hidetag:', metaErr);
          }
        }

        await sock.sendMessage(msg.groupId, {
          text: msg.message,
          ...sendOptions,
        });

        await prisma.whatsappQueue.update({
          where: { id: msg.id },
          data: { sent: true },
        });

        console.log(`[QUEUE] Message ${msg.id} sent successfully.`);
      }
    } catch (err) {
      console.error('[QUEUE ERR] Error polling queue:', err);
    }
  }, 10000); // Poll every 10 seconds
}

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Fallback QR jika pairing code tidak tersedia
    if (qr) {
      console.log('\n⚡ SCAN QR INI DENGAN WHATSAPP DI PONSELMU ⚡\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      retryCount = 0; // reset counter
      console.log('\n✅ WhatsApp berhasil terhubung!');
      startQueuePolling(sock);
    }

    if (connection === 'close') {
      if (queueInterval) {
        clearInterval(queueInterval);
        queueInterval = null;
      }

      const errStatus = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = errStatus === DisconnectReason.loggedOut;
      const isReplaced = errStatus === DisconnectReason.connectionReplaced;

      if (isLoggedOut) {
        console.log('\n🚪 Logout. Hapus folder whatsapp_session/ lalu jalankan ulang.');
        process.exit(0);
      }

      if (isReplaced) {
        console.log('\n⚠️  Conflict: sesi dipakai di tempat lain. Bot berhenti.');
        console.log('   Pastikan tidak ada instance bot lain yang berjalan.');
        process.exit(1);
      }

      if (retryCount >= MAX_RETRIES) {
        console.log(`\n❌ Gagal reconnect setelah ${MAX_RETRIES} percobaan. Bot berhenti.`);
        process.exit(1);
      }

      retryCount++;
      const delay = Math.min(1000 * 2 ** retryCount, 30_000);
      console.log(`🔄 Koneksi terputus (${retryCount}/${MAX_RETRIES}), reconnect dalam ${delay / 1000}s...`);
      setTimeout(() => startBot(), delay);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text) continue;

      console.log(`[MSG] ${remoteJid}: ${text}`);
      await processAgentMessage(remoteJid, text, sock).catch((err) =>
        console.error('[ERR] gagal handle pesan:', err),
      );
    }
  });
}

startBot().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
