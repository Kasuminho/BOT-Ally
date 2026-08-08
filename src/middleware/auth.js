import { PermissionFlagsBits } from 'discord.js';

export const ALLOWED_USER_IDS = ['273600843251712020'];

/**
 * Verifica se o usuário tem permissão para usar o bot (Dono ou Staff)
 * @param {import('discord.js').Interaction} interaction 
 * @returns {boolean}
 */
export function isAuthorized(interaction) {
  // 1. Permite o ID específico do usuário
  if (ALLOWED_USER_IDS.includes(interaction.user.id)) {
    return true;
  }

  // 2. Se for em Guild, verifica Administrador, Gerenciador do Servidor ou Cargo "Staff"
  if (interaction.member) {
    // Permissão de Administrador ou Gerenciar Servidor
    if (
      interaction.member.permissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return true;
    }

    // Verifica se possui algum cargo com o nome "Staff" (case insensitive)
    if (interaction.member.roles?.cache) {
      const hasStaffRole = interaction.member.roles.cache.some(role =>
        role.name.toLowerCase().includes('staff')
      );
      if (hasStaffRole) return true;
    }
  }

  return false;
}
