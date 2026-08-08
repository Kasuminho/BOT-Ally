import { SlashCommandBuilder } from 'discord.js';
import { db } from '../database/db.js';
import { createBossListEmbed } from '../utils/embeds.js';
import { DateTime } from 'luxon';

export const data = new SlashCommandBuilder()
  .setName('bosses')
  .setDescription('Lista todos os bosses ativos atualmente agendados no BOT Ally.');

export async function execute(interaction) {
  const bosses = db.getBosses();
  const now = DateTime.now().setZone('America/Sao_Paulo').toMillis();

  // Filtra apenas bosses que ainda não passaram há mais de 15 min
  const activeBosses = bosses.filter(b => b.spawnTimestamp > (now - 15 * 60 * 1000));

  const embed = createBossListEmbed(activeBosses);

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
