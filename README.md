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

### 3. Outros Comandos
- `/bosses`: Lista todos os bosses agendados com tempo restante dinâmico do Discord.
- `/cancelarboss`: Permite selecionar um boss e cancelar o timer.

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
