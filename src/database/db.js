import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const BOSSES_FILE = path.join(DATA_DIR, 'bosses.json');

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
  }
};
