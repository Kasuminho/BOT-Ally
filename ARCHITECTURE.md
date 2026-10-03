# Arquitetura Técnica do Sistema - BOT Ally (v2.3.1)

Documento técnico de referência completo para desenvolvedores e agentes de IA. Consulte este documento para entender a estrutura, fluxos e regras de negócio sem necessidade de abrir e ler múltiplos arquivos do código-fonte.

---

## 1. Visão Geral e Stack Tecnológica

O **BOT Ally** é um bot de Discord voltado para a guilda Ally (jogos MMORPG como Night Crows / Raven 2). Suas três funções essenciais são:
1. **Rastreamento e Notificação de Bosses** (Alertas fixos diários e agendamento dinâmico via timers com contagem regressiva).
2. **Sistema de Rotação de Drops** (Gerenciamento de rodízio de TAGs/União, separação entre Interserver e Masmorra de Gelo, e painéis com mensagens dinâmicas fixas no Discord).
3. **Leitura Óptica e Ficha de Membros via IA (Gemini Vision)** (Extração automática de PC, Dano, Defesa, Acerto e atributos a partir de screenshots enviadas pelos membros, com busca e filtros).

### Stack:
- **Runtime**: Node.js 18+ com suporte a ECMAScript Modules (`"type": "module"`).
- **Discord API**: `discord.js` v14.18.0 (Gateway Intents: `Guilds`, `GuildMessages`, `GuildMembers`, `MessageContent`).
- **Agendador**: `node-cron` v3.0.3.
- **Data/Hora & Fuso**: `luxon` v3.5.0 configurado exclusivamente para `America/Sao_Paulo` (GMT-3).
- **Inteligência Artificial (OCR)**: `@google/generative-ai` v0.24.1 (Google Gemini Flash Multimodal).
- **Persistência**: Base de dados local em arquivos JSON com escrita atômica (`fs.writeFileSync(.tmp)` + `fs.renameSync`).

---

## 2. Ciclo de Vida da Aplicação (`src/index.js`)

1. **Validação de Configuração** (`src/config.js`):
   - Valida variáveis obrigatórias (`DISCORD_TOKEN`, `CLIENT_ID`). Se ausentes, encerra o processo (`process.exit(1)`).
2. **Carregamento de Comandos**:
   - Cria a coleção de comandos com os 13 módulos (`bossCmd`, `listarCmd`, `cancelarCmd`, `testarCmd`, `cargostaffCmd`, `auditoriaCmd`, `rotacaoCmd`, `registrarStatusCmd`, `consultarStatusCmd`, `listarStatusCmd`, `checkinCmd`, `eventoCmd`, `rankingCmd`).
3. **Evento `ready`**:
   - Conecta ao Discord.
   - Executa `registerCommands()` (`src/deploy-commands.js`) via REST API do Discord para registrar os Slash Commands (Global ou Guild).
   - Define a presença (`status: 'online'`, custom activity: `Gerenciando Bosses & Rotações Ally ⚔️`).
   - Inicializa ou atualiza os painéis fixos de rotação (`updateRotationPanel` e `updateGeloRotationPanel`).
   - Inicializa os cron jobs (`initScheduler(client)`).
4. **Tratamento Centralizado de Interações (`client.on('interactionCreate')`)**:
   - **Controle de Acesso**: Verifica se o comando é público (`PUBLIC_COMMANDS = ['registrar-status', 'consultar-status', 'listar', 'ranking']`), ou botões de checkin e modais de piloto. Caso não seja, valida permissões via `isAuthorized(interaction)` em `src/middleware/auth.js`.
   - **Roteamento de Tipos de Interação**:
     - `isChatInputCommand()`: Executa `command.execute(interaction)`.
     - `isButton()`: `audit_page_*` (paginação de auditoria), `checkin_confirm_*` (confirmar presença), `checkin_pilot_*` (abrir modal piloto), `checkin_cancel_*` (cancelar presença).
     - `isStringSelectMenu()`: `select_boss` (inicia modal do timer) ou `cancel_boss_select` (cancela boss).
     - `isModalSubmit()`: `modal_timer_*` (agenda boss) ou `modal_pilot_*` (registra presença para a conta pilotada).
     - `isAutocomplete()`: preenche catálogo dinâmico de eventos para `/checkin abrir evento:`.

---

## 3. Mecanismo de Alertas e Bosses (`src/services/scheduler.js`)

O sistema divide os bosses em duas categorias com lógicas distintas:

### 3.1. Bosses Fixos Diários (TA 2 / TA 3 / TA 4)
- **Horário de Nascimento**: Todos os dias exatamente às 23:00 (Fuso SP).
- **Bosses Abrangidos**:
  - TA 2: Ducas
  - TA 3: Dergio
  - TA 4: Turga / Gillaot / Frezam
- **Cron Jobs**:
  - `40 22 * * *`: Envia Embed único de aviso prévio de 20 minutos (`REMINDER_20M`) mencionando `@everyone`.
  - `55 22 * * *`: Envia Embed único de aviso crítico de 5 minutos (`REMINDER_5M`) mencionando `@everyone`.
  - `0 23 * * *`: Envia Embed de nascimento (`SPAWN`) anunciando o nascimento simultâneo dos bosses fixos.
- **Canal de Envio**: `ANNOUNCEMENT_CHANNEL_ID`.

### 3.2. Outros Bosses / Bosses Customizados (`/boss`)
- **Lista de Bosses (13 no total)**:
  - **Interserver**: Tandallon (TA 3), Balthazard (TA 4), Cavaleiro (TA 2), Hakir (Grotesca 1 N), Kafka (Grotesca 2 L), Damiross (Grotesca 2 O), Panderre (Grotesca 3 N), Stormid (Grotesca 1 S), Melville (Grotesca 3 S).
    - Menção: `@everyone`. Canal padrão: `ANNOUNCEMENT_CHANNEL_ID`.
  - **Servidor - Masmorra de Gelo**: Dardaloca (Gelo 3 SO), Hotura (Gelo 1 C), Gatphillian (Gelo 2 N), Tigdal (Gelo 2 S).
    - Menção: Cargo fixo `<@&1526217487274741947>` (`MEMBROS_ROLE_ID`).
    - Canal: `GELO_ANNOUNCEMENT_CHANNEL_ID` (com fallback para `ANNOUNCEMENT_CHANNEL_ID`).
- **Ciclo do Agendador (Minuto a Minuto - `* * * * *`)**:
  1. Lê os bosses em `data/bosses.json`.
  2. Calcula a diferença em minutos até `spawnTimeISO`:
     - Entre 19 e 20 minutos (se `notified20m` for falso): Dispara Embed de 20m, marca flag como verdadeira.
     - Entre 4 e 5 minutos (se `notified5m` for falso): Dispara Embed de 5m, marca flag como verdadeira.
     - Diferença <= 0: Dispara Embed de Spawn, avança a rotação (caso não tenha sido girada na criação) e remove o boss da lista de agendamentos.

---

## 4. Sistema de Rotação de Drops (`src/utils/rotation.js`)

Permite alternar de forma justa quem fica com os drops de cada boss entre diferentes TAGs da guilda/união.

### 4.1. Estrutura de Filas e Painéis Duplos
Existem duas listas de tags independentes:
1. `tags`: Fila geral (Interserver: TA e Grotesca).
2. `geloTags`: Fila da Masmorra de Gelo.

### 4.2. Painéis Fixos em Canais do Discord
- O bot cria uma mensagem com Embed estilizado e armazena os IDs:
  - `panelChannelId` / `panelMessageId` (Painel Interserver).
  - `geloPanelChannelId` / `geloPanelMessageId` (Painel de Gelo).
- Toda vez que uma rotação avança ou é revertida, o bot faz fetch da mensagem existente no canal e atualiza o conteúdo (`msg.edit({ embeds: [embed] })`), garantindo que o painel no Discord esteja sempre atualizado sem enviar mensagens duplicadas no canal.

### 4.3. Operações de Rotação
- **Girar Turno (`rotateBossTurn`)**:
  - Pega o `currentNext` daquele boss.
  - O `lastTag` passa a ser a tag que atuou.
  - O `nextTag` passa para a próxima tag na sequência circular da lista.
  - Registra a ação na auditoria (`addAuditEntry`).
  - Atualiza o painel fixo correspondente no Discord.
- **Reversão (`revertBossTurn`)**:
  - Acionado se um agendamento for cancelado via `/cancelarboss`.
  - Restaura `lastTag` e `nextTag` para seus valores anteriores salvos no boss agendado (`previousLastTag`, `previousNextTag`).

---

## 5. Pipeline de Leitura Óptica via IA (`src/services/visionService.js`)

Permite que os jogadores cadastrem ou atualizem seus status apenas tirando um print da tela do jogo no Discord.

```
[Membro envia /registrar-status com print]
                   │
                   ▼
       [enqueueAnalysis(imageUrl)]
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
 [Fila de Espera]    [Rate Limiter: máx 5 req/min]
       │
       ▼
 [Baixa Imagem do Discord -> Converte em Base64 Buffer]
       │
       ▼
 [GoogleGenerativeAI (Fallback em cascata)]
    ├─ Tentativa 1: gemini-3.6-flash
    ├─ Tentativa 2: gemini-3.0-flash
    ├─ Tentativa 3: gemini-2.5-flash
    └─ Tentativa 4: gemini-1.5-flash
       │
       ▼
 [Retorno JSON Estrito com desenvolvimento, classe, nivel, dano, defesa, acerto, etc.]
       │
       ▼
 [Persistência em data/guild_members.json & Resposta Ephemeral ao Jogador]
```

- **Cálculo do PC (Poder de Combate)**:
  `pc = parsedStats.desenvolvimento || (dano + defesa + acerto)`.

---

## 6. Camada de Segurança e Autenticação (`src/middleware/auth.js`)

Apenas membros autorizados podem executar comandos restritos (agendamentos de boss, manipulação de rotação, cargos staff, auditoria).

A função `isAuthorized(interaction)` avalia a permissão em cascata:
1. **SuperAdmins**: IDs estáticos `273600843251712020` e `672236180934492205`. Têm acesso total e irrestrito.
2. **Permissões do Discord no Servidor**: Membro com `PermissionFlagsBits.Administrator` ou `PermissionFlagsBits.ManageGuild`.
3. **Nome de Cargo**: Qualquer cargo do membro que contenha o texto `"staff"` (case-insensitive).
4. **Cargos Cadastrados**: Qualquer cargo cujo ID esteja listado em `data/allowed_roles.json` (gerenciado dinamicamente via comando `/cargostaff`).

---

## 7. Variáveis de Ambiente (`.env`)

| Variável | Obrigatória | Padrão | Descrição |
| :--- | :---: | :---: | :--- |
| `DISCORD_TOKEN` | Sim | - | Token da aplicação do Discord Bot |
| `CLIENT_ID` | Sim | - | ID da aplicação do Discord |
| `GUILD_ID` | Não | `null` | ID do servidor para registrar comandos Slash instantaneamente |
| `ANNOUNCEMENT_CHANNEL_ID` | Não | `null` | Canal padrão para avisos de bosses Interserver e diários |
| `GELO_ANNOUNCEMENT_CHANNEL_ID` | Não | `null` | Canal exclusivo para avisos dos bosses de Gelo |
| `BOSS_ROLE_ID` | Não | `null` | Cargo opcional para menções adicionais |
| `GEMINI_API_KEY` | Sim (para status) | `null` | Chave de API do Google AI Studio para o Gemini Vision |
| `CHECKIN_CHANNEL_ID` | Não | `null` | Canal onde abrem os check-ins da guilda (fallback: `GELO_ANNOUNCEMENT_CHANNEL_ID`) |
| `RANKING_CHANNEL_ID` | Não | `null` | Canal onde são postados os rankings semanais e mensais |

---

## 8. Sistema de Check-in de Bosses, Eventos e Rankings

### 8.1. Abertura e Temporização
- **Automática**: Disparada 3 minutos após qualquer aviso de `SPAWN` (Fixos TA2/TA3 ou agendados).
- **Manual**: Via comando `/checkin abrir [evento] [duracao]` (Staff).

### 8.2. Interatividade (3 Botões)
1. `[ ✅ Confirmar Presença ]`: Adiciona o membro à lista de confirmados e computa os pontos do evento.
2. `[ 🎮 Check-in Piloto ]`: Abre modal para informar o nick da conta pilotada, creditando a pontuação a quem não pôde logar.
3. `[ 🔄 Cancelar Meu Check-in ]`: Permite remover o clique acidental antes do encerramento.

### 8.3. Encerramento e Resumo
- Ao expirar o tempo (ex: 5 min), os botões são desativados.
- Emite o embed de **Resumo Oficial** contendo a lista de confirmados, o total de participantes, a pontuação do boss e a pontuação total gerada.
- Arquiva o registro no histórico (`data/checkins.json`).

### 8.4. Rankings Periódicos (Cron)
- **Semanal**: Domingo às 00:01 (`1 0 * * 0`).
- **Mensal**: Dia 01 às 00:01 (`1 0 1 * *`).
- **Comando Público**: `/ranking [semanal|mensal|geral]` para consulta instantânea por qualquer jogador.
