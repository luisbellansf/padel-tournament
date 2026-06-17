// Team-Bildung für Padel (2 Spieler pro Team)
// Skill-Stufen als numerische Gewichte – höher = stärker.
const SKILL_WEIGHT = {
  ASSOCIATE: 1,
  CONSULTANT: 2,
  EXPERT: 3,
};

function weightOf(player) {
  return SKILL_WEIGHT[player.skillLevel] ?? 1;
}

// Fisher-Yates Shuffle (für die Zufallskomponente)
function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Bildet ausgewogene 2er-Teams.
 *
 * - `manualTeams`: bereits manuell gewählte Paare [{ playerIds: [a, b] }]
 *   Diese bleiben unangetastet.
 * - Übrige Spieler werden ausgewogen gepaart: starker Spieler mit schwachem,
 *   sodass die Gesamtstärke aller Teams möglichst gleich ist. Innerhalb
 *   gleicher Skill-Stufe wird zufällig gemischt -> "zufällig zusammengewürfelt",
 *   aber fair.
 *
 * @returns {{ teams: Array, leftover: Array }}
 */
function buildBalancedTeams(players, manualTeams = [], rng = Math.random) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const usedIds = new Set();
  const teams = [];

  // 1) Manuelle Teams übernehmen
  for (const mt of manualTeams) {
    const members = mt.playerIds.map((id) => byId.get(id)).filter(Boolean);
    if (members.length !== 2) continue;
    members.forEach((m) => usedIds.add(m.id));
    teams.push({
      manual: true,
      players: members,
      totalSkill: members.reduce((s, m) => s + weightOf(m), 0),
    });
  }

  // 2) Übrige Spieler ausgewogen paaren
  const pool = players.filter((p) => !usedIds.has(p.id));
  // Zufällig mischen, dann stabil nach Gewicht sortieren -> Zufall bei Gleichstand
  const shuffled = shuffle(pool, rng);
  shuffled.sort((a, b) => weightOf(b) - weightOf(a)); // stark -> schwach

  let lo = 0;
  let hi = shuffled.length - 1;
  while (lo < hi) {
    const strong = shuffled[lo];
    const weak = shuffled[hi];
    teams.push({
      manual: false,
      players: [strong, weak],
      totalSkill: weightOf(strong) + weightOf(weak),
    });
    lo++;
    hi--;
  }

  // 3) Ungerader Rest -> kein Partner gefunden
  const leftover = lo === hi ? [shuffled[lo]] : [];

  return { teams, leftover };
}

module.exports = { buildBalancedTeams, weightOf, SKILL_WEIGHT };
