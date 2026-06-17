require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');


const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const tournamentRoutes = require('./routes/tournaments');

const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');

// Sicherheits-Header
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// In production the frontend is served from the same origin → no CORS needed.
// In development we allow the Vite dev server origin via env var.
if (!IS_PROD) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [],
    })
  );
}

// Global rate limit – defence against enumeration / scraping
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', globalLimiter);

// Tighter limit on auth routes (brute-force protection)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });
app.use('/api/auth', authLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/tournaments', tournamentRoutes);

// In production: serve the compiled React frontend and handle SPA routing
if (IS_PROD) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api).*/, (_req, res) =>
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  );
}

// Fehlerbehandlung
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`));
