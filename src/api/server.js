import express from 'express';
import cors from 'cors';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { checkinDb } from '../database/checkinDb.js';
import { db } from '../database/db.js';

export function createApiApp(client) {
  const app = express();

  // Middlewares básicos
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Middleware de Autenticação via API_KEY
  const apiKeyAuth = (req, res, next) => {
    // Rota de healthcheck não exige autenticação para facilitar monitoramento
    if (req.path === '/health' || req.originalUrl?.includes('/health')) {
      return next();
    }

    if (!config.apiKey) {
      console.warn('⚠️ [API] Nenhuma API_KEY configurada no .env. Acesso liberado!');
      return next();
    }

    // Procura chave no header Authorization (Bearer token), no header x-api-key ou query param
    const authHeader = req.headers.authorization;
    let providedKey = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7).trim();
    } else if (req.headers['x-api-key']) {
      providedKey = String(req.headers['x-api-key']).trim();
    } else if (req.query && req.query.api_key) {
      providedKey = String(req.query.api_key).trim();
    }

    if (!providedKey || providedKey !== config.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Acesso não autorizado. Forneça uma API_KEY válida no header Authorization: Bearer <chave> ou x-api-key.'
      });
    }

    next();
  };

  app.use('/api', apiKeyAuth);

  // 1. Healthcheck / Status do Bot
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'online',
      bot: client?.user ? client.user.tag : 'conectando...',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: DateTime.now().setZone('America/Sao_Paulo').toISO()
    });
  });

  // 2. Check-ins Ativos (Ao Vivo)
  app.get('/api/presencas/ativas', (req, res) => {
    try {
      const activeCheckins = checkinDb.getActiveCheckins();
      const list = Object.values(activeCheckins).map(chk => ({
        id: chk.id,
        eventId: chk.eventId,
        eventName: chk.eventName,
        basePoints: chk.points,
        bonusPoints: chk.bonusPoints || 0,
        totalPointsPerAttendee: (Number(chk.points) || 1) + (Number(chk.bonusPoints) || 0),
        durationMinutes: chk.durationMinutes,
        status: chk.status,
        openedAtISO: chk.openedAtISO,
        expiresAtISO: chk.expiresAtISO,
        createdBy: chk.createdBy,
        totalAttendees: chk.attendees?.length || 0,
        attendees: chk.attendees || []
      }));

      res.json({
        success: true,
        total: list.length,
        data: list
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar check-ins ativos:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar check-ins ativos.' });
    }
  });

  // 3. Ranking de Presença (Semanal, Mensal ou Geral)
  app.get('/api/presencas/ranking', (req, res) => {
    try {
      const type = (req.query.tipo || 'semanal').toLowerCase();
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const now = DateTime.now().setZone('America/Sao_Paulo');

      let rankings = [];
      let periodLabel = '';

      if (type === 'semanal') {
        rankings = checkinDb.getWeeklyRanking(now);
        const startStr = now.startOf('week').toFormat('dd/MM/yyyy');
        const endStr = now.endOf('week').toFormat('dd/MM/yyyy');
        periodLabel = `${startStr} a ${endStr}`;
      } else if (type === 'mensal') {
        rankings = checkinDb.getMonthlyRanking(now);
        periodLabel = now.toFormat('LLLL / yyyy');
      } else {
        rankings = checkinDb.getAllTimeRanking();
        periodLabel = 'Geral (Acumulado)';
      }

      const total = rankings.length;
      const paginated = rankings.slice(offset, offset + limit).map((item, idx) => ({
        rank: offset + idx + 1,
        ...item
      }));

      res.json({
        success: true,
        tipo: type,
        periodo: periodLabel,
        total,
        limit,
        offset,
        data: paginated
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar ranking:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar ranking.' });
    }
  });

  // 4. Histórico de Presenças Concluídas
  app.get('/api/presencas/historico', (req, res) => {
    try {
      let history = checkinDb.getHistory();
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 200));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      if (req.query.eventId) {
        const evId = String(req.query.eventId).toLowerCase();
        history = history.filter(h => h.eventId?.toLowerCase() === evId);
      }

      const total = history.length;
      const paginated = history.slice(offset, offset + limit).map(h => ({
        id: h.id,
        eventId: h.eventId,
        eventName: h.eventName,
        pointsPerAttendee: h.pointsPerAttendee,
        closedAtISO: h.closedAtISO,
        totalAttendees: h.attendees?.length || 0,
        attendees: h.attendees || []
      }));

      res.json({
        success: true,
        total,
        limit,
        offset,
        data: paginated
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar histórico:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar histórico.' });
    }
  });

  // 5. Ficha de Presença e Status de um Membro Específico
  app.get('/api/presencas/membro/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      const now = DateTime.now().setZone('America/Sao_Paulo');

      // 1. Busca estatísticas de rankings
      const weekly = checkinDb.getWeeklyRanking(now);
      const monthly = checkinDb.getMonthlyRanking(now);
      const allTime = checkinDb.getAllTimeRanking();

      const weekIndex = weekly.findIndex(r => r.userId === userId);
      const monthIndex = monthly.findIndex(r => r.userId === userId);
      const allIndex = allTime.findIndex(r => r.userId === userId);

      // 2. Histórico recente em que o membro esteve presente
      const history = checkinDb.getHistory();
      const memberEvents = history
        .filter(h => h.attendees?.some(a => a.userId === userId || a.pilotByUserId === userId))
        .slice(0, 15)
        .map(h => {
          const att = h.attendees.find(a => a.userId === userId || a.pilotByUserId === userId);
          return {
            checkinId: h.id,
            eventId: h.eventId,
            eventName: h.eventName,
            closedAtISO: h.closedAtISO,
            points: h.pointsPerAttendee,
            isPilot: Boolean(att?.isPilot),
            pilotInfo: att?.isPilot
              ? { pilotName: att.pilotName, pilotByUserId: att.pilotByUserId }
              : null
          };
        });

      // 3. Status in-game registrado no bot
      const memberGameData = db.getMemberData(userId);

      res.json({
        success: true,
        userId,
        charName: memberGameData?.charName || (allIndex !== -1 ? allTime[allIndex].displayName : null),
        gameStats: memberGameData?.parsedStats || null,
        lastStatusUpdateISO: memberGameData?.lastStatusUpdateISO || null,
        presenca: {
          semanal: {
            pontos: weekIndex !== -1 ? weekly[weekIndex].totalPoints : 0,
            posicao: weekIndex !== -1 ? weekIndex + 1 : null,
            presencas: weekIndex !== -1 ? weekly[weekIndex].totalCheckins : 0
          },
          mensal: {
            pontos: monthIndex !== -1 ? monthly[monthIndex].totalPoints : 0,
            posicao: monthIndex !== -1 ? monthIndex + 1 : null,
            presencas: monthIndex !== -1 ? monthly[monthIndex].totalCheckins : 0
          },
          geral: {
            pontos: allIndex !== -1 ? allTime[allIndex].totalPoints : 0,
            posicao: allIndex !== -1 ? allIndex + 1 : null,
            presencas: allIndex !== -1 ? allTime[allIndex].totalCheckins : 0,
            pilotagens: allIndex !== -1 ? allTime[allIndex].pilotCount : 0
          },
          recentes: memberEvents
        }
      });
    } catch (err) {
      console.error(`❌ [API] Erro ao buscar ficha do membro ${req.params.userId}:`, err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar ficha do membro.' });
    }
  });

  // 6. Lista de Membros e Status Cadastrados (Área de Membros / Mural de Poder)
  app.get('/api/membros/status', (req, res) => {
    try {
      let members = db.getGuildMembersList();

      if (req.query.classe) {
        const queryClasse = String(req.query.classe).toLowerCase();
        members = members.filter(m => m.parsedStats?.classe?.toLowerCase().includes(queryClasse));
      }

      const sortBy = req.query.sort || 'pc';
      members.sort((a, b) => {
        const valA = Number(a.parsedStats?.[sortBy]) || 0;
        const valB = Number(b.parsedStats?.[sortBy]) || 0;
        return valB - valA;
      });

      res.json({
        success: true,
        total: members.length,
        data: members
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar status dos membros:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar status dos membros.' });
    }
  });

  // 7. Bosses Agendados (Timers Ativos)
  app.get('/api/bosses/agendados', (req, res) => {
    try {
      const bosses = db.getBosses();
      res.json({
        success: true,
        total: bosses.length,
        data: bosses
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar bosses agendados:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar bosses.' });
    }
  });

  return app;
}

/**
 * Inicializa o servidor HTTP da API REST
 * @param {import('discord.js').Client} client 
 */
export function startApiServer(client) {
  const app = createApiApp(client);
  const port = config.apiPort;

  try {
    const server = app.listen(port, () => {
      console.log(`🌐 [API REST] Servidor HTTP iniciado com sucesso na porta ${port}!`);
      console.log(`🔑 [API REST] Autenticação: ${config.apiKey ? 'Protegido por API_KEY' : '⚠️ Aberto (Sem API_KEY no .env)'}`);
      console.log(`📡 [API REST] Endpoints disponíveis:`);
      console.log(`   - GET http://localhost:${port}/api/health (Público)`);
      console.log(`   - GET http://localhost:${port}/api/presencas/ativas`);
      console.log(`   - GET http://localhost:${port}/api/presencas/ranking?tipo=semanal|mensal|geral`);
      console.log(`   - GET http://localhost:${port}/api/presencas/historico?limit=20`);
      console.log(`   - GET http://localhost:${port}/api/presencas/membro/:userId`);
      console.log(`   - GET http://localhost:${port}/api/membros/status`);
      console.log(`   - GET http://localhost:${port}/api/bosses/agendados`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ [API REST] A porta ${port} já está em uso! Altere API_PORT no .env`);
      } else {
        console.error('❌ [API REST] Erro ao iniciar servidor HTTP:', err);
      }
    });

    return server;
  } catch (err) {
    console.error('❌ [API REST] Falha crítica ao inicializar Express:', err);
    return null;
  }
}
