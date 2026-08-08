import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID || null,
  bossRoleId: process.env.BOSS_ROLE_ID || null,
};

export function validateConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');

  if (missing.length > 0) {
    console.error(`❌ Configuração inválida! Faltam as seguintes variáveis no arquivo .env: ${missing.join(', ')}`);
    process.exit(1);
  }
}
