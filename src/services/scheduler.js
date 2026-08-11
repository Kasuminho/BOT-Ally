import cron from 'node-cron';
import { DateTime } from 'luxon';
import { db } from '../database/db.js';
import { createDailyFixedEmbed, createCustomBossEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { MEMBROS_ROLE_ID } from '../utils/bossList.js';
import { rotateBossTurn } from '../utils/rotation.js';

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
 * Retorna o ID do canal de destino correto para o boss:
 * - Se for Gelo e GELO_ANNOUNCEMENT_CHANNEL_ID estiver configurado -> usa o canal de Gelo
 * - Caso contrário -> usa ANNOUNCEMENT_CHANNEL_ID padrão (ou canal do agendamento)
 * @param {Object} boss 
 */
export function getChannelForBoss(boss) {
  if (isGeloBoss(boss) && config.geloAnnouncementChannelId) {
    return config.geloAnnouncementChannelId;
  }
  return config.announcementChannelId || boss?.channelId;
}

/**
 * Retorna a menção de cargo apropriada para o boss:
 * - Se for boss da Masmorra de Gelo -> <@&1526217487274741947> (Membros)
 * - Se for Interserver ou Boss Fixo -> @everyone
 * @param {Object} boss 
 */
function getPingRoleForBoss(boss) {
  if (isGeloBoss(boss)) {
    return `<@&${MEMBROS_ROLE_ID}>`;
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

  // 4. Cron Job Minuto a Minuto para rastrear Outros Bosses agendados
  cron.schedule('* * * * *', async () => {
    await checkCustomBossReminders(client);
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
    }
  } catch (err) {
    console.error(`❌ [SCHEDULER] Erro ao enviar aviso diário fixo ${noticeType}:`, err);
  }
}

/**
 * Checa os timers dos bosses customizados agendados via /boss
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

    // Determina o canal de destino (Canal de Gelo dedicado ou Canal Padrão)
    const channelId = getChannelForBoss(boss);
    if (!channelId) continue;

    const pingRole = getPingRoleForBoss(boss);

    // 1. Aviso de 20 Minutos Antes (janela de 8 a 20 minutos)
    if (diffMinutes <= 20 && diffMinutes > 8 && !boss.notified20m) {
      boss.notified20m = true;
      updated = true;
      db.updateBoss(boss);

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const embed = createCustomBossEmbed(boss, 'REMINDER_20M');
          await channel.send({
            content: `🚨 **[AVISO 20M]** O Boss **${boss.name}** vai nascer em 20 minutos! ${pingRole}`,
            embeds: [embed]
          });
          console.log(`✅ [SCHEDULER] Lembrete 20M enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
        }
      } catch (err) {
        console.error(`❌ [SCHEDULER] Erro ao enviar aviso 20M para ${boss.name}:`, err);
      }
    }
    // 2. Aviso de 5 Minutos Antes (janela de 1 a 5 minutos)
    else if (diffMinutes <= 5 && diffMinutes > 1 && !boss.notified5m) {
      boss.notified5m = true;
      updated = true;
      db.updateBoss(boss);

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const embed = createCustomBossEmbed(boss, 'REMINDER_5M');
          await channel.send({
            content: `🔥 **[AVISO 5M]** O Boss **${boss.name}** vai nascer em 5 MINUTOS! ${pingRole}`,
            embeds: [embed]
          });
          console.log(`✅ [SCHEDULER] Lembrete 5M enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
        }
      } catch (err) {
        console.error(`❌ [SCHEDULER] Erro ao enviar aviso 5M para ${boss.name}:`, err);
      }
    }
    // 3. Aviso no Momento do Spawn (janela <= 0 minutos)
    else if (diffMinutes <= 0 && !boss.notifiedSpawn) {
      boss.notifiedSpawn = true;
      updated = true;
      db.updateBoss(boss);

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const embed = createCustomBossEmbed(boss, 'SPAWN');
          await channel.send({
            content: `💥 **[BOSS NASCEU]** O Boss **${boss.name}** NASCEU AGORA! ${pingRole}`,
            embeds: [embed]
          });
          console.log(`✅ [SCHEDULER] Aviso SPAWN enviado para boss ${boss.name} no canal ${channelId} (Ping: ${pingRole})`);
        }
      } catch (err) {
        console.error(`❌ [SCHEDULER] Erro ao enviar aviso SPAWN para ${boss.name}:`, err);
      }
    }
  }

  // Se houverem bosses antigos removidos, salva a lista atualizada
  if (updated && activeBosses.length !== bosses.length) {
    db.saveBosses(activeBosses);
  }
}
