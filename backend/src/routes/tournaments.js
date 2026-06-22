const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { buildBalancedTeams } = require('../core/teamBalancer');
const { roundRobin, singleElimination, groupKnockout } = require('../core/tournament');
const { generateAmericano } = require('../core/americano');
const ah = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

/* ---------------- Turniere ---------------- */

// Liste aller Turniere
router.get('/', ah(async (_req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { registrations: true, teams: true } } },
  });
  res.json(tournaments);
}));

const createSchema = z.object({
  name: z.string().min(2).max(100),
  format: z.enum(['ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT', 'AMERICANO']),
  config: z
    .object({
      sportType:        z.string().optional(),
      minPlayers:       z.number().int().min(2).optional(),
      allowSkill:       z.boolean().optional(),
      numRounds:        z.number().int().min(1).max(50).optional(),
      numCourts:        z.number().int().min(1).max(20).optional(),
      winScore:         z.number().int().min(5).max(200).optional(), // Americano: points to win
      fullRotation:     z.boolean().optional(),                       // Americano: auto-calc rounds
      hideStandings:    z.boolean().optional(),                       // Americano: hide from players
      numGroups:        z.number().int().min(2).optional(),
      advancePerGroup:  z.number().int().min(1).optional(),
      timeBasedGame:    z.boolean().optional(),
      pointsForWin:     z.number().int().min(0).max(99).optional(),
      pointsForDraw:    z.number().int().min(0).max(99).optional(),
      allowDraw:        z.boolean().optional(),
      onlyWinner:       z.boolean().optional(),
      pointsForWinPB:   z.number().int().min(0).max(99).optional(),
    })
    .optional(),
});

// Turnier anlegen (Admin)
router.post('/', requireAdmin, ah(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const t = await prisma.tournament.create({ data: parsed.data });
  res.status(201).json(t);
}));

// Turnier-Detail inkl. Teams + Matches
router.get('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: true,
      matches: { orderBy: [{ stage: 'asc' }, { round: 'asc' }, { slot: 'asc' }] },
      registrations: { include: { user: { select: { id: true, name: true, skillLevel: true } } } },
    },
  });
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden' });
  res.json(t);
}));

/* ---------------- Anmeldung ---------------- */

const regSchema = z.object({
  desiredPartnerId: z.number().int().optional(),
  skillLevel:       z.enum(['ASSOCIATE', 'CONSULTANT', 'EXPERT']).optional(),
});

// Eigene Anmeldung (Wunschpartner + optionales Skill-Level)
router.post('/:id/register', ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  if (!Number.isInteger(tournamentId) || tournamentId < 1) {
    return res.status(400).json({ error: 'Ungültige Turnier-ID.' });
  }
  const parsed = regSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingabe' });

  // Validate: if tournament requires skill, it must be provided
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { config: true },
  });
  const cfg = tournament?.config ?? {};
  if (cfg.allowSkill && !parsed.data.skillLevel) {
    return res.status(400).json({ error: 'Skill-Level ist für dieses Turnier erforderlich.' });
  }

  const reg = await prisma.registration.upsert({
    where: { tournamentId_userId: { tournamentId, userId: req.user.sub } },
    update: {
      desiredPartnerId: parsed.data.desiredPartnerId ?? null,
      skillLevel:       parsed.data.skillLevel ?? null,
    },
    create: {
      tournamentId,
      userId:          req.user.sub,
      desiredPartnerId: parsed.data.desiredPartnerId ?? null,
      skillLevel:       parsed.data.skillLevel ?? null,
    },
  });
  res.status(201).json(reg);
}));

/* ---------------- Teams bilden ---------------- */

// Teams auslosen: gegenseitige Wunschpartner -> manuelle Teams,
// Rest ausgewogen nach Skill (Admin)
router.post('/:id/form-teams', requireAdmin, ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  const regs = await prisma.registration.findMany({
    where: { tournamentId },
    include: { user: true },
  });
  if (regs.length < 2) return res.status(400).json({ error: 'Zu wenige Anmeldungen' });

  // Gegenseitige Wunschpartner ermitteln
  const wishMap = new Map(regs.map((r) => [r.userId, r.desiredPartnerId]));
  const manualTeams = [];
  const seen = new Set();
  for (const r of regs) {
    const a = r.userId;
    const b = r.desiredPartnerId;
    if (b && wishMap.get(b) === a && !seen.has(a) && !seen.has(b)) {
      manualTeams.push({ playerIds: [a, b] });
      seen.add(a);
      seen.add(b);
    }
  }

  const players = regs.map((r) => ({
    id: r.userId,
    name: r.user.name,
    // Use tournament-specific skill if set, fall back to user's global skill
    skillLevel: r.skillLevel ?? r.user.skillLevel,
  }));

  const { teams, leftover } = buildBalancedTeams(players, manualTeams);

  // Alte Teams entfernen, neue speichern (Transaktion)
  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId } }),
    prisma.team.deleteMany({ where: { tournamentId } }),
  ]);

  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const created = [];
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const ids = t.players.map((p) => p.id);
    const team = await prisma.team.create({
      data: {
        tournamentId,
        name: t.players.map((p) => nameOf.get(p.id)).join(' & '),
        manual: t.manual,
        totalSkill: t.totalSkill,
        playerIds: ids,
      },
    });
    created.push(team);
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'TEAMS_FORMED' },
  });

  res.json({ teams: created, leftover });
}));

/* ---------------- Bracket / Spielplan erzeugen ---------------- */

router.post('/:id/generate', requireAdmin, ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true },
  });
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden' });

  /* ── AMERICANO: build schedule directly from registrations ── */
  if (t.format === 'AMERICANO') {
    // Clear any previously generated temporary teams + matches
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId } }),
      prisma.team.deleteMany({ where: { tournamentId } }),
    ]);

    const regs = await prisma.registration.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (regs.length < 4) {
      return res.status(400).json({ error: 'Americano benötigt mindestens 4 Spieler.' });
    }

    const playerIds = regs.map((r) => r.userId);
    const numCourts = t.config?.numCourts ?? null;

    // Full-rotation mode: calculate how many rounds until every pairing repeats
    let numRounds;
    if (t.config?.fullRotation) {
      const maxByPlayers = Math.floor(playerIds.length / 4) * 4;
      const maxByCourts  = numCourts ? numCourts * 4 : maxByPlayers;
      const activeCount  = Math.min(maxByPlayers, maxByCourts);
      numRounds = Math.max(1, activeCount - 1);
    } else {
      numRounds = t.config?.numRounds ?? 7;
    }
    const nameOf    = new Map(regs.map((r) => [r.userId, r.user.name]));

    const americanoRounds = generateAmericano(playerIds, numRounds, numCourts);

    // Create per-round temporary teams and matches
    for (const round of americanoRounds) {
      for (let m = 0; m < round.matches.length; m++) {
        const { teamA: pA, teamB: pB } = round.matches[m];

        const [tA, tB] = await Promise.all([
          prisma.team.create({
            data: {
              tournamentId,
              name:       pA.map((id) => nameOf.get(id)).join(' & '),
              manual:     false,
              totalSkill: 0,
              playerIds:  pA,
            },
          }),
          prisma.team.create({
            data: {
              tournamentId,
              name:       pB.map((id) => nameOf.get(id)).join(' & '),
              manual:     false,
              totalSkill: 0,
              playerIds:  pB,
            },
          }),
        ]);

        await prisma.match.create({
          data: {
            tournamentId,
            stage:     'ROUND_ROBIN',
            groupName: null,
            round:     round.round,
            slot:      m,
            teamAId:   tA.id,
            teamBId:   tB.id,
          },
        });
      }
    }

    // Persist sittingOut info per round into config for the leaderboard
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'RUNNING',
        config: {
          ...(t.config ?? {}),
          americanoRounds: americanoRounds.map((r) => ({
            round:      r.round,
            sittingOut: r.sittingOut,
          })),
        },
      },
    });

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { slot: 'asc' }],
    });
    return res.json({ matches });
  }

  /* ── Classic formats: require pre-formed teams ── */
  const teamIds = t.teams.map((x) => x.id);
  if (teamIds.length < 2) return res.status(400).json({ error: 'Erst Teams bilden' });

  await prisma.match.deleteMany({ where: { tournamentId } });

  let matchData = [];
  if (t.format === 'ROUND_ROBIN') {
    matchData = roundRobin(teamIds);
  } else if (t.format === 'KNOCKOUT') {
    matchData = singleElimination(teamIds);
  } else if (t.format === 'GROUP_KNOCKOUT') {
    const cfg = t.config || {};
    const { groupMatches, knockoutMatches } = groupKnockout(teamIds, {
      numGroups:       cfg.numGroups ?? 2,
      advancePerGroup: cfg.advancePerGroup ?? 2,
    });
    matchData = [...groupMatches, ...knockoutMatches];
  }

  await prisma.match.createMany({
    data: matchData.map((m) => ({
      tournamentId,
      stage:     m.stage,
      groupName: m.group ?? null,
      round:     m.round,
      slot:      m.slot,
      teamAId:   m.teamA ?? null,
      teamBId:   m.teamB ?? null,
    })),
  });

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'RUNNING' },
  });

  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ stage: 'asc' }, { round: 'asc' }, { slot: 'asc' }],
  });
  res.json({ matches });
}));

/* ---------------- Ergebnis erfassen ---------------- */

const scoreSchema = z.object({
  scoreA: z.number().int().min(0).max(9999),
  scoreB: z.number().int().min(0).max(9999),
});

router.post('/:id/matches/:matchId/score', requireAdmin, ah(async (req, res) => {
  const matchId = Number(req.params.matchId);
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültiges Ergebnis' });
  const { scoreA, scoreB } = parsed.data;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return res.status(404).json({ error: 'Match nicht gefunden' });

  const tournament = await prisma.tournament.findUnique({
    where: { id: match.tournamentId },
    select: { format: true, config: true },
  });

  if (tournament?.format === 'AMERICANO') {
    const timeBasedGame = tournament.config?.timeBasedGame ?? false;
    const onlyWinner    = tournament.config?.onlyWinner ?? false;
    if (timeBasedGame) {
      if (!onlyWinner) {
        const allowDraw = tournament.config?.allowDraw ?? true;
        if (!allowDraw && scoreA === scoreB) {
          return res.status(400).json({ error: 'Unentschieden nicht erlaubt – bitte Finalpunkt ausspielen.' });
        }
      }
    } else if (!onlyWinner) {
      const winScore = tournament.config?.winScore ?? 11;
      const maxScore = Math.max(scoreA, scoreB);
      const minScore = Math.min(scoreA, scoreB);
      if (maxScore !== winScore) {
        return res.status(400).json({ error: `Das Gewinnerteam muss genau ${winScore} Punkte haben.` });
      }
      if (minScore >= winScore) {
        return res.status(400).json({ error: `Das Verliererteam darf höchstens ${winScore - 1} Punkte haben.` });
      }
    }
  } else {
    if (scoreA === scoreB) return res.status(400).json({ error: 'Unentschieden im K.o. nicht erlaubt' });
  }

  const winnerTeamId = scoreA > scoreB ? match.teamAId : scoreB > scoreA ? match.teamBId : null;
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { scoreA, scoreB, winnerTeamId, playedAt: new Date() },
  });

  // Sieger in die nächste K.o.-Runde schieben
  if (match.stage === 'KNOCKOUT' && winnerTeamId) {
    const nextRound = match.round + 1;
    const nextSlot = Math.floor(match.slot / 2);
    const next = await prisma.match.findFirst({
      where: { tournamentId: match.tournamentId, stage: 'KNOCKOUT', round: nextRound, slot: nextSlot },
    });
    if (next) {
      const field = match.slot % 2 === 0 ? 'teamAId' : 'teamBId';
      await prisma.match.update({ where: { id: next.id }, data: { [field]: winnerTeamId } });
    }

    // Americano-Finalrunde: Die Verlierer der Halbfinals spielen um Platz 3.
    if (tournament?.format === 'AMERICANO' && match.round === 1) {
      const loserTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      const thirdPlace = await prisma.match.findFirst({
        where: { tournamentId: match.tournamentId, stage: 'KNOCKOUT', round: 2, slot: 1 },
      });
      if (thirdPlace && loserTeamId) {
        const field = match.slot === 0 ? 'teamAId' : 'teamBId';
        await prisma.match.update({ where: { id: thirdPlace.id }, data: { [field]: loserTeamId } });
      }
    }
  }

  if (tournament?.format === 'AMERICANO' && match.stage === 'KNOCKOUT' && match.round === 2) {
    const openPlayoffs = await prisma.match.count({
      where: { tournamentId: match.tournamentId, stage: 'KNOCKOUT', round: 2, scoreA: null },
    });
    if (openPlayoffs === 0) {
      await prisma.tournament.update({ where: { id: match.tournamentId }, data: { status: 'FINISHED' } });
    }
  }

  res.json(updated);
}));

/* ---------------- Americano: Finalrunde --------------------- */

router.post('/:id/americano-finals', requireAdmin, ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  const parsed = z.object({
    playerIds: z.array(z.number().int().positive()).length(4)
      .refine((ids) => new Set(ids).size === 4, 'Die Top 4 müssen eindeutig sein.'),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Top-4-Auswahl.' });

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { registrations: { include: { user: { select: { name: true } } } }, matches: true },
  });
  if (!tournament) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  if (tournament.format !== 'AMERICANO') return res.status(400).json({ error: 'Finalrunde ist nur für Americano verfügbar.' });
  if (tournament.matches.some((m) => m.stage === 'KNOCKOUT')) {
    return res.status(409).json({ error: 'Die Finalrunde wurde bereits gestartet.' });
  }

  const preliminary = tournament.matches.filter((m) => m.stage === 'ROUND_ROBIN');
  if (preliminary.length === 0 || preliminary.some((m) => m.scoreA == null)) {
    return res.status(400).json({ error: 'Zuerst müssen alle Americano-Runden abgeschlossen sein.' });
  }

  const registrations = new Map(tournament.registrations.map((r) => [r.userId, r]));
  if (parsed.data.playerIds.some((id) => !registrations.has(id))) {
    return res.status(400).json({ error: 'Mindestens ein Finalist gehört nicht zu diesem Turnier.' });
  }

  const finalistTeams = [];
  for (const playerId of parsed.data.playerIds) {
    const team = await prisma.team.create({
      data: {
        tournamentId,
        name: registrations.get(playerId).user.name,
        manual: false,
        totalSkill: 0,
        playerIds: [playerId],
      },
    });
    finalistTeams.push(team);
  }

  // Setzliste: 1 vs. 4 und 2 vs. 3; Finale und Platz 3 werden automatisch befüllt.
  await prisma.match.createMany({
    data: [
      { tournamentId, stage: 'KNOCKOUT', round: 1, slot: 0, teamAId: finalistTeams[0].id, teamBId: finalistTeams[3].id },
      { tournamentId, stage: 'KNOCKOUT', round: 1, slot: 1, teamAId: finalistTeams[1].id, teamBId: finalistTeams[2].id },
      { tournamentId, stage: 'KNOCKOUT', round: 2, slot: 0 },
      { tournamentId, stage: 'KNOCKOUT', round: 2, slot: 1 },
    ],
  });

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { config: { ...(tournament.config ?? {}), americanoFinalsStarted: true } },
  });

  res.status(201).json({ ok: true });
}));

/* ---------------- Americano: standings visibility ----------- */

router.patch('/:id/hide-standings', requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Ungültige ID.' });
  const parsed = z.object({ hide: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingabe.' });
  const t = await prisma.tournament.findUnique({ where: { id }, select: { config: true } });
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  const updated = await prisma.tournament.update({
    where: { id },
    data: { config: { ...(t.config ?? {}), hideStandings: parsed.data.hide } },
  });
  res.json(updated);
}));

/* ---------------- Admin: Anmeldung verwalten ---------------- */

// Admin registers any existing user for a tournament
router.post('/:id/register-user', requireAdmin, ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  const parsed = z.object({ userId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Benutzer-ID.' });

  const { userId } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  const reg = await prisma.registration.upsert({
    where:  { tournamentId_userId: { tournamentId, userId } },
    update: {},
    create: { tournamentId, userId },
  });
  res.status(201).json(reg);
}));

// Admin removes a user's registration from a tournament
router.delete('/:id/registrations/:userId', requireAdmin, ah(async (req, res) => {
  const tournamentId = Number(req.params.id);
  const userId       = Number(req.params.userId);

  const reg = await prisma.registration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true },
  });
  if (!reg) return res.status(404).json({ error: 'Anmeldung nicht gefunden.' });

  await prisma.registration.delete({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  res.json({ ok: true });
}));

/* ---------------- Turnier löschen ---------------- */

router.delete('/:id', requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Ungültige ID.' });
  const exists = await prisma.tournament.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  // onDelete: Cascade on all relations (Match, Team, Registration) handles cleanup
  await prisma.tournament.delete({ where: { id } });
  res.json({ ok: true });
}));

module.exports = router;
