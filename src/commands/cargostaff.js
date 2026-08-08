import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isSuperAdmin, getAllowedRoles, addAllowedRole, removeAllowedRole } from '../middleware/auth.js';
import { addAuditEntry } from '../utils/audit.js';
import { getRandomJoke } from '../utils/jokes.js';

export const data = new SlashCommandBuilder()
  .setName('cargostaff')
  .setDescription('Comando restrito de gerenciamento de cargos autorizados para o bot.')
  .addSubcommand(sub =>
    sub
      .setName('adicionar')
      .setDescription('Adiciona um cargo à lista de cargos autorizados a usar o bot.')
      .addRoleOption(opt =>
        opt.setName('cargo').setDescription('Selecione o cargo para autorizar').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remover')
      .setDescription('Remove um cargo da lista de cargos autorizados.')
      .addRoleOption(opt =>
        opt.setName('cargo').setDescription('Selecione o cargo para remover').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('listar')
      .setDescription('Lista os cargos atualmente autorizados.')
  );

export async function execute(interaction) {
  // Verificação estrita de SuperAdmin (Apenas Você + Knower)
  if (!isSuperAdmin(interaction.user.id)) {
    return interaction.reply({
      content: '❌ **Acesso negado!** Apenas os SuperAdmins do BOT Ally têm permissão para usar este comando.',
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'adicionar') {
    const role = interaction.options.getRole('cargo');
    addAllowedRole(role.id);

    addAuditEntry(
      interaction.user.tag,
      interaction.user.id,
      `Adicionou o cargo @${role.name} (ID: ${role.id}) à lista de autorizados`
    );

    return interaction.reply({
      content: `✅ **Cargo <@&${role.id}> adicionado com sucesso!** Membros com este cargo agora podem utilizar os comandos do BOT Ally.`,
      ephemeral: true
    });
  } else if (subcommand === 'remover') {
    const role = interaction.options.getRole('cargo');
    removeAllowedRole(role.id);

    addAuditEntry(
      interaction.user.tag,
      interaction.user.id,
      `Removeu o cargo @${role.name} (ID: ${role.id}) da lista de autorizados`
    );

    return interaction.reply({
      content: `🗑️ **Cargo <@&${role.id}> removido com sucesso!**`,
      ephemeral: true
    });
  } else if (subcommand === 'listar') {
    const roleIds = getAllowedRoles();

    const embed = new EmbedBuilder()
      .setTitle('🔒 CARGOS AUTORIZADOS - BOT ALLY')
      .setColor('#9933FF')
      .setTimestamp()
      .setFooter({ text: `${getRandomJoke()}` });

    if (roleIds.length === 0) {
      embed.setDescription('ℹ️ Nenhum cargo cadastrado manualmente no momento.\n*(Cargos com "Staff" no nome e administradores continuam com acesso nativo)*');
    } else {
      const formatted = roleIds.map(id => `• <@&${id}> (ID: \`${id}\`)`).join('\n');
      embed.setDescription(`Os seguintes cargos têm permissão para usar o bot:\n\n${formatted}`);
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}
