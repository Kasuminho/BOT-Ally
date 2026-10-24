import express from 'express';
import cors from 'cors';
import { DateTime } from 'luxon';
import { config, ALLIANCE_GUILDS, getGuildForMember } from '../config.js';
import { checkinDb } from '../database/checkinDb.js';
import { db } from '../database/db.js';
import { getAuditPage } from '../utils/audit.js';
import { getAllowedRoles } from '../middleware/auth.js';

/**
 * Resolve a guilda de um membro através do cache do Discord, do histórico de check-ins ou fallback
 * @param {string} userId 
 * @param {import('discord.js').Client} [client] 
 * @returns {string}
 */
function resolveMemberGuild(userId, client) {
  if (!userId) return 'rise';

  // 1. Tenta identificar nos membros cacheados do Discord
  if (client) {
    try {
      for (const guild of client.guilds?.cache?.values() || []) {
        const member = guild.members?.cache?.get(userId);
        if (member) {
          const gKey = getGuildForMember(member);
          if (gKey) return gKey;
        }
      }
    } catch (_) {}
  }

  // 2. Tenta identificar no histórico recente de check-ins
  try {
    const history = checkinDb.getHistory();
    for (const chk of history) {
      const att = chk.attendees?.find(a => a.userId === userId && a.guild);
      if (att && att.guild) return String(att.guild).toLowerCase().trim();
    }
  } catch (_) {}

  return 'rise';
}

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

  // 2. Check-ins Ativos (Ao Vivo) - Suporta ?guild=rise|gc|emo|minducas
  app.get('/api/presencas/ativas', (req, res) => {
    try {
      const activeCheckins = checkinDb.getActiveCheckins();
      const guildFilter = req.query.guild ? String(req.query.guild).toLowerCase().trim() : null;

      let list = Object.values(activeCheckins).map(chk => {
        const attendees = (chk.attendees || []).map(att => ({
          ...att,
          guild: att.guild ? String(att.guild).toLowerCase().trim() : resolveMemberGuild(att.userId, client)
        }));

        return {
          id: chk.id,
          eventId: chk.eventId,
          eventName: chk.eventName,
          guildId: chk.guildId || null,
          guildName: chk.guildName || (chk.guildId ? chk.guildId.toUpperCase() : null),
          basePoints: chk.points,
          bonusPoints: chk.bonusPoints || 0,
          totalPointsPerAttendee: (Number(chk.points) || 1) + (Number(chk.bonusPoints) || 0),
          durationMinutes: chk.durationMinutes,
          status: chk.status,
          openedAtISO: chk.openedAtISO,
          expiresAtISO: chk.expiresAtISO,
          createdBy: chk.createdBy,
          totalAttendees: attendees.length,
          attendees
        };
      });

      if (guildFilter) {
        list = list
          .filter(chk => {
            if (chk.guildId && chk.guildId.toLowerCase() === guildFilter) return true;
            if (!chk.guildId) return true;
            return false;
          })
          .map(chk => {
            if (!chk.guildId) {
              const filteredAttendees = chk.attendees.filter(a => a.guild === guildFilter);
              return {
                ...chk,
                guildId: guildFilter,
                totalAttendees: filteredAttendees.length,
                attendees: filteredAttendees
              };
            }
            return chk;
          });
      }

      res.json({
        success: true,
        guild: guildFilter || 'todas',
        total: list.length,
        data: list
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar check-ins ativos:', err);
      res.status(500).json({ success: false, error: 'Erro interno ao consultar check-ins ativos.' });
    }
  });

  // 3. Ranking de Presença (Semanal, Mensal ou Geral) - Suporta ?guild=rise|gc|emo|minducas
  app.get('/api/presencas/ranking', (req, res) => {
    try {
      const type = (req.query.tipo || 'semanal').toLowerCase();
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const now = DateTime.now().setZone('America/Sao_Paulo');
      const guildFilter = req.query.guild ? String(req.query.guild).toLowerCase().trim() : null;

      let rankings = [];
      let periodLabel = '';

      if (type === 'semanal') {
        rankings = checkinDb.getWeeklyRanking(now, guildFilter);
        const startStr = now.startOf('week').toFormat('dd/MM/yyyy');
        const endStr = now.endOf('week').toFormat('dd/MM/yyyy');
        periodLabel = `${startStr} a ${endStr}`;
      } else if (type === 'mensal') {
        rankings = checkinDb.getMonthlyRanking(now, guildFilter);
        periodLabel = now.toFormat('LLLL / yyyy');
      } else {
        rankings = checkinDb.getAllTimeRanking(guildFilter);
        periodLabel = 'Geral (Acumulado)';
      }

      const total = rankings.length;
      const paginated = rankings.slice(offset, offset + limit).map((item, idx) => ({
        rank: offset + idx + 1,
        guild: item.guild || 'rise',
        ...item
      }));

      res.json({
        success: true,
        tipo: type,
        guild: guildFilter || 'todas',
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

  // 4. Histórico de Presenças Concluídas - Suporta ?guild=rise|gc|emo|minducas
  app.get('/api/presencas/historico', (req, res) => {
    try {
      let history = checkinDb.getHistory();
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 200));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const guildFilter = req.query.guild ? String(req.query.guild).toLowerCase().trim() : null;

      if (req.query.eventId) {
        const evId = String(req.query.eventId).toLowerCase();
        history = history.filter(h => h.eventId?.toLowerCase() === evId);
      }

      if (guildFilter) {
        history = history.filter(h => {
          if (h.guildId && h.guildId.toLowerCase() === guildFilter) return true;
          return h.attendees?.some(a => {
            const attGuild = a.guild ? String(a.guild).toLowerCase().trim() : 'rise';
            return attGuild === guildFilter;
          });
        });
      }

      const total = history.length;
      const paginated = history.slice(offset, offset + limit).map(h => {
        let atts = (h.attendees || []).map(a => ({
          ...a,
          guild: a.guild ? String(a.guild).toLowerCase().trim() : resolveMemberGuild(a.userId, client)
        }));

        if (guildFilter) {
          atts = atts.filter(a => a.guild === guildFilter);
        }

        return {
          id: h.id,
          eventId: h.eventId,
          eventName: h.eventName,
          guildId: h.guildId || (guildFilter || null),
          pointsPerAttendee: h.pointsPerAttendee,
          closedAtISO: h.closedAtISO,
          totalAttendees: atts.length,
          attendees: atts
        };
      });

      res.json({
        success: true,
        guild: guildFilter || 'todas',
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
      const memberGuild = memberGameData?.guild || resolveMemberGuild(userId, client);

      res.json({
        success: true,
        userId,
        guild: memberGuild,
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

  // 6. Lista de Membros e Status Cadastrados (Área de Membros / Mural de Poder) - Suporta ?guild=rise|gc|emo|minducas
  app.get('/api/membros/status', (req, res) => {
    try {
      let members = db.getGuildMembersList();
      const guildFilter = req.query.guild ? String(req.query.guild).toLowerCase().trim() : null;

      // Anexa a guilda a cada membro
      members = members.map(m => ({
        ...m,
        guild: m.guild ? String(m.guild).toLowerCase().trim() : resolveMemberGuild(m.userId, client)
      }));

      if (guildFilter) {
        members = members.filter(m => m.guild === guildFilter);
      }

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
        guild: guildFilter || 'todas',
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

  // 8. Diagnóstico Completo do Bot na VPS (Admin Health Check)
  app.get('/api/admin/diagnostico', (req, res) => {
    try {
      const bosses = db.getBosses();
      const activeCheckins = checkinDb.getActiveCheckins();
      const auditPage = getAuditPage(1);
      const allowedRoles = getAllowedRoles();
      const mem = process.memoryUsage();

      res.json({
        success: true,
        timestamp: DateTime.now().setZone('America/Sao_Paulo').toISO(),
        bot: {
          tag: client?.user ? client.user.tag : 'desconectado',
          id: client?.user?.id || null,
          pingMs: client?.ws?.ping || 0,
          ready: Boolean(client?.isReady()),
          uptimeSeconds: Math.floor(process.uptime()),
          cachedChannels: client?.channels?.cache?.size || 0,
          cachedGuilds: client?.guilds?.cache?.size || 0
        },
        bosses: {
          totalAtivos: bosses.length,
          lista: bosses.map(b => ({
            id: b.id,
            bossId: b.bossId,
            name: b.name,
            category: b.category,
            server: b.server || null,
            guild: b.guild || null,
            spawnTimeISO: new Date(b.spawnTimestamp).toISOString(),
            channelId: b.channelId
          }))
        },
        checkins: {
          totalAtivos: Object.keys(activeCheckins).length,
          lista: Object.values(activeCheckins).map(c => ({
            id: c.id,
            eventId: c.eventId,
            eventName: c.eventName,
            durationMinutes: c.durationMinutes,
            openedAtISO: c.openedAtISO,
            expiresAtISO: c.expiresAtISO,
            totalAttendees: c.attendees?.length || 0,
            channels: c.channels || [{ channelId: c.channelId }]
          }))
        },
        seguranca: {
          superAdminIds: config.superAdminIds,
          allowedRolesCount: allowedRoles.length,
          allowedRoles
        },
        auditoriaRecente: auditPage.entries.slice(0, 10),
        sistema: {
          nodeVersion: process.version,
          memoriaHeapMB: Math.round(mem.heapUsed / 1024 / 1024),
          memoriaRssMB: Math.round(mem.rss / 1024 / 1024)
        }
      });
    } catch (err) {
      console.error('❌ [API] Erro ao gerar diagnóstico:', err);
      res.status(500).json({ success: false, error: 'Erro ao gerar diagnóstico do bot.' });
    }
  });

  // 9. Logs de Auditoria Completos (Admin)
  app.get('/api/admin/audit', (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const auditData = getAuditPage(page);
      res.json({
        success: true,
        page: auditData.currentPage,
        totalPages: auditData.totalPages,
        totalLogs: auditData.totalLogs,
        data: auditData.entries
      });
    } catch (err) {
      console.error('❌ [API] Erro ao buscar logs de auditoria:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar auditoria.' });
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
