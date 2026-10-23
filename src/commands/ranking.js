import { SlashCommandBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { checkinDb } from '../database/checkinDb.js';
import { createRankingEmbed } from '../utils/embeds.js';
import { getGuildForMember, getGuildConfig } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('Consulta a classificação de presença nos check-ins da guilda')
  .addStringOption(opt =>
    opt
      .setName('tipo')
      .setDescription('Período do ranking a ser visualizado')
      .setRequired(false)
      .addChoices(
        { name: 'Semanal (Semana Atual)', value: 'semanal' },
        { name: 'Mensal (Mês Atual)', value: 'mensal' },
        { name: 'Geral (Histórico Completo)', value: 'geral' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('guilda')
      .setDescription('Filtrar ranking por guilda ou aliança unificada')
      .setRequired(false)
      .addChoices(
        { name: 'Minha Guilda (Padrão)', value: 'minha' },
        { name: 'Geral da Aliança (Unificado)', value: 'todas' },
        { name: 'RiseGaming', value: 'rise' },
        { name: 'GC', value: 'gc' },
        { name: 'EMOCORE', value: 'emo' },
        { name: 'Minducas', value: 'minducas' }
      )
  );

export async function execute(interaction) {
  const type = interaction.options.getString('tipo') || 'semanal';
  const guildaOpt = interaction.options.getString('guilda') || 'minha';
  const now = DateTime.now().setZone('America/Sao_Paulo');

  let guildFilter = null;
  if (guildaOpt === 'minha') {
    guildFilter = getGuildForMember(interaction.member);
  } else if (guildaOpt === 'todas') {
    guildFilter = null;
  } else {
    guildFilter = guildaOpt;
  }

  const guildCfg = guildFilter ? getGuildConfig(guildFilter) : null;
  const guildSuffix = guildCfg ? ` - ${guildCfg.name} (${guildCfg.server})` : (guildFilter ? ` - ${guildFilter.toUpperCase()}` : ' - ALIANÇA GERAL');

  let rankings = [];
  let periodLabel = '';
  let title = '';

  if (type === 'semanal') {
    rankings = checkinDb.getWeeklyRanking(now, guildFilter);
    const startStr = now.startOf('week').toFormat('dd/MM');
    const endStr = now.endOf('week').toFormat('dd/MM');
    periodLabel = `${startStr} a ${endStr}`;
    title = `RANKING SEMANAL DE PRESENÇA${guildSuffix}`;
  } else if (type === 'mensal') {
    rankings = checkinDb.getMonthlyRanking(now, guildFilter);
    periodLabel = now.toFormat('LLLL / yyyy');
    title = `RANKING MENSAL DE PRESENÇA${guildSuffix}`;
  } else {
    rankings = checkinDb.getAllTimeRanking(guildFilter);
    periodLabel = 'Geral (Acumulado)';
    title = `RANKING GERAL ACUMULADO${guildSuffix}`;
  }

  // Descobre a posição do membro que executou o comando
  const userId = interaction.user.id;
  const userIndex = rankings.findIndex(r => r.userId === userId);
  let userRank = null;
  let userPoints = 0;

  if (userIndex !== -1) {
    userRank = userIndex + 1;
    userPoints = rankings[userIndex].totalPoints;
  }

  const embed = createRankingEmbed({
    title,
    periodLabel,
    rankings,
    userRank,
    userPoints
  });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

