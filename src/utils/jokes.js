/**
 * Coleção completa de frases e piadas leves inspiradas nas classes e mecânicas do Night Crows Global
 */
export const NIGHT_CROWS_JOKES = [
  "🛡️ One-Handed Sword (Knight/Lord Knight): Segurando o agro do boss e o dano de 3 guilds rivais no escudo.",
  "⚔️ Two-Handed Sword (Commander/Grand General): Entrou girando na call de PVP e soltou o stun em 10 ao mesmo tempo.",
  "🗡️ Dual Daggers (Assassin/Shadow Master): No stealth há 15 minutos esperando só o boss ficar no vermelho pro killsteal.",
  "🏹 Bow (Ranger/Grand Sniper): Snipando a 50 metros de distância e fingindo que não ouviu o Cleric pedindo resgate.",
  "🧙‍♂️ Staff (Elementalist/Grand Elementalist): Usou tempestade de fogo, queimou a mana toda em 2 segundos e ficou batendo de cajado.",
  "🪄 Wand/Cane (Priest/Saint/High Saint): Curando o tank na fé, na oração e na água benta porque as poções de mana acabaram.",
  "🔱 Spear (Impaler/High Executioner): Puxou o tank inimigo pra dentro do grupo da Ally e comemorou a execução.",
  "🗡️ Rapier (Duelist/Enchanted Blade): Dando estocada rápida de esgrima e se esquivando de todas as skille de área.",
  "🪓 Great Axe (Berserker/Destroyer): Ativou o modo fúria, quebrou a armadura do boss e levou metade da raid junto.",
  "🪂 Gliders: Vendo a guild rival tentando fugir voando de Glider e caindo de paraquedas em cima deles.",
  "💎 Craft & Morion: Rezando 3 Ave Marias pro craft do equipamento lendário não falhar e vir com atributos perfeitos.",
  "🏰 TA & Grotesca: A amizade entre as guilds é linda, mas o rodízio do drop da união é lei absoluta!",
  "🦅 Night Crows Global: Voe alto, acerte o combo e garanta o loot da aliança!"
];

/**
 * Retorna uma piada/frase leve aleatória do Night Crows
 */
export function getRandomJoke() {
  const index = Math.floor(Math.random() * NIGHT_CROWS_JOKES.length);
  return NIGHT_CROWS_JOKES[index];
}
