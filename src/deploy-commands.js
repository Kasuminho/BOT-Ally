import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import * as bossCmd from './commands/boss.js';
import * as listarCmd from './commands/listarBosses.js';
import * as cancelarCmd from './commands/cancelarBoss.js';
import * as testarCmd from './commands/testar.js';

const commands = [
  bossCmd.data.toJSON(),
  listarCmd.data.toJSON(),
  cancelarCmd.data.toJSON(),
  testarCmd.data.toJSON()
];

export async function registerCommands() {
  if (!config.token || !config.clientId) {
    console.error('❌ Token ou ClientId ausentes no .env!');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('🔄 Atualizando os Slash Commands do BOT Ally...');

    if (config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Slash Commands registrados com sucesso no Servidor (Guild: ${config.guildId})!`);
    } else {
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log('✅ Slash Commands registrados com sucesso Globalmente!');
    }
  } catch (error) {
    console.error('❌ Erro ao registrar Slash Commands:', error);
  }
}

if (process.argv[1].endsWith('deploy-commands.js')) {
  registerCommands();
}
