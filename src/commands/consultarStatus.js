import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('consultar-status')
  .setDescription('Consulta os status salvos do personagem de um jogador da guilda')
  .addUserOption(option =>
    option.setName('jogador')
      .setDescription('Selecione o jogador para consultar os status (Opcional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('jogador') || interaction.user;
  const statusData = db.getMemberData(targetUser.id);

  if (!statusData || !statusData.lastStatusUpdateISO) {
    return interaction.reply({
      content: `❌ **Nenhum Status Registrado!** O jogador <@${targetUser.id}> ainda não registrou seus status no bot.\nUse o comando \`/registrar-status\` anexando o print para cadastrar.`,
      ephemeral: true
    });
  }

  const timestampUnix = Math.floor(new Date(statusData.lastStatusUpdateISO).getTime() / 1000);
  const s = statusData.parsedStats || {};
  const desVal = s.desenvolvimento || s.pc || 0;
  const charName = statusData.charName || targetUser.username;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🛡️ STATUS DE ${charName.toUpperCase()}`)
    .setDescription(`Consulta de status de <@${targetUser.id}>\n📅 Última atualização: <t:${timestampUnix}:F> (<t:${timestampUnix}:R>)`)
    .addFields(
      { name: '👤 Personagem', value: `**${charName}**`, inline: true },
      { name: '🗡️ Classe', value: s.classe ? `**${s.classe}**` : 'Não informado', inline: true },
      { name: '⚡ Desenvolvimento (PC)', value: `**${desVal.toLocaleString('pt-BR')}**`, inline: true },
      { name: '⭐ Nível', value: s.nivel ? `**${s.nivel}**` : 'Não informado', inline: true },
      { name: '⚔️ Dano', value: s.dano ? `**${s.dano}**` : '-', inline: true },
      { name: '🛡️ Defesa', value: s.defesa ? `**${s.defesa}**` : '-', inline: true },
      { name: '🎯 Acerto Geral', value: s.acerto ? `**${s.acerto}**` : '-', inline: true },
      { name: '🐉 JvA (Acerto / Defesa)', value: `${s.acertoJvA || '-'} / ${s.defesaJvA || '-'}`, inline: true },
      { name: '⚔️ JvJ (Acerto / Defesa)', value: `${s.acertoJvJ || '-'} / ${s.defesaJvJ || '-'}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'BOT Ally • Acompanhamento de Status' });

  if (statusData.imageUrls && statusData.imageUrls.length > 0) {
    embed.setImage(statusData.imageUrls[0]);
  }

  if (statusData.observacao) {
    embed.addFields({ name: '📝 Observação', value: statusData.observacao, inline: false });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
