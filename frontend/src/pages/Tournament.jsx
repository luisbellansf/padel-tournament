import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App.jsx';

const SPORTS = {
  PADEL:        { label: 'Padel',       icon: '🎾' },
  FOOSBALL:     { label: 'Tischkicker', icon: '⚽' },
  TABLE_TENNIS: { label: 'Tischtennis', icon: '🏓' },
  DARTS:        { label: 'Darts',       icon: '🎯' },
  OTHER:        { label: 'Turnier',     icon: '🏆' },
};

const FORMAT_LABELS = {
  ROUND_ROBIN:    'Jeder gegen jeden',
  KNOCKOUT:       'K.o.-System',
  GROUP_KNOCKOUT: 'Gruppe + K.o.',
  AMERICANO:      'Americano',
};

const STATUS_LABELS = {
  DRAFT:        'Entwurf',
  TEAMS_FORMED: 'Teams gebildet',
  RUNNING:      'Laufend',
  FINISHED:     'Beendet',
};

const SKILL_COLORS = {
  ASSOCIATE:  { bg: '#e0f9fb', fg: '#00757a' },
  CONSULTANT: { bg: '#dbeafe', fg: '#1d4ed8' },
  EXPERT:     { bg: '#eef2ff', fg: '#0025D1' },
};

/* ─── Helpers ─────────────────────────────────────────── */

function SkillPill({ level }) {
  const c = SKILL_COLORS[level] ?? { bg: '#f1f5f9', fg: '#64748b' };
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 20, background: c.bg, color: c.fg,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {level}
    </span>
  );
}

function RegistrationProgress({ current, min }) {
  const pct     = Math.min(100, Math.round((current / min) * 100));
  const needed  = Math.max(0, min - current);
  const reached = current >= min;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
          {current} / {min} Anmeldungen
        </span>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: reached ? 'var(--success)' : '#d97706' }}>
          {reached
            ? '✓ Mindestanzahl erreicht'
            : `Noch ${needed} ${needed === 1 ? 'Anmeldung' : 'Anmeldungen'} ausstehend`}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 99,
          background: reached
            ? 'linear-gradient(90deg, #059669, #10b981)'
            : 'linear-gradient(90deg, var(--sf-blue-4), var(--sf-digital))',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '18px 0 8px', paddingBottom: 6,
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{label}</span>
      <span style={{
        marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '1px 8px', color: 'var(--text-muted)',
      }}>{count}</span>
    </div>
  );
}

function PlayerChip({ reg, suffix, onRemove }) {
  const displaySkill = reg.skillLevel ?? reg.user.skillLevel;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'var(--bg)', borderRadius: 10,
      border: '1px solid var(--border)',
      flex: 1, minWidth: 140,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #0051D4, #0025D1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: '0.75rem',
      }}>
        {reg.user.name[0].toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {reg.user.name}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
          <SkillPill level={displaySkill} />
          {reg.skillLevel && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>Turnier</span>
          )}
        </div>
      </div>
      {suffix && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{suffix}</span>}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Vom Turnier entfernen"
          style={{
            flexShrink: 0, marginLeft: 4,
            width: 22, height: 22, borderRadius: '50%',
            background: '#fee2e2', color: '#dc2626',
            border: 'none', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* Categorise registrations into mutual pairs, one-sided wishes, solo */
function categorise(registrations) {
  const wishMap = new Map(registrations.map((r) => [r.userId, r.desiredPartnerId]));
  const mutualPairs = [];
  const seenMutual  = new Set();
  const oneSided    = [];
  const solo        = [];

  for (const reg of registrations) {
    const uid = reg.userId;
    if (seenMutual.has(uid)) continue;
    const pid = reg.desiredPartnerId;
    if (pid && wishMap.get(pid) === uid) {
      const partnerReg = registrations.find((r) => r.userId === pid);
      mutualPairs.push([reg, partnerReg]);
      seenMutual.add(uid);
      seenMutual.add(pid);
    } else if (pid) {
      oneSided.push(reg);
    } else {
      solo.push(reg);
    }
  }
  return { mutualPairs, oneSided, solo };
}

/* ─── Main component ──────────────────────────────────── */

export default function Tournament() {
  const { id }  = useParams();
  const nav     = useNavigate();
  const { user } = useAuth();

  const [t, setT]             = useState(null);
  const [players, setPlayers]  = useState([]);
  const [partner, setPartner]  = useState('');
  const [skillLevel, setSkillLevel] = useState('ASSOCIATE');
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');

  const load = () => api.tournament(id).then(setT).catch((e) => setError(e.message));
  useEffect(() => { load(); api.players().then(setPlayers).catch(() => {}); }, [id]);

  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!t) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.9rem' }}>
      Lädt…
    </div>
  );

  const isAdmin  = user.role === 'ADMIN';
  const myReg    = t.registrations.find((r) => r.userId === user.id);
  const teamName = (tid) => t.teams.find((x) => x.id === tid)?.name ?? '—';
  const sport    = SPORTS[t.config?.sportType] ?? SPORTS.OTHER;
  const minPlayers = t.config?.minPlayers ?? 0;

  const playerName = (pid) =>
    t.registrations.find((r) => r.userId === pid)?.user?.name
    ?? players.find((p) => p.id === pid)?.name
    ?? `#${pid}`;

  const allowSkill = t?.config?.allowSkill ?? false;

  const doRegister = async () => {
    setMsg(''); setError('');
    try {
      await api.registerForTournament(id, {
        desiredPartnerId: partner ? Number(partner) : undefined,
        skillLevel: allowSkill ? skillLevel : undefined,
      });
      setMsg('Erfolgreich angemeldet!');
      load();
    } catch (e) { setError(e.message); }
  };

  const formTeams = async () => {
    try { await api.formTeams(id); load(); }
    catch (e) { setError(e.message); }
  };

  const generate = async () => {
    try { await api.generate(id); load(); }
    catch (e) { setError(e.message); }
  };

  const saveScore = async (matchId, scoreA, scoreB) => {
    try { await api.score(id, matchId, { scoreA: Number(scoreA), scoreB: Number(scoreB) }); load(); }
    catch (e) { setError(e.message); }
  };

  const undoScore = async (matchId) => {
    try { await api.undoScore(id, matchId); load(); }
    catch (e) { setError(e.message); }
  };

  const adminAddPlayer = async (userId) => {
    try { await api.adminRegisterUser(id, userId); load(); }
    catch (e) { setError(e.message); }
  };

  const adminRemovePlayer = async (userId) => {
    try { await api.adminRemoveReg(id, userId); load(); }
    catch (e) { setError(e.message); }
  };

  const unregisteredPlayers = players.filter(
    (p) => !t.registrations.some((r) => r.userId === p.id)
  );

  const rounds = {};
  t.matches.forEach((m) => {
    const key = `${m.stage}-${m.round}`;
    (rounds[key] ||= []).push(m);
  });

  const { mutualPairs, oneSided, solo } = categorise(t.registrations);

  return (
    <div className="container">
      {/* Header */}
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <span className="tag">{sport.icon} {sport.label}</span>
        <span className="tag" style={{ color: '#94a3b8' }}>·</span>
        <span className="tag">{FORMAT_LABELS[t.format] ?? t.format}</span>
      </div>
      <h1>{t.name}</h1>
      <div className="row" style={{ marginBottom: 28, gap: 10 }}>
        <span className={`badge status-${t.status}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
        <span className="muted" style={{ fontSize: '0.83rem' }}>
          {t.registrations.length} Anmeldungen
          {t.format !== 'AMERICANO' && ` · ${t.teams.length} Teams`}
          {t.format === 'AMERICANO' && t.config?.numRounds && ` · ${t.config.numRounds} Runden`}
        </span>
        {minPlayers > 0 && (
          <span className="muted" style={{ fontSize: '0.83rem' }}>
            · Mindest: {minPlayers}
          </span>
        )}
      </div>

      {/* ── Registration (all users) ───────────────────── */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Anmeldung</h2>
        {myReg ? (
          <p className="success">
            Du bist angemeldet
            {myReg.desiredPartnerId
              ? ` · Wunschpartner: ${playerName(myReg.desiredPartnerId)}`
              : ''}.
          </p>
        ) : (
          <p className="muted">Du bist noch nicht für dieses Turnier angemeldet.</p>
        )}
        {t.status === 'DRAFT' && (
          <>
            {/* Per-tournament skill level (not relevant for Americano) */}
            {allowSkill && t.format !== 'AMERICANO' && (
              <>
                <label>Dein Skill-Level für dieses Turnier ({sport.label})</label>
                <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
                  <option value="ASSOCIATE">Associate</option>
                  <option value="CONSULTANT">Consultant</option>
                  <option value="EXPERT">Expert</option>
                </select>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  Dein Level wird für das Team-Matching in diesem Turnier verwendet.
                </p>
              </>
            )}
            {t.format !== 'AMERICANO' && (
              <>
                <label>Wunschpartner (optional)</label>
                <select value={partner} onChange={(e) => setPartner(e.target.value)}>
                  <option value="">— Kein Wunschpartner —</option>
                  {players.filter((p) => p.id !== user.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
                  Ein Team entsteht nur, wenn ihr euch <strong>gegenseitig</strong> als Partner wählt.
                  Andernfalls erfolgt automatisches Matching nach Level.
                </p>
              </>
            )}
            {t.format === 'AMERICANO' && (
              <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8 }}>
                Beim Americano werden Partner und Gegner jede Runde automatisch neu gemischt.
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={doRegister}>
                {myReg ? 'Anmeldung aktualisieren' : 'Jetzt anmelden'}
              </button>
            </div>
          </>
        )}
        {msg   && <div className="success">{msg}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {/* ── Admin: Turnierleitung ──────────────────────── */}
      {isAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Turnierleitung</h2>
          <div className="row">
            {t.format !== 'AMERICANO' && (
              <button className="btn-primary btn-sm" onClick={formTeams}
                disabled={t.registrations.length < 2}>
                Teams auslosen
              </button>
            )}
            <button
              className={t.format === 'AMERICANO' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
              onClick={generate}
              disabled={t.format === 'AMERICANO' ? t.registrations.length < 4 : t.teams.length < 2}
            >
              Spielplan erstellen
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
            {t.format === 'AMERICANO'
              ? 'Generiert den Spielplan direkt aus den Anmeldungen – Teams rotieren jede Runde. Mindestens 4 Spieler erforderlich.'
              : '„Teams auslosen" respektiert gegenseitige Wunschpartner und gleicht den Rest nach Level aus.'}
          </p>

          {/* Danger zone */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <DeleteTournament tournamentId={id} name={t.name} onDeleted={() => nav('/')} />
          </div>
        </div>
      )}

      {/* ── Admin: Registration overview ──────────────── */}
      {isAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Anmeldungsübersicht</h2>

          {/* Progress bar */}
          {minPlayers > 0 && (
            <RegistrationProgress current={t.registrations.length} min={minPlayers} />
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <StatChip label="Angemeldet"   value={t.registrations.length} />
            <StatChip label="Wunschpaare"  value={mutualPairs.length} color="var(--success)" />
            <StatChip label="Offen"        value={oneSided.length}    color="#d97706" />
            <StatChip label="Ohne Partner" value={solo.length}        />
          </div>

          {t.registrations.length === 0 && (
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 16, textAlign: 'center' }}>
              Noch keine Anmeldungen.
            </p>
          )}

          {/* Mutual pairs */}
          {mutualPairs.length > 0 && (
            <>
              <SectionHeader icon="🟢" label="Gegenseitige Wunschpaare" count={mutualPairs.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mutualPairs.map(([a, b]) => (
                  <div key={a.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PlayerChip reg={a} onRemove={() => adminRemovePlayer(a.userId)} />
                    <span style={{ fontSize: '1rem', color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>↔</span>
                    <PlayerChip reg={b} onRemove={() => adminRemovePlayer(b.userId)} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* One-sided wishes */}
          {oneSided.length > 0 && (
            <>
              <SectionHeader icon="🟡" label="Einseitige Wünsche" count={oneSided.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {oneSided.map((reg) => {
                  const partnerIsRegistered = t.registrations.some(r => r.userId === reg.desiredPartnerId);
                  return (
                    <div key={reg.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <PlayerChip reg={reg} onRemove={() => adminRemovePlayer(reg.userId)} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        → wünscht
                      </span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 10,
                        background: partnerIsRegistered ? '#fef9c3' : '#f8fafc',
                        border: `1px solid ${partnerIsRegistered ? '#fde68a' : 'var(--border)'}`,
                        fontSize: '0.85rem', fontWeight: 600,
                      }}>
                        <span>{playerName(reg.desiredPartnerId)}</span>
                        <span style={{ fontSize: '0.72rem', color: partnerIsRegistered ? '#d97706' : 'var(--text-light)' }}>
                          {partnerIsRegistered ? 'hat nicht zurückgewählt' : 'nicht angemeldet'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Solo registrations */}
          {solo.length > 0 && (
            <>
              <SectionHeader icon="⚪" label="Ohne Wunschpartner" count={solo.length} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {solo.map((reg) => (
                  <PlayerChip key={reg.userId} reg={reg} onRemove={() => adminRemovePlayer(reg.userId)} />
                ))}
              </div>
            </>
          )}

          {/* Admin: add player */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <AdminAddPlayer unregistered={unregisteredPlayers} onAdd={adminAddPlayer} />
          </div>
        </div>
      )}

      {/* ── Americano view ────────────────────────────── */}
      {t.format === 'AMERICANO' && (
        <AmericanoView t={t} isAdmin={isAdmin} onSave={saveScore} onUndo={undoScore} tournamentId={id} onReload={load} />
      )}

      {/* ── Teams (classic formats only) ─────────────── */}
      {t.format !== 'AMERICANO' && t.teams.length > 0 && (
        <>
          <h2>Teams</h2>
          {t.teams.map((team) => (
            <div key={team.id} className="team-card">
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{team.name}</span>
                {team.manual && <span className="badge skill-ASSOCIATE">Wunschteam</span>}
              </div>
              <span className="skill-sum">Σ {team.totalSkill}</span>
            </div>
          ))}
        </>
      )}

      {/* ── Spielplan / Bracket (classic formats only) ── */}
      {t.format !== 'AMERICANO' && t.matches.length > 0 && (
        <>
          <h2>Spielplan</h2>
          {t.format === 'KNOCKOUT' ? (
            <div className="bracket">
              {Object.entries(rounds).map(([key, ms]) => (
                <div key={key} className="round-col">
                  <div className="round-title">Runde {ms[0].round}</div>
                  {ms.map((m) => (
                    <MatchRow key={m.id} m={m} teamName={teamName} isAdmin={isAdmin} onSave={saveScore} onUndo={undoScore} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            t.matches.map((m) => (
              <MatchRow key={m.id} m={m} teamName={teamName} isAdmin={isAdmin} onSave={saveScore} onUndo={undoScore} showGroup />
            ))
          )}
        </>
      )}
    </div>
  );
}

/* ─── Admin: add player to tournament ────────────────── */
function AdminAddPlayer({ unregistered, onAdd }) {
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding]         = useState(false);

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    await onAdd(Number(selectedId));
    setSelectedId('');
    setAdding(false);
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
        Spieler anmelden
      </div>
      <div className="row" style={{ gap: 8 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ flex: 1 }}
          disabled={unregistered.length === 0}
        >
          <option value="">
            {unregistered.length === 0 ? '— Alle Benutzer bereits angemeldet —' : '— Spieler auswählen —'}
          </option>
          {unregistered.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          className="btn-primary btn-sm"
          onClick={handleAdd}
          disabled={!selectedId || adding}
        >
          {adding ? '…' : 'Anmelden'}
        </button>
      </div>
    </div>
  );
}

/* ─── Stat chip ───────────────────────────────────────── */
function StatChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 18px', borderRadius: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
      minWidth: 80,
    }}>
      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: color ?? 'var(--sf-digital)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Delete tournament ───────────────────────────────── */
function DeleteTournament({ tournamentId, name, onDeleted }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');

  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteTournament(tournamentId); onDeleted(); }
    catch (e) { setErr(e.message); setConfirm(false); }
    finally { setBusy(false); }
  };

  if (!confirm) {
    return (
      <div className="row" style={{ gap: 10 }}>
        <button
          className="btn-sm"
          style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
          onClick={() => setConfirm(true)}
        >
          Turnier löschen
        </button>
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          Löscht alle Teams, Matches und Anmeldungen unwiderruflich.
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: 14, borderRadius: 10,
      background: '#fff5f5', border: '1px solid #fecaca',
    }}>
      <p style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 10, color: '#dc2626' }}>
        „{name}" wirklich löschen? Alle Daten gehen verloren.
      </p>
      {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn-sm"
          style={{ background: '#dc2626', color: '#fff', border: 'none' }}
          onClick={doDelete}
          disabled={busy}
        >
          {busy ? 'Wird gelöscht…' : 'Endgültig löschen'}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setConfirm(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AMERICANO components
══════════════════════════════════════════════════════════ */

function computeAmericanoStandings(t) {
  const timeBasedGame  = t.config?.timeBasedGame ?? false;
  const pointsForWin   = t.config?.pointsForWin  ?? 2;
  const pointsForDraw  = t.config?.pointsForDraw  ?? 1;
  const pointsForWinPB = t.config?.pointsForWinPB;
  const useTournamentPointsPB = !timeBasedGame && pointsForWinPB != null;

  const players = {};
  t.registrations.forEach((r) => {
    players[r.userId] = {
      userId: r.userId, name: r.user.name,
      roundsPlayed: 0, byes: 0, totalPoints: 0,
      wins: 0, draws: 0, losses: 0,
    };
  });

  (t.config?.americanoRounds ?? []).forEach((ar) => {
    (ar.sittingOut ?? []).forEach((uid) => {
      if (players[uid]) players[uid].byes++;
    });
  });

  t.matches.filter((m) => m.stage === 'ROUND_ROBIN').forEach((m) => {
    if (m.scoreA == null) return;
    const tA = t.teams.find((x) => x.id === m.teamAId);
    const tB = t.teams.find((x) => x.id === m.teamBId);

    if (timeBasedGame) {
      const isDraw = m.scoreA === m.scoreB;
      const aWon   = m.scoreA > m.scoreB;
      (tA?.playerIds ?? []).forEach((uid) => {
        if (!players[uid]) return;
        players[uid].roundsPlayed++;
        if (isDraw)    { players[uid].draws++;  players[uid].totalPoints += pointsForDraw; }
        else if (aWon) { players[uid].wins++;   players[uid].totalPoints += pointsForWin; }
        else           { players[uid].losses++; }
      });
      (tB?.playerIds ?? []).forEach((uid) => {
        if (!players[uid]) return;
        players[uid].roundsPlayed++;
        if (isDraw)     { players[uid].draws++;  players[uid].totalPoints += pointsForDraw; }
        else if (!aWon) { players[uid].wins++;   players[uid].totalPoints += pointsForWin; }
        else            { players[uid].losses++; }
      });
    } else if (useTournamentPointsPB) {
      const aWon = m.scoreA > m.scoreB;
      (tA?.playerIds ?? []).forEach((uid) => {
        if (!players[uid]) return;
        players[uid].roundsPlayed++;
        if (aWon) { players[uid].wins++;   players[uid].totalPoints += pointsForWinPB; }
        else       { players[uid].losses++; }
      });
      (tB?.playerIds ?? []).forEach((uid) => {
        if (!players[uid]) return;
        players[uid].roundsPlayed++;
        if (!aWon) { players[uid].wins++;   players[uid].totalPoints += pointsForWinPB; }
        else        { players[uid].losses++; }
      });
    } else {
      (tA?.playerIds ?? []).forEach((uid) => {
        if (players[uid]) { players[uid].totalPoints += m.scoreA; players[uid].roundsPlayed++; }
      });
      (tB?.playerIds ?? []).forEach((uid) => {
        if (players[uid]) { players[uid].totalPoints += m.scoreB; players[uid].roundsPlayed++; }
      });
    }
  });

  return Object.values(players)
    .sort((a, b) => b.totalPoints - a.totalPoints || b.roundsPlayed - a.roundsPlayed)
    .map((p, i) => ({ ...p, position: i + 1 }));
}

/* ─── Container ───────────────────────────────────────── */
function AmericanoView({ t, isAdmin, onSave, onUndo, tournamentId, onReload }) {
  const [showResults, setShowResults] = useState(false);
  const [startingFinals, setStartingFinals] = useState(false);
  const [finalsError, setFinalsError] = useState('');
  const standings     = computeAmericanoStandings(t);
  const aroundsMeta   = t.config?.americanoRounds ?? [];
  const winScore      = t.config?.winScore ?? 11;
  const hidden        = t.config?.hideStandings ?? false;
  const timeBasedGame = t.config?.timeBasedGame ?? false;
  const allowDraw     = t.config?.allowDraw ?? true;
  const onlyWinner    = t.config?.onlyWinner ?? false;
  const pointsForWinPB = t.config?.pointsForWinPB;

  const preliminaryMatches = t.matches.filter((m) => m.stage === 'ROUND_ROBIN');
  const playoffMatches = t.matches.filter((m) => m.stage === 'KNOCKOUT');
  const preliminaryDone = preliminaryMatches.length > 0 && preliminaryMatches.every((m) => m.scoreA != null);
  const finalsStarted = playoffMatches.length > 0;

  const matchesByRound = {};
  preliminaryMatches.forEach((m) => { (matchesByRound[m.round] ||= []).push(m); });

  const startFinals = async () => {
    setFinalsError('');
    setStartingFinals(true);
    try {
      await api.startAmericanoFinals(tournamentId, standings.slice(0, 4).map((s) => s.userId));
      onReload();
    } catch (e) {
      setFinalsError(e.message);
    } finally {
      setStartingFinals(false);
    }
  };

  const toggleHide = async () => {
    try { await api.toggleStandings(tournamentId, !hidden); onReload(); }
    catch (_) {}
  };

  return (
    <>
      {/* Standings – with admin toggle */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🏅 Rangliste</h2>
          {isAdmin && (
            <button
              className="btn-ghost btn-sm"
              onClick={toggleHide}
              style={hidden ? { background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a' } : {}}
            >
              {hidden ? '🙈 Verborgen – anzeigen' : '👁 Sichtbar – verbergen'}
            </button>
          )}
        </div>

        {(!hidden || isAdmin) ? (
          <AmericanoStandings standings={standings} dimmed={hidden && isAdmin} timeBasedGame={timeBasedGame} onlyWinner={onlyWinner} pointsForWinPB={pointsForWinPB} />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🙈</div>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              Die Rangliste wird nach dem Turnier veröffentlicht.
            </p>
          </div>
        )}
      </div>

      {aroundsMeta.length === 0 && t.matches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎾</div>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Spielplan noch nicht erstellt. Sobald genug Spieler angemeldet sind, klicke auf „Spielplan erstellen".
          </p>
        </div>
      )}
      {aroundsMeta.map((ar) => (
        <AmericanoRoundCard
          key={ar.round}
          roundNum={ar.round}
          matches={matchesByRound[ar.round] ?? []}
          sittingOut={ar.sittingOut ?? []}
          teams={t.teams}
          registrations={t.registrations}
          isAdmin={isAdmin}
          winScore={winScore}
          onSave={onSave}
          onUndo={onUndo}
          timeBasedGame={timeBasedGame}
          allowDraw={allowDraw}
          onlyWinner={onlyWinner}
        />
      ))}

      {finalsStarted && (
        <AmericanoFinals
          matches={playoffMatches}
          teams={t.teams}
          isAdmin={isAdmin}
          onSave={onSave}
          onUndo={onUndo}
          winScore={winScore}
          timeBasedGame={timeBasedGame}
          allowDraw={allowDraw}
          onlyWinner={onlyWinner}
        />
      )}

      {preliminaryDone && (
        <div className="americano-finish-actions">
          <div>
            <span className="tag">Americano abgeschlossen</span>
            <h2 style={{ margin: 0 }}>Zeit für die Entscheidung</h2>
          </div>
          <div className="americano-finish-buttons">
            <button className="btn-primary" onClick={() => setShowResults(true)}>🏆 Ergebnis anzeigen</button>
            {isAdmin && !finalsStarted && (
              <button className="btn-ghost" onClick={startFinals} disabled={startingFinals || standings.length < 4}>
                {startingFinals ? 'Wird erstellt…' : '🎾 Finalrunde starten'}
              </button>
            )}
          </div>
          {finalsError && <div className="error" style={{ width: '100%' }}>{finalsError}</div>}
        </div>
      )}

      {showResults && (
        <ResultsCelebration
          tournamentName={t.name}
          standings={standings}
          playoffMatches={playoffMatches}
          teams={t.teams}
          onClose={() => setShowResults(false)}
        />
      )}
    </>
  );
}

/* ─── Americano playoffs ─────────────────────────────── */
function AmericanoFinals({ matches, teams, isAdmin, onSave, onUndo, winScore, timeBasedGame, allowDraw, onlyWinner }) {
  const teamName = (id) => teams.find((team) => team.id === id)?.name ?? '';
  const semifinals = matches.filter((m) => m.round === 1).sort((a, b) => a.slot - b.slot);
  const final = matches.find((m) => m.round === 2 && m.slot === 0);
  const third = matches.find((m) => m.round === 2 && m.slot === 1);

  const playoffMatch = (m, label) => m && (
    <div key={m.id} className="americano-playoff-match">
      <div className="americano-playoff-label">{label}</div>
      {!m.teamAId || !m.teamBId ? (
        <div className="americano-playoff-pending">Wartet auf die Halbfinal-Ergebnisse…</div>
      ) : (
        <AmericanoMatchRow
          courtNum=""
          courtLabel={label}
          m={m}
          teamALabel={teamName(m.teamAId)}
          teamBLabel={teamName(m.teamBId)}
          isAdmin={isAdmin}
          winScore={winScore}
          onSave={onSave}
          onUndo={onUndo}
          timeBasedGame={timeBasedGame}
          allowDraw={allowDraw}
          onlyWinner={onlyWinner}
        />
      )}
    </div>
  );

  return (
    <section className="americano-finals-card">
      <div className="americano-finals-heading">
        <div className="americano-finals-icon">🏆</div>
        <div>
          <span className="tag">Top 4</span>
          <h2 style={{ margin: 0 }}>Finalrunde</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: '0.84rem' }}>1. gegen 4. und 2. gegen 3.</p>
        </div>
      </div>
      <div className="americano-playoff-grid">
        <div>
          <h3>Halbfinale</h3>
          {semifinals.map((m, i) => playoffMatch(m, `Halbfinale ${i + 1}`))}
        </div>
        <div>
          <h3>Platzierungsspiele</h3>
          {playoffMatch(final, 'Finale')}
          {playoffMatch(third, 'Spiel um Platz 3')}
        </div>
      </div>
    </section>
  );
}

function ResultsCelebration({ tournamentName, standings, playoffMatches, teams, onClose }) {
  useEffect(() => {
    const closeOnEscape = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const teamPlayer = (teamId) => {
    const playerId = teams.find((team) => team.id === teamId)?.playerIds?.[0];
    return standings.find((entry) => entry.userId === playerId);
  };
  const winnerAndLoser = (match) => {
    if (!match || match.scoreA == null || match.scoreA === match.scoreB) return null;
    return match.scoreA > match.scoreB
      ? [teamPlayer(match.teamAId), teamPlayer(match.teamBId)]
      : [teamPlayer(match.teamBId), teamPlayer(match.teamAId)];
  };

  const finalResult = winnerAndLoser(playoffMatches.find((m) => m.round === 2 && m.slot === 0));
  const thirdResult = winnerAndLoser(playoffMatches.find((m) => m.round === 2 && m.slot === 1));
  const podium = finalResult && thirdResult
    ? [finalResult[0], finalResult[1], thirdResult[0]]
    : standings.slice(0, 3);
  const podiumByVisualOrder = [
    { place: 2, entry: podium[1], medal: '🥈' },
    { place: 1, entry: podium[0], medal: '🥇' },
    { place: 3, entry: podium[2], medal: '🥉' },
  ];

  return (
    <div className="results-celebration" role="dialog" aria-modal="true" aria-label="Turnierergebnis">
      <div className="celebration-glow" />
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <i key={i} style={{
            '--i': i,
            '--x': `${(i * 29) % 100}%`,
            '--delay': `${(i % 9) * 0.12}s`,
            '--duration': `${3 + (i % 5) * 0.35}s`,
            '--drift': `${((i % 7) - 3) * 12}px`,
          }} />
        ))}
      </div>
      <button className="celebration-close" onClick={onClose} aria-label="Ergebnis schließen">✕</button>
      <div className="celebration-brand">
        <img src="/fivy.svg" alt="Salesfive" />
        <div><strong>Salesfive</strong><span>Tournaments</span></div>
      </div>
      <div className="celebration-title">
        <span>Americano Champions</span>
        <h1>{tournamentName}</h1>
      </div>
      <div className="celebration-podium">
        {podiumByVisualOrder.map(({ place, entry, medal }) => (
          <div key={place} className={`podium-place podium-place-${place}`}>
            <div className="podium-medal">{medal}</div>
            <div className="podium-name">{entry?.name ?? '—'}</div>
            <div className="podium-score">{entry?.totalPoints ?? 0} Punkte</div>
            <div className="podium-block"><strong>{place}</strong><span>PLATZ</span></div>
          </div>
        ))}
      </div>
      <button className="celebration-done" onClick={onClose}>Zurück zum Turnier</button>
    </div>
  );
}

/* ─── Standings table ─────────────────────────────────── */
function AmericanoStandings({ standings, dimmed = false, timeBasedGame = false, onlyWinner = false, pointsForWinPB }) {
  const hasData = standings.some((s) => s.totalPoints > 0 || s.byes > 0 || s.roundsPlayed > 0);
  const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

  const useTournamentPointsPB = !timeBasedGame && pointsForWinPB != null;
  const showWinLoss = timeBasedGame || useTournamentPointsPB;
  const showDraws = timeBasedGame && !onlyWinner;

  const cols = showWinLoss
    ? [
        { k: 'pos',    l: 'Pos',     align: 'center' },
        { k: 'name',   l: 'Spieler',  align: 'left'   },
        { k: 'rounds', l: 'Runden',   align: 'center' },
        { k: 'byes',   l: 'Pausen',   align: 'center' },
        { k: 'wins',   l: 'Siege',    align: 'center' },
        ...(showDraws ? [{ k: 'draws', l: 'Unent.', align: 'center' }] : []),
        { k: 'losses', l: 'Niederl.', align: 'center' },
        { k: 'pts',    l: 'T.Pkte',   align: 'center' },
      ]
    : [
        { k: 'pos',    l: 'Pos',    align: 'center' },
        { k: 'name',   l: 'Spieler', align: 'left'  },
        { k: 'rounds', l: 'Runden',  align: 'center' },
        { k: 'byes',   l: 'Pausen',  align: 'center' },
        { k: 'pts',    l: 'Punkte',  align: 'center' },
      ];

  return (
    <div style={{ opacity: dimmed ? 0.45 : 1, transition: 'opacity 0.2s' }}>
      {!hasData && standings.length > 0 && (
        <p className="muted" style={{ fontSize: '0.85rem', textAlign: 'center', paddingBottom: 8 }}>
          Noch keine Ergebnisse – Rangliste wird nach dem ersten eingetragenen Ergebnis aktualisiert.
        </p>
      )}
      {standings.length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem', textAlign: 'center', paddingBottom: 8 }}>
          Noch keine Anmeldungen.
        </p>
      )}
      {standings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {cols.map(({ k, l, align }) => (
                  <th key={k} style={{
                    padding: '7px 10px', textAlign: align,
                    fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: 'var(--text-muted)',
                    borderBottom: '2px solid var(--border)',
                  }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.userId} style={{
                  background: i === 0 && hasData ? '#eef2ff' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, fontSize: '1rem' }}>
                    {medal(i) && hasData ? medal(i) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.position}</span>}
                  </td>
                  <td style={{ padding: '9px 10px', fontWeight: 700 }}>{s.name}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.roundsPlayed}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.byes}</td>
                  {showWinLoss && (
                    <>
                      <td style={{ padding: '9px 10px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{s.wins}</td>
                      {showDraws && <td style={{ padding: '9px 10px', textAlign: 'center', color: '#d97706', fontWeight: 700 }}>{s.draws}</td>}
                      <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.losses}</td>
                    </>
                  )}
                  <td style={{
                    padding: '9px 10px', textAlign: 'center',
                    fontWeight: 900, fontSize: '1.05rem',
                    color: i === 0 && hasData ? 'var(--sf-digital)' : 'var(--text)',
                  }}>{s.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Single round card ───────────────────────────────── */
function AmericanoRoundCard({ roundNum, matches, sittingOut, teams, registrations, isAdmin, winScore, onSave, onUndo, timeBasedGame = false, allowDraw = true, onlyWinner = false }) {
  const pName = (uid) => registrations.find((r) => r.userId === uid)?.user?.name ?? `#${uid}`;
  const teamLabel = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    return (team?.playerIds ?? []).map(pName).join(' & ');
  };

  const played = matches.filter((m) => m.scoreA != null).length;
  const allDone = matches.length > 0 && played === matches.length;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Round header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: allDone ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0051D4, #0025D1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
          }}>
            {allDone ? '✓' : roundNum}
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.97rem' }}>Runde {roundNum}</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: allDone ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
          {played}/{matches.length} gespielt
        </span>
      </div>

      {/* Match rows */}
      {matches.map((m, i) => (
        <AmericanoMatchRow
          key={m.id}
          courtNum={i + 1}
          m={m}
          teamALabel={teamLabel(m.teamAId)}
          teamBLabel={teamLabel(m.teamBId)}
          isAdmin={isAdmin}
          winScore={winScore}
          onSave={onSave}
          onUndo={onUndo}
          timeBasedGame={timeBasedGame}
          allowDraw={allowDraw}
          onlyWinner={onlyWinner}
        />
      ))}

      {/* Sitting out */}
      {sittingOut.length > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: 'var(--bg)', borderRadius: 8,
          fontSize: '0.82rem', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⏸</span>
          <span><strong>Pausiert:</strong> {sittingOut.map(pName).join(', ')}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Single match row (winner-selection UI) ─────────── */
function AmericanoMatchRow({ courtNum, courtLabel = 'Court', m, teamALabel, teamBLabel, isAdmin, winScore = 11, onSave, onUndo, timeBasedGame = false, allowDraw = true, onlyWinner = false }) {
  // Points-based state
  const [winner, setWinner]         = useState(null);
  const [loserScore, setLoserScore] = useState('');
  // Time-based state
  const [scoreAInput, setScoreAInput] = useState('');
  const [scoreBInput, setScoreBInput] = useState('');

  const played  = m.scoreA != null;
  const winA    = played && m.scoreA > m.scoreB;
  const winB    = played && m.scoreB > m.scoreA;
  const isDraw  = played && m.scoreA === m.scoreB;

  // Time-based validation
  const scoreANum   = scoreAInput !== '' ? Number(scoreAInput) : NaN;
  const scoreBNum   = scoreBInput !== '' ? Number(scoreBInput) : NaN;
  const bothValid   = !isNaN(scoreANum) && !isNaN(scoreBNum) && scoreANum >= 0 && scoreBNum >= 0
                      && Number.isInteger(scoreANum) && Number.isInteger(scoreBNum);
  const drawBlocked = bothValid && scoreANum === scoreBNum && !allowDraw;

  // Points-based validation
  const loserNum   = loserScore !== '' ? Number(loserScore) : NaN;
  const loserValid = !isNaN(loserNum) && loserNum >= 0 && loserNum < winScore;

  const confirmTime = () => { if (bothValid && !drawBlocked) onSave(m.id, scoreANum, scoreBNum); };
  const confirmPoints = () => {
    if (!loserValid) return;
    if (winner === 'A') onSave(m.id, winScore, loserNum);
    else if (winner === 'B') onSave(m.id, loserNum, winScore);
  };
  const confirmWinner = (side) => {
    if (side === 'A') onSave(m.id, 1, 0);
    else onSave(m.id, 0, 1);
  };

  const TEAM_BTN = (side, label) => {
    const selected = winner === side;
    return (
      <button
        onClick={() => {
          if (onlyWinner) { confirmWinner(side); }
          else { setWinner(side); setLoserScore(''); }
        }}
        style={{
          flex: 1, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
          fontWeight: 700, fontSize: '0.85rem', border: '2px solid',
          transition: 'all 0.12s',
          background: selected ? 'linear-gradient(135deg, #0051D4, #0025D1)' : 'var(--bg)',
          color: selected ? '#fff' : 'var(--text)',
          borderColor: selected ? 'var(--sf-digital)' : 'var(--border)',
          textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {onlyWinner && <span aria-hidden="true" style={{ marginRight: 6 }}>🏆</span>}
        {label || '—'}
        {selected && <span style={{ marginLeft: 6, opacity: 0.8 }}>✓</span>}
      </button>
    );
  };

  const scoreColor = isDraw ? '#d97706' : 'var(--sf-digital)';

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: 'var(--bg)', marginBottom: 8,
      border: `1px solid ${played ? 'var(--border)' : (winner || bothValid) ? 'var(--sf-blue-4)' : 'var(--border)'}`,
    }}>
      {/* Court label + teams */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-light)',
          textTransform: 'uppercase', letterSpacing: '0.06em', width: 46, flexShrink: 0, textAlign: 'center',
        }}>
          {courtLabel}{courtNum !== '' && <><br />{courtNum}</>}
        </span>

        {played ? (
          /* ── Result display ── */
          onlyWinner ? (
            <>
              <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', textAlign: 'right',
                color: winA ? 'var(--sf-digital)' : 'var(--text-muted)',
                textDecoration: !winA ? 'line-through' : 'none' }}>
                {teamALabel || '—'}
              </div>
              <div style={{ flexShrink: 0, minWidth: 40, textAlign: 'center', color: 'var(--text-light)', fontWeight: 800, fontSize: '0.8rem' }}>
                vs
              </div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem',
                color: winB ? 'var(--sf-digital)' : 'var(--text-muted)',
                textDecoration: !winB ? 'line-through' : 'none' }}>
                {teamBLabel || '—'}
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', textAlign: 'right',
                color: winA ? 'var(--sf-digital)' : isDraw ? 'var(--text)' : 'var(--text-muted)',
                textDecoration: (!winA && !isDraw) ? 'line-through' : 'none' }}>
                {teamALabel || '—'}
              </div>
              <div style={{ flexShrink: 0, minWidth: 54, textAlign: 'center' }}>
                <span style={{ fontWeight: 900, fontSize: '1.05rem', color: scoreColor }}>
                  {m.scoreA} : {m.scoreB}
                </span>
                {isDraw && (
                  <div style={{ fontSize: '0.6rem', color: '#d97706', fontWeight: 800, letterSpacing: '0.04em', marginTop: 1 }}>
                    UNENTSCHIEDEN
                  </div>
                )}
              </div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem',
                color: winB ? 'var(--sf-digital)' : isDraw ? 'var(--text)' : 'var(--text-muted)',
                textDecoration: (!winB && !isDraw) ? 'line-through' : 'none' }}>
                {teamBLabel || '—'}
              </div>
            </>
          )
        ) : isAdmin && timeBasedGame && !onlyWinner ? (
          /* ── Time-based: direct score entry ── */
          <>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>
              {teamALabel || '—'}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" min="0"
                value={scoreAInput}
                onChange={(e) => setScoreAInput(e.target.value)}
                style={{ width: 54, padding: '6px 4px', textAlign: 'center', fontSize: '0.9rem' }}
                placeholder="0"
              />
              <span style={{ fontWeight: 800, color: 'var(--text-light)', fontSize: '0.9rem' }}>:</span>
              <input
                type="number" min="0"
                value={scoreBInput}
                onChange={(e) => setScoreBInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && bothValid && !drawBlocked && confirmTime()}
                style={{ width: 54, padding: '6px 4px', textAlign: 'center', fontSize: '0.9rem' }}
                placeholder="0"
              />
            </div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>
              {teamBLabel || '—'}
            </div>
          </>
        ) : isAdmin ? (
          /* ── Winner selection (points-based or onlyWinner mode) ── */
          <>
            {TEAM_BTN('A', teamALabel)}
            <span style={{ color: 'var(--text-light)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>vs</span>
            {TEAM_BTN('B', teamBLabel)}
          </>
        ) : (
          /* ── Player view ── */
          <>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', textAlign: 'right' }}>{teamALabel || '—'}</div>
            <span style={{ color: 'var(--text-light)', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }}>vs</span>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem' }}>{teamBLabel || '—'}</div>
          </>
        )}
      </div>

      {/* Undo result */}
      {played && isAdmin && onUndo && (
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <button
            className="btn-ghost btn-sm"
            onClick={() => onUndo(m.id)}
            style={{ fontSize: '0.72rem', opacity: 0.65, padding: '2px 8px' }}
            title="Ergebnis rückgängig machen"
          >
            ↩ Rückgängig
          </button>
        </div>
      )}

      {/* Time-based: confirm / draw-blocked warning */}
      {!played && isAdmin && timeBasedGame && bothValid && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {drawBlocked ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>
              Unentschieden nicht erlaubt – bitte Finalpunkt ausspielen.
            </span>
          ) : (
            <button className="btn-primary btn-sm" onClick={confirmTime}>Bestätigen</button>
          )}
          <button className="btn-ghost btn-sm" onClick={() => { setScoreAInput(''); setScoreBInput(''); }}>
            Zurücksetzen
          </button>
        </div>
      )}

      {/* Points-based: loser score input */}
      {!played && isAdmin && !timeBasedGame && !onlyWinner && winner && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            Punkte {winner === 'A' ? teamBLabel : teamALabel}:
          </span>
          <input
            type="number" min="0" max={winScore - 1}
            autoFocus
            value={loserScore}
            onChange={(e) => setLoserScore(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loserValid && confirmPoints()}
            style={{ width: 70, padding: '6px 8px', textAlign: 'center', fontSize: '0.9rem' }}
            placeholder={`0 – ${winScore - 1}`}
          />
          <button className="btn-primary btn-sm" onClick={confirmPoints} disabled={!loserValid}>
            Bestätigen
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { setWinner(null); setLoserScore(''); }}>
            Abbrechen
          </button>
          {loserScore !== '' && !loserValid && (
            <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>
              Muss zwischen 0 und {winScore - 1} liegen
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Match row (classic formats) ────────────────────── */
function MatchRow({ m, teamName, isAdmin, onSave, onUndo, showGroup }) {
  const [a, setA] = useState(m.scoreA ?? '');
  const [b, setB] = useState(m.scoreB ?? '');
  const played = m.scoreA != null;
  const winA   = played && m.winnerTeamId === m.teamAId;
  const winB   = played && m.winnerTeamId === m.teamBId;

  return (
    <div className="match">
      <div className={`team-name ${winA ? 'match-winner' : ''}`}>
        {showGroup && m.groupName && (
          <span className="badge skill-CONSULTANT" style={{ marginRight: 6, marginBottom: 2, display: 'inline-flex' }}>
            Gr.&nbsp;{m.groupName}
          </span>
        )}
        {teamName(m.teamAId)}
      </div>
      <div className="center">
        {played ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="score">{m.scoreA} : {m.scoreB}</span>
            {isAdmin && onUndo && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => onUndo(m.id)}
                style={{ fontSize: '0.72rem', opacity: 0.65, padding: '2px 6px' }}
                title="Ergebnis rückgängig machen"
              >↩</button>
            )}
          </div>
        ) : isAdmin && m.teamAId && m.teamBId ? (
          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <input style={{ width: 50, padding: '6px 8px', textAlign: 'center' }} value={a} onChange={(e) => setA(e.target.value)} />
            <span className="vs">:</span>
            <input style={{ width: 50, padding: '6px 8px', textAlign: 'center' }} value={b} onChange={(e) => setB(e.target.value)} />
            <button className="btn-primary btn-sm" onClick={() => onSave(m.id, a, b)}>OK</button>
          </div>
        ) : (
          <span className="vs">vs</span>
        )}
      </div>
      <div className={`team-name ${winB ? 'match-winner' : ''}`} style={{ textAlign: 'right' }}>
        {teamName(m.teamBId)}
      </div>
    </div>
  );
}
