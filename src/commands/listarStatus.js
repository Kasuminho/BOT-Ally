import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('listar')
  .setDescription('Lista os jogadores da guilda filtrando por valores mínimos de Acerto, Defesa ou PC')
  .addIntegerOption(option =>
    option.setName('acerto')
      .setDescription('Acerto mínimo desejado (ex: 800)')
      .setRequired(false)
      .setMinValue(0)
  )
  .addIntegerOption(option =>
    option.setName('defesa')
      .setDescription('Defesa mínima desejada (ex: 700)')
      .setRequired(false)
      .setMinValue(0)
  )
  .addIntegerOption(option =>
    option.setName('desenvolvimento')
      .setDescription('Desenvolvimento / PC mínimo desejado (ex: 300000)')
      .setRequired(false)
      .setMinValue(0)
  );

export async function execute(interaction) {
  const minAcerto = interaction.options.getInteger('acerto') || 0;
  const minDefesa = interaction.options.getInteger('defesa') || 0;
  const minPC = interaction.options.getInteger('desenvolvimento') || 0;

  const members = db.getGuildMembersList();
  const registeredMembers = members.filter(m => m.lastStatusUpdateISO && m.parsedStats);

  if (registeredMembers.length === 0) {
    return interaction.reply({
      content: 'ℹ️ **Nenhum status cadastrado no sistema.** Use `/registrar-status` para cadastrar seus status.',
      ephemeral: true
    });
  }

  // Aplica os filtros exigidos pelo usuário
  const filtered = registeredMembers.filter(m => {
    const s = m.parsedStats || {};
    const acertoOk = minAcerto === 0 || ((s.acerto || 0) >= minAcerto);
    const defesaOk = minDefesa === 0 || ((s.defesa || 0) >= minDefesa);
    const pcOk = minPC === 0 || ((s.pc || s.desenvolvimento || 0) >= minPC);
    return acertoOk && defesaOk && pcOk;
  });

  // Ordena por PC / Desenvolvimento decrescente
  filtered.sort((a, b) => {
    const pcA = a.parsedStats?.pc || a.parsedStats?.desenvolvimento || 0;
    const pcB = b.parsedStats?.pc || b.parsedStats?.desenvolvimento || 0;
    return pcB - pcA;
  });

  const filterSummary = [];
  if (minAcerto > 0) filterSummary.push(`🎯 **Acerto ≥ ${minAcerto}**`);
  if (minDefesa > 0) filterSummary.push(`🛡️ **Defesa ≥ ${minDefesa}**`);
  if (minPC > 0) filterSummary.push(`⚡ **PC ≥ ${minPC.toLocaleString('pt-BR')}**`);

  const filterText = filterSummary.length > 0 ? filterSummary.join(' | ') : 'Nenhum filtro aplicado (Todos os cadastrados)';

  const embed = new EmbedBuilder()
    .setTitle('📊 LISTAGEM DE STATUS DA GUILDA - ALLY')
    .setColor('#5865F2')
    .setTimestamp()
    .setFooter({ text: 'BOT Ally • Consulta de Status' });

  if (filtered.length === 0) {
    embed.setDescription(
      `🔍 **Filtros Aplicados:** ${filterText}\n\n❌ **Nenhum personagem atendeu aos critérios informados.**`
    );
  } else {
    let desc = `🔍 **Filtros Aplicados:** ${filterText}\n👥 **Total Encontrado:** ${filtered.length} jogador(es)\n───────────────────────────────\n\n`;

    const displayList = filtered.slice(0, 20);
    displayList.forEach((m, idx) => {
      const s = m.parsedStats || {};
      const charName = m.charName || m.userTag;
      const pcVal = (s.pc || s.desenvolvimento || 0).toLocaleString('pt-BR');
      const acertoVal = s.acerto || '-';
      const defesaVal = s.defesa || '-';
      const danoVal = s.dano || '-';
      const nivelVal = s.nivel ? `Nv.${s.nivel}` : '';
      const classeVal = s.classe || 'N/I';

      desc += `**${idx + 1}. ${charName}** (<@${m.userId}>) - *${classeVal} ${nivelVal}*\n`;
      desc += `   ⚡ **PC:** \`${pcVal}\` | 🎯 **Acerto:** \`${acertoVal}\` | 🛡️ **Defesa:** \`${defesaVal}\` | ⚔️ **Dano:** \`${danoVal}\`\n\n`;
    });

    if (filtered.length > 20) {
      desc += `*... e mais ${filtered.length - 20} jogador(es) atendem aos critérios.*`;
    }

    embed.setDescription(desc);
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
