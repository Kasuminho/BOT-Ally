import { EmbedBuilder } from 'discord.js';
import { getRandomJoke } from './jokes.js';
import { getBossRotationState } from './rotation.js';

/**
 * Cria o Embed "enfeitado" para o aviso diário fixo das 23:00 (TA 2 / TA 3 / TA 4)
 * @param {'REMINDER_20M' | 'REMINDER_5M' | 'SPAWN'} noticeType 
 */
export function createDailyFixedEmbed(noticeType) {
  const embed = new EmbedBuilder().setTimestamp();
  const state = getBossRotationState('fixed_23h');

  if (noticeType === 'REMINDER_20M') {
    embed
      .setTitle('🚨 ⚔️ [ALERTA 20 MINUTOS] BOSSES FIXOS DAS 23:00 ⚔️ 🚨')
      .setColor('#FF9900')
      .setDescription(
        '⏰ **Atenção Ally!** Os Bosses diários das **23:00** vão nascer em **20 minutos**!\n' +
        ' Preparem os times, suprimentos e organizem a call!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '👑 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '👑 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '👑 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Vez do Drop (União)', value: `**\`${state.nextTag}\`** *(Última: ${state.lastTag})*`, inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  } else if (noticeType === 'REMINDER_5M') {
    embed
      .setTitle('🔥 ⚔️ [ALERTA 5 MINUTOS] BOSSES FIXOS NASCENDO EM BREVE! ⚔️ 🔥')
      .setColor('#FF5500')
      .setDescription(
        '🚨 **ATENÇÃO GUILD ALLY!** Todos os Bosses fixos das **23:00** nascem em **5 MINUTOS**!\n' +
        ' Corram para os mapas!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '🔥 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '🔥 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '🔥 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Vez do Drop (União)', value: `**\`${state.nextTag}\`** *(Última: ${state.lastTag})*`, inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  } else {
    embed
      .setTitle('⚔️ 🔥 [BOSSES NASCERAM] TA 2 / TA 3 / TA 4 NASCERAM! 🔥 ⚔️')
      .setColor('#FF0033')
      .setDescription(
        '⚔️ **ATENÇÃO GUILD ALLY!** Todos os Bosses fixos das **23:00** NASCERAM AGORA!\n' +
        ' Matem os Bosses e garantam os loots!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '💥 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '💥 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '💥 **Turga / Gillaot / Frezam**', inline: true },
        { name: '🎯 Vez do Drop (União)', value: `**\`${state.nextTag}\`**`, inline: false }
      )
      .setFooter({ text: `${getRandomJoke()}` });
  }

  return embed;
}

/**
 * Cria Embed para agendamentos individuais dos Outros Bosses
 * @param {Object} boss 
 * @param {'REGISTERED' | 'REMINDER_20M' | 'REMINDER_5M' | 'SPAWN'} noticeType 
 */
export function createCustomBossEmbed(boss, noticeType) {
  const embed = new EmbedBuilder().setTimestamp();
  const unixSec = Math.floor(boss.spawnTimestamp / 1000);
  const isInterserver = boss.category === 'interserver';
  const state = isInterserver ? getBossRotationState(boss.bossId || boss.id) : null;

  if (noticeType === 'REGISTERED') {
    embed
      .setTitle(`✅ 🎯 BOSS AGENDADO COM SUCESSO!`)
      .setColor('#00FFCC')
      .setDescription(`O timer para o boss **${boss.name}** foi registrado.`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário Previsto', value: `<t:${unixSec}:F> (<t:${unixSec}:R>)`, inline: false }
      );

    if (isInterserver && state) {
      embed.addFields({ name: '🎯 Vez da TAG (União)', value: `**\`${state.nextTag}\`** *(Última: ${state.lastTag})*`, inline: true });
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

    if (isInterserver && state) {
      embed.addFields({ name: '🎯 Vez da TAG (União)', value: `**\`${state.nextTag}\`**`, inline: true });
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

    if (isInterserver && state) {
      embed.addFields({ name: '🎯 Vez da TAG (União)', value: `**\`${state.nextTag}\`**`, inline: true });
    }

    embed.setFooter({ text: `${getRandomJoke()}` });

  } else if (noticeType === 'SPAWN') {
    embed
      .setTitle(`💥 ⚔️ [BOSS NASCEU] ${boss.name.toUpperCase()} NASCEU AGORA! ⚔️ 💥`)
      .setColor('#FF0033')
      .setDescription(`⚔️ O Boss **${boss.name}** acabou de nascer no local **${boss.location}**! Corram pra matar!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true }
      );

    if (isInterserver && state) {
      embed.addFields({ name: '🎯 Vez da TAG (União)', value: `**\`${state.nextTag}\`**`, inline: true });
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

    if (b.category === 'interserver') {
      const state = getBossRotationState(b.bossId || b.id);
      desc += `🎯 **TAG da Vez:** \`${state.nextTag}\`\n`;
    }

    desc += `👤 **Por:** ${b.createdBy}\n`;
    desc += `───────────────\n`;
  });

  embed.setDescription(desc);
  return embed;
}
