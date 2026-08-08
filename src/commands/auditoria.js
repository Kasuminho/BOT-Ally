import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getAuditPage } from '../utils/audit.js';
import { getRandomJoke } from '../utils/jokes.js';

export const data = new SlashCommandBuilder()
  .setName('auditoria')
  .setDescription('Exibe o histórico de auditoria das ações e alterações do BOT Ally (paginado).');

/**
 * Cria o Embed e os Botões de Paginação para a auditoria
 */
export function buildAuditPagePayload(page = 1) {
  const { entries, currentPage, totalPages, totalLogs } = getAuditPage(page);

  const embed = new EmbedBuilder()
    .setTitle('📜 ⚔️ HISTÓRICO DE AUDITORIA - BOT ALLY ⚔️ 📜')
    .setColor('#00CCFF')
    .setDescription(`Exibindo **${entries.length}** registros de **${totalLogs}** totais.\nPágina **${currentPage}** de **${totalPages}**:\n\n`)
    .setTimestamp()
    .setFooter({ text: `Página ${currentPage}/${totalPages} • ${getRandomJoke()}` });

  if (entries.length === 0) {
    embed.setDescription('ℹ️ Nenhum registro de auditoria encontrado até o momento.');
  } else {
    let desc = '';
    entries.forEach(item => {
      desc += `🕒 **[${item.timestamp}]**\n`;
      desc += `👤 **Por:** ${item.authorTag} (\`${item.authorId}\`)\n`;
      desc += `📌 **Ação:** ${item.action}\n`;
      desc += `───────────────\n`;
    });
    embed.setDescription(desc);
  }

  const prevBtn = new ButtonBuilder()
    .setCustomId(`audit_page_${currentPage - 1}`)
    .setLabel('◀️ Anterior')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage <= 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`audit_page_${currentPage + 1}`)
    .setLabel('Próxima ▶️')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage >= totalPages);

  const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

  return { embeds: [embed], components: [row] };
}

export async function execute(interaction) {
  const payload = buildAuditPagePayload(1);
  await interaction.reply({
    ...payload,
    ephemeral: true
  });
}

/**
 * Manipula a navegação por botões na auditoria
 * @param {import('discord.js').ButtonInteraction} interaction 
 */
export async function handleAuditPagination(interaction) {
  const customId = interaction.customId; // audit_page_<pageNum>
  const targetPage = parseInt(customId.replace('audit_page_', ''), 10) || 1;

  const payload = buildAuditPagePayload(targetPage);
  await interaction.update({
    ...payload
  });
}
