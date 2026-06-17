const { verifyToken } = require('../lib/auth');
const prisma = require('../lib/prisma');

// Prüft das Bearer-Token und hängt req.user an.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nicht authentifiziert' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
  }
}

// Verifies ADMIN role against the DB so a demoted user can't reuse an old token.
async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(403).json({ error: 'Adminrechte erforderlich' });
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { role: true },
    });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Adminrechte erforderlich' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireAdmin };
