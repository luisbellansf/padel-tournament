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

module.exports = { generateAmericano };
