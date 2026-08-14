import { CommandContext } from './classid';

export const pingCommand = {
  name: 'ping',
  description: 'Cek apakah bot aktif',
  execute: async ({ sock, remoteJid }: CommandContext) => {
    await sock.sendMessage(remoteJid, { text: '🏓 Pong! Bot aktif dan siap melayani.' });
  },
};
