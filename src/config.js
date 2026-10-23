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
  apiPort: Number(process.env.API_PORT) || 3001,
  apiKey: process.env.API_KEY || null,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  superAdminIds: process.env.SUPER_ADMIN_IDS
    ? process.env.SUPER_ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : ['273600843251712020', '672236180934492205'],
};

export const ALLIANCE_GUILDS = {
  rise: {
    id: 'rise',
    name: 'Rise',
    server: 'Rook',
    roleId: config.bossRoleId || process.env.RISE_ROLE_ID || '1526217487274741947',
    checkinChannelId: config.checkinChannelId || process.env.CHECKIN_CHANNEL_ID || null,
    rankingChannelId: config.rankingChannelId || process.env.RANKING_CHANNEL_ID || null
  },
  gc: {
    id: 'gc',
    name: 'GC',
    server: 'Bishop',
    roleId: process.env.GC_ROLE_ID || '1535678192608612352',
    checkinChannelId: process.env.GC_CHECKIN_CHANNEL_ID || '1563248618885087323',
    rankingChannelId: process.env.GC_RANKING_CHANNEL_ID || '1563250590799233084'
  },
  emo: {
    id: 'emo',
    name: 'EMO',
    server: 'Bishop',
    roleId: process.env.EMO_ROLE_ID || '1552852458185949255',
    checkinChannelId: process.env.EMO_CHECKIN_CHANNEL_ID || '1563249140748521692',
    rankingChannelId: process.env.EMO_RANKING_CHANNEL_ID || '1563250737457275012'
  },
  minducas: {
    id: 'minducas',
    name: 'Minducas',
    server: 'Knight',
    roleId: process.env.MINDUCAS_ROLE_ID || '1547454080274661516',
    checkinChannelId: process.env.MINDUCAS_CHECKIN_CHANNEL_ID || '1563249047123525672',
    rankingChannelId: process.env.MINDUCAS_RANKING_CHANNEL_ID || '1563250510281310360'
  }
};

config.allianceGuilds = ALLIANCE_GUILDS;

/**
 * Retorna a configuração de uma guilda pelo ID/Key ou Role/Canal
 * @param {string} guildKeyOrId 
 */
export function getGuildConfig(guildKeyOrId) {
  if (!guildKeyOrId) return null;
  const key = String(guildKeyOrId).toLowerCase().trim();
  if (ALLIANCE_GUILDS[key]) return ALLIANCE_GUILDS[key];
  return Object.values(ALLIANCE_GUILDS).find(g =>
    g.id.toLowerCase() === key ||
    g.name.toLowerCase() === key ||
    (g.id === 'rise' && key === 'risegaming') ||
    (g.id === 'emo' && key === 'emocore') ||
    g.roleId === guildKeyOrId ||
    g.checkinChannelId === guildKeyOrId ||
    g.rankingChannelId === guildKeyOrId
  ) || null;
}

/**
 * Identifica a guilda correspondente de um membro através de seus cargos
 * @param {import('discord.js').GuildMember} member 
 * @returns {'gc' | 'emo' | 'minducas' | 'rise'}
 */
export function getGuildForMember(member) {
  if (!member) return 'rise';

  // Verifica as guildas aliadas específicas primeiro antes do fallback para 'rise'
  const priorityOrder = ['gc', 'emo', 'minducas', 'rise'];
  for (const guildKey of priorityOrder) {
    const guild = ALLIANCE_GUILDS[guildKey];
    if (!guild?.roleId) continue;

    if (member.roles?.cache) {
      if (typeof member.roles.cache.has === 'function' && member.roles.cache.has(guild.roleId)) {
        return guildKey;
      }
    } else if (Array.isArray(member.roles)) {
      if (member.roles.includes(guild.roleId)) {
        return guildKey;
      }
    } else if (Array.isArray(member._roles)) {
      if (member._roles.includes(guild.roleId)) {
        return guildKey;
      }
    }
  }

  return 'rise';
}

/**
 * Retorna a chave da guilda cujo checkinChannelId ou rankingChannelId bate com o channelId
 * @param {string} channelId 
 * @returns {string|null}
 */
export function getGuildForChannel(channelId) {
  if (!channelId) return null;
  const idStr = String(channelId).trim();
  for (const [key, guild] of Object.entries(ALLIANCE_GUILDS)) {
    if (guild.checkinChannelId === idStr || guild.rankingChannelId === idStr) {
      return key;
    }
  }
  if (
    idStr === config.announcementChannelId ||
    idStr === config.geloAnnouncementChannelId ||
    idStr === config.checkinChannelId ||
    idStr === config.rankingChannelId
  ) {
    return 'rise';
  }
  return null;
}

/**
 * Retorna os canais de destino para notificações e check-ins com base na categoria e servidor
 * @param {'interserver' | 'gelo' | string} category 
 * @param {'Bishop' | 'Knight' | 'Rook' | string | null} serverFilter 
 * @returns {string[]}
 */
export function getChannelsForCategory(category, serverFilter = null) {
  const cat = String(category || '').toLowerCase().trim();
  const sFilter = serverFilter ? String(serverFilter).toLowerCase().trim() : null;

  if (cat === 'gelo') {
    if (sFilter === 'bishop' || sFilter === 'gc' || sFilter === 'emo') {
      return [
        ALLIANCE_GUILDS.gc.checkinChannelId,
        ALLIANCE_GUILDS.emo.checkinChannelId
      ].filter(Boolean);
    }
    if (sFilter === 'knight' || sFilter === 'minducas') {
      return [
        ALLIANCE_GUILDS.minducas.checkinChannelId
      ].filter(Boolean);
    }
    if (sFilter === 'rook' || sFilter === 'rise') {
      const riseChannel = config.geloAnnouncementChannelId || ALLIANCE_GUILDS.rise.checkinChannelId || config.announcementChannelId;
      return [riseChannel].filter(Boolean);
    }

    // Se sem filtro, retorna o canal configurado de Gelo da Rise ou todos
    if (config.geloAnnouncementChannelId) {
      return [config.geloAnnouncementChannelId];
    }
    return [
      ALLIANCE_GUILDS.rise.checkinChannelId || config.announcementChannelId,
      ALLIANCE_GUILDS.gc.checkinChannelId,
      ALLIANCE_GUILDS.emo.checkinChannelId,
      ALLIANCE_GUILDS.minducas.checkinChannelId
    ].filter(Boolean);
  }

  // Se for 'interserver' (Masmorra de Pedra / geral): retorna lista de canais de todas as 4 guildas
  const channels = [
    ALLIANCE_GUILDS.rise.checkinChannelId || config.announcementChannelId,
    ALLIANCE_GUILDS.gc.checkinChannelId,
    ALLIANCE_GUILDS.emo.checkinChannelId,
    ALLIANCE_GUILDS.minducas.checkinChannelId
  ].filter(Boolean);

  return [...new Set(channels)];
}

export function validateConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');

  if (missing.length > 0) {
    console.error(`❌ Configuração inválida! Faltam as seguintes variáveis no arquivo .env: ${missing.join(', ')}`);
    process.exit(1);
  }
}
