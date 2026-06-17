const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail fast – ein fehlendes Secret ist ein Sicherheitsrisiko.
  throw new Error('JWT_SECRET fehlt in der Umgebung (.env).');
}

// argon2id ist der empfohlene Passwort-Hash (stärker als bcrypt).
async function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id });
}

async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
