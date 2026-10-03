import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { eventsDb } from '../database/eventsDb.js';

export const data = new SlashCommandBuilder()
  .setName('evento')
  .setDescription('Gerencia os eventos, bosses cadastrados e suas respectivas pontuações de presença')
  .addSubcommand(sub =>
    sub
      .setName('listar')
      .setDescription('Lista todos os eventos cadastrados agrupados por pontuação e duração')
  )
  .addSubcommand(sub =>
    sub
      .setName('editar')
      .setDescription('Altera a pontuação e/ou a duração do timer de um evento/boss')
      .addStringOption(opt =>
        opt
          .setName('evento')
          .setDescription('Identificador do evento (ex: tandallon, ta2, damiross, rotura)')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('pontos')
          .setDescription('Nova pontuação de presença concedida')
          .setRequired(false)
          .setMinValue(1)
      )
      .addIntegerOption(opt =>
        opt
          .setName('duracao')
          .setDescription('Nova duração do timer em minutos (ex: 5, 7, 10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(60)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('pontos')
      .setDescription('Altera a pontuação concedida por um evento/boss')
      .addStringOption(opt =>
        opt
          .setName('evento')
          .setDescription('Identificador do evento (ex: gatphillian, damiross, ta2_ta3, gvg)')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('novos_pontos')
          .setDescription('Nova quantidade de pontos por check-in')
          .setRequired(true)
          .setMinValue(1)
      )
      .addIntegerOption(opt =>
        opt
          .setName('duracao')
          .setDescription('Nova duração do timer em minutos (opcional)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(60)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('cadastrar')
      .setDescription('Cadastra um novo evento ou boss para check-in')
      .addStringOption(opt =>
        opt.setName('id').setDescription('ID único sem espaços (ex: nova_dungeon)').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('nome').setDescription('Nome de exibição (ex: Nova Dungeon)').setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName('pontos').setDescription('Pontos concedidos').setRequired(true).setMinValue(1)
      )
      .addStringOption(opt =>
        opt
          .setName('tipo')
          .setDescription('Tipo do evento')
          .setRequired(false)
          .addChoices(
            { name: 'Manual (GvG, Global, TA)', value: 'manual' },
            { name: 'Automático (Bosses com Spawn)', value: 'auto' }
          )
      )
      .addIntegerOption(opt =>
        opt.setName('duracao').setDescription('Duração padrão em minutos (ex: 5, 7 ou 10)').setRequired(false).setMinValue(1).setMaxValue(60)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remover')
      .setDescription('Remove um evento cadastrado')
      .addStringOption(opt =>
        opt.setName('id').setDescription('ID do evento a remover').setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'listar') {
    const all = eventsDb.getAll();
    const eventList = Object.values(all);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 Catálogo Oficial de Bosses & Eventos (Presença)')
      .setDescription('Configuração atual de pontuações e timers do BOT Ally:\n*Use `/evento editar` para alterar pontos ou tempo de qualquer evento.*')
      .setTimestamp();

    // Agrupamento por tiers de pontos (1 a 5+)
    const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    const others = [];

    eventList.forEach(e => {
      const pts = Number(e.points) || 1;
      const dur = e.defaultDuration || 5;
      const typeBadge = e.type === 'manual' ? '⚔️' : '🤖';
      const text = `• **${e.name}** (\`${e.id}\`) — **${pts} pt(s)** | ⏰ ${dur} min ${typeBadge}`;
      if (tiers[pts]) {
        tiers[pts].push(text);
      } else {
        others.push(text);
      }
    });

    if (tiers[1].length > 0) {
      embed.addFields({ name: `⭐ 1 Ponto (${tiers[1].length} bosses/eventos)`, value: tiers[1].join('\n'), inline: false });
    }
    if (tiers[2].length > 0) {
      embed.addFields({ name: `🌟 2 Pontos (${tiers[2].length} bosses/eventos)`, value: tiers[2].join('\n'), inline: false });
    }
    if (tiers[3].length > 0) {
      embed.addFields({ name: `💫 3 Pontos (${tiers[3].length} bosses/eventos)`, value: tiers[3].join('\n'), inline: false });
    }
    if (tiers[4].length > 0) {
      embed.addFields({ name: `✨ 4 Pontos (${tiers[4].length} bosses/eventos)`, value: tiers[4].join('\n'), inline: false });
    }
    if (tiers[5].length > 0) {
      embed.addFields({ name: `🔥 5 Pontos (${tiers[5].length} bosses/eventos)`, value: tiers[5].join('\n'), inline: false });
    }
    if (others.length > 0) {
      embed.addFields({ name: `💎 Outras Pontuações`, value: others.join('\n'), inline: false });
    }

    embed.setFooter({ text: 'Legenda: 🤖 Check-in Automático | ⚔️ Manual da Guilda' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (subcommand === 'editar') {
    const eventId = interaction.options.getString('evento').toLowerCase().trim();
    const points = interaction.options.getInteger('pontos');
    const duration = interaction.options.getInteger('duracao');

    if (points === null && duration === null) {
      return interaction.reply({
        content: '⚠️ Você deve informar ao menos um parâmetro para atualizar (`pontos` ou `duracao`).',
        ephemeral: true
      });
    }

    const updated = eventsDb.updateEvent(eventId, { points, defaultDuration: duration });
    if (!updated) {
      return interaction.reply({
        content: `❌ Evento com ID \`${eventId}\` não foi encontrado. Use \`/evento listar\` para ver os IDs disponíveis.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `✅ Evento **${updated.name}** (\`${updated.id}\`) atualizado com sucesso!\n• **Pontos:** ${updated.points} pt(s)\n• **Duração do Timer:** ${updated.defaultDuration || 5} minuto(s)`,
      ephemeral: true
    });
  }

  if (subcommand === 'pontos') {
    const eventId = interaction.options.getString('evento').toLowerCase().trim();
    const newPoints = interaction.options.getInteger('novos_pontos');
    const newDuration = interaction.options.getInteger('duracao');

    const updated = eventsDb.updateEvent(eventId, {
      points: newPoints,
      defaultDuration: newDuration
    });

    if (!updated) {
      return interaction.reply({
        content: `❌ Evento com ID \`${eventId}\` não foi encontrado. Use \`/evento listar\` para ver os IDs disponíveis.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `✅ Pontuação do evento **${updated.name}** atualizada para **${updated.points} ponto(s)** (Duração: ${updated.defaultDuration || 5} min) com sucesso!`,
      ephemeral: true
    });
  }

  if (subcommand === 'cadastrar') {
    const id = interaction.options.getString('id').toLowerCase().trim();
    const name = interaction.options.getString('nome').trim();
    const points = interaction.options.getInteger('pontos');
    const type = interaction.options.getString('tipo') || 'manual';
    const defaultDuration = interaction.options.getInteger('duracao') || 5;

    const saved = eventsDb.save({ id, name, points, type, defaultDuration });

    return interaction.reply({
      content: `✅ Evento **${saved.name}** (\`${saved.id}\`) cadastrado com sucesso com **${saved.points} pontos** e duração de **${saved.defaultDuration} min**!`,
      ephemeral: true
    });
  }

  if (subcommand === 'remover') {
    const id = interaction.options.getString('id').toLowerCase().trim();
    const removed = eventsDb.remove(id);

    if (!removed) {
      return interaction.reply({
        content: `❌ Evento \`${id}\` não encontrado.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `🗑️ Evento \`${id}\` removido do catálogo com sucesso.`,
      ephemeral: true
    });
  }
}
