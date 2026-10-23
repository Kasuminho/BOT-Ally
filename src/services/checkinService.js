import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} from 'discord.js';
import { DateTime } from 'luxon';
import {
  config,
  ALLIANCE_GUILDS,
  getGuildConfig,
  getGuildForMember,
  getGuildForChannel,
  getChannelsForCategory
} from '../config.js';
import { eventsDb, ALIASES } from '../database/eventsDb.js';
import { checkinDb } from '../database/checkinDb.js';
import {
  createCheckinNoticeEmbed,
  createCheckinMainEmbed,
  createCheckinSummaryEmbed
} from '../utils/embeds.js';

// Mapa em memória de timers de encerramento
const activeTimers = new Map();
// Conjunto em memória para bloquear encerramentos simultâneos (race condition lock)
const closingCheckins = new Set();

const GELO_BOSS_IDS = ['dardaloca', 'dardalroka', 'hotura', 'rotura', 'gatphillian', 'gatfilian', 'tigdal'];

/**
 * Identifica se um boss/evento pertence à Masmorra de Gelo
 * @param {string} eventId
 * @param {Object} [boss]
 * @returns {boolean}
 */
export function isGeloCheckin(eventId, boss = null) {
  if (boss && (boss.category === 'gelo' || /gelo/i.test(boss.location || ''))) return true;
  const rawId = String(eventId || '').toLowerCase().trim();
  const normalizedId = (ALIASES && ALIASES[rawId]) || rawId;
  return GELO_BOSS_IDS.includes(normalizedId) || GELO_BOSS_IDS.includes(rawId);
}

/**
 * Identifica a guilda de um membro usando os cargos do membro ou canal de interação
 * @param {import('discord.js').GuildMember} member
 * @param {string} [channelId]
 * @returns {string} ID da guilda ('rise', 'gc', 'emo', 'minducas')
 */
export function detectMemberGuild(member, channelId = null) {
  const guildFromMember = getGuildForMember(member);

  if (channelId) {
    const guildFromChannel = getGuildForChannel(channelId);
    if (guildFromChannel && guildFromChannel !== 'rise' && guildFromMember === 'rise') {
      const riseRole = ALLIANCE_GUILDS.rise?.roleId;
      const hasRiseRole = member?.roles?.cache
        ? (typeof member.roles.cache.has === 'function' && member.roles.cache.has(riseRole))
        : (Array.isArray(member?.roles) && member.roles.includes(riseRole));

      if (!hasRiseRole) {
        return guildFromChannel;
      }
    }
  }

  return guildFromMember || getGuildForChannel(channelId) || 'rise';
}

/**
 * Determina as guildas e canais alvos para abertura do check-in
 * @param {Object} params
 * @param {string} params.eventId
 * @param {Object} [params.boss]
 * @param {string} [params.customChannelId]
 * @param {string} [params.server]
 * @param {string} [params.guildId]
 * @param {import('discord.js').GuildMember} [params.member]
 * @returns {Array<{ guildId: string, guild: Object, channelId: string }>}
 */
export function resolveTargetChannels({ eventId, boss = null, customChannelId = null, server = null, guildId = null, member = null }) {
  const isGelo = isGeloCheckin(eventId, boss);
  const cleanGuildId = (guildId && String(guildId).toLowerCase().trim() !== 'todas')
    ? String(guildId).toLowerCase().trim()
    : null;

  if (isGelo) {
    let resolvedServer = null;

    if (server) {
      resolvedServer = String(server).toLowerCase().trim();
    } else if (cleanGuildId) {
      const gCfg = getGuildConfig(cleanGuildId);
      if (gCfg?.server) resolvedServer = gCfg.server.toLowerCase().trim();
    } else if (boss) {
      if (boss.server) {
        resolvedServer = String(boss.server).toLowerCase().trim();
      } else if (boss.channelId) {
        const gKey = getGuildForChannel(boss.channelId);
        const gCfg = getGuildConfig(gKey);
        if (gCfg?.server) resolvedServer = gCfg.server.toLowerCase().trim();
      }
    } else if (customChannelId) {
      const gKey = getGuildForChannel(customChannelId);
      const gCfg = getGuildConfig(gKey);
      if (gCfg?.server) resolvedServer = gCfg.server.toLowerCase().trim();
    } else if (member) {
      const gKey = getGuildForMember(member);
      const gCfg = getGuildConfig(gKey);
      if (gCfg?.server) resolvedServer = gCfg.server.toLowerCase().trim();
    }

    let targetGuildKeys = [];
    if (cleanGuildId && ALLIANCE_GUILDS[cleanGuildId]) {
      targetGuildKeys = [cleanGuildId];
    } else if (resolvedServer === 'bishop') {
      targetGuildKeys = ['gc', 'emo'];
    } else if (resolvedServer === 'knight') {
      targetGuildKeys = ['minducas'];
    } else if (resolvedServer === 'rook') {
      targetGuildKeys = ['rise'];
    } else {
      if (customChannelId) {
        const gKey = getGuildForChannel(customChannelId) || 'rise';
        targetGuildKeys = [gKey];
      } else {
        targetGuildKeys = ['rise'];
      }
    }

    const targets = [];
    for (const gKey of targetGuildKeys) {
      const guild = ALLIANCE_GUILDS[gKey];
      if (!guild) continue;
      const channelId = guild.checkinChannelId || (gKey === 'rise' ? (config.geloAnnouncementChannelId || config.checkinChannelId || config.announcementChannelId) : null);
      if (channelId) {
        targets.push({ guildId: gKey, guild, channelId });
      }
    }
    return targets;
  }

  // Interserver / Masmorra de Pedra / Geral: Todas as 4 guildas aliadas simultaneamente (ou guilda selecionada)
  const targets = [];
  const allGuildKeys = (cleanGuildId && ALLIANCE_GUILDS[cleanGuildId])
    ? [cleanGuildId]
    : ['rise', 'gc', 'emo', 'minducas'];

  for (const gKey of allGuildKeys) {
    const guild = ALLIANCE_GUILDS[gKey];
    if (!guild) continue;
    const channelId = guild.checkinChannelId || (gKey === 'rise' ? (config.checkinChannelId || config.announcementChannelId) : null);
    if (channelId) {
      targets.push({ guildId: gKey, guild, channelId });
    }
  }

  // Fallback caso nenhuma guilda tenha canal configurado
  if (targets.length === 0) {
    const fallbackId = customChannelId || config.checkinChannelId || config.announcementChannelId;
    if (fallbackId) {
      const gKey = getGuildForChannel(fallbackId) || 'rise';
      targets.push({
        guildId: gKey,
        guild: ALLIANCE_GUILDS[gKey] || ALLIANCE_GUILDS.rise,
        channelId: fallbackId
      });
    }
  }

  return targets;
}

/**
 * Retorna as informações de Boost Time (Corujão) caso esteja dentro do horário configurado
 * @param {DateTime} [now]
 */
export function getBoostTimeInfo(now = DateTime.now().setZone('America/Sao_Paulo')) {
  if (!config.boostTimeEnabled) {
    return { isBoost: false, bonusPoints: 0, timeWindow: '' };
  }

  const [startH, startM] = (config.boostTimeStart || '00:00').split(':').map(Number);
  const [endH, endM] = (config.boostTimeEnd || '07:00').split(':').map(Number);

  const curMinutes = now.hour * 60 + now.minute;
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  let isBoost = false;
  if (startMinutes <= endMinutes) {
    isBoost = curMinutes >= startMinutes && curMinutes < endMinutes;
  } else {
    // Cruza a meia-noite (ex: 23:00 às 07:00)
    isBoost = curMinutes >= startMinutes || curMinutes < endMinutes;
  }

  return {
    isBoost,
    bonusPoints: isBoost ? (Number(config.boostTimeBonusPoints) || 2) : 0,
    timeWindow: `${config.boostTimeStart || '00:00'} às ${config.boostTimeEnd || '07:00'}`
  };
}

/**
 * Cria a barra de botões interativos para o check-in
 * @param {string} chkId 
 * @param {boolean} disabled 
 */
function createCheckinActionRow(chkId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`checkin_confirm_${chkId}`)
      .setLabel('Confirmar Presença')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`checkin_pilot_${chkId}`)
      .setLabel('Check-in Piloto')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`checkin_cancel_${chkId}`)
      .setLabel('Cancelar Meu Check-in')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

export const checkinService = {
  /**
   * Abre um novo check-in para um boss ou evento (Multi-Guild / Multi-Server)
   * @param {Object} options
   * @param {string} options.eventId ID do evento (ex: 'gatphillian', 'damiross', 'ta2_ta3', 'gvg')
   * @param {string} options.createdBy Nome do autor ou bot
   * @param {number} [options.durationMinutes] Duração em minutos (padrão do evento ou 5 min)
   * @param {import('discord.js').Client} options.client
   * @param {string} [options.customChannelId] Canal específico (opcional)
   * @param {string} [options.server] Filtro de servidor para Masmorra de Gelo (opcional)
   * @param {string} [options.guildId] Filtro de guilda (opcional)
   * @param {Object} [options.boss] Objeto de boss agendado (opcional)
   * @param {import('discord.js').GuildMember} [options.member] Membro que disparou (opcional)
   */
  async openCheckin({
    eventId,
    createdBy,
    durationMinutes = null,
    client,
    customChannelId = null,
    server = null,
    guildId = null,
    boss = null,
    member = null
  }) {
    const targets = resolveTargetChannels({
      eventId,
      boss,
      customChannelId,
      server,
      guildId,
      member
    });

    if (!targets || targets.length === 0) {
      console.warn('⚠️ [CHECKIN] Nenhum canal de check-in configurado ou disponível.');
      return null;
    }

    const event = eventsDb.get(eventId) || {
      id: eventId,
      name: eventId.toUpperCase(),
      points: 2,
      type: 'manual',
      defaultDuration: 5
    };

    const duration = durationMinutes || event.defaultDuration || 5;
    const now = DateTime.now().setZone('America/Sao_Paulo');
    const expiresAt = now.plus({ minutes: duration });
    const chkId = `chk_${Date.now()}`;

    const boostInfo = getBoostTimeInfo(now);
    const basePoints = Number(event.points) || 1;
    const finalPoints = basePoints + boostInfo.bonusPoints;

    const checkinData = {
      id: chkId,
      eventId: event.id,
      eventName: event.name,
      category: isGeloCheckin(eventId, boss) ? 'gelo' : 'interserver',
      basePoints,
      bonusPoints: boostInfo.bonusPoints,
      isBoost: boostInfo.isBoost,
      points: finalPoints,
      pointsPerAttendee: finalPoints,
      durationMinutes: duration,
      createdBy: createdBy || 'BOT Ally',
      channels: [], // Array de { guildId, channelId, messageId, noticeMessageId }
      channelId: targets[0]?.channelId || null,
      messageId: null,
      noticeMessageId: null,
      status: 'open',
      openedAtISO: now.toISO(),
      expiresAtISO: expiresAt.toISO(),
      attendees: []
    };

    const actionRow = createCheckinActionRow(chkId, false);

    for (const target of targets) {
      try {
        const channel = await client.channels.fetch(target.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          console.warn(`⚠️ [CHECKIN] Canal ${target.channelId} (${target.guildId}) não encontrado ou inacessível.`);
          continue;
        }

        const rawPing = target.guild?.roleId;
        const pingContent = rawPing
          ? (/^\d+$/.test(String(rawPing).trim()) ? `<@&${rawPing}>` : rawPing)
          : (config.checkinPingRole || '@everyone');

        // 1. Mensagem de aviso com menção específica do cargo da guilda
        const noticeEmbed = createCheckinNoticeEmbed({
          eventName: checkinData.eventName,
          points: checkinData.points,
          basePoints: checkinData.basePoints,
          bonusPoints: checkinData.bonusPoints,
          isBoost: checkinData.isBoost,
          durationMinutes: checkinData.durationMinutes,
          channelId: target.channelId,
          pingText: pingContent,
          guildFilter: target.guildId
        });

        const noticeMsg = await channel.send({
          content: pingContent,
          embeds: [noticeEmbed]
        });

        // 2. Embed Principal adaptado para o canal desta guilda com botões
        const mainEmbed = createCheckinMainEmbed(checkinData, duration, target.guildId);
        const mainMsg = await channel.send({
          embeds: [mainEmbed],
          components: [actionRow]
        });

        checkinData.channels.push({
          guildId: target.guildId,
          channelId: target.channelId,
          messageId: mainMsg.id,
          noticeMessageId: noticeMsg.id
        });

        if (!checkinData.messageId) {
          checkinData.channelId = target.channelId;
          checkinData.messageId = mainMsg.id;
          checkinData.noticeMessageId = noticeMsg.id;
        }
      } catch (err) {
        console.error(`❌ [CHECKIN] Erro ao enviar check-in no canal ${target.channelId} (${target.guildId}):`, err.message);
      }
    }

    if (checkinData.channels.length === 0) {
      console.error('❌ [CHECKIN] Falha ao publicar check-in em todos os canais de destino.');
      return null;
    }

    // Persiste no banco de check-ins ativos
    checkinDb.saveActiveCheckin(checkinData);

    // Agenda encerramento
    this.setupTimer(chkId, duration, client);

    console.log(`✅ [CHECKIN] Check-in para ${checkinData.eventName} aberto com sucesso em ${checkinData.channels.length} canal(is).`);
    return checkinData;
  },

  /**
   * Configura o timer em memória para fechar o check-in no prazo exato
   */
  setupTimer(chkId, durationMinutes, client) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk) return;

    const expiresMs = new Date(chk.expiresAtISO).getTime();
    const remainingMs = Math.max(0, expiresMs - Date.now());

    // Limpa timeout anterior se houver
    if (activeTimers.has(chkId)) {
      clearTimeout(activeTimers.get(chkId).timeout);
    }

    const timeout = setTimeout(async () => {
      await this.closeCheckin(chkId, client);
    }, remainingMs);

    activeTimers.set(chkId, { timeout });
  },

  /**
   * Varredura periódica de persistência (chamada no ready e a cada 1 min no cron):
   * - Encerra check-ins expirados
   * - Atualiza o contador de minutos restantes dos check-ins abertos em todos os canais
   * @param {import('discord.js').Client} client 
   */
  async checkActiveCheckins(client) {
    const actives = checkinDb.getActiveCheckins();
    const activeList = Object.values(actives);
    if (activeList.length === 0) return;

    const nowMs = Date.now();

    for (const chk of activeList) {
      if (chk.status !== 'open' || closingCheckins.has(chk.id)) continue;

      const expiresMs = new Date(chk.expiresAtISO).getTime();
      const remainingMs = expiresMs - nowMs;

      // Se o tempo já expirou (ex: bot reiniciou ou timeout esgotou)
      if (remainingMs <= 0) {
        console.log(`⌛ [CHECKIN] Tempo esgotado para ${chk.eventName} (${chk.id}). Encerrando automaticamente...`);
        await this.closeCheckin(chk.id, client);
        continue;
      }

      // Garante que o timeout de encerramento em memória esteja ativo
      if (!activeTimers.has(chk.id)) {
        this.setupTimer(chk.id, null, client);
      }

      // Atualiza visual da mensagem com os minutos restantes em cada canal
      const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
      const channelsToUpdate = (Array.isArray(chk.channels) && chk.channels.length > 0)
        ? chk.channels
        : (chk.channelId ? [{ guildId: null, channelId: chk.channelId, messageId: chk.messageId }] : []);

      await Promise.allSettled(channelsToUpdate.map(async (c) => {
        try {
          if (!c.channelId || !c.messageId) return;
          const channel = await client.channels.fetch(c.channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const msg = await channel.messages.fetch(c.messageId).catch(() => null);
            if (msg) {
              const updatedEmbed = createCheckinMainEmbed(chk, remainingMins, c.guildId);
              await msg.edit({ embeds: [updatedEmbed] }).catch(() => null);
            }
          }
        } catch (err) {
          // Ignora erros transitórios de rede
        }
      }));
    }
  },

  /**
   * Encerra um check-in, desativa os botões e emite o Resumo Oficial em cada canal (Thread-safe & idempotente)
   */
  async closeCheckin(chkId, client) {
    if (!chkId || closingCheckins.has(chkId)) return;
    closingCheckins.add(chkId);

    try {
      const chk = checkinDb.getActiveCheckin(chkId);
      if (!chk || chk.status !== 'open') return;

      // 1. Limpa timers em memória imediatamente
      const timerObj = activeTimers.get(chkId);
      if (timerObj) {
        clearTimeout(timerObj.timeout);
        activeTimers.delete(chkId);
      }

      // 2. Imediatamente marca como fechado e arquiva no banco antes de qualquer await de rede
      chk.status = 'closed';
      const now = DateTime.now().setZone('America/Sao_Paulo');
      chk.closedAtISO = now.toISO();

      // Arquiva no histórico e remove de activeCheckins para evitar leituras concorrentes
      checkinDb.archiveCheckin(chk);

      // 3. Atualizações visuais no Discord em cada canal participante
      const channelsToProcess = (Array.isArray(chk.channels) && chk.channels.length > 0)
        ? chk.channels
        : (chk.channelId ? [{ guildId: null, channelId: chk.channelId, messageId: chk.messageId }] : []);

      const durationStr = `${chk.durationMinutes}min 0s`;

      await Promise.allSettled(channelsToProcess.map(async (c) => {
        try {
          if (!c.channelId) return;
          const channel = await client.channels.fetch(c.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) return;

          // Desativa botões da mensagem principal original
          if (c.messageId) {
            try {
              const mainMsg = await channel.messages.fetch(c.messageId).catch(() => null);
              if (mainMsg) {
                const closedEmbed = createCheckinMainEmbed(chk, 0, c.guildId);
                const disabledRow = createCheckinActionRow(chkId, true);
                await mainMsg.edit({ embeds: [closedEmbed], components: [disabledRow] }).catch(() => null);
              }
            } catch (e) {
              console.warn(`⚠️ Não foi possível desativar botões da mensagem original no canal ${c.channelId}.`);
            }
          }

          // Envia o Embed de Resumo Final filtrado por guilda para este canal
          const summaryEmbed = createCheckinSummaryEmbed(chk, durationStr, c.guildId);
          await channel.send({ embeds: [summaryEmbed] }).catch(() => null);
        } catch (err) {
          console.error(`❌ [CHECKIN] Erro ao enviar resumo para o canal ${c.channelId}:`, err);
        }
      }));

      console.log(`🔒 [CHECKIN] Check-in ${chkId} (${chk.eventName}) encerrado e arquivado com ${chk.attendees.length} participantes em ${channelsToProcess.length} canal(is).`);
    } finally {
      closingCheckins.delete(chkId);
    }
  },

  /**
   * Manipula o clique em "Confirmar Presença"
   */
  async handleConfirmPresence(interaction, chkId) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk || chk.status !== 'open') {
      return interaction.reply({ content: '🔒 Este check-in já foi encerrado!', ephemeral: true });
    }

    const userId = interaction.user.id;
    const displayName = interaction.member?.displayName || interaction.user.username;

    // Bloqueia presença caso o membro já esteja registrado (seja diretamente ou via piloto)
    const alreadyAttended = chk.attendees.some(a => a.userId === userId);
    if (alreadyAttended) {
      const attendee = chk.attendees.find(a => a.userId === userId);
      const extraMsg = attendee?.isPilot
        ? ` Você já possui presença confirmada neste check-in registrada pelo piloto **${attendee.pilotByName || 'Staff'}**!`
        : ` Você já confirmou sua presença no check-in de **${chk.eventName}**!`;
      return interaction.reply({
        content: `⚠️${extraMsg}`,
        ephemeral: true
      });
    }

    const memberGuildId = detectMemberGuild(interaction.member, interaction.channelId);
    const guildConfig = getGuildConfig(memberGuildId) || ALLIANCE_GUILDS.rise;

    chk.attendees.push({
      userId,
      userTag: interaction.user.tag,
      displayName,
      guild: memberGuildId,
      isPilot: false,
      timestampISO: DateTime.now().setZone('America/Sao_Paulo').toISO()
    });

    checkinDb.saveActiveCheckin(chk);

    // Atualiza as mensagens principais em tempo real em todos os canais
    await this.refreshCheckinMessage(interaction.client, chk);

    return interaction.reply({
      content: `✅ **Presença confirmada!** Você ganhou **${chk.points} ponto(s)** no evento **${chk.eventName}** (${guildConfig.name}).`,
      ephemeral: true
    });
  },

  /**
   * Abre a seleção de membros do Discord via UserSelectMenu para registrar conta pilotada
   */
  async handlePilotButton(interaction, chkId) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk || chk.status !== 'open') {
      return interaction.reply({ content: '🔒 Este check-in já foi encerrado!', ephemeral: true });
    }

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`checkin_pilot_select_${chkId}`)
      .setPlaceholder('Escolha o membro dono do personagem...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: `🎮 **Check-in de Piloto - ${chk.eventName}**\nSelecione abaixo o membro do Discord dono do personagem que você está pilotando neste boss/evento.\n*Ambos (você piloto e o membro selecionado) receberão ${chk.points} ponto(s)!*`,
      components: [row],
      ephemeral: true
    });
  },

  /**
   * Manipula a seleção do membro pilotado via Discord User Select Menu
   */
  async handlePilotUserSelect(interaction, chkId) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk || chk.status !== 'open') {
      return interaction.reply({ content: '🔒 Este check-in já foi encerrado!', ephemeral: true });
    }

    const selectedUserId = interaction.values[0];
    const pilotUser = interaction.user;
    const pilotMember = interaction.member;
    const pilotDisplayName = pilotMember?.displayName || pilotUser.username;

    if (selectedUserId === pilotUser.id) {
      return interaction.update({
        content: '⚠️ Você selecionou a si mesmo! Para confirmar sua própria presença, utilize o botão verde **"Confirmar Presença"**.',
        components: []
      });
    }

    // Busca usuário e membro selecionado
    const targetUser = interaction.users?.get(selectedUserId) || await interaction.client.users.fetch(selectedUserId).catch(() => null);
    let targetMember = interaction.guild?.members?.cache?.get(selectedUserId);
    if (!targetMember && interaction.guild) {
      try {
        targetMember = await interaction.guild.members.fetch(selectedUserId);
      } catch (e) {}
    }
    const targetDisplayName = targetMember?.displayName || targetUser?.username || `Membro (${selectedUserId})`;
    const targetTag = targetUser?.tag || targetDisplayName;

    // Evita duplicidade no mesmo check-in
    const alreadyAttended = chk.attendees.some(a => a.userId === selectedUserId);
    if (alreadyAttended) {
      return interaction.update({
        content: `⚠️ O membro **${targetDisplayName}** (<@${selectedUserId}>) já possui presença confirmada neste check-in!`,
        components: []
      });
    }

    const nowISO = DateTime.now().setZone('America/Sao_Paulo').toISO();
    const pilotGuildId = detectMemberGuild(pilotMember, interaction.channelId);
    const targetGuildId = detectMemberGuild(targetMember, interaction.channelId);

    // 1. Garante a pontuação do piloto (se ele ainda não confirmou presença individual)
    const pilotAlreadyAttended = chk.attendees.some(a => a.userId === pilotUser.id && !a.isPilot);
    if (!pilotAlreadyAttended) {
      chk.attendees.push({
        userId: pilotUser.id,
        userTag: pilotUser.tag,
        displayName: pilotDisplayName,
        guild: pilotGuildId,
        isPilot: false,
        timestampISO: nowISO
      });
    }

    // 2. Registra o membro pilotado (também pontua no ranking)
    chk.attendees.push({
      userId: selectedUserId,
      userTag: targetTag,
      displayName: targetDisplayName,
      guild: targetGuildId,
      isPilot: true,
      pilotForName: targetDisplayName,
      pilotByUserId: pilotUser.id,
      pilotByName: pilotDisplayName,
      timestampISO: nowISO
    });

    checkinDb.saveActiveCheckin(chk);

    // Atualiza a mensagem principal do check-in em todos os canais
    await this.refreshCheckinMessage(interaction.client, chk);

    const pilotGuildCfg = getGuildConfig(pilotGuildId) || ALLIANCE_GUILDS.rise;
    const targetGuildCfg = getGuildConfig(targetGuildId) || ALLIANCE_GUILDS.rise;

    return interaction.update({
      content: `🎮 **Presença de Piloto Registrada com Sucesso!**\n` +
        `• 🕹️ **Piloto:** ${pilotDisplayName} (<@${pilotUser.id}>) [${pilotGuildCfg.name}]\n` +
        `• 👤 **Membro Pilotado:** ${targetDisplayName} (<@${selectedUserId}>) [${targetGuildCfg.name}]\n` +
        `✨ Ambos garantiram **${chk.points} ponto(s)** no evento **${chk.eventName}**!`,
      components: []
    });
  },

  /**
   * Manipula o envio do Modal de Piloto
   */
  async handlePilotModalSubmit(interaction, chkId) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk || chk.status !== 'open') {
      return interaction.reply({ content: '🔒 Este check-in já foi encerrado!', ephemeral: true });
    }

    const pilotNick = interaction.fields.getTextInputValue('pilot_nick').trim();
    if (!pilotNick) {
      return interaction.reply({ content: '❌ O nome do membro pilotado não pode ser vazio.', ephemeral: true });
    }

    // Evita duplicar a mesma conta pilotada no mesmo check-in
    const alreadyPiloted = chk.attendees.some(a => a.displayName.toLowerCase() === pilotNick.toLowerCase());
    if (alreadyPiloted) {
      return interaction.reply({
        content: `⚠️ A conta **${pilotNick}** já está confirmada neste check-in!`,
        ephemeral: true
      });
    }

    const pilotGuildId = detectMemberGuild(interaction.member, interaction.channelId);

    chk.attendees.push({
      userId: `pilot_${pilotNick.toLowerCase().replace(/\s+/g, '_')}`,
      userTag: `${pilotNick} (Pilotado por ${interaction.user.tag})`,
      displayName: pilotNick,
      guild: pilotGuildId,
      isPilot: true,
      pilotForName: pilotNick,
      pilotByUserId: interaction.user.id,
      timestampISO: DateTime.now().setZone('America/Sao_Paulo').toISO()
    });

    checkinDb.saveActiveCheckin(chk);

    // Atualiza a mensagem principal em todos os canais
    await this.refreshCheckinMessage(interaction.client, chk);

    return interaction.reply({
      content: `🎮 **Presença de Piloto registrada!** A conta **${pilotNick}** recebeu **${chk.points} ponto(s)**.`,
      ephemeral: true
    });
  },

  /**
   * Permite que o membro cancele sua própria presença antes do fim do check-in
   */
  async handleCancelPresence(interaction, chkId) {
    const chk = checkinDb.getActiveCheckin(chkId);
    if (!chk || chk.status !== 'open') {
      return interaction.reply({ content: '🔒 Este check-in já foi encerrado!', ephemeral: true });
    }

    const userId = interaction.user.id;
    const initialCount = chk.attendees.length;

    // Remove presenças diretas do usuário ou pilotagens feitas por ele
    chk.attendees = chk.attendees.filter(a => a.userId !== userId && a.pilotByUserId !== userId);

    if (chk.attendees.length === initialCount) {
      return interaction.reply({
        content: 'ℹ️ Você não possui presenças registradas neste check-in para cancelar.',
        ephemeral: true
      });
    }

    checkinDb.saveActiveCheckin(chk);

    // Atualiza a mensagem principal em todos os canais
    await this.refreshCheckinMessage(interaction.client, chk);

    return interaction.reply({
      content: `🔄 **Presença cancelada com sucesso!**`,
      ephemeral: true
    });
  },

  /**
   * Atualiza a mensagem de embed do check-in ativo em todos os canais
   */
  async refreshCheckinMessage(client, chk) {
    try {
      const remainingMs = new Date(chk.expiresAtISO).getTime() - Date.now();
      if (remainingMs <= 0) {
        await this.closeCheckin(chk.id, client);
        return;
      }

      const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
      const channelsToUpdate = (Array.isArray(chk.channels) && chk.channels.length > 0)
        ? chk.channels
        : (chk.channelId ? [{ guildId: null, channelId: chk.channelId, messageId: chk.messageId }] : []);

      await Promise.allSettled(channelsToUpdate.map(async (c) => {
        try {
          if (!c.channelId || !c.messageId) return;
          const channel = await client.channels.fetch(c.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) return;
          const msg = await channel.messages.fetch(c.messageId).catch(() => null);
          if (!msg) return;

          const embed = createCheckinMainEmbed(chk, remainingMins, c.guildId);
          await msg.edit({ embeds: [embed] }).catch(() => null);
        } catch (err) {
          // Ignora erros individuais de fetch/edição
        }
      }));
    } catch (err) {
      console.warn('⚠️ Não foi possível atualizar visual do checkin em tempo real:', err.message);
    }
  },

  /**
   * Agenda a abertura automática do check-in 3 minutos após o nascimento (SPAWN)
   */
  scheduleAutoCheckin(boss, client) {
    const bossId = (boss.bossId || boss.id || '').toLowerCase();
    const eventName = boss.name || bossId;
    const delayMinutes = config.checkinAutoDelayMinutes || 3;
    const delayMs = delayMinutes * 60 * 1000;

    console.log(`⏳ [CHECKIN AUTO] Agendando check-in automático para ${eventName} em ${delayMinutes} minuto(s)...`);

    setTimeout(async () => {
      try {
        console.log(`🚀 [CHECKIN AUTO] Abrindo check-in automático para ${eventName}...`);
        const event = eventsDb.get(bossId);
        const duration = event?.defaultDuration || 5;

        await this.openCheckin({
          eventId: bossId,
          createdBy: 'BOT Ally (Automático)',
          durationMinutes: duration,
          client,
          boss
        });
      } catch (err) {
        console.error(`❌ [CHECKIN AUTO] Falha ao abrir check-in para ${eventName}:`, err);
      }
    }, delayMs);
  },

  /**
   * Agenda a abertura dos check-ins escalonados dos Bosses Fixos das 23:00 (TA 2 e TA 3):
   * - TA 2 abre após ta2DelayMinutes (padrão 1 min) com duração ta2DurationMinutes (padrão 5 min)
   * - TA 3 abre após ta3DelayMinutes (padrão 3 min) com duração ta3DurationMinutes (padrão 5 min)
   * Como TA 2 e TA 3 são interserver, abrem simultaneamente nos 4 canais.
   * @param {import('discord.js').Client} client 
   */
  scheduleFixedBossCheckins(client) {
    const ta2DelayMin = config.ta2DelayMinutes ?? 1;
    const ta2Duration = config.ta2DurationMinutes ?? 5;
    const ta3DelayMin = config.ta3DelayMinutes ?? 3;
    const ta3Duration = config.ta3DurationMinutes ?? 5;

    console.log(`⏳ [CHECKIN FIXO] Agendando TA 2 em ${ta2DelayMin}m (${ta2Duration}m duração) e TA 3 em ${ta3DelayMin}m (${ta3Duration}m duração)...`);

    // 1. Agendamento TA 2
    setTimeout(async () => {
      try {
        console.log('🚀 [CHECKIN FIXO] Abrindo check-in para T.A 2...');
        const event = eventsDb.get('ta2') || { id: 'ta2', name: 'T.A 2', points: 5, defaultDuration: ta2Duration };
        await this.openCheckin({
          eventId: 'ta2',
          createdBy: 'BOT Ally (Fixo 23:00)',
          durationMinutes: ta2Duration || event.defaultDuration || 5,
          client
        });
      } catch (err) {
        console.error('❌ Falha ao abrir check-in automático TA 2:', err);
      }
    }, ta2DelayMin * 60 * 1000);

    // 2. Agendamento TA 3
    setTimeout(async () => {
      try {
        console.log('🚀 [CHECKIN FIXO] Abrindo check-in para T.A 3...');
        const event = eventsDb.get('ta3') || { id: 'ta3', name: 'T.A 3', points: 5, defaultDuration: ta3Duration };
        await this.openCheckin({
          eventId: 'ta3',
          createdBy: 'BOT Ally (Fixo 23:00)',
          durationMinutes: ta3Duration || event.defaultDuration || 5,
          client
        });
      } catch (err) {
        console.error('❌ Falha ao abrir check-in automático TA 3:', err);
      }
    }, ta3DelayMin * 60 * 1000);

    // 3. Agendamento TA 4 (preparado e configurável para ativação futura)
    if (config.ta4Enabled) {
      const ta4DelayMin = config.ta4DelayMinutes ?? 5;
      const ta4Duration = config.ta4DurationMinutes ?? 5;
      console.log(`⏳ [CHECKIN FIXO] Agendando TA 4 em ${ta4DelayMin}m (${ta4Duration}m duração)...`);
      setTimeout(async () => {
        try {
          console.log('🚀 [CHECKIN FIXO] Abrindo check-in para T.A 4...');
          const event = eventsDb.get('ta4') || { id: 'ta4', name: 'T.A 4', points: 5, defaultDuration: ta4Duration };
          await this.openCheckin({
            eventId: 'ta4',
            createdBy: 'BOT Ally (Fixo 23:00)',
            durationMinutes: ta4Duration || event.defaultDuration || 5,
            client
          });
        } catch (err) {
          console.error('❌ Falha ao abrir check-in automático TA 4:', err);
        }
      }, ta4DelayMin * 60 * 1000);
    }
  }
};
