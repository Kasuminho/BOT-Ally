import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { createDailyFixedEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('testar')
  .setDescription('Envia um aviso de teste no canal de avisos (SEM marcar @everyone).');

export async function execute(interaction) {
  const channelId = config.announcementChannelId;

  if (!channelId) {
    return interaction.reply({
      content: '❌ **Canal de avisos não configurado!** Configure `ANNOUNCEMENT_CHANNEL_ID` no `.env`.',
      ephemeral: true
    });
  }

  try {
    const channel = await interaction.client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: '❌ **Canal de avisos inválido ou não encontrado!**',
        ephemeral: true
      });
    }

    // Embed de teste bonito sem marcar @everyone
    const testEmbed = createDailyFixedEmbed('REMINDER_20M');

    await channel.send({
      content: '🧪 **[AVISO DE TESTE]** Testando formato do anúncio (Sem menção de @everyone):',
      embeds: [testEmbed]
    });

    await interaction.reply({
      content: `✅ **Aviso de teste enviado com sucesso no canal <#${channelId}>!** (Sem marcar @everyone).`,
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erro ao enviar aviso de teste:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao tentar enviar o aviso de teste.',
      ephemeral: true
    });
  }
}
