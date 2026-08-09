import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { addAuditEntry } from './audit.js';
import { getRandomJoke } from './jokes.js';
import { BOSS_LIST } from './bossList.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const ROTATION_FILE = path.join(DATA_DIR, 'rotation.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_TAGS = ['TAG A', 'TAG B'];

function readRotation() {
  if (!fs.existsSync(ROTATION_FILE)) {
    return {
      tags: DEFAULT_TAGS,
      panelChannelId: null,
      panelMessageId: null,
      bosses: {}
    };
  }
  try {
    const raw = fs.readFileSync(ROTATION_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.tags || parsed.tags.length === 0) parsed.tags = DEFAULT_TAGS;
    if (!parsed.bosses) parsed.bosses = {};
    return parsed;
  } catch (err) {
    console.error('Erro ao ler rotation.json:', err);
    return {
      tags: DEFAULT_TAGS,
      panelChannelId: null,
      panelMessageId: null,
      bosses: {}
    };
  }
}

function writeRotation(data) {
  try {
    const tempPath = `${ROTATION_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, ROTATION_FILE);
  } catch (err) {
    console.error('Erro ao salvar rotation.json:', err);
  }
}

export const rotationDb = {
  get() {
    return readRotation();
  },
  save(data) {
    writeRotation(data);
  }
};

/**
 * Retorna a próxima tag da sequência em rodízio
 */
export function getNextTagInSequence(currentTag) {
  const rot = rotationDb.get();
  const tags = rot.tags || DEFAULT_TAGS;
  const index = tags.indexOf(currentTag);
  if (index === -1 || index === tags.length - 1) {
    return tags[0];
  }
  return tags[index + 1];
}

/**
 * Retorna as informações de rotação de um boss específico (ou valores padrão)
 */
export function getBossRotationState(bossId) {
  const rot = rotationDb.get();
  const tags = rot.tags || DEFAULT_TAGS;

  if (rot.bosses && rot.bosses[bossId]) {
    return rot.bosses[bossId];
  }

  // Padrão se ainda não foi rodado
  return {
    lastTag: tags[tags.length - 1],
    nextTag: tags[0],
    updatedAt: '-'
  };
}

/**
 * Executa a rotação do turno de um boss
 * @param {string} bossId - ID do boss
 * @param {string} bossName - Nome amigável do boss
 * @param {string|null} tagConfirmada - Tag que atuou (opcional)
 * @param {Object} authorInfo - { authorTag, authorId }
 * @param {import('discord.js').Client} client 
 */
export async function rotateBossTurn(bossId, bossName, tagConfirmada = null, authorInfo = null, client = null) {
  const rot = rotationDb.get();
  const currentState = getBossRotationState(bossId);
  const currentNext = currentState.nextTag;

  const actualLast = tagConfirmada || currentNext;
  const newNext = getNextTagInSequence(actualLast);
  const nowStr = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm');

  rot.bosses[bossId] = {
    lastTag: actualLast,
    nextTag: newNext,
    updatedAt: nowStr
  };

  rotationDb.save(rot);

  // Registro na auditoria
  const actionText = `Rotacionou Boss ${bossName} (Última: ${actualLast} ➡️ Próxima: ${newNext})`;
  const authorTag = authorInfo?.authorTag || 'BOT Ally (Automático)';
  const authorId = authorInfo?.authorId || 'SYSTEM';

  addAuditEntry(authorTag, authorId, actionText);

  // Atualiza a mensagem fixa do painel no Discord
  if (client) {
    await updateRotationPanel(client);
  }

  return rot.bosses[bossId];
}

/**
 * Reverte o turno de um boss para o estado anterior (usado ao cancelar agendamento)
 * @param {string} bossId - ID do boss
 * @param {string} bossName - Nome amigável do boss
 * @param {string} previousLastTag - Tag anterior (lastTag)
 * @param {string} previousNextTag - Próxima tag anterior (nextTag)
 * @param {Object} authorInfo - { authorTag, authorId }
 * @param {import('discord.js').Client} client 
 */
export async function revertBossTurn(bossId, bossName, previousLastTag, previousNextTag, authorInfo = null, client = null) {
  if (!previousLastTag || !previousNextTag) return null;

  const rot = rotationDb.get();
  const nowStr = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm');

  rot.bosses[bossId] = {
    lastTag: previousLastTag,
    nextTag: previousNextTag,
    updatedAt: nowStr
  };

  rotationDb.save(rot);

  // Registro na auditoria
  const actionText = `Reverteu Rotação do Boss ${bossName} (Restaurado: Última ${previousLastTag} ➡️ Próxima ${previousNextTag})`;
  const authorTag = authorInfo?.authorTag || 'BOT Ally (Automático)';
  const authorId = authorInfo?.authorId || 'SYSTEM';

  addAuditEntry(authorTag, authorId, actionText);

  // Atualiza a mensagem fixa do painel no Discord
  if (client) {
    await updateRotationPanel(client);
  }

  return rot.bosses[bossId];
}

/**
 * Cria ou edita a mensagem única do Painel de Rotação de Drops no Discord
 * @param {import('discord.js').Client} client 
 */
export async function updateRotationPanel(client) {
  const rot = rotationDb.get();
  if (!rot.panelChannelId) return;

  try {
    const channel = await client.channels.fetch(rot.panelChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = createPanelEmbed();

    if (rot.panelMessageId) {
      try {
        const msg = await channel.messages.fetch(rot.panelMessageId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          console.log(`✅ [ROTAÇÃO] Painel único de rotação atualizado na mensagem ${rot.panelMessageId}`);
          return;
        }
      } catch (e) {
        console.warn('⚠️ Mensagem de painel existente não encontrada. Criando uma nova...');
      }
    }

    // Se não encontrou ou não existia, envia nova e salva ID
    const newMsg = await channel.send({ embeds: [embed] });
    rot.panelMessageId = newMsg.id;
    rotationDb.save(rot);
    console.log(`✅ [ROTAÇÃO] Novo painel único criado com mensagem ID ${newMsg.id}`);

  } catch (err) {
    console.error('❌ Erro ao atualizar o painel de rotação:', err);
  }
}

/**
 * Gera o Embed do Painel Fixo de Rotação de Drops (Exclui bosses fixos que são FFA)
 */
export function createPanelEmbed() {
  const rot = rotationDb.get();
  const tags = rot.tags || DEFAULT_TAGS;
  const now = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm');

  // Filtra bosses de TA e Grotesca (excluindo os fixos das 23h que são FFA)
  const taGrotescaBosses = BOSS_LIST.filter(b => b.category === 'interserver');

  let taText = '';
  let grotescaText = '';

  taGrotescaBosses.forEach(b => {
    const state = getBossRotationState(b.id);
    const line = `• **${b.name}** (${b.location})\n  └ 🎯 **Próxima:** \`${state.nextTag}\` | 🕒 **Última:** \`${state.lastTag}\`\n`;

    if (b.location.startsWith('TA')) {
      taText += line;
    } else {
      grotescaText += line;
    }
  });

  const embed = new EmbedBuilder()
    .setTitle('📜 ⚔️ PAINEL OFICIAL DE ROTAÇÃO DE DROPS - UNIÃO ⚔️ 📜')
    .setColor('#9933FF')
    .setDescription(
      `**Última Atualização:** \`${now}\`\n` +
      `🔄 **Sequência de Tags:** [ ${tags.map(t => `\`${t}\``).join(' ➡️ ')} ]\n\n` +
      `*Atenção: A rodada rotaciona automaticamente a cada ciclo de spawn dos bosses de TA/Grotesca. (Bosses fixos das 23h são FFA).*`
    )
    .addFields(
      { name: '🏰 BOSSES DE TA (Torre da Arrogância)', value: taText || 'Nenhum', inline: false },
      { name: '🗿 BOSSES DE GROTESCA', value: grotescaText || 'Nenhum', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `${getRandomJoke()}` });

  return embed;
}
