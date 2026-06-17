const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { hashPassword, verifyPassword } = require('../lib/auth');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ah = require('../lib/asyncHandler');

const router = express.Router();
router.use(requireAuth);

/* ─── Helpers ─────────────────────────────────────────── */

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: 'Ungültige ID.' }); return null; }
  return id;
}

function notFound(res, message = 'Benutzer nicht gefunden.') {
  return (err) => {
    if (err?.code === 'P2025') return res.status(404).json({ error: message });
    throw err;
  };
}

const USER_SELECT = { id: true, name: true, email: true, role: true, skillLevel: true };

/* ─── Own profile ─────────────────────────────────────── */

router.get('/me', ah(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, skillLevel: user.skillLevel });
}));

const meUpdateSchema = z.object({
  name:            z.string().min(2).max(50).optional(),
  email:           z.string().email().max(254).optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword:     z.string().min(8).max(128).optional(),
}).refine(
  (d) => !(d.newPassword && !d.currentPassword),
  { message: 'Aktuelles Passwort ist erforderlich zum Ändern des Passworts.' }
).refine(
  (d) => !(d.currentPassword && !d.newPassword),
  { message: 'Neues Passwort darf nicht leer sein.' }
);

router.patch('/me', ah(async (req, res) => {
  const parsed = meUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { name, email, currentPassword, newPassword } = parsed.data;
  const data = {};

  if (name) {
    const nameConflict = await prisma.user.findFirst({
      where: { name, id: { not: req.user.sub } },
      select: { id: true },
    });
    if (nameConflict) return res.status(409).json({ error: 'Benutzername bereits vergeben.' });
    data.name = name;
  }

  if (email) {
    const emailConflict = await prisma.user.findFirst({
      where: { email, id: { not: req.user.sub } },
      select: { id: true },
    });
    if (emailConflict) return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' });
    data.email = email;
  }

  if (newPassword) {
    const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { passwordHash: true } });
    const valid = await verifyPassword(me.passwordHash, currentPassword);
    if (!valid) return res.status(403).json({ error: 'Aktuelles Passwort ist falsch.' });
    data.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Keine Änderungen angegeben.' });
  }

  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data,
    select: USER_SELECT,
  });
  res.json(user);
}));

/* ─── Player list (partner selection) ────────────────── */

router.get('/', ah(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, skillLevel: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

/* ─── Admin: Userverwaltung ───────────────────────────── */

router.get('/admin/all', requireAdmin, ah(async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, skillLevel: true, createdAt: true },
  });
  res.json(users);
}));

const updateUserSchema = z.object({
  name:       z.string().min(2).max(50).optional(),
  skillLevel: z.enum(['ASSOCIATE', 'CONSULTANT', 'EXPERT']).optional(),
}).strict();

router.patch('/:id', requireAdmin, ah(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const user = await prisma.user.update({
    where: { id }, data: parsed.data, select: USER_SELECT,
  }).catch(notFound(res));
  if (user) res.json(user);
}));

router.patch('/:id/role', requireAdmin, ah(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (id === req.user.sub) return res.status(403).json({ error: 'Du kannst deine eigene Rolle nicht ändern.' });
  const parsed = z.object({ role: z.enum(['ADMIN', 'PLAYER']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Rolle.' });
  if (parsed.data.role === 'PLAYER') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) return res.status(409).json({ error: 'Der letzte Admin kann nicht degradiert werden.' });
  }
  const user = await prisma.user.update({
    where: { id }, data: { role: parsed.data.role }, select: USER_SELECT,
  }).catch(notFound(res));
  if (user) res.json(user);
}));

router.delete('/:id', requireAdmin, ah(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (id === req.user.sub) return res.status(403).json({ error: 'Du kannst deinen eigenen Account nicht löschen.' });
  const done = await prisma.$transaction([
    prisma.registration.updateMany({ where: { desiredPartnerId: id }, data: { desiredPartnerId: null } }),
    prisma.user.delete({ where: { id } }),
  ]).catch(notFound(res));
  if (done) res.json({ ok: true });
}));

router.post('/:id/reset-password', requireAdmin, ah(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const parsed = z.object({ password: z.string().min(8).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  const passwordHash = await hashPassword(parsed.data.password);
  const done = await prisma.user.update({ where: { id }, data: { passwordHash } }).catch(notFound(res));
  if (done) res.json({ ok: true });
}));

module.exports = router;
