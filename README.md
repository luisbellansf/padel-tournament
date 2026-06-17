# Padel Cup 🎾

Web-App für Padel-Turniere: Spieler melden sich an, geben ihr Skill-Level an
(**Associate / Consultant / Expert**), und es werden **2er-Teams** gebildet –
entweder mit selbst gewähltem Wunschpartner oder automatisch und **ausgewogen
nach Skill** ausgelost. Darauf baut eine Turnierstruktur in drei Formaten auf.

## Features

- **Auth**: Registrierung & Login, Passwörter mit **argon2id** gehasht, JWT (7 Tage), Rate-Limiting & Security-Header (helmet).
- **Skill-Level**: Associate / Consultant / Expert (Gewichte 1 / 2 / 3).
- **Team-Bildung**:
  - Gegenseitige Wunschpartner → festes Team.
  - Alle übrigen → ausgewogene Paarung (stark + schwach), zufällig innerhalb gleicher Stufe.
- **Turnierformate**:
  - Jeder gegen jeden (Round Robin, Kreis-Verfahren)
  - K.o.-System (Single Elimination, mit Freilosen bei ungerader Anzahl)
  - Gruppe + K.o. (konfigurierbar: Gruppenzahl & Qualifizierte pro Gruppe)
- **Spielplan**: Ergebnisse erfassen, Sieger rücken im K.o. automatisch auf.

## Tech-Stack

| Schicht   | Technologie                          |
|-----------|--------------------------------------|
| Frontend  | React 18 + Vite + React Router       |
| Backend   | Node.js + Express                    |
| ORM/DB    | Prisma → **MySQL**                   |
| Auth      | argon2 + JWT                         |

## Schnellstart (lokal)

Voraussetzung: Node.js ≥ 18 und eine laufende MySQL-Datenbank.

### 1. Backend

```bash
cd backend
cp .env.example .env          # DATABASE_URL & JWT_SECRET eintragen!
npm install
npx prisma migrate dev --name init   # legt Tabellen an
npm run db:seed               # Admin-Account anlegen
npm run dev                   # API auf http://localhost:4000
```

Wichtig: In `.env` ein starkes `JWT_SECRET` setzen, z. B.:
```bash
openssl rand -base64 48
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # App auf http://localhost:5173
```

Der Vite-Dev-Server leitet `/api` automatisch ans Backend weiter.

### Login

Nach dem Seed existiert ein Admin: `admin@padel.local` / `admin12345`
(**Passwort sofort ändern!**). Admins können Turniere anlegen, Teams auslosen
und Bracket/Ergebnisse verwalten. Normale Spieler melden sich selbst an.

## Tests

Die Kernlogik (Team-Balancing + Turnier-Generatoren) ist ohne DB testbar:

```bash
cd backend && npm test
```

## Deployment

**Backend** (z. B. Render, Railway, Fly.io, eigener Server / Docker):
1. Managed MySQL bereitstellen, `DATABASE_URL` setzen.
2. `npx prisma migrate deploy` beim Deploy ausführen.
3. `npm start` als Startbefehl.
4. `JWT_SECRET` und `CORS_ORIGIN` (Frontend-URL) als Umgebungsvariablen setzen.

**Frontend** (z. B. Vercel, Netlify, statisches Hosting):
1. `npm run build` → Output in `frontend/dist`.
2. Statische Dateien ausliefern; API-Calls auf die Backend-URL zeigen lassen
   (in Produktion `/api` per Reverse-Proxy oder Build-Variable auf die API-Domain routen).

## Sicherheitshinweise

- Passwörter werden nie im Klartext gespeichert (argon2id).
- JWT-Secret niemals committen; `.env` ist in `.gitignore`.
- In Produktion **HTTPS** erzwingen (Reverse-Proxy / Hosting-TLS).
- `CORS_ORIGIN` strikt auf die echte Frontend-Domain setzen, nicht `*`.

## Projektstruktur

```
padel-tournament/
├── backend/
│   ├── prisma/schema.prisma     # Datenmodell (MySQL)
│   ├── src/
│   │   ├── core/                # Balancing + Turnier-Generatoren (rein, testbar)
│   │   ├── lib/                 # Prisma-Client, Auth (argon2/JWT)
│   │   ├── middleware/          # requireAuth / requireAdmin
│   │   └── routes/              # auth, players, tournaments
│   └── test/core.test.js
└── frontend/
    └── src/
        ├── api.js               # API-Client
        ├── App.jsx              # Routing + Auth-Kontext
        └── pages/               # Login, Register, Dashboard, Tournament
```
