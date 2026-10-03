import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { checkinService } from '../services/checkinService.js';
import { eventsDb } from '../database/eventsDb.js';
import { checkinDb } from '../database/checkinDb.js';
import { addAuditEntry } from '../utils/audit.js';

export const data = new SlashCommandBuilder()
  .setName('checkin')
  .setDescription('Gerencia e abre check-ins manuais para bosses e eventos da guilda')
  .addSubcommand(sub =>
    sub
      .setName('abrir')
      .setDescription('Abre um check-in manual imediatamente no canal de check-in')
      .addStringOption(opt =>
        opt
          .setName('evento')
          .setDescription('Selecione ou digite o identificador do evento/boss')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('duracao')
          .setDescription('Duração do check-in em minutos (Padrão: 5 ou 10 minutos)')
          .setMinValue(1)
          .setMaxValue(60)
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('listar-ativos')
      .setDescription('Lista os check-ins que estão com presença aberta neste momento')
  )
  .addSubcommand(sub =>
    sub
      .setName('detalhes')
      .setDescription('Exibe a lista detalhada de participantes e pilotos de um check-in')
      .addStringOption(opt =>
        opt
          .setName('id')
          .setDescription('ID do check-in (ex: chk_1790907960395)')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remover-presenca')
      .setDescription('Remove a presença de um membro de um check-in ativo ou do histórico (Staff)')
      .addUserOption(opt =>
        opt
          .setName('membro')
          .setDescription('Membro do Discord cuja presença será removida')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('id')
          .setDescription('ID do check-in específico (opcional, busca o ativo/recente se omitido)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('encerrar')
      .setDescription('Encerra imediatamente um check-in ativo antes do tempo')
      .addStringOption(opt =>
        opt
          .setName('id')
          .setDescription('ID do check-in ativo a ser encerrado')
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'abrir') {
    const eventInput = interaction.options.getString('evento').toLowerCase();
    const duration = interaction.options.getInteger('duracao') || null;

    const event = eventsDb.get(eventInput);
    const eventName = event ? event.name : eventInput.toUpperCase();
    const authorName = interaction.member?.displayName || interaction.user.username;

    await interaction.deferReply({ ephemeral: true });

    const newCheckin = await checkinService.openCheckin({
      eventId: eventInput,
      createdBy: authorName,
      durationMinutes: duration,
      client: interaction.client
    });

    if (!newCheckin) {
      return interaction.editReply({
        content: '❌ **Erro ao abrir check-in!** Verifique se o canal de check-in (`CHECKIN_CHANNEL_ID` ou `GELO_ANNOUNCEMENT_CHANNEL_ID`) está configurado no `.env`.'
      });
    }

    return interaction.editReply({
      content: `✅ **Check-in para "${eventName}" aberto com sucesso!**\nCanal: <#${newCheckin.channelId}>\nDuração: **${newCheckin.durationMinutes} minutos**\nPontuação: **${newCheckin.points} ponto(s)** por participante.`
    });
  }

  if (subcommand === 'listar-ativos') {
    const actives = checkinDb.getActiveCheckins();
    const activeList = Object.values(actives);

    if (activeList.length === 0) {
      return interaction.reply({
        content: 'ℹ️ Nenhum check-in aberto no momento.',
        ephemeral: true
      });
    }

    let msg = '📋 **Check-ins Ativos no Momento:**\n\n';
    activeList.forEach(c => {
      msg += `• **${c.eventName}** (ID: \`${c.id}\`) - Canal: <#${c.channelId}> - Confirmados: **${c.attendees.length}**\n`;
    });

    return interaction.reply({ content: msg, ephemeral: true });
  }

  if (subcommand === 'detalhes') {
    const chkId = interaction.options.getString('id').trim();
    const chk = checkinDb.getCheckinById(chkId);

    if (!chk) {
      return interaction.reply({
        content: `❌ Check-in com ID \`${chkId}\` não encontrado (nem em ativos, nem no histórico).`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📋 Detalhes do Check-in: ${chk.eventName}`)
      .setDescription(`ID: \`${chk.id}\` | Status: **${chk.status === 'open' ? '🟢 Aberto' : '🔒 Encerrado'}**\nPontos por participante: **${chk.points || chk.pointsPerAttendee || 1}**`)
      .setTimestamp();

    if (chk.attendees && chk.attendees.length > 0) {
      let listText = '';
      chk.attendees.forEach((a, i) => {
        const pilotText = a.isPilot ? ` 🎮 *(Piloto: ${a.pilotByName || 'Outro'})*` : ' 👤 *(Direto)*';
        listText += `${i + 1}. **${a.displayName}** (<@${a.userId}>)${pilotText}\n`;
      });
      embed.addFields({ name: `✅ Participantes Confirmados (${chk.attendees.length})`, value: listText.slice(0, 1024) });
    } else {
      embed.addFields({ name: 'Participantes', value: 'Nenhum participante registrado.' });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (subcommand === 'remover-presenca') {
    const targetUser = interaction.options.getUser('membro');
    const chkId = interaction.options.getString('id')?.trim() || null;

    const result = checkinDb.removeAttendee(chkId, targetUser.id);
    if (!result.found) {
      return interaction.reply({
        content: `❌ Nenhuma presença encontrada para <@${targetUser.id}>${chkId ? ` no check-in \`${chkId}\`` : ''}.`,
        ephemeral: true
      });
    }

    // Se o check-in for ativo, atualiza o Embed do canal em tempo real
    if (result.isActive && result.checkin) {
      await checkinService.refreshCheckinMessage(interaction.client, result.checkin);
    }

    // Log de auditoria
    const staffTag = interaction.user.tag;
    const staffId = interaction.user.id;
    addAuditEntry(
      staffTag,
      staffId,
      `Removeu presença de ${targetUser.tag} (${targetUser.id}) do check-in ${result.checkin.id} (${result.checkin.eventName})`
    );

    const contextStr = result.isActive ? 'check-in ativo' : 'histórico';
    return interaction.reply({
      content: `🗑️ **Presença removida com sucesso!**\nMembro: <@${targetUser.id}> (${targetUser.tag})\nCheck-in: **${result.checkin.eventName}** (\`${result.checkin.id}\` - ${contextStr})\nRemovidos: **${result.removed?.length || 1}** registro(s).`,
      ephemeral: true
    });
  }

  if (subcommand === 'encerrar') {
    const chkId = interaction.options.getString('id');
    const chk = checkinDb.getActiveCheckin(chkId);

    if (!chk) {
      return interaction.reply({
        content: `❌ Check-in ativo com ID \`${chkId}\` não encontrado.`,
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await checkinService.closeCheckin(chkId, interaction.client);

    return interaction.editReply({
      content: `✅ Check-in \`${chkId}\` (${chk.eventName}) encerrado manualmente!`
    });
  }
}
