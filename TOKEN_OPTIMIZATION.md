# Guia de Economia e Otimização de Tokens - BOT Ally

Este manual detalha como desenvolvedores e assistentes de IA devem operar no repositório **BOT Ally** para obter máxima eficiência e evitar desperdício de tokens na janela de contexto de LLMs.

---

## 🛑 Os 5 Principais Ralos de Tokens no BOT Ally

| Ralo de Tokens | Impacto Estimado | Causa | Solução Recomendada |
| :--- | :---: | :--- | :--- |
| **Leitura de `data/*.json`** | 2.000 a 15.000 tokens | Pedir para a IA ler `audit.json` ou `bosses.json` inteiros. | Consultar os esquemas em `AGENTS.md` ou usar comandos PowerShell fatiados (`Select-Object -First 5`). |
| **Inspeção de `package-lock.json`** | ~4.000 tokens | Assistente lê o lockfile para descobrir versões instaladas. | Ler unicamente `package.json` (`dependencies` tem apenas 29 linhas). |
| **Exploração cega de diretórios** | 3.000 a 8.000 tokens | Assistente roda múltiplos `ls` ou `find` recursivos procurando arquivos. | Usar o mapa de arquivos em `AGENTS.md` e abrir diretamente o arquivo desejado. |
| **Varredura de `node_modules/`** | 20.000+ tokens | Indexadores ou prompts amplos vasculhando bibliotecas externas. | Adicionar regras no `.geminiignore` e proibir no prompt do agente. |
| **Dump de imagens em Base64 no prompt** | 5.000 a 20.000 tokens | Imprimir buffers de imagem no terminal ou na conversa com a IA. | Processar via Discord URL e manter Base64 isolado no `visionService.js`. |

---

## ⚡ Como Inspecionar Dados no Terminal sem Gastar Tokens da IA

Se você ou a IA precisarem verificar o estado atual dos dados em tempo de execução, **não carregue o arquivo JSON inteiro no contexto**. Use estes comandos PowerShell enxutos:

### 1. Inspecionar os últimos logs de auditoria (apenas os 3 mais recentes):
```powershell
Get-Content data/audit.json | ConvertFrom-Json | Select-Object -First 3
```

### 2. Verificar bosses agendados ativos:
```powershell
Get-Content data/bosses.json | ConvertFrom-Json | Select-Object id, name, location, spawnTimeISO
```

### 3. Verificar o status atual das tags de rotação:
```powershell
(Get-Content data/rotation.json | ConvertFrom-Json).tags
(Get-Content data/rotation.json | ConvertFrom-Json).geloTags
```

### 4. Verificar um membro específico em `guild_members.json`:
```powershell
Get-Content data/guild_members.json | ConvertFrom-Json | Where-Object { $_.charName -like "*Nome*" }
```

---

## 🧠 Boas Práticas para Prompts com a IA

1. **Seja Direto no Alvo**:
   - Em vez de: *"Quero que você veja como os bosses funcionam e faça uma alteração."*
   - Prefira: *"Modifique a mensagem de aviso prévio de 5 minutos em `src/utils/embeds.js` para adicionar um emoji de fogo no título."*
2. **Não peça re-explicações do projeto**:
   - Toda a estrutura já está condensada em `AGENTS.md`, `GEMINI.md` e `ARCHITECTURE.md`. A IA já recebe essas informações com custo mínimo de tokens.
3. **Edições Contíguas e Precisas**:
   - Instrua a IA a usar ferramentas de substituição pontual (`replace_file_content`) em vez de reescrever arquivos completos de 300 linhas quando for alterar poucas linhas.

---

## 🌐 Otimização da API Gemini Vision (`src/services/visionService.js`)

Para manter o bot dentro da cota gratuita e econômica do Google AI Studio:
- **Rate Limit Local**: O bot implementa fila estrita de no máximo **5 requisições por minuto** (`MAX_REQUESTS_PER_MINUTE = 5`).
- **Prompt Enxuto**: O prompt de sistema de OCR em `visionService.js` já foi otimizado para menos de 180 tokens de instrução com retorno JSON estrito.
- **Modelos Flash**: Utiliza prioritariamente a família **Flash** (`gemini-3.6-flash` / `gemini-3.0-flash` / `gemini-2.5-flash` / `gemini-1.5-flash`), que possuem o menor custo de tokens por milhão e altíssima velocidade para OCR multimodal.
