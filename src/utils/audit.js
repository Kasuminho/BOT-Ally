import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAuditLog() {
  if (!fs.existsSync(AUDIT_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler audit.json:', err);
    return [];
  }
}

function writeAuditLog(data) {
  try {
    const tempPath = `${AUDIT_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, AUDIT_FILE);
  } catch (err) {
    console.error('Erro ao salvar audit.json:', err);
  }
}

/**
 * Adiciona uma nova entrada no log de auditoria
 * @param {string} authorTag - Nome/Tag do usuário que executou a ação
 * @param {string} authorId - ID do usuário
 * @param {string} action - Descrição detalhada da ação
 */
export function addAuditEntry(authorTag, authorId, action) {
  const logs = readAuditLog();
  const timestamp = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm:ss');

  const entry = {
    id: `audit_${Date.now()}`,
    timestamp,
    authorTag,
    authorId,
    action
  };

  // Insere no início (mais recente primeiro)
  logs.unshift(entry);

  // Mantém no máximo 500 registros
  if (logs.length > 500) {
    logs.pop();
  }

  writeAuditLog(logs);
  return entry;
}

/**
 * Retorna uma página de logs de auditoria (20 registros por página)
 * @param {number} page - Número da página (1-based)
 */
export function getAuditPage(page = 1) {
  const logs = readAuditLog();
  const pageSize = 20;
  const totalPages = Math.ceil(logs.length / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (currentPage - 1) * pageSize;
  const entries = logs.slice(startIndex, startIndex + pageSize);

  return {
    entries,
    currentPage,
    totalPages,
    totalLogs: logs.length
  };
}
