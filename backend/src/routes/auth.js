const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { hashPassword, verifyPassword, signToken } = require('../lib/auth');
const ah = require('../lib/asyncHandler');

const router = express.Router();

const registerSchema = z.object({
  name:       z.string().min(2, 'Benutzername muss mind. 2 Zeichen haben').max(50),
  email:      z.string().email().max(254).optional(),
  password:   z.string().min(8, 'Passwort muss mind. 8 Zeichen haben').max(128),
  skillLevel: z.enum(['ASSOCIATE', 'CONSULTANT', 'EXPERT']).default('ASSOCIATE'),
});

router.post('/register', ah(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password, skillLevel } = parsed.data;

  // Username must be unique
  const nameConflict = await prisma.user.findUnique({ where: { name } });
  if (nameConflict) return res.status(409).json({ error: 'Benutzername bereits vergeben.' });

  // Email must be unique when provided
  if (email) {
    const emailConflict = await prisma.user.findFirst({ where: { email } });
    if (emailConflict) return res.status(409).json({ error: 'E-Mail bereits registriert.' });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email: email ?? null, passwordHash, skillLevel },
  });
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
}));

const loginSchema = z.object({
  name:     z.string().min(1).max(50),
  password: z.string().max(128),
});

router.post('/login', ah(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingabe' });
  const { name, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { name } });
  // Constant-time check to prevent username enumeration
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}));

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, skillLevel: u.skillLevel };
}

module.exports = router;
