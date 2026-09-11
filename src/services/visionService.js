import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

// Fila de processamento com Rate Limit (máximo 5 requisições por minuto)
const queue = [];
let isProcessing = false;
const executionTimestamps = [];
const MAX_REQUESTS_PER_MINUTE = 5;
const ONE_MINUTE_MS = 60 * 1000;

/**
 * Adiciona uma análise de imagem à fila com Rate Limit (5 requisições/min).
 * @param {string} imageUrl URL da imagem no Discord
 * @returns {Promise<Object>} Promessa resolvida com os dados estruturados lidos pela IA
 */
export function enqueueAnalysis(imageUrl) {
  return new Promise((resolve, reject) => {
    queue.push({ imageUrl, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  const now = Date.now();
  // Limpa timestamps mais antigos que 60 segundos
  while (executionTimestamps.length > 0 && executionTimestamps[0] <= now - ONE_MINUTE_MS) {
    executionTimestamps.shift();
  }

  // Se já atingimos 5 chamadas no último minuto, aguarda até abrir vaga
  if (executionTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = ONE_MINUTE_MS - (now - executionTimestamps[0]) + 100;
    console.log(`⏳ [VISION RATE LIMIT] Limite de 5 req/min atingido. Próxima vaga em ${Math.ceil(waitTime / 1000)}s...`);
    setTimeout(processQueue, waitTime);
    return;
  }

  isProcessing = true;
  const currentTask = queue.shift();
  executionTimestamps.push(Date.now());

  try {
    const result = await analyzeScreenshotsWithGemini([currentTask.imageUrl]);
    currentTask.resolve(result);
  } catch (err) {
    currentTask.reject(err);
  } finally {
    isProcessing = false;
    setImmediate(processQueue);
  }
}

/**
 * Envia uma imagem para a API do Gemini e extrai os status do jogo em JSON.
 * @param {Array<string>} imageUrls Array com a URL da imagem
 * @returns {Promise<Object>} JSON estruturado com os status lidos
 */
export async function analyzeScreenshotsWithGemini(imageUrls) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY não configurada no arquivo .env.');
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);

  const imageParts = [];
  for (const url of imageUrls) {
    if (!url) continue;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/png';

      imageParts.push({
        inlineData: {
          data: base64,
          mimeType
        }
      });
    } catch (fetchErr) {
      console.error(`Erro ao carregar a imagem da URL (${url}):`, fetchErr);
    }
  }

  if (imageParts.length === 0) {
    throw new Error('Nenhuma imagem válida pôde ser baixada do Discord.');
  }

  const prompt = `Você é um leitor óptico especialista em prints de jogos MMORPG (Night Crows / Raven 2).
Analise a imagem fornecida e extraia com exatidão os seguintes atributos do personagem:
1. "desenvolvimento": Valor numérico da linha "Desenvolvimento" ou "PC" (ex: 355.361 ou 355361 -> retorne número puro ex: 355361).
2. "classe": Nome da classe exibido (ex: "Atirador Fantasma" ou "Guerreiro").
3. "nivel": Nível numérico do personagem (ex: 62).
4. "dano": Dano numérico exibido ao lado do ícone de espadas no HUD (ex: 480).
5. "defesa": Defesa numérica exibida ao lado do ícone de escudo no HUD (ex: 562).
6. "acerto": Acerto numérico exibido ao lado do ícone de alvo/mira no HUD (ex: 567).
7. "acertoJvA": Valor numérico da linha "Acerto em JvA" (se visível).
8. "defesaJvA": Valor numérico da linha "Defesa em JvA" (se visível).
9. "acertoJvJ": Valor numérico da linha "Acerto em JvJ" (se visível).
10. "defesaJvJ": Valor numérico da linha "Defesa em JvJ" (se visível).

Retorne APENAS um objeto JSON válido no formato estrito abaixo, sem marcações markdown de código e sem texto adicional:
{
  "desenvolvimento": 0,
  "classe": "string",
  "nivel": 0,
  "dano": 0,
  "defesa": 0,
  "acerto": 0,
  "acertoJvA": 0,
  "defesaJvA": 0,
  "acertoJvJ": 0,
  "defesaJvJ": 0
}
Se algum dado não estiver visível na imagem, coloque null naquele campo específico.`;

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest'
  ];
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, ...imageParts]);
      const responseText = result.response.text();
      const jsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(jsonString);

      let desVal = null;
      if (parsed.desenvolvimento) {
        const desStr = String(parsed.desenvolvimento).replace(/\./g, '').replace(/\,/g, '').trim();
        desVal = parseInt(desStr, 10) || null;
      }

      return {
        desenvolvimento: desVal,
        classe: parsed.classe ? String(parsed.classe).trim() : null,
        nivel: parsed.nivel ? parseInt(parsed.nivel, 10) : null,
        dano: parsed.dano ? parseInt(parsed.dano, 10) : null,
        defesa: parsed.defesa ? parseInt(parsed.defesa, 10) : null,
        acerto: parsed.acerto ? parseInt(parsed.acerto, 10) : null,
        acertoJvA: parsed.acertoJvA ? parseInt(parsed.acertoJvA, 10) : null,
        defesaJvA: parsed.defesaJvA ? parseInt(parsed.defesaJvA, 10) : null,
        acertoJvJ: parsed.acertoJvJ ? parseInt(parsed.acertoJvJ, 10) : null,
        defesaJvJ: parsed.defesaJvJ ? parseInt(parsed.defesaJvJ, 10) : null
      };
    } catch (err) {
      console.warn(`[VISION] Tentativa com modelo ${modelName} falhou (${err.message}). Tentando próximo modelo...`);
      lastError = err;
    }
  }

  throw new Error(`Falha ao ler print com a API do Gemini: ${lastError?.message || 'Erro desconhecido'}`);
}
