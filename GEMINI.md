# Regras de Workspace e Guia do Agente - BOT Ally

Este arquivo é lido automaticamente pelo Antigravity / Gemini CLI para definir o contexto operacional e minimizar o consumo de tokens.

---

## 🚫 Restrições de Leitura para Economia de Tokens

1. **PROIBIDO LER**:
   - `node_modules/` (nunca explore ou liste este diretório).
   - `package-lock.json` (use apenas `package.json`).
   - Arquivos brutos em `data/*.json` (`audit.json`, `bosses.json`, `guild_members.json`, `rotation.json`).
2. **CONSULTA DE ESQUEMAS**: Consulte os esquemas de dados prontos em [AGENTS.md](file:///c:/Users/Administrator/Documents/BOT%20Ally/AGENTS.md) ou [ARCHITECTURE.md](file:///c:/Users/Administrator/Documents/BOT%20Ally/ARCHITECTURE.md).
3. **EXPLORAÇÃO**: Não faça buscas recursivas abertas. Consulte o índice de componentes abaixo e abra somente o arquivo específico necessário.

---

## 📌 Visão Rápida da Arquitetura

- **Stack**: Node.js 18+ (ESM), Discord.js v14, Luxon (`America/Sao_Paulo`), node-cron, Google Generative AI (Gemini Flash).
- **Entrada Principal**: `src/index.js` (gerencia eventos, client Discord, comandos, modais, botões e dropdowns).
- **Agendamento & Alertas**: `src/services/scheduler.js` (avisos diários 22:40, 22:55, 23:00 e cron minuto a minuto).
- **Sistema de Rotação**: `src/utils/rotation.js` e `src/commands/rotacao.js` (painéis fixos Interserver vs Gelo).
- **Visão Computacional**: `src/services/visionService.js` (fila com rate limit 5 req/min, fallback de modelos Flash).
- **Banco de Dados**: `src/database/db.js` (gravação atômica em arquivos JSON).
- **Autenticação**: `src/middleware/auth.js` (SuperAdmins, Administradores, Staff ou cargos cadastrados).

---

## ⚙️ Regras de Código

- Sempre mantenha `type: "module"` (import/export).
- Não altere ou delete comentários pré-existentes.
- Para inspeção de dados em runtime no terminal PowerShell, use filtros (ex: `Get-Content data/bosses.json -TotalCount 20`).
- Comandos novos no Discord devem ser adicionados na lista `commandsList` em `src/index.js` e registrados via `npm run deploy-commands`.
