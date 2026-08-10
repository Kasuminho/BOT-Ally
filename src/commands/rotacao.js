import { SlashCommandBuilder } from 'discord.js';
import { rotationDb, rotateBossTurn, updateRotationPanel, updateGeloRotationPanel } from '../utils/rotation.js';
import { BOSS_LIST } from '../utils/bossList.js';
import { addAuditEntry } from '../utils/audit.js';

const rotatableBosses = BOSS_LIST.filter(b => b.category === 'interserver' || b.category === 'gelo');

export const data = new SlashCommandBuilder()
  .setName('rotacao')
  .setDescription('Gerencia a rotação de drops e o painel fixo de união.')
  .addSubcommand(sub =>
    sub
      .setName('painel')
      .setDescription('Inicializa/Fixa a mensagem única do Painel de Rotação Principal neste canal.')
  )
  .addSubcommand(sub =>
    sub
      .setName('painelgelo')
      .setDescription('Inicializa/Fixa a mensagem única do Painel de Rotação da Masmorra de Gelo neste canal.')
  )
  .addSubcommand(sub =>
    sub
      .setName('girar')
      .setDescription('Rotaciona manualmente o turno de um boss (TA, Grotesca ou Gelo).')
      .addStringOption(opt =>
        opt
          .setName('boss')
          .setDescription('Selecione o boss para avançar a vez da TAG')
          .setRequired(true)
          .addChoices(
            ...rotatableBosses.map(b => ({ name: `${b.name} (${b.location})`, value: b.id }))
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
          .addBooleanOption(opt => opt.setName('gelo').setDescription('Participa da rotação do Gelo (MF)? (Padrão: Sim)'))
      )
      .addSubcommand(sub =>
        sub
          .setName('editar')
          .setDescription('Altera/Renomeia uma TAG existente mantendo a posição e histórico.')
          .addStringOption(opt => opt.setName('antiga').setDescription('Nome da TAG atual a ser substituída').setRequired(true))
          .addStringOption(opt => opt.setName('nova').setDescription('Novo nome da TAG').setRequired(true))
          .addBooleanOption(opt => opt.setName('gelo').setDescription('Participa da rotação do Gelo (MF)?'))
      )
      .addSubcommand(sub =>
        sub
          .setName('remover')
          .setDescription('Remove uma TAG da fila de rotação.')
          .addStringOption(opt => opt.setName('nome').setDescription('Nome da TAG').setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName('gelo')
          .setDescription('Define se uma TAG participa da rotação da Masmorra de Gelo (MF).')
          .addStringOption(opt => opt.setName('nome').setDescription('Nome da TAG').setRequired(true))
          .addBooleanOption(opt => opt.setName('participa').setDescription('Participa da rotação de Gelo?').setRequired(true))
      )
  );

export async function execute(interaction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // 1. Configurar Painel de Rotação Principal
  if (subcommand === 'painel') {
    const rot = rotationDb.get();
    rot.panelChannelId = interaction.channelId;
    rot.panelMessageId = null; // força criação de nova mensagem fixa
    rotationDb.save(rot);

    await updateRotationPanel(interaction.client);

    addAuditEntry(
      interaction.user.tag,
      interaction.user.id,
      `Configurou o Painel Fixo Principal de Rotação no canal <#${interaction.channelId}>`
    );

    return interaction.reply({
      content: `✅ **Painel Oficial de Rotação Principal configurado no canal <#${interaction.channelId}>!**\nA mensagem única foi publicada e será editada a cada alteração de turno.`,
      ephemeral: true
    });
  }

  // 2. Configurar Painel de Rotação de Gelo
  if (subcommand === 'painelgelo') {
    const rot = rotationDb.get();
    rot.geloPanelChannelId = interaction.channelId;
    rot.geloPanelMessageId = null; // força criação de nova mensagem fixa
    rotationDb.save(rot);

    await updateGeloRotationPanel(interaction.client);

    addAuditEntry(
      interaction.user.tag,
      interaction.user.id,
      `Configurou o Painel Fixo de Rotação da Masmorra de Gelo no canal <#${interaction.channelId}>`
    );

    return interaction.reply({
      content: `✅ **Painel Oficial de Rotação de Gelo (MF) configurado no canal <#${interaction.channelId}>!**\nA mensagem única foi publicada e será editada a cada alteração de turno.`,
      ephemeral: true
    });
  }

  // 3. Girar Turno do Boss Manualmente
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

  // 4. Gerenciamento de Tags (Fila)
  if (subcommandGroup === 'tags') {
    const rot = rotationDb.get();
    if (!rot.geloTags) rot.geloTags = [...rot.tags];

    if (subcommand === 'adicionar') {
      const tagNome = interaction.options.getString('nome').trim().toUpperCase();
      const participaGelo = interaction.options.getBoolean('gelo') ?? true;

      if (rot.tags.includes(tagNome)) {
        return interaction.reply({ content: `❌ A TAG \`${tagNome}\` já está na fila!`, ephemeral: true });
      }
      rot.tags.push(tagNome);
      if (participaGelo && !rot.geloTags.includes(tagNome)) {
        rot.geloTags.push(tagNome);
      }
      rotationDb.save(rot);

      await updateRotationPanel(interaction.client);
      await updateGeloRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Adicionou a TAG ${tagNome} na fila (Gelo: ${participaGelo ? 'Sim' : 'Não'})`);

      return interaction.reply({
        content: `✅ **TAG \`${tagNome}\` adicionada com sucesso!**\n• Fila Geral: [ ${rot.tags.join(' ➡️ ')} ]\n• Fila de Gelo: [ ${rot.geloTags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    } else if (subcommand === 'editar') {
      const antiga = interaction.options.getString('antiga').trim().toUpperCase();
      const nova = interaction.options.getString('nova').trim().toUpperCase();
      const participaGeloOpt = interaction.options.getBoolean('gelo');

      const index = rot.tags.indexOf(antiga);
      if (index === -1) {
        return interaction.reply({
          content: `❌ A TAG \`${antiga}\` não foi encontrada na fila atual! [ ${rot.tags.join(' ➡️ ')} ]`,
          ephemeral: true
        });
      }

      rot.tags[index] = nova;

      const geloIndex = rot.geloTags.indexOf(antiga);
      if (geloIndex !== -1) {
        if (participaGeloOpt === false) {
          rot.geloTags.splice(geloIndex, 1);
        } else {
          rot.geloTags[geloIndex] = nova;
        }
      } else if (participaGeloOpt === true) {
        rot.geloTags.push(nova);
      }

      if (rot.bosses) {
        Object.keys(rot.bosses).forEach(bossId => {
          if (rot.bosses[bossId].lastTag === antiga) {
            rot.bosses[bossId].lastTag = nova;
          }
          if (rot.bosses[bossId].nextTag === antiga) {
            rot.bosses[bossId].nextTag = nova;
          }
        });
      }

      rotationDb.save(rot);

      await updateRotationPanel(interaction.client);
      await updateGeloRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Alterou a TAG ${antiga} para ${nova}`);

      return interaction.reply({
        content: `✏️ **TAG \`${antiga}\` alterada para \`${nova}\` com sucesso!**\n• Fila Geral: [ ${rot.tags.join(' ➡️ ')} ]\n• Fila de Gelo: [ ${rot.geloTags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    } else if (subcommand === 'remover') {
      const tagNome = interaction.options.getString('nome').trim().toUpperCase();
      if (rot.tags.length <= 1) {
        return interaction.reply({ content: '❌ A fila precisa ter pelo menos 1 TAG!', ephemeral: true });
      }
      rot.tags = rot.tags.filter(t => t !== tagNome);
      rot.geloTags = rot.geloTags.filter(t => t !== tagNome);
      rotationDb.save(rot);

      await updateRotationPanel(interaction.client);
      await updateGeloRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Removeu a TAG ${tagNome} da fila de rotação`);

      return interaction.reply({
        content: `🗑️ **TAG \`${tagNome}\` removida da fila.**\n• Fila Geral: [ ${rot.tags.join(' ➡️ ')} ]\n• Fila de Gelo: [ ${rot.geloTags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    } else if (subcommand === 'gelo') {
      const tagNome = interaction.options.getString('nome').trim().toUpperCase();
      const participa = interaction.options.getBoolean('participa');

      if (!rot.tags.includes(tagNome)) {
        return interaction.reply({ content: `❌ A TAG \`${tagNome}\` não foi encontrada na lista de TAGs cadastradas!`, ephemeral: true });
      }

      if (participa) {
        if (!rot.geloTags.includes(tagNome)) rot.geloTags.push(tagNome);
      } else {
        if (rot.geloTags.length <= 1 && rot.geloTags.includes(tagNome)) {
          return interaction.reply({ content: '❌ A fila de Gelo precisa ter pelo menos 1 TAG!', ephemeral: true });
        }
        rot.geloTags = rot.geloTags.filter(t => t !== tagNome);
      }

      rotationDb.save(rot);

      await updateGeloRotationPanel(interaction.client);
      addAuditEntry(interaction.user.tag, interaction.user.id, `Alterou flag de Gelo da TAG ${tagNome} para ${participa ? 'Sim' : 'Não'}`);

      return interaction.reply({
        content: `❄️ **Flag de Gelo atualizada para a TAG \`${tagNome}\`!** (Participa: \`${participa ? 'Sim' : 'Não'}\`)\nFila de Gelo atual: [ ${rot.geloTags.join(' ➡️ ')} ]`,
        ephemeral: true
      });
    }
  }
}
