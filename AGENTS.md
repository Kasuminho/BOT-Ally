# Diretrizes de Desenvolvimento e Economia de Tokens - BOT Ally

Este arquivo define as regras de contexto, padrões de arquitetura e restrições para agentes de IA (Antigravity, Cursor, Claude, etc.) atuando no repositório **BOT Ally**.

---

## ⚡ Regras Estritas de Economia de Tokens

Para evitar consumo desnecessário de tokens de contexto:
1. **NUNCA leia `node_modules/` ou `package-lock.json`**: Se precisar verificar dependências, leia apenas `package.json`.
2. **NUNCA leia arquivos de dados completos em `data/`**: Os arquivos `data/audit.json`, `data/bosses.json`, `data/guild_members.json`, `data/rotation.json` e `data/allowed_roles.json` são persistências em disco de execução. Consulte os esquemas documentados abaixo em vez de ler o JSON bruto.
3. **NUNCA faça varreduras cegas de diretórios**: Use o mapa de arquivos desta documentação para abrir diretamente o arquivo alvo da alteração.
4. **Respostas Concisas**: Responda diretamente ao ponto sem reproduzir código não modificado ou explicações genéricas.

---

## 🗺️ Mapa de Responsabilidade dos Arquivos (`src/`)

```
src/
├── config.js               # Carrega e valida variáveis de ambiente (.env)
├── deploy-commands.js      # Registra/atualiza Slash Commands na API do Discord
├── index.js                # Inicialização do client Discord, roteamento de interações e eventos
├── commands/
│   ├── auditoria.js        # /auditoria [pagina] - Paginação de logs em embeds interativos
│   ├── boss.js             # /boss - Menu dropdown e modal para agendar timers de bosses
│   ├── cancelarBoss.js     # /cancelarboss - Cancela timer ativo e restaura rotação
│   ├── cargostaff.js       # /cargostaff - Adiciona/remove/lista cargos autorizados
│   ├── checkin.js          # /checkin [abrir|listar-ativos|encerrar] - Check-in manual/ativos
│   ├── consultarStatus.js  # /consultar-status [jogador] - Exibe ficha de status (Público)
│   ├── evento.js           # /evento [listar|pontos|cadastrar|remover] - Pontuações da guilda
│   ├── listarBosses.js     # /listar (ou /bosses) - Lista bosses agendados com countdown
│   ├── listarStatus.js     # /listar [acerto] [defesa] [desenvolvimento] - Filtro de membros (Público)
│   ├── ranking.js          # /ranking [semanal|mensal|geral] - Classificação de presença (Público)
│   ├── registrarStatus.js  # /registrar-status - Recebe print do jogo e aciona Gemini Vision (Público)
│   ├── rotacao.js          # /rotacao [painel|painelgelo|girar|tags] - Painéis e rodízio de drops
│   └── testar.js           # /testar - Disparo de embeds de teste para validação visual
├── database/
│   ├── db.js               # CRUD atômico (.tmp -> rename) para bosses e guild_members
│   ├── checkinDb.js        # CRUD atômico para check-ins ativos, histórico e apuração de rankings
│   └── eventsDb.js         # Catálogo configurável de pontuações de eventos e bosses
├── middleware/
│   └── auth.js             # Verificação de permissões (SuperAdmins, Staff, Admin, allowed_roles)
├── services/
│   ├── checkinService.js   # Ciclo de vida do check-in: 3 botões (presença, piloto, cancelar), timers e resumo
│   ├── scheduler.js        # node-cron: lembretes 22:40/55/00, minuta-a-minuto, rankings semanal (dom) e mensal (01)
│   └── visionService.js    # Fila com Rate Limit (5 req/min) e OCR multimodal via @google/generative-ai
└── utils/
    ├── audit.js            # Registro circular de até 500 logs de auditoria
    ├── bossList.js         # Lista estática de bosses (Interserver vs Gelo) e IDs fixos
    ├── embeds.js           # Formatadores visuais de Embeds do Discord (bosses, check-ins, rankings)
    ├── jokes.js            # Piadas e frases temáticas de MMORPG para as mensagens
    └── rotation.js         # Lógica da fila de tags, avanço/reversão e edição de painéis fixos
```

---

## 📊 Esquemas de Dados (`data/`) - Não leia os JSONs!

### 1. `data/bosses.json`
Array de objetos:
```json
[
  {
    "id": "boss_1727800000000",
    "bossId": "tandallon",
    "name": "Tandallon",
    "location": "TA 3",
    "category": "interserver",
    "spawnTimeISO": "2026-10-01T23:00:00.000-03:00",
    "channelId": "123456789012345678",
    "createdBy": "Nick#0000",
    "notified20m": false,
    "notified5m": false,
    "previousLastTag": "TAG A",
    "previousNextTag": "TAG B"
  }
]
```

### 2. `data/rotation.json`
Objeto único:
```json
{
  "tags": ["TAG A", "TAG B"],
  "geloTags": ["TAG A", "TAG B"],
  "panelChannelId": "123456789012345678",
  "panelMessageId": "123456789012345678",
  "geloPanelChannelId": "123456789012345678",
  "geloPanelMessageId": "123456789012345678",
  "bosses": {
    "tandallon": {
      "lastTag": "TAG A",
      "nextTag": "TAG B",
      "updatedAt": "01/10 22:30"
    }
  }
}
```

### 3. `data/guild_members.json`
Array de membros com status:
```json
[
  {
    "userId": "273600843251712020",
    "userTag": "usuario#0000",
    "charName": "NickDoJogo",
    "parsedStats": {
      "desenvolvimento": 355000,
      "classe": "Atirador Fantasma",
      "nivel": 62,
      "dano": 480,
      "defesa": 562,
      "acerto": 567,
      "acertoJvA": 500,
      "defesaJvA": 520,
      "acertoJvJ": 480,
      "defesaJvJ": 510,
      "pc": 355000
    },
    "imageUrls": ["https://..."],
    "observacao": "",
    "lastStatusUpdateISO": "2026-10-01T15:00:00.000Z"
  }
]
```

### 4. `data/allowed_roles.json` & `data/audit.json`
- `allowed_roles.json`: Array simples de strings com os IDs de cargos permitidos: `["role_id_1", "role_id_2"]`.
- `audit.json`: Array com até 500 objetos `{ id, timestamp, authorTag, authorId, action }`.

### 5. `data/events.json`
Objeto indexado por ID do evento com pontuação e duração:
```json
{
  "gatphillian": { "id": "gatphillian", "name": "Gatfilian", "points": 2, "type": "auto", "defaultDuration": 5 },
  "damiross": { "id": "damiross", "name": "Damiros", "points": 3, "type": "auto", "defaultDuration": 5 },
  "ta2_ta3": { "id": "ta2_ta3", "name": "TA 2 / TA 3", "points": 4, "type": "manual", "defaultDuration": 10 },
  "gvg": { "id": "gvg", "name": "GvG (Guild vs Guild)", "points": 5, "type": "manual", "defaultDuration": 10 }
}
```

### 6. `data/checkins.json`
Objeto com check-ins ativos e histórico permanente:
```json
{
  "activeCheckins": {
    "chk_1727800000": {
      "id": "chk_1727800000",
      "eventId": "damiross",
      "eventName": "Damiros",
      "points": 3,
      "durationMinutes": 5,
      "createdBy": "[RG] Knower",
      "channelId": "1234567890",
      "messageId": "9876543210",
      "status": "open",
      "openedAtISO": "2026-10-01T18:41:00.000-03:00",
      "expiresAtISO": "2026-10-01T18:46:00.000-03:00",
      "attendees": [
        { "userId": "12345", "userTag": "nick#0000", "displayName": "[RG] twice999", "isPilot": false }
      ]
    }
  },
  "history": [
    {
      "id": "chk_1727800000",
      "eventName": "Damiros",
      "closedAtISO": "2026-10-01T18:46:00.000-03:00",
      "pointsPerAttendee": 3,
      "attendees": [...]
    }
  ]
}
```

---

## 🛠️ Convenções e Diretrizes Técnicas

1. **Módulo ECMAScript (`type: "module"`)**: Utilize sempre `import` e `export`. Nunca utilize `require()`.
2. **Datas e Fusos**: Fuso horário padrão obrigatório é `America/Sao_Paulo` via Luxon (`DateTime.now().setZone('America/Sao_Paulo')`).
3. **Discord.js v14**:
   - Interações demoradas (como análise de imagem por IA) **devem** chamar `await interaction.deferReply({ ephemeral: true })`.
   - Mensagens de erro ou uso exclusivo devem usar `ephemeral: true`.
   - Comandos públicos (`/registrar-status`, `/consultar-status`, `/listar`) não exigem cargo Staff.
4. **Persistência Atômica**: Ao gravar dados, utilize sempre escrita em arquivo `.tmp` seguida de `fs.renameSync` para evitar corrupção em caso de encerramento abrupto.
5. **Google Gemini Vision**:
   - Respeite a fila com rate limit de 5 requisições por minuto (`enqueueAnalysis`).
   - Modelos de fallback ordenados: `gemini-3.6-flash` -> `gemini-3.0-flash` -> `gemini-2.5-flash` -> `gemini-1.5-flash`.
   - A saída deve ser JSON estrito sem markdown.

---

## 🚀 Comandos de Terminal Rápidos

- Deploy de comandos Slash: `npm run deploy-commands`
- Execução com recarregamento automático (Node 18+): `npm run dev`
- Execução padrão: `npm start`
- Testes manuais no Discord: Utilize `/testar` para simular notificações sem esperar os horários do cron.
