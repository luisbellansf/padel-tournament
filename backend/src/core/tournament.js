// Turnier-Generatoren. Alle Funktionen sind rein (kein DB-Zugriff) und liefern
// eine Struktur aus Runden + Matches, die das Backend persistiert.
//
// Match-Form: { round, slot, teamA, teamB, stage, group }
//   teamA/teamB = Team-ID oder null (Freilos/Platzhalter)

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Jeder gegen jeden (Round Robin) nach dem Kreis-Verfahren.
 * Bei ungerader Teamzahl wird ein "BYE" (null) ergänzt.
 */
function roundRobin(teamIds, { stage = 'ROUND_ROBIN', group = null } = {}) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null); // Freilos
  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches = [];

  const arr = [...teams];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const teamA = arr[i];
      const teamB = arr[n - 1 - i];
      if (teamA !== null && teamB !== null) {
        matches.push({ round: r + 1, slot: i, teamA, teamB, stage, group });
      }
    }
    // Rotation: erstes Element fix, Rest im Uhrzeigersinn drehen
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return matches;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Single Elimination (K.o.). Nicht-2er-Potenzen werden mit Freilosen
 * (null) in Runde 1 aufgefüllt. Folge-Runden enthalten Platzhalter
 * (teamA/teamB = null), die nach Ergebnissen aufgelöst werden.
 */
function singleElimination(teamIds, { seed = true, rng = Math.random } = {}) {
  const ordered = seed ? [...teamIds] : shuffle(teamIds, rng);
  const size = nextPowerOfTwo(ordered.length);
  const slots = [...ordered];
  while (slots.length < size) slots.push(null); // Freilose

  const matches = [];
  // Runde 1
  let round = 1;
  for (let i = 0; i < size / 2; i++) {
    matches.push({
      round,
      slot: i,
      teamA: slots[i * 2],
      teamB: slots[i * 2 + 1],
      stage: 'KNOCKOUT',
      group: null,
    });
  }
  // Folge-Runden als Platzhalter
  let teamsInRound = size / 2;
  while (teamsInRound > 1) {
    round++;
    teamsInRound /= 2;
    for (let i = 0; i < teamsInRound; i++) {
      matches.push({
        round,
        slot: i,
        teamA: null,
        teamB: null,
        stage: 'KNOCKOUT',
        group: null,
      });
    }
  }
  return matches;
}

/**
 * Gruppenphase + K.o.
 * Teams werden auf `numGroups` verteilt, in jeder Gruppe Round Robin,
 * danach K.o. mit den besten `advancePerGroup` je Gruppe.
 */
function groupKnockout(
  teamIds,
  { numGroups = 2, advancePerGroup = 2, rng = Math.random } = {}
) {
  const shuffled = shuffle(teamIds, rng);
  const groups = Array.from({ length: numGroups }, () => []);
  shuffled.forEach((id, idx) => groups[idx % numGroups].push(id));

  const groupMatches = [];
  groups.forEach((g, gi) => {
    const groupName = String.fromCharCode(65 + gi); // A, B, C ...
    groupMatches.push(
      ...roundRobin(g, { stage: 'GROUP', group: groupName })
    );
  });

  // K.o.-Platzhalter für die Qualifizierten
  const advancing = numGroups * advancePerGroup;
  const placeholders = Array.from({ length: advancing }, () => null);
  const knockoutMatches = singleElimination(placeholders, { seed: true });

  return { groups, groupMatches, knockoutMatches };
}

module.exports = {
  roundRobin,
  singleElimination,
  groupKnockout,
  nextPowerOfTwo,
};
