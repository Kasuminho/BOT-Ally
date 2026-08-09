import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { createDailyFixedEmbed, createCustomBossEmbed } from '../utils/embeds.js';
import { getChannelForBoss } from '../services/scheduler.js';

export const data = new SlashCommandBuilder()
  .setName('testar')
  .setDescription('Envia um aviso de teste dos Embeds no canal de avisos (SEM marcar @everyone ou cargos).');

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

    // Embed de Teste 1: Boss de Rotação de União (Grotesca)
    const sampleRotationBoss = {
      id: 'panderre_test',
      bossId: 'panderre',
      name: 'Panderre',
      location: 'Caverna Grotesca 3º Andar',
      category: 'interserver',
      categoryLabel: '🗿 Interserver (Grotesca)',
      spawnTimestamp: Date.now(),
      createdBy: interaction.user.tag
    };
    const testRotationEmbed = createCustomBossEmbed(sampleRotationBoss, 'SPAWN');

    // Embed de Teste 2: Bosses Fixos das 23h
    const testFixedEmbed = createDailyFixedEmbed('SPAWN');

    await channel.send({
      content: '🧪 **[TESTE DE EMBEDS E PERMISSÕES]** *(Verificando exibição dos cartões Embed)*',
      embeds: [testRotationEmbed, testFixedEmbed]
    });

    await interaction.reply({
      content: `✅ **Aviso de teste enviado no canal <#${channelId}>!**\n\n📌 **Atenção:** Se apenas o texto apareceu e o cartão do Embed **não apareceu**, ative a permissão **"Inserir Links" (Embed Links)** para o bot no cargo ou no canal de avisos!`,
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
