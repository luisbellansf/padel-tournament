const assert = require('assert');
const { buildBalancedTeams } = require('../src/core/teamBalancer');
const { roundRobin, singleElimination, groupKnockout } = require('../src/core/tournament');

function player(id, skill) {
  return { id, name: `P${id}`, skillLevel: skill };
}

// --- Team-Balancing ---
const players = [
  player(1, 'EXPERT'), player(2, 'EXPERT'),
  player(3, 'CONSULTANT'), player(4, 'CONSULTANT'),
  player(5, 'ASSOCIATE'), player(6, 'ASSOCIATE'),
  player(7, 'EXPERT'), player(8, 'ASSOCIATE'),
];

const { teams, leftover } = buildBalancedTeams(players);
assert.strictEqual(teams.length, 4, 'sollte 4 Teams bilden');
assert.strictEqual(leftover.length, 0, 'kein Rest bei gerader Anzahl');
const totals = teams.map((t) => t.totalSkill);
const spread = Math.max(...totals) - Math.min(...totals);
assert.ok(spread <= 2, `Teams sollten ausgewogen sein (Spread=${spread})`);
console.log('✓ Balancing: 4 ausgewogene Teams, Skill-Summen =', totals);

// Manuelle Teams bleiben erhalten + ungerader Rest
const r2 = buildBalancedTeams(players, [{ playerIds: [1, 5] }]);
assert.ok(r2.teams.some((t) => t.manual), 'manuelles Team vorhanden');
console.log('✓ Manuelle Auswahl respektiert, Teams:', r2.teams.length, 'Rest:', r2.leftover.length);

// --- Round Robin ---
const rr = roundRobin([10, 11, 12, 13]);
assert.strictEqual(rr.length, 6, '4 Teams -> 6 Spiele');
const rr5 = roundRobin([1, 2, 3, 4, 5]);
assert.strictEqual(rr5.length, 10, '5 Teams -> 10 Spiele (Freilose entfernt)');
console.log('✓ Round Robin: 4->6 Spiele, 5->10 Spiele');

// --- Single Elimination ---
const ko = singleElimination([1, 2, 3, 4, 5, 6, 7, 8]);
const r1 = ko.filter((m) => m.round === 1);
assert.strictEqual(r1.length, 4, '8 Teams -> 4 Erstrunden-Spiele');
assert.strictEqual(Math.max(...ko.map((m) => m.round)), 3, '8 Teams -> 3 Runden');
const ko6 = singleElimination([1, 2, 3, 4, 5, 6]); // mit Freilosen
assert.strictEqual(ko6.filter((m) => m.round === 1).length, 4, '6 Teams -> Bracket auf 8 aufgefüllt');
console.log('✓ K.o.: 8 Teams -> 3 Runden, 6 Teams -> Freilose ergänzt');

// --- Gruppe + K.o. ---
const gk = groupKnockout([1, 2, 3, 4, 5, 6, 7, 8], { numGroups: 2, advancePerGroup: 2 });
assert.strictEqual(gk.groups.length, 2, '2 Gruppen');
assert.strictEqual(gk.groups[0].length + gk.groups[1].length, 8, 'alle Teams verteilt');
assert.ok(gk.knockoutMatches.length >= 3, 'K.o.-Phase für 4 Qualifizierte');
console.log('✓ Gruppe+K.o.: 2 Gruppen,', gk.groupMatches.length, 'Gruppenspiele, K.o. für 4 Teams');

console.log('\nAlle Tests bestanden ✅');
