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
        '⏰ **Atenção Guild Ally!** Os Bosses diários das **23:00** vão nascer em **20 minutos**!\n' +
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
        '🚨 **ATENÇÃO GUILD ALLY!** Todos os Bosses fixos das **23:00** nascem em **5 MINUTOS**!\n' +
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
        '⚔️ **ATENÇÃO GUILD ALLY!** Todos os Bosses fixos das **23:00** NASCERAM AGORA!\n' +
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

  // TAG da vez para este spawn e próxima TAG da fila
  const currentTag = boss.targetTag || state?.nextTag || state?.lastTag;
  const upcomingTag = boss.nextTag || (currentTag ? getNextTagInSequence(currentTag, isGelo) : state?.nextTag);
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

    if (b.category === 'interserver' || b.category === 'gelo') {
      const state = getBossRotationState(b.bossId || b.id);
      const tagVez = b.targetTag || state?.nextTag || state?.lastTag;
      const catTitle = b.category === 'gelo' ? 'Gelo' : 'União';
      desc += `🎯 **TAG da Vez (${catTitle}):** \`${tagVez}\`\n`;
    }

    desc += `👤 **Por:** ${b.createdBy}\n`;
    desc += `───────────────\n`;
  });

  embed.setDescription(desc);
  return embed;
}
