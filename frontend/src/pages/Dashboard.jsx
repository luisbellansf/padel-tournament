import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App.jsx';

const FORMATS = [
  { v: 'ROUND_ROBIN',    label: 'Jeder gegen jeden' },
  { v: 'KNOCKOUT',       label: 'K.o.-System'       },
  { v: 'GROUP_KNOCKOUT', label: 'Gruppe + K.o.'     },
  { v: 'AMERICANO',      label: 'Americano'         },
];

const SPORTS = [
  { v: 'PADEL',        label: 'Padel',       icon: '🎾' },
  { v: 'FOOSBALL',     label: 'Tischkicker', icon: '⚽' },
  { v: 'TABLE_TENNIS', label: 'Tischtennis', icon: '🏓' },
  { v: 'DARTS',        label: 'Darts',       icon: '🎯' },
  { v: 'OTHER',        label: 'Sonstiges',   icon: '🏆' },
];

const STATUS_LABELS = {
  DRAFT:        'Entwurf',
  TEAMS_FORMED: 'Teams gebildet',
  RUNNING:      'Laufend',
  FINISHED:     'Beendet',
};

function getSportIcon(config) {
  return SPORTS.find((s) => s.v === config?.sportType)?.icon ?? '🏆';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState({
    name: '', format: 'ROUND_ROBIN', sportType: 'PADEL',
    minPlayers: 8, allowSkill: false,
    // Americano
    winScore: 21, numCourts: 2, fullRotation: false, numRounds: 7, hideStandings: false,
    timeBasedGame: false, pointsForWin: 2, pointsForDraw: 1, allowDraw: true,
    // Group + KO
    numGroups: 2, advancePerGroup: 2,
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api.tournaments().then(setTournaments).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    setCreating(true);
    try {
      const config = {
        sportType:  form.sportType,
        minPlayers: Number(form.minPlayers),
        allowSkill: form.allowSkill,
      };
      if (form.format === 'AMERICANO') {
        config.timeBasedGame = form.timeBasedGame;
        config.numCourts     = Number(form.numCourts);
        config.fullRotation  = form.fullRotation;
        config.hideStandings = form.hideStandings;
        if (!form.timeBasedGame) {
          config.winScore = Number(form.winScore);
        } else {
          config.pointsForWin  = Number(form.pointsForWin);
          config.pointsForDraw = form.allowDraw ? Number(form.pointsForDraw) : 0;
          config.allowDraw     = form.allowDraw;
        }
        if (!form.fullRotation) config.numRounds = Number(form.numRounds);
      }
      if (form.format === 'GROUP_KNOCKOUT') {
        config.numGroups       = Number(form.numGroups);
        config.advancePerGroup = Number(form.advancePerGroup);
      }
      await api.createTournament({ name: form.name, format: form.format, config });
      setForm({ ...form, name: '' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="container">
      <div className="tag">Turnierübersicht</div>
      <h1>Salesfive Tournaments</h1>
      <p className="sub">
        Melde dich für ein Turnier an – mit Wunschpartner oder per automatischem Skill-Matching.
      </p>

      {/* ── Create form (admin only) ─────────────────────── */}
      {isAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Neues Turnier anlegen</h2>
          <div className="grid2">
            <div>
              <label>Turniername</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Padel Summer Cup"
                onKeyDown={(e) => e.key === 'Enter' && form.name.trim() && create()}
              />
            </div>
            <div>
              <label>Sportart</label>
              <select value={form.sportType} onChange={(e) => setForm({ ...form, sportType: e.target.value })}>
                {SPORTS.map((s) => (
                  <option key={s.v} value={s.v}>{s.icon} {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Format</label>
              <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label>Mindestanmeldungen</label>
              <input
                type="number" min="2" max="256"
                value={form.minPlayers}
                onChange={(e) => setForm({ ...form, minPlayers: e.target.value })}
              />
            </div>
            {form.format === 'AMERICANO' && (
              <>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Spielmodus</label>
                  <div className="row" style={{ gap: 8, marginTop: 6 }}>
                    {[{ v: false, l: 'Punktebasiert' }, { v: true, l: 'Zeitbasiert' }].map(({ v, l }) => (
                      <button key={String(v)} type="button"
                        onClick={() => setForm({ ...form, timeBasedGame: v })}
                        style={{
                          padding: '7px 14px', fontSize: '0.82rem', borderRadius: 8,
                          fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: form.timeBasedGame === v
                            ? 'linear-gradient(135deg, #0051D4, #0025D1)' : 'var(--bg)',
                          color: form.timeBasedGame === v ? '#fff' : 'var(--text-muted)',
                          outline: form.timeBasedGame === v ? 'none' : '1px solid var(--border)',
                        }}
                      >{l}</button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                    {form.timeBasedGame
                      ? 'Spiele laufen auf Zeit – Turnierpunkte werden für Sieg/Unentschieden vergeben.'
                      : 'Gewinner ist, wer zuerst die Siegpunktzahl erreicht.'}
                  </p>
                </div>
                {!form.timeBasedGame && (
                  <div>
                    <label>Siegpunkte</label>
                    <input type="number" min="5" max="200" value={form.winScore}
                      onChange={(e) => setForm({ ...form, winScore: e.target.value })} />
                  </div>
                )}
                {form.timeBasedGame && (
                  <div>
                    <label>Turnierpunkte für Sieg</label>
                    <input type="number" min="0" max="99" value={form.pointsForWin}
                      onChange={(e) => setForm({ ...form, pointsForWin: e.target.value })} />
                  </div>
                )}
                <div>
                  <label>Anzahl Courts</label>
                  <input type="number" min="1" max="20" value={form.numCourts}
                    onChange={(e) => setForm({ ...form, numCourts: e.target.value })} />
                </div>
              </>
            )}
            {form.format !== 'AMERICANO' && <div>
              <label>Skill-Eingabe bei Anmeldung</label>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                {[{ v: false, l: 'Nicht erforderlich' }, { v: true, l: 'Spieler wählen Level' }].map(({ v, l }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setForm({ ...form, allowSkill: v })}
                    style={{
                      padding: '7px 14px', fontSize: '0.82rem', borderRadius: 8,
                      fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: form.allowSkill === v
                        ? 'linear-gradient(135deg, #0051D4, #0025D1)'
                        : 'var(--bg)',
                      color: form.allowSkill === v ? '#fff' : 'var(--text-muted)',
                      outline: form.allowSkill === v ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>}
          </div>
          {/* Americano: full-rotation + rounds + hide standings */}
          {form.format === 'AMERICANO' && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Time-based: draw settings */}
              {form.timeBasedGame && (
                <>
                  <div>
                    <label>Unentschieden</label>
                    <div className="row" style={{ gap: 8, marginTop: 6 }}>
                      {[
                        { v: true,  l: 'Erlaubt' },
                        { v: false, l: 'Finalpunkt erforderlich' },
                      ].map(({ v, l }) => (
                        <button key={String(v)} type="button"
                          onClick={() => setForm({ ...form, allowDraw: v })}
                          style={{
                            padding: '7px 14px', fontSize: '0.82rem', borderRadius: 8,
                            fontWeight: 700, cursor: 'pointer', border: 'none',
                            background: form.allowDraw === v
                              ? 'linear-gradient(135deg, #0051D4, #0025D1)' : 'var(--bg)',
                            color: form.allowDraw === v ? '#fff' : 'var(--text-muted)',
                            outline: form.allowDraw === v ? 'none' : '1px solid var(--border)',
                          }}
                        >{l}</button>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                      {form.allowDraw
                        ? 'Gleichstand zählt als Unentschieden.'
                        : 'Bei Gleichstand muss ein Finalpunkt ausgespielt werden.'}
                    </p>
                  </div>
                  {form.allowDraw && (
                    <div>
                      <label>Turnierpunkte für Unentschieden</label>
                      <input type="number" min="0" max="99" value={form.pointsForDraw}
                        onChange={(e) => setForm({ ...form, pointsForDraw: e.target.value })} />
                    </div>
                  )}
                </>
              )}
              {/* Full rotation toggle */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 10,
                background: form.fullRotation ? '#eef2ff' : 'var(--bg)',
                border: `1px solid ${form.fullRotation ? '#c7d2fe' : 'var(--border)'}`,
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={form.fullRotation}
                  onChange={(e) => setForm({ ...form, fullRotation: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0025D1' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: form.fullRotation ? '#0025D1' : 'var(--text)' }}>
                    Volle Rotation
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    Rundenzahl wird beim Generieren automatisch berechnet, sodass jeder einmal mit jedem gespielt hat
                  </div>
                </div>
              </label>
              {/* Manual rounds (only when not full rotation) */}
              {!form.fullRotation && (
                <div>
                  <label>Anzahl Runden</label>
                  <input type="number" min="1" max="50" value={form.numRounds}
                    onChange={(e) => setForm({ ...form, numRounds: e.target.value })} />
                </div>
              )}
              {/* Hide standings */}
              <div>
                <label>Rangliste für Teilnehmer</label>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  {[{ v: false, l: '👁 Sichtbar' }, { v: true, l: '🙈 Verborgen' }].map(({ v, l }) => (
                    <button key={String(v)} type="button"
                      onClick={() => setForm({ ...form, hideStandings: v })}
                      style={{
                        padding: '7px 14px', fontSize: '0.82rem', borderRadius: 8,
                        fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: form.hideStandings === v
                          ? 'linear-gradient(135deg, #0051D4, #0025D1)' : 'var(--bg)',
                        color: form.hideStandings === v ? '#fff' : 'var(--text-muted)',
                        outline: form.hideStandings === v ? 'none' : '1px solid var(--border)',
                      }}
                    >{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {form.format === 'GROUP_KNOCKOUT' && (
            <div className="grid2">
              <div>
                <label>Anzahl Gruppen</label>
                <input
                  type="number" min="2" value={form.numGroups}
                  onChange={(e) => setForm({ ...form, numGroups: e.target.value })}
                />
              </div>
              <div>
                <label>Qualifizierte pro Gruppe</label>
                <input
                  type="number" min="1" value={form.advancePerGroup}
                  onChange={(e) => setForm({ ...form, advancePerGroup: e.target.value })}
                />
              </div>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={create} disabled={creating || !form.name.trim()}>
              {creating ? 'Wird erstellt…' : 'Turnier anlegen'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tournament list ──────────────────────────────── */}
      <h2>Aktuelle Turniere</h2>
      {tournaments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>🏆</div>
          <p className="muted" style={{ fontSize: '0.9rem' }}>Noch keine Turniere vorhanden.</p>
        </div>
      ) : (
        tournaments.map((t) => (
          <TournamentCard
            key={t.id}
            t={t}
            isAdmin={isAdmin}
            onDeleted={load}
          />
        ))
      )}
    </div>
  );
}

function TournamentCard({ t, isAdmin, onDeleted }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const minPlayers = t.config?.minPlayers ?? 0;
  const regCount   = t._count.registrations;
  const pct        = minPlayers > 0 ? Math.min(100, Math.round((regCount / minPlayers) * 100)) : null;
  const needed     = minPlayers > 0 ? Math.max(0, minPlayers - regCount) : 0;
  const reached    = minPlayers === 0 || regCount >= minPlayers;

  const doDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try { await api.deleteTournament(t.id); onDeleted(); }
    catch (e) { setErr(e.message); setConfirm(false); }
    finally { setDeleting(false); }
  };

  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, gap: 0 }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Clickable area */}
        <Link
          to={`/t/${t.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            flex: 1, padding: '14px 20px',
            textDecoration: 'none', color: 'inherit', minWidth: 0,
          }}
        >
          <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>
            {getSportIcon(t.config)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.97rem' }}>{t.name}</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: 3 }}>
              {FORMATS.find((f) => f.v === t.format)?.label}
              {' · '}{regCount} Anmeldungen
              {t.format !== 'AMERICANO' && <>{' · '}{t._count.teams} Teams</>}
              {minPlayers > 0 && !reached && (
                <span style={{ color: '#d97706', marginLeft: 6 }}>
                  · noch {needed} ausstehend
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Right side: badge + admin actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 14px 0', flexShrink: 0 }}>
          <span className={`badge status-${t.status}`}>
            {STATUS_LABELS[t.status] ?? t.status}
          </span>

          {isAdmin && !confirm && (
            <button
              className="btn-sm"
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
              onClick={(e) => { e.preventDefault(); setConfirm(true); }}
              title="Turnier löschen"
            >
              Löschen
            </button>
          )}
          {isAdmin && confirm && (
            <>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                Wirklich löschen?
              </span>
              <button
                className="btn-sm"
                style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                onClick={doDelete}
                disabled={deleting}
              >
                {deleting ? '…' : 'Ja'}
              </button>
              <button className="btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setConfirm(false); }}>
                Nein
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mini progress bar (if minPlayers set) */}
      {pct !== null && (
        <div style={{ padding: '0 20px 12px', borderTop: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              {regCount} / {minPlayers} Anmeldungen
            </span>
            <span style={{ fontSize: '0.73rem', color: reached ? 'var(--success)' : '#d97706', fontWeight: 600 }}>
              {reached ? '✓ Bereit' : `${pct}%`}
            </span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 99,
              background: reached
                ? 'linear-gradient(90deg, #059669, #10b981)'
                : 'linear-gradient(90deg, var(--sf-blue-4), var(--sf-digital))',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {err && <div className="error" style={{ padding: '0 20px 12px', fontSize: '0.82rem' }}>{err}</div>}
    </div>
  );
}
