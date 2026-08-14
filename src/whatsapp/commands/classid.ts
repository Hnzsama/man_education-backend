import { WASocket, isJidGroup } from '@whiskeysockets/baileys';

export interface CommandContext {
  sock: WASocket;
  remoteJid: string;
  args: string[];
  message: any;
}

export const classidCommand = {
  name: 'classid',
  description: 'Dapatkan ID grup WhatsApp ini untuk dihubungkan ke akun kelas',
  execute: async ({ sock, remoteJid }: CommandContext) => {
    if (isJidGroup(remoteJid)) {
      await sock.sendMessage(remoteJid, {
        text:
          `🔑 *ID Grup WhatsApp ini:*\n\n` +
          `\`${remoteJid}\`\n\n` +
          `Copy ID di atas, lalu masukkan ke dashboard kelas → *Hubungkan WhatsApp Grup*.`,
      });
    } else {
      await sock.sendMessage(remoteJid, {
        text: '⚠️ Perintah ini hanya bisa dipakai di dalam *grup WhatsApp*, bukan chat pribadi.',
      });
    }
  },
};
