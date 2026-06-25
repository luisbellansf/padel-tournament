/**
 * Americano tournament scheduler.
 *
 * Rules:
 *  - Always 2v2 doubles
 *  - Every round new partners AND new opponents (social rotation)
 *  - Individual point scoring per player (not per team)
 *  - Each match is played to 11 points (Ballwechsel = 1 Punkt)
 *  - Odd player counts are handled by fair bye rotation
 *
 * The pairing algorithm uses the Berger circle construction which,
 * for k players (k even), produces k-1 rounds where every player
 * partners with every other player exactly once.
 * For k not divisible by 4 some players sit out per round; byes are
 * distributed as evenly as possible.
 */

/**
 * Generate Americano rounds.
 *
 * @param {number[]} playerIds  - Array of player IDs (min 4)
 * @param {number}   numRounds  - How many rounds to generate
 * @param {number|null} numCourts - Court limit per round (null = unlimited)
 * @returns {{ round, matches: [{teamA, teamB}], sittingOut }[]}
 */
function generateAmericano(playerIds, numRounds, numCourts) {
  const n = playerIds.length;
  if (n < 4) throw new Error('Americano benötigt mindestens 4 Spieler.');

  // Active players: limited by player count AND available courts
  const maxByPlayers = Math.floor(n / 4) * 4;
  const maxByCourts  = numCourts ? numCourts * 4 : maxByPlayers;
  const activeCount  = Math.min(maxByPlayers, maxByCourts);
  const byesPerRound = n - activeCount;        // ≥ 0

  const byeCounts = new Array(n).fill(0);
  const rounds    = [];

  for (let r = 0; r < numRounds; r++) {
    // ── 1. Select sitting-out players ────────────────────────
    // Always choose players with the fewest byes so far.
    // Ties are broken by player index (deterministic, distributes
    // byes in a round-robin across equally-rested players).
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => byeCounts[a] - byeCounts[b] || a - b);

    const sittingIdxs = order.slice(0, byesPerRound);
    sittingIdxs.forEach(i => byeCounts[i]++);

    const activeIdxs = order.slice(byesPerRound).sort((a, b) => a - b);

    // ── 2. Generate partner pairs via Berger circle ───────────
    const pairs = bergerRound(activeCount, r);

    // ── 3. Build matches: pair[2m] vs pair[2m+1] ─────────────
    const matches = [];
    for (let m = 0; m < pairs.length; m += 2) {
      matches.push({
        teamA: [playerIds[activeIdxs[pairs[m][0]]], playerIds[activeIdxs[pairs[m][1]]]],
        teamB: [playerIds[activeIdxs[pairs[m + 1][0]]], playerIds[activeIdxs[pairs[m + 1][1]]]],
      });
    }

    rounds.push({
      round:      r + 1,
      sittingOut: sittingIdxs.map(i => playerIds[i]),
      matches,
    });
  }

  return rounds;
}

/**
 * Berger circle construction for k players (k must be even).
 *
 * Returns k/2 unique pairs (each covering every player exactly once)
 * for the given round index. Cycles with period k-1.
 *
 * Algorithm:
 *  - Fix player at index k-1 (the "anchor")
 *  - For rotation step r (1..k-1), pair anchor with player r-1
 *  - Remaining k-2 players form (k-2)/2 pairs via symmetric offsets
 */
function bergerRound(k, roundIndex) {
  const kk    = k - 1;                    // number of rotating positions
  const r     = (roundIndex % kk) + 1;   // r ∈ [1, k-1], cycles
  const fixed = k - 1;                   // anchor player index

  const pairs = [];

  // Pair the anchor with player at rotating position r-1
  pairs.push([fixed, (r - 1) % kk]);

  // Symmetric pairs for the remaining k-2 players
  for (let i = 1; i <= (k - 2) / 2; i++) {
    const p1 = ((r - 1 + i) % kk);
    const p2 = ((r - 1 - i + kk) % kk);
    pairs.push([p1, p2]);
  }

  return pairs; // k/2 pairs
}

// ─────────────────────────────────────────────────────────────────────────────
// Faire Auslosung (skill-balanced + variety-optimised)
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_WEIGHT = { ASSOCIATE: 1, CONSULTANT: 2, EXPERT: 3 };

/**
 * Generate Americano rounds with balanced skill levels and maximised variety.
 *
 * For each round a Monte-Carlo search finds the match arrangement that
 * minimises a weighted cost:
 *   W_SKILL   × |skillTeamA − skillTeamB|   (balance every match)
 *   W_PARTNER × times these two have partnered before (avoid repeat partners)
 *   W_OPP     × times these two have opposed each other (variety of opponents)
 *
 * @param {number[]} playerIds  – Array of player IDs (min 4)
 * @param {{ [playerId]: string }} skillMap – Skill enum per player ID
 * @param {number}   numRounds
 * @param {number|null} numCourts
 */
function generateAmericanoFair(playerIds, skillMap, numRounds, numCourts) {
  const n = playerIds.length;
  if (n < 4) throw new Error('Americano benötigt mindestens 4 Spieler.');

  const maxByPlayers = Math.floor(n / 4) * 4;
  const maxByCourts  = numCourts ? numCourts * 4 : maxByPlayers;
  const activeCount  = Math.min(maxByPlayers, maxByCourts);
  const byesPerRound = n - activeCount;

  const byeCounts    = new Array(n).fill(0);
  const partnerCount = Array.from({ length: n }, () => new Array(n).fill(0));
  const oppCount     = Array.from({ length: n }, () => new Array(n).fill(0));

  // Skill weight per position in playerIds array
  const skills = playerIds.map(id => SKILL_WEIGHT[skillMap[id]] || 1);

  const rounds = [];

  for (let r = 0; r < numRounds; r++) {
    // 1. Sitting-out selection (same fair-bye rotation as standard Americano)
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => byeCounts[a] - byeCounts[b] || a - b);
    const sittingIdxs = order.slice(0, byesPerRound);
    sittingIdxs.forEach(i => byeCounts[i]++);
    const activeIdxs = order.slice(byesPerRound);

    // 2. Monte-Carlo: find best match arrangement
    const arrangement = findBestArrangement(activeCount, activeIdxs, skills, partnerCount, oppCount);

    // 3. Build matches and update history
    const matches = [];
    for (let m = 0; m < activeCount / 4; m++) {
      const base = m * 4;
      const p = [
        activeIdxs[arrangement[base]],
        activeIdxs[arrangement[base + 1]],
        activeIdxs[arrangement[base + 2]],
        activeIdxs[arrangement[base + 3]],
      ];

      partnerCount[p[0]][p[1]]++;  partnerCount[p[1]][p[0]]++;
      partnerCount[p[2]][p[3]]++;  partnerCount[p[3]][p[2]]++;

      for (const a of [p[0], p[1]]) for (const b of [p[2], p[3]]) {
        oppCount[a][b]++;
        oppCount[b][a]++;
      }

      matches.push({
        teamA: [playerIds[p[0]], playerIds[p[1]]],
        teamB: [playerIds[p[2]], playerIds[p[3]]],
      });
    }

    rounds.push({
      round:      r + 1,
      sittingOut: sittingIdxs.map(i => playerIds[i]),
      matches,
    });
  }

  return rounds;
}

/** Find arrangement of [0..activeCount-1] that minimises match cost. */
function findBestArrangement(activeCount, activeIdxs, skills, partnerCount, oppCount) {
  const N_ATTEMPTS = 800;
  const perm = Array.from({ length: activeCount }, (_, i) => i);

  let bestPerm  = perm.slice();
  let bestScore = scoreArrangement(perm, activeIdxs, skills, partnerCount, oppCount);

  for (let t = 0; t < N_ATTEMPTS; t++) {
    shuffleFY(perm);
    const s = scoreArrangement(perm, activeIdxs, skills, partnerCount, oppCount);
    if (s < bestScore) {
      bestScore = s;
      bestPerm  = perm.slice();
    }
  }

  return bestPerm;
}

function scoreArrangement(perm, activeIdxs, skills, partnerCount, oppCount) {
  const W_SKILL   = 3;
  const W_PARTNER = 4;
  const W_OPP     = 1;
  let score = 0;

  for (let m = 0; m < perm.length / 4; m++) {
    const base = m * 4;
    const [p0, p1, p2, p3] = [
      activeIdxs[perm[base]],
      activeIdxs[perm[base + 1]],
      activeIdxs[perm[base + 2]],
      activeIdxs[perm[base + 3]],
    ];

    score += W_SKILL   * Math.abs((skills[p0] + skills[p1]) - (skills[p2] + skills[p3]));
    score += W_PARTNER * (partnerCount[p0][p1] + partnerCount[p2][p3]);
    score += W_OPP     * (oppCount[p0][p2] + oppCount[p0][p3] + oppCount[p1][p2] + oppCount[p1][p3]);
  }

  return score;
}

function shuffleFY(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

module.exports = { generateAmericano, generateAmericanoFair };
