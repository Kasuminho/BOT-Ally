/**
 * Coleção de frases e piadas leves inspiradas nas classes e mecânicas do Night Crows (NC Global)
 */
export const NIGHT_CROWS_JOKES = [
  "⚔️ One-Handed Sword: Tankando o boss e a guild inimiga inteira enquanto o grupo pega o loot.",
  "🗡️ Twin Daggers: No stealth há 10 minutos só esperando o boss ficar com 1% de HP pra dar o hit final.",
  "🏹 Bow: Atirando de longe e fingindo que não ouviu o Cleric pedindo ajuda na call.",
  "🧙‍♂️ Staff: Queimou a barra de mana inteira em 3 segundos e agora tá usando ataque básico.",
  "🪄 Cane (Cleric): Curando a party na fé e na coragem porque o estoque de poção de mana acabou.",
  "🔱 Spear: Puxando o mob pro meio da call da Ally pra ver o caos acontecer.",
  "⚔️ Two-Handed Sword: Entrou rodando no meio do PVP e esqueceu que tava sem buff.",
  "🪂 Gliders: Se o boss tentar fugir de Glider, a Ally vai atrás voando junto!",
  "💎 Craft & Morion: Rezando pro craft vir com sucesso e não quebrar na hora H.",
  "🏰 TA & Grotesca: Onde a amizade é forte, mas o drop da aliança é sagrado!"
];

/**
 * Retorna uma piada/frase leve aleatória do Night Crows
 */
export function getRandomJoke() {
  const index = Math.floor(Math.random() * NIGHT_CROWS_JOKES.length);
  return NIGHT_CROWS_JOKES[index];
}
