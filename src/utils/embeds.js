import { EmbedBuilder } from 'discord.js';

/**
 * Cria o Embed "enfeitado" para o aviso diário fixo das 23:00 (TA 2 / TA 3 / TA 4)
 * @param {'REMINDER_20M' | 'REMINDER_3M'} noticeType 
 */
export function createDailyFixedEmbed(noticeType) {
  const is20m = noticeType === 'REMINDER_20M';

  const embed = new EmbedBuilder().setTimestamp();

  if (is20m) {
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
        { name: '🏰 TA 4', value: '👑 **Turga / Gillaot / Frezam**', inline: true }
      )
      .setFooter({ text: 'BOT Ally • Lembrete 20m (22:40)' });
  } else {
    embed
      .setTitle('🔥 ⚔️ [ALERTA 3 MINUTOS] BOSSES FIXOS NASCENDO EM BREVE! ⚔️ 🔥')
      .setColor('#FF3300')
      .setDescription(
        '🚨 **ATENÇÃO GUILD ALLY!** Todos os Bosses fixos das **23:00** nascem em **3 MINUTOS**!\n' +
        ' Corram para os mapas!'
      )
      .addFields(
        { name: '🏰 TA 2', value: '🔥 **Ducas**', inline: true },
        { name: '🏰 TA 3', value: '🔥 **Dergio**', inline: true },
        { name: '🏰 TA 4', value: '🔥 **Turga / Gillaot / Frezam**', inline: true }
      )
      .setFooter({ text: 'BOT Ally • Lembrete 3m (22:57)' });
  }

  return embed;
}

/**
 * Cria Embed para agendamentos individuais dos Outros Bosses
 * @param {Object} boss 
 * @param {'REGISTERED' | 'REMINDER_20M' | 'REMINDER_3M'} noticeType 
 */
export function createCustomBossEmbed(boss, noticeType) {
  const embed = new EmbedBuilder().setTimestamp();
  const unixSec = Math.floor(boss.spawnTimestamp / 1000);

  if (noticeType === 'REGISTERED') {
    embed
      .setTitle(`✅ 🎯 BOSS AGENDADO COM SUCESSO!`)
      .setColor('#00FFCC')
      .setDescription(`O timer para o boss **${boss.name}** foi registrado.`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário Previsto', value: `<t:${unixSec}:F> (<t:${unixSec}:R>)`, inline: false },
        { name: '👤 Agendado por', value: `${boss.createdBy}`, inline: true }
      )
      .setFooter({ text: 'BOT Ally • Rastreamento de Bosses' });
  } else if (noticeType === 'REMINDER_20M') {
    embed
      .setTitle(`🚨 ⚔️ [ALERTA 20 MINUTOS] BOSS CHEGANDO!`)
      .setColor('#FF9900')
      .setDescription(`Faltam **20 minutos** para o nascimento do Boss **${boss.name}**!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário do Spawn', value: `<t:${unixSec}:T> (<t:${unixSec}:R>)`, inline: false }
      )
      .setFooter({ text: 'BOT Ally • Lembrete 20m' });
  } else if (noticeType === 'REMINDER_3M') {
    embed
      .setTitle(`🔥 ⚔️ [ALERTA 3 MINUTOS] ${boss.name.toUpperCase()} NASCENDO EM BREVE! ⚔️ 🔥`)
      .setColor('#FF3300')
      .setDescription(`🚨 Faltam apenas **3 minutos** para o nascimento do Boss **${boss.name}** no local **${boss.location}**! Corram!`)
      .addFields(
        { name: '👾 Boss', value: `**${boss.name}**`, inline: true },
        { name: '📍 Local', value: `**${boss.location}**`, inline: true },
        { name: '⏰ Horário do Spawn', value: `<t:${unixSec}:T> (<t:${unixSec}:R>)`, inline: false }
      )
      .setFooter({ text: 'BOT Ally • Lembrete 3m' });
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
    .setFooter({ text: 'BOT Ally • Rastreamento Ativo' });

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
    desc += `👤 **Por:** ${b.createdBy}\n`;
    desc += `───────────────\n`;
  });

  embed.setDescription(desc);
  return embed;
}
