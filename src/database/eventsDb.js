import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const ALIASES = {
  hotura: 'rotura',
  damiros: 'damiross',
  dardalroka: 'dardaloca',
  pander: 'panderre',
  baltazar: 'balthazard',
  stomid: 'stormid',
  melvile: 'melville',
  gatfilian: 'gatphillian',
  loccius: 'loccius_abadia',
  'loccius-abadia': 'loccius_abadia',
  'epica-anonima': 'epica_anonima',
  epica: 'epica_anonima',
  zerkal: 'zerkal_118',
  'zerkal-118': 'zerkal_118',
  'ta2/ta3': 'ta2_ta3',
  't.a 2/t.a 3': 'ta2_ta3',
  't.a 2': 'ta2',
  't.a 3': 'ta3',
  't.a 4': 'ta4'
};

export const DEFAULT_EVENTS = {
  // ⭐ 1 Ponto (1 boss)
  rotura:         { id: 'rotura', name: 'Rotura', points: 1, type: 'auto', defaultDuration: 5 },

  // 🌟 2 Pontos (5 bosses)
  cavaleiro:      { id: 'cavaleiro', name: 'Cavaleiro', points: 2, type: 'auto', defaultDuration: 5 },
  gatphillian:    { id: 'gatphillian', name: 'Gatfilian', points: 2, type: 'auto', defaultDuration: 5 },
  hakir:          { id: 'hakir', name: 'Hakir', points: 2, type: 'auto', defaultDuration: 5 },
  stormid:        { id: 'stormid', name: 'Stomid', points: 2, type: 'auto', defaultDuration: 5 },
  tigdal:         { id: 'tigdal', name: 'Tigdal', points: 2, type: 'auto', defaultDuration: 5 },

  // 💫 3 Pontos (6 bosses)
  damiross:       { id: 'damiross', name: 'Damiros', points: 3, type: 'auto', defaultDuration: 5 },
  dardaloca:      { id: 'dardaloca', name: 'Dardalroka', points: 3, type: 'auto', defaultDuration: 5 },
  kafka:          { id: 'kafka', name: 'Kafka', points: 3, type: 'auto', defaultDuration: 5 },
  loccius_abadia: { id: 'loccius_abadia', name: 'Loccius-Abadia', points: 3, type: 'manual', defaultDuration: 5 },
  tandallon:      { id: 'tandallon', name: 'Tandallon', points: 3, type: 'auto', defaultDuration: 5 },
  epica_anonima:  { id: 'epica_anonima', name: 'Épica Anônima', points: 3, type: 'manual', defaultDuration: 5 },

  // ✨ 4 Pontos (4 bosses/eventos)
  global:         { id: 'global', name: 'Global', points: 4, type: 'manual', defaultDuration: 10 },
  karnius:        { id: 'karnius', name: 'Karnius', points: 4, type: 'manual', defaultDuration: 5 },
  melville:       { id: 'melville', name: 'Melvile', points: 4, type: 'auto', defaultDuration: 5 },
  panderre:       { id: 'panderre', name: 'Pander', points: 4, type: 'auto', defaultDuration: 5 },

  // ✨ 5 Pontos (7 bosses/eventos)
  balthazard:     { id: 'balthazard', name: 'Baltazar', points: 5, type: 'auto', defaultDuration: 5 },
  cruzada:        { id: 'cruzada', name: 'Cruzada', points: 5, type: 'manual', defaultDuration: 10 },
  dominacao:      { id: 'dominacao', name: 'Dominação', points: 5, type: 'manual', defaultDuration: 10 },
  gvg:            { id: 'gvg', name: 'GvG', points: 5, type: 'manual', defaultDuration: 10 },
  ta2_ta3:        { id: 'ta2_ta3', name: 'T.A 2 / T.A 3', points: 5, type: 'auto', defaultDuration: 5 },
  ta2:            { id: 'ta2', name: 'T.A 2', points: 5, type: 'auto', defaultDuration: 5 },
  ta3:            { id: 'ta3', name: 'T.A 3', points: 5, type: 'auto', defaultDuration: 5 },
  ta4:            { id: 'ta4', name: 'T.A 4', points: 5, type: 'auto', defaultDuration: 5 },
  zerkal_118:     { id: 'zerkal_118', name: 'Zerkal-118', points: 5, type: 'manual', defaultDuration: 5 }
};

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    writeEvents(DEFAULT_EVENTS);
    return { ...DEFAULT_EVENTS };
  }
  try {
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_EVENTS, ...parsed };
  } catch (error) {
    console.error('Erro ao ler events.json:', error);
    return { ...DEFAULT_EVENTS };
  }
}

function writeEvents(data) {
  try {
    const tempPath = `${EVENTS_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, EVENTS_FILE);
  } catch (error) {
    console.error('Erro ao salvar em events.json:', error);
  }
}

export const eventsDb = {
  getAll() {
    return readEvents();
  },

  get(id) {
    if (!id) return null;
    const cleanId = id.toLowerCase().trim();
    const resolvedId = ALIASES[cleanId] || cleanId;
    const events = readEvents();
    return events[resolvedId] || events[cleanId] || null;
  },

  updateEvent(id, { points = null, defaultDuration = null }) {
    const events = readEvents();
    const cleanId = id.toLowerCase().trim();
    const resolvedId = ALIASES[cleanId] || cleanId;

    if (!events[resolvedId]) return null;

    if (points !== null && !isNaN(points)) {
      events[resolvedId].points = Number(points);
    }
    if (defaultDuration !== null && !isNaN(defaultDuration)) {
      events[resolvedId].defaultDuration = Number(defaultDuration);
    }

    writeEvents(events);
    return events[resolvedId];
  },

  updatePoints(id, points) {
    return this.updateEvent(id, { points });
  },

  updateDuration(id, defaultDuration) {
    return this.updateEvent(id, { defaultDuration });
  },

  save(eventData) {
    const events = readEvents();
    const key = eventData.id.toLowerCase().trim();
    events[key] = {
      id: key,
      name: eventData.name,
      points: Number(eventData.points) || 1,
      type: eventData.type || 'manual',
      defaultDuration: Number(eventData.defaultDuration) || 5
    };
    writeEvents(events);
    return events[key];
  },

  remove(id) {
    const events = readEvents();
    const key = id.toLowerCase().trim();
    const resolvedId = ALIASES[key] || key;

    if (!events[resolvedId]) return false;

    delete events[resolvedId];
    writeEvents(events);
    return true;
  }
};
