import { SlashCommandBuilder } from 'discord.js';
import { rotationDb, rotateBossTurn, updateRotationPanel } from '../utils/rotation.js';
import { BOSS_LIST } from '../utils/bossList.js';
import { addAuditEntry } from '../utils/audit.js';

const taGrotescaBosses = BOSS_LIST.filter(b => b.category === 'interserver');

export const data = new SlashCommandBuilder()
  .setName('rotacao')
  .setDescription('Gerencia a rotação de drops e o painel fixo de união.')
  .addSubcommand(sub =>
    sub
      .setName('painel')
      .setDescription('Inicializa/Fixa a mensagem única do Painel de Rotação neste canal.')
  )
  .addSubcommand(sub =>
    sub
      .setName('girar')
      .setDescription('Rotaciona manualmente o turno de um boss de TA ou Grotesca.')
      .addStringOption(opt =>
        opt
          .setName('boss')
          .setDescription('Selecione o boss para avançar a vez da TAG')
          .setRequired(true)
          .addChoices(
            ...taGrotescaBosses.map(b => ({ name: `${b.name} (${b.location})`, value: b.id }))
          )
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('tags')
      .setDescription('Gerencia as Tags da união na fila de rotação.')
      .addSubcommand(sub =>
        sub
          .setName('adicionar')
          .setDescription('Adiciona uma nova TAG na sequência da fila.')
          .addStringOption(opt => opt.setName('nome').setDescription('Nome da TAG (ex: TAG C)').setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName('remover')
          .setDescription('Remove uma TAG da fila de rotação.')
          .addStringOption(opt => opt.setName('nome').setDescription('Nome da TAG').setRequired(true))
      )
  );

export async function execute(interaction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // 1. Configurar Painel de Rotação no Canal Atual
  if (subcommand === 'painel') {
    const rot = rotationDb.get();
    rot.panelChannelId = interaction.channelId;
    rot.panelMessageId = null; // força criação de nova mensagem fixa
    rotationDb.save(rot);

    await updateRotationPanel(interaction.client);

    addAuditEntry(
      interaction.user.tag,
      interaction.user.id,
      `Configurou o Painel Fixo de Rotação de Drops no canal <#${interaction.channelId}>`
    );

    return interaction.reply({
      content: `✅ **Painel Oficial de Rotação de Drops configurado no canal <#${interaction.channelId}>!**\nA mensagem única foi publicada e será editada a cada alteração de turno.`,
      ephemeral: true
    });
  }

  // 2. Girar Turno do Boss Manualmente
  if (subcommand === 'girar') {
    const bossId = interaction.options.getString('boss');
    const bObj = BOSS_LIST.find(b => b.id === bossId);
    const bossName = bObj ? bObj.name : bossId;

    const newState = await rotateBossTurn(
      bossId,
      bossName,
      null,
      { authorTag: interaction.user.tag, authorId: interaction.user.id },
      interaction.client
    );

    return interaction.reply({
      content: `🔄 **Turno do Boss ${bossName} rotacionado com sucesso!**\n• Última TAG: \`${newState.lastTag}\`\n• Próxima TAG a receber: \`${newState.nextTag}\`\n*(O painel fixo de rotação foi atualizado automaticamente)*`,
      ephemeral: true
    });
  }

  // 3. Gerenciamento de Tags (Fila)
  if (subcommandGroup === 'tags') {
    const rot = rotationDb.get();
    const tagNome = interaction.options.getString('nome').trim().toUpperCase();

    if (subcommand === 'adicionar') {
      if (rot.tags.includes(tagNome)) {
        return interaction.reply({ content: `❌ A TAG \`${tagNome}\` já está na fila!`, ephemeral: true });
      }
      rot.tags.push(tagNome);
      rotationDb.save(rot);

      await updateRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Adicionou a TAG ${tagNome} na fila de rotação`);

      return interaction.reply({
        content: `✅ **TAG \`${tagNome}\` adicionada com sucesso à fila de rotação!**\nFila atual: [ ${rot.tags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    } else if (subcommand === 'remover') {
      if (rot.tags.length <= 1) {
        return interaction.reply({ content: '❌ A fila precisa ter pelo menos 1 TAG!', ephemeral: true });
      }
      rot.tags = rot.tags.filter(t => t !== tagNome);
      rotationDb.save(rot);

      await updateRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Removeu a TAG ${tagNome} da fila de rotação`);

      return interaction.reply({
        content: `🗑️ **TAG \`${tagNome}\` removida da fila.**\nFila atual: [ ${rot.tags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    }
  }
}
