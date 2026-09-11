import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { enqueueAnalysis } from '../services/visionService.js';
import { db } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('registrar-status')
  .setDescription('Registra seus status de jogo anexando a print do personagem para leitura via IA Gemini')
  .addStringOption(option =>
    option.setName('nome_personagem')
      .setDescription('Seu Nick / Nome exato do personagem dentro do jogo')
      .setRequired(true)
  )
  .addAttachmentOption(option =>
    option.setName('print_1')
      .setDescription('Print dos status do personagem (HUD / Status)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('observacao')
      .setDescription('Observação ou nota adicional para a Staff (Opcional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const charName = interaction.options.getString('nome_personagem');
  const print1 = interaction.options.getAttachment('print_1');
  const observacao = interaction.options.getString('observacao') || '';

  if (!print1.contentType || !print1.contentType.startsWith('image/')) {
    return interaction.reply({
      content: '❌ **Arquivo Inválido!** Por favor, anexe apenas arquivos de imagem (PNG, JPG, WEBP).',
      ephemeral: true
    });
  }

  // Resposta Efêmera Privada ativada para não poluir o chat
  await interaction.deferReply({ ephemeral: true });

  try {
    // Envia a imagem para a fila com Rate Limit (máximo 5 requisições por minuto)
    const parsedStats = await enqueueAnalysis(print1.url);

    // Salva ou atualiza os status no banco de dados
    const savedMember = db.setPlayerStatus(
      interaction.user.id,
      interaction.user.tag,
      charName,
      parsedStats,
      [print1.url],
      observacao
    );

    const s = savedMember.parsedStats || {};
    const desVal = s.desenvolvimento || s.pc || 0;
    const timestampUnix = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`🛡️ STATUS DE "${charName.toUpperCase()}" REGISTRADOS COM SUCESSO!`)
      .setDescription(`Status de <@${interaction.user.id}> salvos via **IA Gemini** em <t:${timestampUnix}:F>`)
      .addFields(
        { name: '👤 Personagem In-Game', value: `**${charName}**`, inline: true },
        { name: '🗡️ Classe', value: s.classe ? `**${s.classe}**` : 'Não detectado', inline: true },
        { name: '⚡ Desenvolvimento (PC)', value: `**${desVal.toLocaleString('pt-BR')}**`, inline: true },
        { name: '⭐ Nível', value: s.nivel ? `**${s.nivel}**` : 'Não detectado', inline: true },
        { name: '⚔️ Dano', value: s.dano ? `**${s.dano}**` : 'Não detectado', inline: true },
        { name: '🛡️ Defesa', value: s.defesa ? `**${s.defesa}**` : 'Não detectado', inline: true },
        { name: '🎯 Acerto Geral', value: s.acerto ? `**${s.acerto}**` : 'Não detectado', inline: true }
      )
      .setImage(print1.url)
      .setTimestamp()
      .setFooter({ text: 'BOT Ally • Leitura com Fila Rate Limit (5 req/min)' });

    if (s.acertoJvA || s.defesaJvA) {
      embed.addFields({ name: '🐉 JvA (Acerto / Defesa)', value: `${s.acertoJvA || '-'} / ${s.defesaJvA || '-'}`, inline: true });
    }
    if (s.acertoJvJ || s.defesaJvJ) {
      embed.addFields({ name: '⚔️ JvJ (Acerto / Defesa)', value: `${s.acertoJvJ || '-'} / ${s.defesaJvJ || '-'}`, inline: true });
    }
    if (observacao) {
      embed.addFields({ name: '📝 Observação', value: observacao, inline: false });
    }

    await interaction.editReply({
      content: `✅ Seus status de **${charName}** foram salvos com sucesso!`,
      embeds: [embed]
    });

  } catch (err) {
    console.error('Erro ao processar Gemini dos status:', err);
    await interaction.editReply({
      content: `❌ **Erro na Leitura por IA:** Ocorreu uma falha ao ler o print anexado.\nDetalhamento: \`${err.message}\`.\nVerifique se a imagem está nítida e tente novamente.`
    });
  }
}
