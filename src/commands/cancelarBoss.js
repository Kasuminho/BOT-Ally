import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { db } from '../database/db.js';
import { DateTime } from 'luxon';

export const data = new SlashCommandBuilder()
  .setName('cancelarboss')
  .setDescription('Cancela o agendamento de um boss rastreado.');

export async function execute(interaction) {
  const bosses = db.getBosses();
  const now = DateTime.now().setZone('America/Sao_Paulo').toMillis();
  const activeBosses = bosses.filter(b => b.spawnTimestamp > (now - 15 * 60 * 1000));

  if (activeBosses.length === 0) {
    return interaction.reply({
      content: 'ℹ️ Não há nenhum boss agendado no momento para cancelar.',
      ephemeral: true
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('cancel_boss_select')
    .setPlaceholder('❌ Selecione o Boss que deseja cancelar...')
    .addOptions(
      activeBosses.map(b => {
        const unixSec = Math.floor(b.spawnTimestamp / 1000);
        return {
          label: `${b.name} (${b.location})`,
          description: `ID: ${b.id} | Agendado por: ${b.createdBy}`,
          value: b.id
        };
      })
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '⚠️ **Selecione o Boss que deseja remover dos agendamentos:**',
    components: [row],
    ephemeral: true
  });
}

/**
 * Manipula a seleção para cancelamento do Boss
 * @param {import('discord.js').StringSelectMenuInteraction} interaction 
 */
export async function handleCancelSelect(interaction) {
  const bossId = interaction.values[0];
  const bosses = db.getBosses();
  const targetBoss = bosses.find(b => b.id === bossId);

  const removed = db.removeBoss(bossId);

  if (removed) {
    await interaction.update({
      content: `✅ **Timer do Boss ${targetBoss ? targetBoss.name : ''} cancelado com sucesso!**`,
      components: []
    });
  } else {
    await interaction.update({
      content: `❌ Boss não encontrado ou já havia sido removido.`,
      components: []
    });
  }
}
