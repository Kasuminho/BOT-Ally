import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config, validateConfig } from './config.js';
import { initScheduler } from './services/scheduler.js';
import { registerCommands } from './deploy-commands.js';
import { isAuthorized } from './middleware/auth.js';
import { updateRotationPanel } from './utils/rotation.js';

import * as bossCmd from './commands/boss.js';
import * as listarCmd from './commands/listarBosses.js';
import * as cancelarCmd from './commands/cancelarBoss.js';
import * as testarCmd from './commands/testar.js';
import * as cargostaffCmd from './commands/cargostaff.js';
import * as auditoriaCmd from './commands/auditoria.js';
import * as rotacaoCmd from './commands/rotacao.js';

validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Registra os comandos na coleção
client.commands = new Collection();
const commandsList = [bossCmd, listarCmd, cancelarCmd, testarCmd, cargostaffCmd, auditoriaCmd, rotacaoCmd];

for (const cmd of commandsList) {
  client.commands.set(cmd.data.name, cmd);
}

// Evento quando o bot está pronto
client.once('ready', async () => {
  console.log(`==========================================`);
  console.log(`🤖 BOT Ally conectado como: ${client.user.tag}`);
  console.log(`📢 Canal de Avisos: ${config.announcementChannelId || 'Não configurado'}`);
  console.log(`==========================================`);

  // Registrar/Atualizar Slash Commands
  await registerCommands();

  // Presença do bot
  client.user.setPresence({
    activities: [{ name: 'Gerenciando Bosses & Rotações Ally ⚔️', type: ActivityType.Custom }],
    status: 'online'
  });

  // Atualizar imediatamente a mensagem fixa do painel de rotação ao iniciar
  await updateRotationPanel(client);

  // Inicializar o Scheduler (23:00 Fixo & Timers de Outros Bosses)
  initScheduler(client);
});

// Manipulação centralizada de interações no Discord
client.on('interactionCreate', async interaction => {
  try {
    // Verificação de Autorização (SuperAdmins, Staff ou Cargos Autorizados)
    if (!isAuthorized(interaction)) {
      const unauthorizedMessage = {
        content: '❌ **Acesso negado!** Apenas membros da **Staff** ou cargos autorizados podem utilizar os comandos do BOT Ally.',
        ephemeral: true
      };
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp(unauthorizedMessage);
      } else {
        return await interaction.reply(unauthorizedMessage);
      }
    }

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
    // 2. Botões Interativos (Navegação de Paginação)
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith('audit_page_')) {
        await auditoriaCmd.handleAuditPagination(interaction);
      }
    }
    // 3. Select Menus (Dropdown)
    else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_boss') {
        await bossCmd.handleSelectMenu(interaction);
      } else if (interaction.customId === 'cancel_boss_select') {
        await cancelarCmd.handleCancelSelect(interaction);
      }
    }
    // 4. Modals Submit
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_timer_')) {
        await bossCmd.handleModalSubmit(interaction);
      }
    }
  } catch (error) {
    console.error('❌ Erro na execução da interação:', error);
    const errorMessage = {
      content: '❌ Ocorreu um erro interno ao processar sua solicitação.',
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Login no Discord
client.login(config.token);
