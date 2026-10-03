import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID || null,
  geloAnnouncementChannelId: process.env.GELO_ANNOUNCEMENT_CHANNEL_ID || null,
  bossRoleId: process.env.BOSS_ROLE_ID || process.env.MEMBROS_ROLE_ID || null,
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || null,
  geminiRateLimit: Number(process.env.GEMINI_RATE_LIMIT) || 5,
  checkinChannelId: process.env.CHECKIN_CHANNEL_ID || process.env.GELO_ANNOUNCEMENT_CHANNEL_ID || null,
  rankingChannelId: process.env.RANKING_CHANNEL_ID || null,
  checkinPingRole: process.env.CHECKIN_PING_ROLE || '@everyone',
  checkinAutoDelayMinutes: Number(process.env.CHECKIN_AUTO_DELAY_MINUTES) || 3,
  boostTimeStart: process.env.BOOST_TIME_START || '00:00',
  boostTimeEnd: process.env.BOOST_TIME_END || '07:00',
  boostTimeBonusPoints: Number(process.env.BOOST_TIME_BONUS_POINTS) || 2,
  boostTimeEnabled: process.env.BOOST_TIME_ENABLED !== 'false',
  ta2DelayMinutes: Number(process.env.TA2_DELAY_MINUTES) || 1,
  ta2DurationMinutes: Number(process.env.TA2_DURATION_MINUTES) || 5,
  ta3DelayMinutes: Number(process.env.TA3_DELAY_MINUTES) || 3,
  ta3DurationMinutes: Number(process.env.TA3_DURATION_MINUTES) || 5,
  ta4Enabled: process.env.TA4_ENABLED === 'true',
  ta4DelayMinutes: Number(process.env.TA4_DELAY_MINUTES) || 5,
  ta4DurationMinutes: Number(process.env.TA4_DURATION_MINUTES) || 5,
  globalEnabled: process.env.GLOBAL_ENABLED !== 'false',
  globalDays: process.env.GLOBAL_DAYS ? process.env.GLOBAL_DAYS.split(',').map(d => d.trim().toLowerCase()) : ['quinta', 'domingo'],
  globalTime: process.env.GLOBAL_TIME || '22:00',
  globalAutoCheckin: process.env.GLOBAL_AUTO_CHECKIN === 'true',
  globalDelayMinutes: Number(process.env.GLOBAL_DELAY_MINUTES) || 10,
  globalDurationMinutes: Number(process.env.GLOBAL_DURATION_MINUTES) || 10,
  gvgEnabled: process.env.GVG_ENABLED !== 'false',
  gvgDays: process.env.GVG_DAYS ? process.env.GVG_DAYS.split(',').map(d => d.trim().toLowerCase()) : ['quarta', 'sabado'],
  gvgTime: process.env.GVG_TIME || '21:00',
  gvgDelayMinutes: Number(process.env.GVG_DELAY_MINUTES) || 10,
  gvgDurationMinutes: Number(process.env.GVG_DURATION_MINUTES) || 10,
  superAdminIds: process.env.SUPER_ADMIN_IDS
    ? process.env.SUPER_ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : ['273600843251712020', '672236180934492205'],
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
