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
import { config } from '../config.js';
import { rotateBossTurn, getBossRotationState } from '../utils/rotation.js';
import { addAuditEntry } from '../utils/audit.js';
import { getChannelForBoss } from '../services/scheduler.js';
import { DateTime } from 'luxon';

export const data = new SlashCommandBuilder()
  .setName('boss')
  .setDescription('Seleciona um Boss da lista e define o tempo restante para o nascimento (HH:MM).');

/**
 * Execução do comando /boss
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
export async function execute(interaction) {
  const activeBosses = db.getBosses();
  const now = DateTime.now().setZone('America/Sao_Paulo').toMillis();

  // Conjunto de IDs dos bosses que já possuem timer ativo
  const activeBossIds = new Set(
    activeBosses
      .filter(b => b.spawnTimestamp > (now - 15 * 60 * 1000))
      .map(b => b.bossId)
  );

  // Filtra apenas os bosses que AINDA NÃO possuem timer agendado
  const availableBosses = BOSS_LIST.filter(b => !activeBossIds.has(b.id));

  if (availableBosses.length === 0) {
    return interaction.reply({
      content: 'ℹ️ **Todos os bosses disponíveis já possuem timers ativos agendados!**\nUse `/bosses` para visualizar a lista ou `/cancelarboss` para remover algum agendamento.',
      ephemeral: true
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_boss')
    .setPlaceholder(`🎯 Escolha um Boss (${availableBosses.length} disponíveis)...`)
    .addOptions(
      availableBosses.map(b => ({
        label: `${b.name} (${b.categoryLabel})`,
        description: `Local: ${b.location}`,
        value: b.id
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '⚔️ **Selecione o Boss desejado no menu abaixo:** *(Bosses com timer ativo não aparecem nesta lista)*',
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

  // Verifica se o boss já foi agendado enquanto o usuário navegava no menu
  const activeBosses = db.getBosses();
  const now = DateTime.now().setZone('America/Sao_Paulo').toMillis();
  const isAlreadyScheduled = activeBosses.some(
    b => b.bossId === bossObj.id && b.spawnTimestamp > (now - 15 * 60 * 1000)
  );

  if (isAlreadyScheduled) {
    return interaction.reply({
      content: `❌ **O boss ${bossObj.name} já possui um timer ativo agendado!**`,
      ephemeral: true
    });
  }

  let labelText = `Tempo restante até nascer (HH:MM):`;
  if (bossObj.category === 'interserver') {
    const rotState = getBossRotationState(bossObj.id);
    labelText = `[TAG ${rotState.nextTag}] Tempo até nascer (HH:MM):`;
  }

  // Cria o Modal para solicitar o tempo restante em HH:MM
  const modal = new ModalBuilder()
    .setCustomId(`modal_timer_${bossObj.id}`)
    .setTitle(`Tempo para ${bossObj.name}`);

  const timerInput = new TextInputBuilder()
    .setCustomId('input_timer')
    .setLabel(labelText)
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
  const nowMs = now.toMillis();

  // Validação de duplicidade no submit do modal
  const activeBosses = db.getBosses();
  const isAlreadyScheduled = activeBosses.some(
    b => b.bossId === bossObj.id && b.spawnTimestamp > (nowMs - 15 * 60 * 1000)
  );

  if (isAlreadyScheduled) {
    return interaction.reply({
      content: `❌ **O boss ${bossObj.name} já possui um timer ativo agendado!**`,
      ephemeral: true
    });
  }

  // Se for boss de TA ou Grotesca, executa a rotação de união automaticamente
  let rotText = '';
  let targetTag = null;
  let nextTag = null;
  let previousLastTag = null;
  let previousNextTag = null;

  if (bossObj.category === 'interserver') {
    const prevState = getBossRotationState(bossObj.id);
    previousLastTag = prevState.lastTag;
    previousNextTag = prevState.nextTag;

    const newState = await rotateBossTurn(
      bossObj.id,
      bossObj.name,
      null,
      { authorTag: interaction.user.tag, authorId: interaction.user.id },
      interaction.client
    );
    targetTag = newState.lastTag;
    nextTag = newState.nextTag;
    rotText = `\n🔄 **Rodada da União:** O turno deste boss foi confirmado para \`${newState.lastTag}\` e avançou para a próxima TAG \`${newState.nextTag}\` (Painel fixo atualizado).`;
  }

  const spawnDateTime = now.plus({ minutes: totalMinutes });
  const spawnTimestamp = spawnDateTime.toMillis();

  // Determina canal de destino (Canal de Gelo dedicado ou Canal Padrão)
  const targetChannelId = getChannelForBoss(bossObj) || interaction.channelId;

  const bossData = {
    id: `${bossObj.id}_${Date.now()}`,
    bossId: bossObj.id,
    name: bossObj.name,
    location: bossObj.location,
    category: bossObj.category,
    categoryLabel: bossObj.categoryLabel,
    targetTag,
    nextTag,
    previousLastTag,
    previousNextTag,
    spawnTimestamp,
    createdBy: interaction.user.tag,
    channelId: targetChannelId,
    notified20m: totalMinutes <= 20,
    notified5m: totalMinutes <= 5,
    notifiedSpawn: false
  };

  db.addBoss(bossData);

  // Registro na Auditoria
  addAuditEntry(
    interaction.user.tag,
    interaction.user.id,
    `Agendou o Boss ${bossObj.name} (${bossObj.location}) para ${totalMinutes}m a partir de agora`
  );

  const embed = createCustomBossEmbed(bossData, 'REGISTERED');

  // Resposta EFÊMERA
  await interaction.reply({
    content: `📢 **[BOSS RASTREADO]** Timer ativado para **${bossObj.name}** (${bossObj.categoryLabel})!${rotText}\nOs avisos serão enviados no canal <#${targetChannelId}>.`,
    embeds: [embed],
    ephemeral: true
  });
}
