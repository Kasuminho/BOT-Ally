import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { createDailyFixedEmbed, createCustomBossEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('testar')
  .setDescription('Envia um aviso de teste no canal de avisos (SEM marcar @everyone ou cargos).');

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

    // Embeds no formato idêntico ao oficial, sem qualquer marcação/ping de cargo
    const testFixedEmbed = createDailyFixedEmbed('REMINDER_20M');

    const sampleBoss = {
      name: 'Dardaloca',
      location: 'Caverna de Gelo 3 Sudoeste',
      spawnTimestamp: Date.now() + 20 * 60 * 1000,
      createdBy: interaction.user.tag,
      categoryLabel: '❄️ Servidor (Gelo)'
    };
    const testCustomEmbed = createCustomBossEmbed(sampleBoss, 'REMINDER_20M');

    await channel.send({
      content: '🧪 **[TESTE DE LAYOUT E PERMISSÕES]** *(Nenhum cargo ou @everyone foi marcado neste teste)*',
      embeds: [testFixedEmbed, testCustomEmbed]
    });

    await interaction.reply({
      content: `✅ **Aviso de teste enviado com sucesso no canal <#${channelId}>!**\nVerifique se o bot conseguiu postar os Embeds corretamente.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erro ao enviar aviso de teste:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao tentar enviar o aviso de teste. Verifique se o bot tem permissão de enviar mensagens e incorporar links no canal.',
      ephemeral: true
    });
  }
}
