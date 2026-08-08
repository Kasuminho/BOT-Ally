import { PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const ROLES_FILE = path.join(DATA_DIR, 'allowed_roles.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const SUPER_ADMIN_IDS = ['273600843251712020', '672236180934492205'];

/**
 * Retorna se o usuário é um dos dois SuperAdmins autorizados
 */
export function isSuperAdmin(userId) {
  return SUPER_ADMIN_IDS.includes(userId);
}

/**
 * Lê a lista de IDs de Cargos permitidos
 */
export function getAllowedRoles() {
  if (!fs.existsSync(ROLES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ROLES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler allowed_roles.json:', err);
    return [];
  }
}

/**
 * Adiciona um Cargo ID à lista de permitidos
 */
export function addAllowedRole(roleId) {
  const roles = getAllowedRoles();
  if (!roles.includes(roleId)) {
    roles.push(roleId);
    fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2), 'utf-8');
  }
  return roles;
}

/**
 * Remove um Cargo ID da lista de permitidos
 */
export function removeAllowedRole(roleId) {
  const roles = getAllowedRoles();
  const filtered = roles.filter(r => r !== roleId);
  fs.writeFileSync(ROLES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  return filtered;
}

/**
 * Verifica se o usuário tem autorização para usar os comandos do BOT Ally
 * @param {import('discord.js').Interaction} interaction 
 * @returns {boolean}
 */
export function isAuthorized(interaction) {
  // 1. SuperAdmins (Você + Knower)
  if (isSuperAdmin(interaction.user.id)) {
    return true;
  }

  // 2. Verificações de permissão em Guild
  if (interaction.member) {
    // Permissão de Administrador ou Gerenciar Servidor
    if (
      interaction.member.permissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return true;
    }

    const memberRoles = interaction.member.roles?.cache;
    if (memberRoles) {
      // Cargo que contém a palavra "Staff" no nome
      const hasStaffName = memberRoles.some(role =>
        role.name.toLowerCase().includes('staff')
      );
      if (hasStaffName) return true;

      // Cargo cadastrado dinamicamente via /cargostaff
      const allowedRoles = getAllowedRoles();
      const hasAllowedRole = allowedRoles.some(roleId => memberRoles.has(roleId));
      if (hasAllowedRole) return true;
    }
  }

  return false;
}
