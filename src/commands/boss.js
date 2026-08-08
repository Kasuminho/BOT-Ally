import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { BOSS_LIST } from '../utils/bossList.js';
import { db } from '../database/db.js';
import { createCustomBossEmbed } from '../utils/embeds.js';
import { DateTime } from 'luxon';

export const data = new SlashCommandBuilder()
  .setName('boss')
  .setDescription('Seleciona um Boss da lista e define o tempo restante para o nascimento (HH:MM).');

/**
 * Execução do comando /boss
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
export async function execute(interaction) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_boss')
    .setPlaceholder('🎯 Escolha um Boss para agendar o timer...')
    .addOptions(
      BOSS_LIST.map(b => ({
        label: `${b.name} (${b.categoryLabel})`,
        description: `Local: ${b.location}`,
        value: b.id
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '⚔️ **Selecione o Boss desejado no menu abaixo:**',
    components: [row],
    ephemeral: true
  });
}

/**
 * Manipula a seleção no Menu Dropdown de Bosses
 * @param {import('discord.js').StringSelectMenuInteraction} interaction 
 */
export async function handleSelectMenu(interaction) {
  const selectedBossId = interaction.values[0];
  const bossObj = BOSS_LIST.find(b => b.id === selectedBossId);

  if (!bossObj) {
    return interaction.reply({ content: '❌ Boss não encontrado na lista.', ephemeral: true });
  }

  // Cria o Modal para solicitar o tempo restante em HH:MM
  const modal = new ModalBuilder()
    .setCustomId(`modal_timer_${bossObj.id}`)
    .setTitle(`Tempo para ${bossObj.name}`);

  const timerInput = new TextInputBuilder()
    .setCustomId('input_timer')
    .setLabel(`Tempo restante até nascer (HH:MM):`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Exemplo: 02:30 (2h e 30m) ou 00:45 (45 min)')
    .setMinLength(4)
    .setMaxLength(5)
    .setRequired(true);

  const actionRow = new ActionRowBuilder().addComponents(timerInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

/**
 * Manipula o envio do Modal com o tempo HH:MM
 * @param {import('discord.js').ModalSubmitInteraction} interaction 
 */
export async function handleModalSubmit(interaction) {
  const customId = interaction.customId; // modal_timer_<bossId>
  const bossId = customId.replace('modal_timer_', '');
  const bossObj = BOSS_LIST.find(b => b.id === bossId);

  if (!bossObj) {
    return interaction.reply({ content: '❌ Boss não encontrado.', ephemeral: true });
  }

  const rawTime = interaction.fields.getTextInputValue('input_timer').trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return interaction.reply({
      content: '❌ **Formato de tempo inválido!**\nUse o formato `HH:MM` (ex: `02:30` para 2h30m ou `00:45` para 45 minutos).',
      ephemeral: true
    });
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 72 || minutes < 0 || minutes > 59) {
    return interaction.reply({
      content: '❌ **Tempo fora dos limites permitidos!** Os minutos devem ser entre 00 e 59.',
      ephemeral: true
    });
  }

  const totalMinutes = (hours * 60) + minutes;

  if (totalMinutes === 0) {
    return interaction.reply({
      content: '❌ O tempo que falta não pode ser 00:00.',
      ephemeral: true
    });
  }

  const now = DateTime.now().setZone('America/Sao_Paulo');
  const spawnDateTime = now.plus({ minutes: totalMinutes });
  const spawnTimestamp = spawnDateTime.toMillis();

  const bossData = {
    id: `${bossObj.id}_${Date.now()}`,
    bossId: bossObj.id,
    name: bossObj.name,
    location: bossObj.location,
    category: bossObj.category,
    categoryLabel: bossObj.categoryLabel,
    spawnTimestamp,
    createdBy: interaction.user.tag,
    channelId: interaction.channelId,
    notified20m: totalMinutes <= 20, // se faltar 20 min ou menos, marca como já notificado o aviso prévio
    notifiedSpawn: false
  };

  db.addBoss(bossData);

  const embed = createCustomBossEmbed(bossData, 'REGISTERED');

  // Resposta EFÊMERA (apenas para quem usou o comando)
  await interaction.reply({
    content: `📢 **[BOSS RASTREADO]** Timer ativado para **${bossObj.name}** (${bossObj.categoryLabel})!`,
    embeds: [embed],
    ephemeral: true
  });
}
