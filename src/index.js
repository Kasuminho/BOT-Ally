import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config, validateConfig } from './config.js';
import { initScheduler } from './services/scheduler.js';
import { registerCommands } from './deploy-commands.js';
import { isAuthorized } from './middleware/auth.js';
import { updateRotationPanel, updateGeloRotationPanel } from './utils/rotation.js';

import * as bossCmd from './commands/boss.js';
import * as listarCmd from './commands/listarBosses.js';
import * as cancelarCmd from './commands/cancelarBoss.js';
import * as testarCmd from './commands/testar.js';
import * as cargostaffCmd from './commands/cargostaff.js';
import * as auditoriaCmd from './commands/auditoria.js';
import * as rotacaoCmd from './commands/rotacao.js';
import * as registrarStatusCmd from './commands/registrarStatus.js';
import * as consultarStatusCmd from './commands/consultarStatus.js';
import * as listarStatusCmd from './commands/listarStatus.js';
import * as checkinCmd from './commands/checkin.js';
import * as eventoCmd from './commands/evento.js';
import * as rankingCmd from './commands/ranking.js';
import { checkinService } from './services/checkinService.js';
import { eventsDb } from './database/eventsDb.js';

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
const commandsList = [
  bossCmd,
  listarCmd,
  cancelarCmd,
  testarCmd,
  cargostaffCmd,
  auditoriaCmd,
  rotacaoCmd,
  registrarStatusCmd,
  consultarStatusCmd,
  listarStatusCmd,
  checkinCmd,
  eventoCmd,
  rankingCmd
];

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

  // Atualizar imediatamente as mensagens fixas dos painéis de rotação ao iniciar
  await updateRotationPanel(client);
  await updateGeloRotationPanel(client);

  // Inicializar o Scheduler (23:00 Fixo & Timers de Outros Bosses)
  initScheduler(client);

  // Sincroniza e processa imediatamente check-ins pendentes/expirados
  await checkinService.checkActiveCheckins(client);
});

// Comandos acessíveis a todos os membros (sem restrição Staff)
const PUBLIC_COMMANDS = ['registrar-status', 'consultar-status', 'listar', 'ranking'];

// Manipulação centralizada de interações no Discord
client.on('interactionCreate', async interaction => {
  try {
    // 0. Autocomplete para seleção de eventos em /checkin
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'checkin') {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'evento') {
          const all = Object.values(eventsDb.getAll());
          const q = (focusedOption.value || '').toLowerCase();
          const filtered = all
            .filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
            .slice(0, 25);
          return await interaction.respond(
            filtered.map(e => ({ name: `${e.name} (${e.points} pts - ${e.type})`, value: e.id }))
          );
        }
      }
      return;
    }

    const isCheckinButton = interaction.isButton() && interaction.customId.startsWith('checkin_');
    const isPilotModal = interaction.isModalSubmit() && interaction.customId.startsWith('modal_pilot_');
    const isPilotSelect = interaction.isUserSelectMenu() && interaction.customId.startsWith('checkin_pilot_select_');
    const isPublic = (interaction.isChatInputCommand() && PUBLIC_COMMANDS.includes(interaction.commandName)) ||
      isCheckinButton ||
      isPilotModal ||
      isPilotSelect;

    // Verificação de Autorização (SuperAdmins, Staff ou Cargos Autorizados) para comandos restritos
    if (!isPublic && !isAuthorized(interaction)) {
      const unauthorizedMessage = {
        content: '❌ **Acesso negado!** Apenas membros da **Staff** ou cargos autorizados podem utilizar este comando do BOT Ally.',
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
    // 2. Botões Interativos (Navegação e Check-ins)
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith('audit_page_')) {
        await auditoriaCmd.handleAuditPagination(interaction);
      } else if (interaction.customId.startsWith('checkin_confirm_')) {
        const chkId = interaction.customId.replace('checkin_confirm_', '');
        await checkinService.handleConfirmPresence(interaction, chkId);
      } else if (interaction.customId.startsWith('checkin_pilot_')) {
        const chkId = interaction.customId.replace('checkin_pilot_', '');
        await checkinService.handlePilotButton(interaction, chkId);
      } else if (interaction.customId.startsWith('checkin_cancel_')) {
        const chkId = interaction.customId.replace('checkin_cancel_', '');
        await checkinService.handleCancelPresence(interaction, chkId);
      }
    }
    // 3. String Select Menus (Dropdown)
    else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_boss') {
        await bossCmd.handleSelectMenu(interaction);
      } else if (interaction.customId === 'cancel_boss_select') {
        await cancelarCmd.handleCancelSelect(interaction);
      }
    }
    // 4. User Select Menus (Dropdown de Usuários para Check-in Piloto)
    else if (interaction.isUserSelectMenu()) {
      if (interaction.customId.startsWith('checkin_pilot_select_')) {
        const chkId = interaction.customId.replace('checkin_pilot_select_', '');
        await checkinService.handlePilotUserSelect(interaction, chkId);
      }
    }
    // 5. Modals Submit
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_timer_')) {
        await bossCmd.handleModalSubmit(interaction);
      } else if (interaction.customId.startsWith('modal_pilot_')) {
        const chkId = interaction.customId.replace('modal_pilot_', '');
        await checkinService.handlePilotModalSubmit(interaction, chkId);
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
