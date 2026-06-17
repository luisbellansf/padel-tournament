// Legt einen Admin-Account an. Aufruf: npm run db:seed
require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../src/lib/auth');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@padel.local';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: { email, name: 'Admin', passwordHash, role: 'ADMIN', skillLevel: 'EXPERT' },
  });
  console.log(`Admin angelegt: ${email} / ${password}  (bitte Passwort ändern!)`);
}

main().finally(() => prisma.$disconnect());
