import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const BOSSES_FILE = path.join(DATA_DIR, 'bosses.json');
const GUILD_MEMBERS_FILE = path.join(DATA_DIR, 'guild_members.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`Erro ao salvar em ${filePath}:`, error);
  }
}

export const db = {
  getBosses() {
    return readJSON(BOSSES_FILE);
  },

  saveBosses(bosses) {
    writeJSON(BOSSES_FILE, bosses);
  },

  addBoss(bossData) {
    const bosses = this.getBosses();
    bosses.push(bossData);
    this.saveBosses(bosses);
    return bossData;
  },

  removeBoss(bossId) {
    const bosses = this.getBosses();
    const filtered = bosses.filter(b => b.id !== bossId);
    const removed = bosses.length !== filtered.length;
    if (removed) {
      this.saveBosses(filtered);
    }
    return removed;
  },

  updateBoss(updatedBoss) {
    const bosses = this.getBosses();
    const index = bosses.findIndex(b => b.id === updatedBoss.id);
    if (index !== -1) {
      bosses[index] = updatedBoss;
      this.saveBosses(bosses);
    }
  },

  // Membros da Guild (Status & Pontuação)
  getGuildMembersList() {
    return readJSON(GUILD_MEMBERS_FILE);
  },

  saveGuildMembersList(list) {
    writeJSON(GUILD_MEMBERS_FILE, list);
  },

  getMemberData(userId) {
    const list = this.getGuildMembersList();
    return list.find(m => m.userId === userId);
  },

  setPlayerStatus(userId, userTag, charName, parsedStats, imageUrls = [], observacao = '') {
    const list = this.getGuildMembersList();
    const index = list.findIndex(m => m.userId === userId);

    const pc = parsedStats.desenvolvimento || ((parsedStats.dano || 0) + (parsedStats.defesa || 0) + (parsedStats.acerto || 0));

    const existingStats = index !== -1 ? (list[index].parsedStats || {}) : {};
    const updatedStats = {
      desenvolvimento: parsedStats.desenvolvimento || existingStats.desenvolvimento || null,
      classe: parsedStats.classe || existingStats.classe || null,
      nivel: parsedStats.nivel || existingStats.nivel || null,
      dano: parsedStats.dano || existingStats.dano || null,
      defesa: parsedStats.defesa || existingStats.defesa || null,
      acerto: parsedStats.acerto || existingStats.acerto || null,
      acertoJvA: parsedStats.acertoJvA || existingStats.acertoJvA || null,
      defesaJvA: parsedStats.defesaJvA || existingStats.defesaJvA || null,
      acertoJvJ: parsedStats.acertoJvJ || existingStats.acertoJvJ || null,
      defesaJvJ: parsedStats.defesaJvJ || existingStats.defesaJvJ || null,
      pc
    };

    const memberEntry = {
      userId,
      userTag,
      charName: charName ? charName.trim() : (index !== -1 ? list[index].charName : userTag),
      parsedStats: updatedStats,
      imageUrls: imageUrls.filter(Boolean),
      observacao,
      lastStatusUpdateISO: new Date().toISOString()
    };

    if (index !== -1) {
      list[index] = { ...list[index], ...memberEntry };
    } else {
      list.push(memberEntry);
    }

    this.saveGuildMembersList(list);
    return memberEntry;
  }
};
