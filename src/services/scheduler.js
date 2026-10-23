import cron from 'node-cron';
import { DateTime } from 'luxon';
import { db } from '../database/db.js';
import {
  createDailyFixedEmbed,
  createCustomBossEmbed,
  createWeeklyEventEmbed,
  createRankingEmbed
} from '../utils/embeds.js';
import { config, ALLIANCE_GUILDS, getGuildConfig, getGuildForChannel, getChannelsForCategory } from '../config.js';
import { MEMBROS_ROLE_ID } from '../utils/bossList.js';
import { rotateBossTurn, updateRotationPanel, updateGeloRotationPanel } from '../utils/rotation.js';
import { checkinService } from './checkinService.js';
import { checkinDb } from '../database/checkinDb.js';

/**
 * Retorna se o boss pertence à Masmorra de Gelo
 * @param {Object} boss 
 */
export function isGeloBoss(boss) {
  if (!boss) return false;
  return (
    boss.category === 'gelo' ||
    (boss.location && /gelo/i.test(boss.location)) ||
    (boss.bossId && ['dardaloca', 'hotura', 'gatphillian', 'tigdal'].includes(boss.bossId))
  );
}

/**
 * Retorna os canais de destino para o boss:
 * - Se for Gelo: respeita o servidor ou canal configurado do boss
 * - Se for Interserver: retorna os canais de todas as guildas (globalmente)
 * @param {Object} boss 
 * @returns {string[]}
 */
export function getChannelsForBoss(boss) {
  if (isGeloBoss(boss)) {
    const serverFilter = boss?.server || boss?.guild;
    const channels = getChannelsForCategory('gelo', serverFilter);
    if (channels && channels.length > 0) return channels;
    if (boss?.channelId) return [boss.channelId];
    if (config.geloAnnouncementChannelId) return [config.geloAnnouncementChannelId];
    return [config.announcementChannelId].filter(Boolean);
  }

  // Interserver: global em todas as guildas
  const channels = getChannelsForCategory('interserver');
  if (channels && channels.length > 0) return channels;
  return [boss?.channelId || config.announcementChannelId].filter(Boolean);
}

/**
 * Retorna a menção de cargo apropriada para o boss:
 * - Se for boss da Masmorra de Gelo:
 *   Se o canal pertencer a uma guilda aliada, menciona a role dessa guilda;
 *   caso contrário, usa o bossRoleId da Rise / MEMBROS_ROLE_ID.
 * - Se for Interserver ou Boss Fixo -> @everyone
 * @param {Object} boss 
 * @param {string} [channelId]
 */
function getPingRoleForBoss(boss, channelId = null) {
  if (isGeloBoss(boss)) {
    if (channelId) {
      const gKey = getGuildForChannel(channelId);
      if (gKey && ALLIANCE_GUILDS[gKey]?.roleId) {
        return `<@&${ALLIANCE_GUILDS[gKey].roleId}>`;
      }
    }
    const roleId = config.bossRoleId || MEMBROS_ROLE_ID;
    return roleId ? `<@&${roleId}>` : '@everyone';
  }
  return '@everyone';
}

/**
 * Inicializa o serviço de agendamento do BOT Ally
 * @param {import('discord.js').Client} client 
 */
export function initScheduler(client) {
  console.log('⏰ [SCHEDULER] Serviço de agendamento de Bosses inicializado (Fuso: America/Sao_Paulo).');

  // 1. Cron Job Diário para o Lembrete de 20 minutos antes (às 22:40 GMT-3)
  cron.schedule('40 22 * * *', async () => {
    console.log('📢 [SCHEDULER] Executando aviso prévio das 22:40 (20m) para Bosses Fixos (23:00)...');
    await sendDailyFixedAnnouncement(client, 'REMINDER_20M');
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 2. Cron Job Diário para o Lembrete de 5 minutos antes (às 22:55 GMT-3)
  cron.schedule('55 22 * * *', async () => {
    console.log('🔥 [SCHEDULER] Executando aviso prévio das 22:55 (5m) para Bosses Fixos (23:00)...');
    await sendDailyFixedAnnouncement(client, 'REMINDER_5M');
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 3. Cron Job Diário para o Nascimento dos Bosses (às 23:00 GMT-3)
  cron.schedule('0 23 * * *', async () => {
    console.log('💥 [SCHEDULER] Executando aviso de spawn das 23:00 para Bosses Fixos...');
    await sendDailyFixedAnnouncement(client, 'SPAWN');
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 4. Cron Job Minuto a Minuto para rastrear Outros Bosses, Eventos Semanais e Check-ins Ativos
  cron.schedule('* * * * *', async () => {
    await checkCustomBossReminders(client);
    await checkWeeklyEventsReminders(client);
    await checkinService.checkActiveCheckins(client);
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 5. Cron Job Semanal para o Fechamento do Ranking (Domingo às 00:01 GMT-3)
  cron.schedule('1 0 * * 0', async () => {
    console.log('🏆 [SCHEDULER] Executando fechamento e envio do Ranking Semanal...');
    await sendWeeklyRankingReport(client);
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 6. Cron Job Mensal para o Fechamento do Ranking (Dia 01 às 00:01 GMT-3)
  cron.schedule('1 0 1 * *', async () => {
    console.log('🏆 [SCHEDULER] Executando fechamento e envio do Ranking Mensal...');
    await sendMonthlyRankingReport(client);
  }, {
    timezone: 'America/Sao_Paulo'
  });
}

/**
 * Envia o aviso fixo único para os Bosses das 23:00 (Interserver -> @everyone)
 * @param {import('discord.js').Client} client 
 * @param {'REMINDER_20M' | 'REMINDER_5M' | 'SPAWN'} noticeType 
 */
async function sendDailyFixedAnnouncement(client, noticeType) {
  const channelId = config.announcementChannelId;
  if (!channelId) {
    console.warn('⚠️ [SCHEDULER] ANNOUNCEMENT_CHANNEL_ID não configurado no .env!');
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      const embed = createDailyFixedEmbed(noticeType);
      const pingRole = '@everyone';
      let contentText = '';

      if (noticeType === 'REMINDER_20M') {
        contentText = `🚨 **[LEMBRETE 20M]** Bosses Fixos das 23:00! ${pingRole}`;
      } else if (noticeType === 'REMINDER_5M') {
        contentText = `🔥 **[LEMBRETE 5M]** Bosses Fixos das 23:00 nascem em 5 minutos! ${pingRole}`;
      } else {
        contentText = `💥 **[BOSSES NASCERAM]** Bosses Fixos das 23:00 NASCERAM AGORA! ${pingRole}`;
      }

      await channel.send({
        content: contentText,
        embeds: [embed]
      });
      console.log(`✅ [SCHEDULER] Aviso diário fixo ${noticeType} enviado com sucesso no canal ${channelId}`);

      // Se for SPAWN, agenda os check-ins escalonados dos Bosses Fixos (TA 2 e TA 3)
      if (noticeType === 'SPAWN') {
        checkinService.scheduleFixedBossCheckins(client);
      }
    }
  } catch (err) {
    console.error(`❌ [SCHEDULER] Erro ao enviar aviso diário fixo ${noticeType}:`, err);
  }
}

/**
 * Checa os timers dos bosses customizados agendados via /boss
 * - Boss Interserver: avisos de spawn/lembretes enviados globalmente em todas as guildas
 * - Boss de Gelo: avisos enviados no servidor ou canal configurado do boss
 * @param {import('discord.js').Client} client 
 */
async function checkCustomBossReminders(client) {
  const bosses = db.getBosses();
  const now = DateTime.now().setZone('America/Sao_Paulo');
  let updated = false;

  const activeBosses = [];

  for (const boss of bosses) {
    const spawnTime = DateTime.fromMillis(boss.spawnTimestamp).setZone('America/Sao_Paulo');
    const diffMinutes = Math.floor(spawnTime.diff(now, 'minutes').minutes);

    // Se passou mais de 15 minutos do spawn, remove do rastreamento ativo
    if (diffMinutes < -15) {
      updated = true;
      continue;
    }

    activeBosses.push(boss);

    // Determina os canais de destino (Interserver = global; Gelo = servidor/guilda configurado)
    const targetChannels = getChannelsForBoss(boss);
    if (!targetChannels || targetChannels.length === 0) continue;

    // 1. Aviso de 20 Minutos Antes (janela de 8 a 20 minutos)
    if (diffMinutes <= 20 && diffMinutes > 8 && !boss.notified20m) {
      boss.notified20m = true;
      updated = true;
      db.updateBoss(boss);

      for (const channelId of targetChannels) {
        try {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const pingRole = getPingRoleForBoss(boss, channelId);
            const embed = createCustomBossEmbed(boss, 'REMINDER_20M');
            await channel.send({
              content: `🚨 **[AVISO 20M]** O Boss **${boss.name}** vai nascer em 20 minutos! ${pingRole}`,
              embeds: [embed]
            });
            console.log(`✅ [SCHEDULER] Lembrete 20M enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
          }
        } catch (err) {
          console.error(`❌ [SCHEDULER] Erro ao enviar aviso 20M para ${boss.name} no canal ${channelId}:`, err);
        }
      }
    }
    // 2. Aviso de 5 Minutos Antes (janela de 1 a 5 minutos)
    else if (diffMinutes <= 5 && diffMinutes > 1 && !boss.notified5m) {
      boss.notified5m = true;
      updated = true;
      db.updateBoss(boss);

      for (const channelId of targetChannels) {
        try {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const pingRole = getPingRoleForBoss(boss, channelId);
            const embed = createCustomBossEmbed(boss, 'REMINDER_5M');
            await channel.send({
              content: `🔥 **[AVISO 5M]** O Boss **${boss.name}** vai nascer em 5 MINUTOS! ${pingRole}`,
              embeds: [embed]
            });
            console.log(`✅ [SCHEDULER] Lembrete 5M enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
          }
        } catch (err) {
          console.error(`❌ [SCHEDULER] Erro ao enviar aviso 5M para ${boss.name} no canal ${channelId}:`, err);
        }
      }
    }
    // 3. Aviso no Momento do Spawn (janela <= 0 minutos)
    else if (diffMinutes <= 0 && !boss.notifiedSpawn) {
      boss.notifiedSpawn = true;
      updated = true;
      db.updateBoss(boss);

      for (const channelId of targetChannels) {
        try {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const pingRole = getPingRoleForBoss(boss, channelId);
            const embed = createCustomBossEmbed(boss, 'SPAWN');
            await channel.send({
              content: `💥 **[BOSS NASCEU]** O Boss **${boss.name}** NASCEU AGORA! ${pingRole}`,
              embeds: [embed]
            });
            console.log(`✅ [SCHEDULER] Aviso SPAWN enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
          }
        } catch (err) {
          console.error(`❌ [SCHEDULER] Erro ao enviar aviso SPAWN para ${boss.name} no canal ${channelId}:`, err);
        }
      }

      // Agenda check-in automático após delay (respeita interserver global e gelo por servidor/guilda)
      checkinService.scheduleAutoCheckin(boss, client);
    }
  }

  // Se houverem bosses antigos removidos, salva a lista atualizada
  if (updated && activeBosses.length !== bosses.length) {
    db.saveBosses(activeBosses);
  }
}

/**
 * Envia o relatório e fechamento do Ranking Semanal nos canais de cada guilda da aliança
 * @param {import('discord.js').Client} client 
 */
export async function sendWeeklyRankingReport(client) {
  console.log('🏆 [SCHEDULER] Disparando relatórios de Ranking Semanal para as 4 guildas aliadas...');
  const yesterday = DateTime.now().setZone('America/Sao_Paulo').minus({ days: 1 });
  const startStr = yesterday.startOf('week').toFormat('dd/MM');
  const endStr = yesterday.endOf('week').toFormat('dd/MM');
  const periodLabel = `${startStr} a ${endStr}`;

  for (const guild of Object.values(ALLIANCE_GUILDS)) {
    const channelId = guild.rankingChannelId || (guild.id === 'rise' ? (config.rankingChannelId || config.checkinChannelId || config.announcementChannelId) : null);

    if (!channelId) {
      console.warn(`⚠️ [SCHEDULER] Canal de ranking não configurado para a guilda ${guild.name} (${guild.id}).`);
      continue;
    }

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        console.warn(`⚠️ [SCHEDULER] Canal ${channelId} de ranking para ${guild.name} não encontrado ou inválido.`);
        continue;
      }

      const rankings = checkinDb.getWeeklyRanking(yesterday, guild.id);

      const embed = createRankingEmbed({
        title: `RANKING SEMANAL DE PRESENÇA - ${guild.name} (${guild.server})`,
        periodLabel,
        rankings
      });

      await channel.send({
        content: `📢 **[FECHAMENTO SEMANAL - ${guild.name.toUpperCase()}]** Confira a classificação semanal da guilda!`,
        embeds: [embed]
      });

      console.log(`✅ [SCHEDULER] Relatório semanal enviado com sucesso para ${guild.name} no canal ${channelId}.`);
    } catch (err) {
      console.error(`❌ [SCHEDULER] Erro ao enviar relatório semanal de ${guild.name}:`, err);
    }
  }
}

/**
 * Envia o relatório e fechamento do Ranking Mensal nos canais de cada guilda da aliança
 * @param {import('discord.js').Client} client 
 */
export async function sendMonthlyRankingReport(client) {
  console.log('🏆 [SCHEDULER] Disparando relatórios de Ranking Mensal para as 4 guildas aliadas...');
  const lastMonth = DateTime.now().setZone('America/Sao_Paulo').minus({ days: 1 });
  const periodLabel = lastMonth.toFormat('LLLL / yyyy');

  for (const guild of Object.values(ALLIANCE_GUILDS)) {
    const channelId = guild.rankingChannelId || (guild.id === 'rise' ? (config.rankingChannelId || config.checkinChannelId || config.announcementChannelId) : null);

    if (!channelId) {
      console.warn(`⚠️ [SCHEDULER] Canal de ranking não configurado para a guilda ${guild.name} (${guild.id}).`);
      continue;
    }

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        console.warn(`⚠️ [SCHEDULER] Canal ${channelId} de ranking para ${guild.name} não encontrado ou inválido.`);
        continue;
      }

      const rankings = checkinDb.getMonthlyRanking(lastMonth, guild.id);

      const embed = createRankingEmbed({
        title: `RANKING MENSAL DE PRESENÇA - ${guild.name} (${guild.server})`,
        periodLabel,
        rankings
      });

      await channel.send({
        content: `🏆 **[FECHAMENTO MENSAL - ${guild.name.toUpperCase()}]** Parabéns aos membros da ${guild.name} pelo engajamento no mês!`,
        embeds: [embed]
      });

      console.log(`✅ [SCHEDULER] Relatório mensal enviado com sucesso para ${guild.name} no canal ${channelId}.`);
    } catch (err) {
      console.error(`❌ [SCHEDULER] Erro ao enviar relatório mensal de ${guild.name}:`, err);
    }
  }
}

// Estado em memória para controle de avisos dos eventos semanais
const weeklyEventsState = {
  gvg: { date: '', notified20m: false, notified5m: false, notifiedStart: false },
  global: { date: '', notified20m: false, notified5m: false, notifiedStart: false }
};

const WEEKDAY_NAMES_MAP = {
  domingo: 7,
  dom: 7,
  segunda: 1,
  seg: 1,
  terca: 2,
  ter: 2,
  quarta: 3,
  qua: 3,
  quinta: 4,
  qui: 4,
  sexta: 5,
  sex: 5,
  sabado: 6,
  sab: 6
};

function normalizeDayToWeekday(dayStr) {
  if (!dayStr) return null;
  const clean = String(dayStr).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return WEEKDAY_NAMES_MAP[clean] || null;
}

/**
 * Checa minuto a minuto os eventos semanais fixos (GvG e Global)
 * - GvG: Quarta e Sábado às 21:00 (Check-in 10m após por 10 min)
 * - Global: Quinta e Domingo (Configurável)
 * @param {import('discord.js').Client} client 
 */
export async function checkWeeklyEventsReminders(client) {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  const todayStr = now.toFormat('yyyy-MM-dd');
  const currentWeekday = now.weekday; // 1 (Mon) a 7 (Sun)
  const channelId = config.announcementChannelId;
  if (!channelId) return;

  // 1. GvG (Guild vs Guild)
  if (config.gvgEnabled) {
    const gvgDays = (config.gvgDays || ['quarta', 'sabado']).map(normalizeDayToWeekday).filter(Boolean);
    if (gvgDays.includes(currentWeekday)) {
      await processWeeklyEvent({
        eventKey: 'gvg',
        eventId: 'gvg',
        name: 'GvG (Guild vs Guild)',
        timeStr: config.gvgTime || '21:00',
        autoCheckin: true,
        delayMinutes: config.gvgDelayMinutes ?? 10,
        durationMinutes: config.gvgDurationMinutes ?? 10,
        state: weeklyEventsState.gvg,
        todayStr,
        now,
        channelId,
        client
      });
    }
  }

  // 2. Evento Global (Quinta e Domingo às 22:00 - avisos de início; check-in apenas nos bosses)
  if (config.globalEnabled) {
    const globalDays = (config.globalDays || ['quinta', 'domingo']).map(normalizeDayToWeekday).filter(Boolean);
    if (globalDays.includes(currentWeekday)) {
      await processWeeklyEvent({
        eventKey: 'global',
        eventId: 'global',
        name: 'Masmorra Global',
        timeStr: config.globalTime || '22:00',
        autoCheckin: Boolean(config.globalAutoCheckin), // false por padrão (checkin só nos bosses)
        delayMinutes: config.globalDelayMinutes ?? 10,
        durationMinutes: config.globalDurationMinutes ?? 10,
        state: weeklyEventsState.global,
        todayStr,
        now,
        channelId,
        client
      });
    }
  }
}

async function processWeeklyEvent({
  eventKey,
  eventId,
  name,
  timeStr,
  autoCheckin = true,
  delayMinutes,
  durationMinutes,
  state,
  todayStr,
  now,
  channelId,
  client
}) {
  // Reseta estado no início de um novo dia
  if (state.date !== todayStr) {
    state.date = todayStr;
    state.notified20m = false;
    state.notified5m = false;
    state.notifiedStart = false;
  }

  const [targetH, targetM] = (timeStr || '21:00').split(':').map(Number);
  const targetTime = now.set({ hour: targetH || 21, minute: targetM || 0, second: 0, millisecond: 0 });
  const diffMinutes = Math.floor(targetTime.diff(now, 'minutes').minutes);

  // 1. Aviso de 20 minutos antes (janela 8m a 20m)
  if (diffMinutes <= 20 && diffMinutes > 8 && !state.notified20m) {
    state.notified20m = true;
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        const embed = createWeeklyEventEmbed(eventKey, 'REMINDER_20M', { time: timeStr });
        await channel.send({
          content: `🚨 **[AVISO 20M]** O evento **${name}** começará às **${timeStr}**! @everyone`,
          embeds: [embed]
        });
        console.log(`✅ [SCHEDULER] Lembrete 20M enviado para ${name} no canal ${channelId}`);
      }
    } catch (e) {
      console.error(`❌ Erro no lembrete 20M de ${name}:`, e);
    }
  }
  // 2. Aviso de 5 minutos antes (janela 1m a 5m)
  else if (diffMinutes <= 5 && diffMinutes > 1 && !state.notified5m) {
    state.notified5m = true;
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        const embed = createWeeklyEventEmbed(eventKey, 'REMINDER_5M', { time: timeStr });
        await channel.send({
          content: `🔥 **[AVISO 5M]** O evento **${name}** começará em 5 MINUTOS! @everyone`,
          embeds: [embed]
        });
        console.log(`✅ [SCHEDULER] Lembrete 5M enviado para ${name} no canal ${channelId}`);
      }
    } catch (e) {
      console.error(`❌ Erro no lembrete 5M de ${name}:`, e);
    }
  }
  // 3. Aviso de Início e agendamento automático do Check-in
  else if (diffMinutes <= 0 && !state.notifiedStart) {
    state.notifiedStart = true;
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        const embed = createWeeklyEventEmbed(eventKey, 'START', { time: timeStr });
        await channel.send({
          content: `💥 **[EVENTO INICIADO]** O evento **${name}** COMEÇOU AGORA! @everyone`,
          embeds: [embed]
        });
        console.log(`✅ [SCHEDULER] Aviso de início enviado para ${name} no canal ${channelId}`);
      }
    } catch (e) {
      console.error(`❌ Erro no aviso START de ${name}:`, e);
    }

    // Agenda o check-in automático caso habilitado para o evento
    if (autoCheckin) {
      const delayMs = Math.max(1, delayMinutes) * 60 * 1000;
      console.log(`⏳ [CHECKIN AUTO] Agendando check-in de ${name} em ${delayMinutes} min com ${durationMinutes} min de duração...`);
      setTimeout(async () => {
        try {
          console.log(`🚀 [CHECKIN AUTO] Abrindo check-in para ${name}...`);
          await checkinService.openCheckin({
            eventId,
            createdBy: `BOT Ally (${name})`,
            durationMinutes,
            client
          });
        } catch (err) {
          console.error(`❌ Falha ao abrir check-in de ${name}:`, err);
        }
      }, delayMs);
    } else {
      console.log(`ℹ️ [CHECKIN AUTO] Check-in automático desabilitado para ${name} (presença apenas nos bosses).`);
    }
  }
}
