# 🤖 BOT Ally - Rastreamento e Notificação de Bosses

Bot do Discord para gerenciar avisos de Bosses fixos e agendamento de outros bosses para a guild Ally.

## 📌 Funcionalidades

### 1. BOSS TA 2 / TA 3 / TA 4 (Aviso Fixo Único às 23:00)
- **Horário do Spawn**: 23:00 diariamente.
- **Bosses incluídos**:
  - **TA 2**: Ducas
  - **TA 3**: Dergio
  - **TA 4**: Turga / Gillaot / Frezam
- **Horários dos Alertas**:
  - **22:40** (20 minutos antes): Envia 1 aviso único enfeitado com Embed listando todos os Bosses fixos.
  - **23:00** (Hora do Spawn): Envia 1 aviso único notificando que os Bosses nasceram.

---

### 2. Outros Bosses (`/boss`)
Comando interativo `/boss` com menu dropdown para selecionar entre os 13 Bosses:
1. **Tandallon** (TA 3)
2. **Balthazard** (TA 4)
3. **Dardaloca** (Caverna de Gelo 3 Sudoeste)
4. **Hakir** (Grotesca 1 Norte)
5. **Hotura** (Caverna de Gelo 1 Centro)
6. **Kafka** (Grotesca 2 Leste)
7. **Damiross** (Grotesca 2 Oeste)
8. **Panderre** (Grotesca 3 Norte)
9. **Stormid** (Grotesca 1 Sul)
10. **Melville** (Grotesca 3 Sul)
11. **Gatphillian** (Gelo 2 Norte)
12. **Tigdal** (Gelo 2 Sul)
13. **Cavaleiro** (TA 2)

Após a seleção no menu, digita-se o tempo que falta no formato `HH:MM` (ex: `02:30` ou `00:45`).

---

### 3. Comandos & Funcionalidades da v2.4.0
- `/checkin [abrir|listar-ativos|detalhes|remover-presenca|encerrar]`: Sistema completo de presença com botões interativos, suporte a piloto (seletor de membros do Discord) e auditoria de remoção.
- `/ranking [semanal|mensal|geral]`: Classificação de presença da guilda com apuração semanal (Domingo 00:01) e mensal (dia 01 às 00:01).
- `/evento [listar|editar|pontos|cadastrar|remover]`: Catálogo oficial de bosses/eventos com configuração de pontuação (1 a 5 pts) e duração de timers.
- `/bosses` ou `/listar`: Lista todos os bosses agendados com contagem regressiva dinâmica e TAG da vez.
- `/cancelarboss`: Cancela um timer ativo e reverte a rotação.
- `/rotacao [painel|painelgelo|girar|tags]`: Gerencia os painéis fixos e o rodízio de drops da união (Grotesca/Interserver e Gelo).
- `/registrar-status`: Registra os status do jogador via print e leitura por IA multimodal (Gemini Vision).
- `/consultar-status`: Consulta a ficha de status de qualquer membro da guilda.
- `/listar [acerto] [defesa] [desenvolvimento]`: Filtra membros cadastrados por atributos mínimos.
- `/auditoria [pagina]`: Visualiza o histórico de até 500 ações da Staff com paginação interativa.
- `/cargostaff [adicionar|remover|listar]`: Gerencia cargos autorizados dinamicamente.
- `/testar`: Testa os modelos de Embeds de avisos no canal.

### 🌟 Destaques da v2.4.0
- **Check-in de Piloto**: Permite que quem pilota confirme a presença do dono da conta pelo Discord — ambos recebem pontuação integral com trava anti-duplicação.
- **Horário Corujão (Boost Time)**: Bosses nascidos entre 00:00 e 07:00 concedem automaticamente +2 pontos de bônus com visual roxo.
- **TA 2 e TA 3 Escalonados**: Sequência de abertura independente às 23:00 (TA 2 em 1m, TA 3 em 3m, e TA 4 preparado).
- **GvG e Global Recorrentes**: Avisos prévios (20m, 5m, início) automáticos para GvG (Quarta e Sábado às 21h) e Masmorra Global (Quinta e Domingo às 22h).

---

## 📚 Documentação Técnica & Otimização de IA
Para desenvolvedores e assistentes de IA (evitando consumo excessivo de tokens):
- 📘 [AGENTS.md](AGENTS.md) - Regras estritas de economia de contexto, mapa de arquivos e esquemas de dados.
- 📐 [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura completa, fluxos do cron, máquina de estados da rotação e pipeline da IA.
- ⚡ [TOKEN_OPTIMIZATION.md](TOKEN_OPTIMIZATION.md) - Guia contra ralos de tokens e comandos de terminal leves.
- 🤖 [GEMINI.md](GEMINI.md) - Diretrizes automáticas de workspace para o Antigravity / Gemini CLI.

---

## ⚙️ Configuração (.env)

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id_aqui
GUILD_ID=id_do_servidor_opcional
ANNOUNCEMENT_CHANNEL_ID=id_do_canal_de_avisos
BOSS_ROLE_ID=id_do_cargo_opcional
```

## 🚀 Como Executar

### Localmente:
```bash
npm install
npm run deploy-commands
npm start
```

### Com Docker:
```bash
docker-compose up -d --build
```
