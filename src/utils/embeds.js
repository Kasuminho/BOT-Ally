import { EmbedBuilder } from 'discord.js';
import { getRandomJoke } from './jokes.js';
import { getBossRotationState, getNextTagInSequence } from './rotation.js';

/**
 * Cria o Embed "enfeitado" para o aviso diário fixo das 23:00 (TA 2 / TA 3 / TA 4 - FFA)
 * @param {'REMINDER_20M' | 'REMINDER_5M' | 'SPAWN'} noticeType 
 */
export function createDailyFixedEmbed(noticeType) {
  const embed = new EmbedBuilder().setTimestamp();

  if (noticeType === 'REMINDER_20M') {
    embed
      .setTitle('🚨 ⚔️ [ALERTA 20 MINUTOS] BOSSES FIXOS DAS 23:00 (FFA) ⚔️ 🚨')
      .setColor('#FF9900')
      .setDescription(
        '⏰ **Atenção Ally!** Os Bosses diários das **23:00** vão nascer em **20 minutos**!\n' +
        ' Preparem os times, suprimentos e entrem na call de PVP!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '👑 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '👑 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '👑 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Regra de Drop', value: '🔥 **FFA (Free For All)**', inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  } else if (noticeType === 'REMINDER_5M') {
    embed
      .setTitle('🔥 ⚔️ [ALERTA 5 MINUTOS] BOSSES FIXOS NASCENDO EM BREVE! (FFA) ⚔️ 🔥')
      .setColor('#FF5500')
      .setDescription(
        '🚨 **ATENÇÃO ALLY!** Todos os Bosses fixos das **23:00** nascem em **5 MINUTOS**!\n' +
        ' Corram para os mapas da Torre da Arrogância!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '🔥 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '🔥 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '🔥 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Regra de Drop', value: '🔥 **FFA (Free For All)**', inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  } else {
    embed
      .setTitle('💥 ⚔️ 🔥 [BOSSES NASCERAM] TA 2 / TA 3 / TA 4 NASCERAM! (FFA) 🔥 ⚔️ 💥')
      .setColor('#FF0033')
      .setDescription(
        '⚔️ **ATENÇÃO ALLY!** Todos os Bosses fixos das **23:00** NASCERAM AGORA!\n' +
        ' Corram para os mapas, garantam o kill e o loot!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '💥 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '💥 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '💥 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Regra de Drop', value: '🔥 **FFA (Free For All)**', inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  }

  return embed;
}

/**
 * Cria o Embed para eventos semanais da guilda (GvG e Global)
 * @param {'gvg' | 'global'} eventKey
 * @param {'REMINDER_20M' | 'REMINDER_5M' | 'START'} noticeType
 * @param {Object} [customData]
 */
export function createWeeklyEventEmbed(eventKey, noticeType, customData = {}) {
  const embed = new EmbedBuilder().setTimestamp();
  const timeStr = customData.time || '21:00';

  if (eventKey === 'gvg') {
    if (noticeType === 'REMINDER_20M') {
      embed
        .setTitle('🚨 ⚔️ [ALERTA 20 MINUTOS] GUILD VS GUILD (GvG) EM BREVE! ⚔️ 🚨')
        .setColor('#FF9900')
        .setDescription(
          '⏰ **Atenção Ally!** A guerra de **GvG (Guild vs Guild)** começará em **20 minutos**!\n' +
          'Entrem na call da guilda, confiram as formações e preparem os suprimentos!'
        )
        .addFields(
          { name: '⚔️ Modalidade', value: '🛡️ **Guild vs Guild (GvG)**', inline: true },
          { name: '⏰ Horário de Início', value: `🎯 **${timeStr}**`, inline: true },
          { name: '📝 Check-in de Presença', value: 'Abre 10 minutos após o início (duração de 10 min)', inline: false }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    } else if (noticeType === 'REMINDER_5M') {
      embed
        .setTitle('🔥 ⚔️ [ALERTA 5 MINUTOS] GvG COMEÇA EM 5 MINUTOS! ⚔️ 🔥')
        .setColor('#FF5500')
        .setDescription(
          '🚨 **ATENÇÃO ALLY!** O **GvG** começará em apenas **5 MINUTOS**!\n' +
          'Todos nos pontos estratégicos e preparados para o combate!'
        )
        .addFields(
          { name: '⚔️ Modalidade', value: '🛡️ **Guild vs Guild (GvG)**', inline: true },
          { name: '⏰ Horário', value: `🎯 **${timeStr}**`, inline: true }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    } else {
      embed
        .setTitle('💥 ⚔️ 🛡️ [GvG INICIADO] O COMBATE DE GUILDA COMEÇOU! 🛡️ ⚔️ 💥')
        .setColor('#FF0033')
        .setDescription(
          '⚔️ **ATENÇÃO ALLY! O GvG ESTÁ VALENDO!**\n' +
          'Foco total nas calls, estratégia e vitória para a guilda!\n\n' +
          '📝 *O check-in de presença abrirá automaticamente em 10 minutos.*'
        )
        .addFields(
          { name: '⚔️ Modalidade', value: '🛡️ **Guild vs Guild (GvG)**', inline: true },
          { name: '⏰ Duração do Check-in', value: '10 minutos após a abertura', inline: true }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    }
    // Global (Quinta e Domingo às 22:00)
    const globalTimeStr = customData.time || '22:00';
    if (noticeType === 'REMINDER_20M') {
      embed
        .setTitle('🚨 🌍 [ALERTA 20 MINUTOS] MASMORRA GLOBAL ÀS 22:00! 🌍 🚨')
        .setColor('#9933FF')
        .setDescription(
          '⏰ **Atenção Ally!** A **Masmorra Global** começará em **20 minutos** (às **22:00**)!\n' +
          'Reúnam os grupos, preparem os suprimentos e entrem na call de PVP da guilda!'
        )
        .addFields(
          { name: '🌍 Modalidade', value: '⚔️ **Masmorra Global**', inline: true },
          { name: '⏰ Horário de Abertura', value: `🎯 **${globalTimeStr}**`, inline: true },
          { name: '📝 Presença', value: 'Check-in realizado diretamente nos bosses do evento', inline: false }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    } else if (noticeType === 'REMINDER_5M') {
      embed
        .setTitle('🔥 🌍 [ALERTA 5 MINUTOS] GLOBAL COMEÇA EM 5 MINUTOS! 🌍 🔥')
        .setColor('#FF5500')
        .setDescription(
          '🚨 **ATENÇÃO ALLY!** A **Masmorra Global** abrirá em apenas **5 MINUTOS** (às **22:00**)!\n' +
          'Todos a postos para entrar juntos no mapa!'
        )
        .addFields(
          { name: '🌍 Modalidade', value: '⚔️ **Masmorra Global**', inline: true },
          { name: '⏰ Horário', value: `🎯 **${globalTimeStr}**`, inline: true }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    } else {
      embed
        .setTitle('💥 🌍 ⚔️ [GLOBAL ABERTA] A MASMORRA GLOBAL COMEÇOU AGORA! ⚔️ 🌍 💥')
        .setColor('#7E3AF2')
        .setDescription(
          '⚔️ **ATENÇÃO ALLY! A MASMORRA GLOBAL ESTÁ ABERTA!**\n' +
          'Todos para o mapa e foco nas calls!\n\n' +
          '📝 *A presença da guilda será computada nos check-ins dos bosses.*'
        )
        .addFields(
          { name: '🌍 Modalidade', value: '⚔️ **Masmorra Global**', inline: true },
          { name: '🎯 Foco', value: 'Bosses & PVP da Guilda', inline: true }
        )
        .setFooter({ text: `${getRandomJoke()}` });
    }
  }

  return embed;
}

/**
 * Cria Embed elegante para os avisos de nascimento e lembretes dos Bosses
 * @param {Object} boss 
 * @param {'REGISTERED' | 'REMINDER_20M' | 'REMINDER_5M' | 'SPAWN'} noticeType 
 */
export function createCustomBossEmbed(boss, noticeType) {
  const embed = new EmbedBuilder().setTimestamp();
  const unixSec = Math.floor(boss.spawnTimestamp / 1000);
  const isRotatable = boss.category === 'interserver' || boss.category === 'gelo';
  const isGelo = boss.category === 'gelo';
  const state = isRotatable ? getBossRotationState(boss.bossId || boss.id) : null;

  // TAG da vez para este spawn (conforme Painel Fixo) e próxima TAG da fila
  const currentTag = state?.nextTag || null;
  const upcomingTag = currentTag ? getNextTagInSequence(currentTag, isGelo) : null;
  const tagLabel = isGelo ? '🎯 Vez da TAG (Gelo)' : '🎯 Vez da TAG (União)';
  const spawnTagLabel = isGelo ? '🎯 TAG Atual do Drop (Gelo)' : '🎯 TAG Atual do Drop (União)';

  if (noticeType === 'REGISTERED') {
    embed
      .setTitle(`✅ 🎯 BOSS RASTREADO COM SUCESSO!`)
      .setColor('#00FFCC')
      .setDescription(`O timer para o boss **${boss.name}** foi registrado com sucesso.`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário do Spawn', value: `<t:${unixSec}:F> (<t:${unixSec}:R>)`, inline: false }
      );

    if (isRotatable && currentTag) {
      const tagInfo = upcomingTag ? `👑 **\`${currentTag}\`** *(Próxima: ${upcomingTag})*` : `👑 **\`${currentTag}\`**`;
      embed.addFields({ name: tagLabel, value: tagInfo, inline: true });
    }

    embed
      .addFields({ name: '👤 Agendado por', value: `${boss.createdBy}`, inline: true })
      .setFooter({ text: `${getRandomJoke()}` });

  } else if (noticeType === 'REMINDER_20M') {
    embed
      .setTitle(`🚨 ⚔️ [ALERTA 20 MINUTOS] BOSS CHEGANDO!`)
      .setColor('#FF9900')
      .setDescription(`Faltam **20 minutos** para o nascimento do Boss **${boss.name}**!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário do Spawn', value: `<t:${unixSec}:T> (<t:${unixSec}:R>)`, inline: false }
      );

    if (isRotatable && currentTag) {
      const tagInfo = upcomingTag ? `👑 **\`${currentTag}\`** *(Próxima: ${upcomingTag})*` : `👑 **\`${currentTag}\`**`;
      embed.addFields({ name: tagLabel, value: tagInfo, inline: true });
    }

    embed.setFooter({ text: `${getRandomJoke()}` });

  } else if (noticeType === 'REMINDER_5M') {
    embed
      .setTitle(`🔥 ⚔️ [ALERTA 5 MINUTOS] ${boss.name.toUpperCase()} NASCENDO EM BREVE! ⚔️ 🔥`)
      .setColor('#FF5500')
      .setDescription(`🚨 Faltam apenas **5 minutos** para o nascimento do Boss **${boss.name}** no local **${boss.location}**! Corram!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário do Spawn', value: `<t:${unixSec}:T> (<t:${unixSec}:R>)`, inline: false }
      );

    if (isRotatable && currentTag) {
      const tagInfo = upcomingTag ? `👑 **\`${currentTag}\`** *(Próxima: ${upcomingTag})*` : `👑 **\`${currentTag}\`**`;
      embed.addFields({ name: tagLabel, value: tagInfo, inline: true });
    }

    embed.setFooter({ text: `${getRandomJoke()}` });

  } else if (noticeType === 'SPAWN') {
    embed
      .setTitle(`💥 ⚔️ 🔥 [BOSS NASCEU] ${boss.name.toUpperCase()} NASCEU AGORA! 🔥 ⚔️ 💥`)
      .setColor('#FF0033')
      .setDescription(`⚔️ **ATENÇÃO ALLY!** O Boss **${boss.name}** acabou de nascer no local **${boss.location}**!\nUnam os grupos e corram para o mapa!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true }
      );

    if (isRotatable && currentTag) {
      const tagInfo = upcomingTag ? `👑 **\`${currentTag}\`** *(Próxima: ${upcomingTag})*` : `👑 **\`${currentTag}\`**`;
      embed.addFields({ name: spawnTagLabel, value: tagInfo, inline: false });
    }

    embed.setFooter({ text: `${getRandomJoke()}` });
  }

  return embed;
}

/**
 * Cria Embed formatado listando os bosses agendados
 * @param {Array} bosses 
 */
export function createBossListEmbed(bosses) {
  const embed = new EmbedBuilder()
    .setTitle('📜 ⚔️ LISTA DE BOSSES AGENDADOS - ALLY ⚔️ 📜')
    .setColor('#3399FF')
    .setTimestamp()
    .setFooter({ text: `${getRandomJoke()}` });

  if (!bosses || bosses.length === 0) {
    embed.setDescription('ℹ️ Nenhum boss agendado no momento.\nUse `/boss` para agendar um novo boss!');
    return embed;
  }

  const sorted = [...bosses].sort((a, b) => a.spawnTimestamp - b.spawnTimestamp);

  let desc = 'Abaixo estão os bosses atualmente rastreados pelo bot:\n\n';
  sorted.forEach((b, idx) => {
    const unixSec = Math.floor(b.spawnTimestamp / 1000);
    desc += `**${idx + 1}. ${b.name}** (ID: \`${b.id}\`)\n`;
    desc += `📍 **Local:** ${b.location}\n`;
    desc += `⏰ **Nascimento:** <t:${unixSec}:T> (<t:${unixSec}:R>)\n`;

    if ((b.category === 'interserver' || b.category === 'gelo')) {
      const state = getBossRotationState(b.bossId || b.id);
      const tagVez = state?.nextTag || null;
      if (tagVez) {
        const catTitle = b.category === 'gelo' ? 'Gelo' : 'União';
        desc += `🎯 **TAG da Vez (${catTitle}):** \`${tagVez}\`\n`;
      }
    }

    desc += `👤 **Por:** ${b.createdBy}\n`;
    desc += `───────────────\n`;
  });

  embed.setDescription(desc);
  return embed;
}

/**
 * Cria o aviso inicial de que um novo check-in foi aberto
 */
export function createCheckinNoticeEmbed({ eventName, points, basePoints, bonusPoints, isBoost, durationMinutes, channelId, pingText = '@everyone' }) {
  const formattedPing = /^\d+$/.test(String(pingText).trim())
    ? `<@&${pingText}>`
    : pingText;

  const pointsDesc = isBoost
    ? `**${points} ponto(s)** 🌙 *(Base: ${basePoints} + Corujão: +${bonusPoints})*`
    : `**${points} ponto(s)**`;

  return new EmbedBuilder()
    .setColor(isBoost ? '#9933FF' : '#FF0033')
    .setTitle(`🚨 CHECK-IN NORMAL: ${eventName}${isBoost ? ' 🌙 [CORUJÃO ATIVO]' : ''}`)
    .setDescription(`${formattedPing} **Um novo check-in foi aberto!**`)
    .addFields(
      { name: '🐍 Boss / Evento', value: `**${eventName}**`, inline: true },
      { name: '🎯 Pontos', value: pointsDesc, inline: true },
      { name: '⏰ Duração', value: `**${durationMinutes} minutos**`, inline: true },
      { name: '📍 Local', value: `Vá para <#${channelId}> para confirmar presença!`, inline: false }
    )
    .setTimestamp();
}

/**
 * Cria o Embed interativo principal do check-in com lista de confirmados em tempo real
 */
export function createCheckinMainEmbed(checkin, remainingMinutes = 0) {
  const isClosed = checkin.status === 'closed' || remainingMinutes <= 0;
  const isBoost = Boolean(checkin.isBoost);
  const embedColor = isClosed ? '#2B2D31' : (isBoost ? '#9933FF' : '#00FF66');

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🚨 CHECK-IN NORMAL: ${checkin.eventName}${isBoost ? ' 🌙 [CORUJÃO ATIVO]' : ''}`)
    .setDescription(isClosed ? '🔒 **Check-in encerrado!**' : 'Clique no botão abaixo para confirmar presença!')
    .setTimestamp();

  // Lista dos confirmados (nicks do Discord no servidor)
  let attendeesText = 'Nenhum participante confirmado.';
  if (checkin.attendees && checkin.attendees.length > 0) {
    attendeesText = checkin.attendees
      .map(a => {
        if (a.isPilot) {
          const pilotInfo = a.pilotByName ? ` *(Piloto: ${a.pilotByName})*` : ' *(Piloto)*';
          return `${a.displayName}${pilotInfo}`;
        }
        return a.displayName;
      })
      .join('\n');
  }

  const pointsValue = isBoost
    ? `**${checkin.points} ponto(s)** 🌙 *(+${checkin.bonusPoints} bônus)*`
    : `**${checkin.points} ponto(s)**`;

  embed.addFields(
    { name: '👹 Pontuação', value: pointsValue, inline: true },
    { name: '⏰ Duração', value: `**${checkin.durationMinutes} minutos**`, inline: true },
    { name: '👤 Criado por', value: `**${checkin.createdBy}**`, inline: true },
    { name: '✅ Confirmados', value: attendeesText, inline: false }
  );

  if (!isClosed) {
    embed.addFields({
      name: '⏰ Tempo Restante',
      value: `⌛ **${remainingMinutes} minutos**`,
      inline: false
    });
  } else {
    embed.setFooter({ text: '✅ Check-in encerrado' });
  }

  return embed;
}

/**
 * Cria o Embed de resumo oficial do check-in após o encerramento
 */
export function createCheckinSummaryEmbed(checkin, durationStr = '5min 0s') {
  const total = checkin.attendees?.length || 0;
  const pointsPer = checkin.points || 1;
  const totalPoints = total * pointsPer;
  const isBoost = Boolean(checkin.isBoost);

  let attendeesText = 'Nenhum participante confirmado.';
  if (checkin.attendees && checkin.attendees.length > 0) {
    attendeesText = checkin.attendees
      .map(a => {
        if (a.isPilot) {
          const pilotInfo = a.pilotByName ? ` *(Piloto: ${a.pilotByName})*` : ` *(Piloto: ${a.pilotForName || 'Membro'})*`;
          return `${a.displayName}${pilotInfo}`;
        }
        return a.displayName;
      })
      .join('\n');
  }

  const pointsDesc = isBoost
    ? `**${pointsPer} ponto(s)** 🌙 *(Base: ${checkin.basePoints || (pointsPer - checkin.bonusPoints)} + Corujão: +${checkin.bonusPoints})*`
    : `**${pointsPer} ponto(s)**`;

  return new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(`📊 Resumo do Check-in para ${checkin.eventName}${isBoost ? ' 🌙 [CORUJÃO]' : ''}`)
    .setDescription(`Check-in tempo esgotado após ${durationStr}.`)
    .addFields(
      { name: '👤 Criado por', value: `**${checkin.createdBy}**`, inline: false },
      { name: '✅ Confirmados', value: attendeesText, inline: false },
      { name: '👤 Total de Participantes', value: `**${total}**`, inline: true },
      { name: '🎯 Pontuação do Boss', value: pointsDesc, inline: true },
      { name: '🏆 Pontuação Total', value: `**${totalPoints} pontos**`, inline: true }
    )
    .setFooter({ text: '✅ Presenças salvas no banco de dados com sucesso.' })
    .setTimestamp();
}

/**
 * Cria o Embed do Ranking Semanal ou Mensal
 */
export function createRankingEmbed({ title, periodLabel, rankings, userRank = null, userPoints = 0 }) {
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏆 ${title}`)
    .setDescription(`🗓️ **Período:** \`${periodLabel}\`\nTotal de membros ativos no período: **${rankings.length}**`)
    .setTimestamp();

  if (!rankings || rankings.length === 0) {
    embed.addFields({ name: 'Classificação', value: 'Nenhuma presença registrada no período informado.' });
    return embed;
  }

  // Monta tabela em formato texto limpo e legível (Top 20)
  const topList = rankings.slice(0, 20);
  let rankText = '```\nPos | Usuário                        | Pontos\n';
  rankText += '----+--------------------------------+-------\n';

  topList.forEach((r, idx) => {
    const pos = String(idx + 1).padStart(2, ' ');
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
    // Trunca ou preenche nome até 28 caracteres
    const rawName = (r.displayName || 'Desconhecido').replace(/`/g, '');
    const namePadded = rawName.length > 28 ? rawName.slice(0, 25) + '...' : rawName.padEnd(28, ' ');
    const pts = String(r.totalPoints).padStart(5, ' ');
    rankText += `${pos}  | ${namePadded} | ${pts}\n`;
  });
  rankText += '```';

  embed.addFields({ name: '📊 Classificação (Top 20)', value: rankText });

  if (userRank) {
    embed.addFields({
      name: '👤 Sua Posição',
      value: `Você está na **${userRank}ª posição** com **${userPoints} pontos**.`
    });
  }

  embed.setFooter({ text: 'BOT Ally • Sistema de Check-in & Presença' });
  return embed;
}
