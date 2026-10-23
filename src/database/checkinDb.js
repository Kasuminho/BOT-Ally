import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const CHECKINS_FILE = path.join(DATA_DIR, 'checkins.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readCheckins() {
  if (!fs.existsSync(CHECKINS_FILE)) {
    const initial = { activeCheckins: {}, history: [] };
    writeCheckins(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(CHECKINS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      activeCheckins: parsed.activeCheckins || {},
      history: parsed.history || []
    };
  } catch (error) {
    console.error('Erro ao ler checkins.json:', error);
    return { activeCheckins: {}, history: [] };
  }
}

function writeCheckins(data) {
  try {
    const tempPath = `${CHECKINS_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, CHECKINS_FILE);
  } catch (error) {
    console.error('Erro ao salvar em checkins.json:', error);
  }
}

export const checkinDb = {
  getActiveCheckins() {
    const data = readCheckins();
    return data.activeCheckins;
  },

  getActiveCheckin(chkId) {
    const data = readCheckins();
    return data.activeCheckins[chkId] || null;
  },

  saveActiveCheckin(checkin) {
    const data = readCheckins();
    data.activeCheckins[checkin.id] = checkin;
    writeCheckins(data);
    return checkin;
  },

  removeActiveCheckin(chkId) {
    const data = readCheckins();
    if (data.activeCheckins[chkId]) {
      delete data.activeCheckins[chkId];
      writeCheckins(data);
      return true;
    }
    return false;
  },

  archiveCheckin(completedCheckin) {
    const data = readCheckins();
    delete data.activeCheckins[completedCheckin.id];

    // Evita duplicatas no histórico caso o mesmo ID seja arquivado novamente
    data.history = data.history.filter(item => item.id !== completedCheckin.id);

    // Salva no histórico consolidado
    data.history.unshift(completedCheckin);

    // Mantém os últimos 2.000 registros para evitar arquivo excessivamente pesado
    if (data.history.length > 2000) {
      data.history = data.history.slice(0, 2000);
    }

    writeCheckins(data);
    return completedCheckin;
  },

  getHistory() {
    const data = readCheckins();
    return data.history;
  },

  getCheckinById(chkId) {
    if (!chkId) return null;
    const data = readCheckins();
    return data.activeCheckins[chkId] || data.history.find(h => h.id === chkId) || null;
  },

  /**
   * Remove a presença de um membro de um check-in (ativo ou histórico)
   * @param {string} chkId
   * @param {string} targetUserId
   */
  removeAttendee(chkId, targetUserId) {
    const data = readCheckins();

    // 1. Procura em check-ins ativos
    if (chkId && data.activeCheckins[chkId]) {
      const chk = data.activeCheckins[chkId];
      const initialCount = chk.attendees.length;
      const removed = chk.attendees.filter(a => a.userId === targetUserId || a.pilotByUserId === targetUserId);
      chk.attendees = chk.attendees.filter(a => a.userId !== targetUserId && a.pilotByUserId !== targetUserId);

      if (chk.attendees.length < initialCount) {
        writeCheckins(data);
        return { found: true, isActive: true, removed, checkin: chk };
      }
      return { found: false, isActive: true, checkin: chk };
    }

    // Se chkId não foi passado, procura em todos os ativos primeiro
    if (!chkId) {
      for (const active of Object.values(data.activeCheckins)) {
        const removed = active.attendees.filter(a => a.userId === targetUserId || a.pilotByUserId === targetUserId);
        if (removed.length > 0) {
          active.attendees = active.attendees.filter(a => a.userId !== targetUserId && a.pilotByUserId !== targetUserId);
          writeCheckins(data);
          return { found: true, isActive: true, removed, checkin: active };
        }
      }
    }

    // 2. Procura no histórico
    const historyItem = chkId
      ? data.history.find(h => h.id === chkId)
      : data.history.find(h => h.attendees?.some(a => a.userId === targetUserId || a.pilotByUserId === targetUserId));

    if (historyItem) {
      const initialCount = historyItem.attendees?.length || 0;
      const removed = historyItem.attendees.filter(a => a.userId === targetUserId || a.pilotByUserId === targetUserId);
      historyItem.attendees = historyItem.attendees.filter(a => a.userId !== targetUserId && a.pilotByUserId !== targetUserId);

      if (historyItem.attendees.length < initialCount) {
        writeCheckins(data);
        return { found: true, isActive: false, removed, checkin: historyItem };
      }
      return { found: false, isActive: false, checkin: historyItem };
    }

    return { found: false, notFoundCheckin: true };
  },

  /**
   * Consolida o ranking semanal (Segunda 00:00 a Domingo 23:59 Fuso SP)
   * @param {DateTime|string} [targetDate] Data de referência ou guildFilter direto
   * @param {string|null} [guildFilter=null] Filtro de guilda ('gc', 'rise', 'emo', 'minducas')
   */
  getWeeklyRanking(targetDate = DateTime.now().setZone('America/Sao_Paulo'), guildFilter = null) {
    let date = targetDate;
    let filter = guildFilter;

    // Trata chamada simplificada com apenas guildFilter (ex: getWeeklyRanking('gc'))
    if (typeof targetDate === 'string' && !guildFilter) {
      filter = targetDate;
      date = DateTime.now().setZone('America/Sao_Paulo');
    } else if (!date || typeof date.startOf !== 'function') {
      date = DateTime.now().setZone('America/Sao_Paulo');
    }

    const history = this.getHistory();
    const startOfWeek = date.startOf('week');
    const endOfWeek = date.endOf('week');

    const weeklyHistory = history.filter(item => {
      if (!item.closedAtISO) return false;
      const itemDate = DateTime.fromISO(item.closedAtISO).setZone('America/Sao_Paulo');
      return itemDate >= startOfWeek && itemDate <= endOfWeek;
    });

    return calculateRankings(weeklyHistory, filter);
  },

  /**
   * Consolida o ranking mensal (1º dia do mês 00:00 ao último dia 23:59)
   * @param {DateTime|string} [targetDate] Data de referência ou guildFilter direto
   * @param {string|null} [guildFilter=null] Filtro de guilda ('gc', 'rise', 'emo', 'minducas')
   */
  getMonthlyRanking(targetDate = DateTime.now().setZone('America/Sao_Paulo'), guildFilter = null) {
    let date = targetDate;
    let filter = guildFilter;

    // Trata chamada simplificada com apenas guildFilter (ex: getMonthlyRanking('gc'))
    if (typeof targetDate === 'string' && !guildFilter) {
      filter = targetDate;
      date = DateTime.now().setZone('America/Sao_Paulo');
    } else if (!date || typeof date.startOf !== 'function') {
      date = DateTime.now().setZone('America/Sao_Paulo');
    }

    const history = this.getHistory();
    const startOfMonth = date.startOf('month');
    const endOfMonth = date.endOf('month');

    const monthlyHistory = history.filter(item => {
      if (!item.closedAtISO) return false;
      const itemDate = DateTime.fromISO(item.closedAtISO).setZone('America/Sao_Paulo');
      return itemDate >= startOfMonth && itemDate <= endOfMonth;
    });

    return calculateRankings(monthlyHistory, filter);
  },

  /**
   * Consolida o ranking de todos os tempos
   * @param {string|null} [guildFilter=null] Filtro de guilda ('gc', 'rise', 'emo', 'minducas')
   */
  getAllTimeRanking(guildFilter = null) {
    const history = this.getHistory();
    return calculateRankings(history, guildFilter);
  }
};

/**
 * Agrupa as presenças por usuário calculando pontuação total acumulada.
 * Suporta filtragem por guilda ('rise', 'gc', 'emo', 'minducas').
 * Se um attendee não possuir o campo guild, atribui como 'rise'.
 * 
 * @param {Array} checkinList
 * @param {string|null} [guildFilter=null]
 * @returns {Array}
 */
export function calculateRankings(checkinList, guildFilter = null) {
  const userMap = new Map();
  const normalizedGuildFilter = guildFilter
    ? (typeof guildFilter === 'object' && guildFilter.id ? String(guildFilter.id) : String(guildFilter)).toLowerCase().trim()
    : null;

  for (const chk of checkinList) {
    const points = Number(chk.pointsPerAttendee) || Number(chk.points) || 1;
    const attendees = chk.attendees || [];

    for (const att of attendees) {
      const attGuild = att.guild ? String(att.guild).toLowerCase().trim() : 'rise';

      // Se filtro de guilda foi informado, ignora membros de outras guildas
      if (normalizedGuildFilter && attGuild !== normalizedGuildFilter) {
        continue;
      }

      // Identificador chave: ID de quem recebe os pontos (usuário ou a conta pilotada)
      const userKey = att.userId || att.displayName;
      const current = userMap.get(userKey) || {
        userId: att.userId,
        displayName: att.displayName,
        guild: attGuild,
        totalPoints: 0,
        totalCheckins: 0,
        pilotCount: 0
      };

      current.totalPoints += points;
      current.totalCheckins += 1;
      if (att.isPilot) {
        current.pilotCount += 1;
      }

      // Mantém o nome e guilda mais recentes caso o usuário tenha trocado de nick
      current.displayName = att.displayName;
      if (att.guild) {
        current.guild = attGuild;
      }

      userMap.set(userKey, current);
    }
  }

  // Ordena por maior pontuação (decrescente)
  const ranking = Array.from(userMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return b.totalCheckins - a.totalCheckins;
  });

  return ranking;
}

checkinDb.calculateRankings = calculateRankings;
