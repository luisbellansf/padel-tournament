import { useState, Fragment } from 'react';

/* ─── Bracket layout constants ────────────────────────── */
const SLOT_H   = 82;   // first-round slot height (px)
const CARD_W   = 174;  // match-card width (px)
const CONN_W   = 34;   // connector column width (px)
const LABEL_H  = 38;   // round-label height (px)
const NUM_QF   = 4;    // matches in round 1
const NUM_ROUNDS = 3;
const TOTAL_H  = NUM_QF * SLOT_H; // 328 px

const ROUND_NAMES = ['Viertelfinale', 'Halbfinale', 'Finale'];

const DEMO_TEAMS = [
  { name: 'Thunder Hawks',  emoji: '⚡' },
  { name: 'Fire Dragons',   emoji: '🔥' },
  { name: 'Green Giants',   emoji: '💚' },
  { name: 'Solar Flares',   emoji: '☀️' },
  { name: 'Purple Rockets', emoji: '🚀' },
  { name: 'Orange Tigers',  emoji: '🐯' },
  { name: 'Blue Sharks',    emoji: '🦈' },
  { name: 'Pink Panthers',  emoji: '🌸' },
];

/* ══════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════ */
export default function Help() {
  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div className="tag">Dokumentation</div>
      <h1>Hilfe & Übersicht</h1>
      <p className="sub">Alles rund um das Erstellen und Verwalten von Salesfive Turnieren.</p>

      {/* 1 ─ Turnier erstellen */}
      <Section title="Turnier erstellen" icon="➕">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 18, lineHeight: 1.6 }}>
          Nur <strong>Admins</strong> können Turniere anlegen. Öffne die Startseite und folge diesen Schritten:
        </p>
        <Steps steps={[
          { title: 'Formular ausfüllen',      desc: 'Turniername, Sportart, Format und Mindestanmeldungen angeben.' },
          { title: '"Turnier anlegen" klicken', desc: 'Das Turnier erscheint sofort mit dem Status „Entwurf" in der Liste.' },
          { title: 'Anmeldungen sammeln',     desc: 'Spieler melden sich an und können optional einen Wunschpartner angeben.' },
          { title: 'Teams auslosen',          desc: 'Auf der Turnierseite „Teams auslosen" klicken, sobald genug Anmeldungen da sind.' },
          { title: 'Spielplan erstellen',     desc: 'Auf „Spielplan erstellen" klicken – alle Partien werden automatisch generiert.' },
          { title: 'Ergebnisse eintragen',    desc: 'Beim K.o.-System rückt der Sieger automatisch in die nächste Runde vor.' },
        ]} />
      </Section>

      {/* 2 ─ Anmeldung & Teams */}
      <Section title="Anmeldung & Teams" icon="🤝">
        <InfoGrid items={[
          {
            icon: '📝',
            title: 'Anmelden',
            text: 'Jeder Spieler meldet sich direkt auf der Turnierseite an. Eine Anmeldung ist bis zum Auslosen möglich.',
          },
          {
            icon: '💑',
            title: 'Wunschteam',
            text: 'Wählen beide Spieler sich gegenseitig als Partner, wird daraus automatisch ein festes Team gebildet.',
          },
          {
            icon: '⚖️',
            title: 'Skill-Matching',
            text: 'Verbleibende Spieler werden nach Level gematcht: starke und schwache Spieler werden ausgewogen gepaart.',
          },
          {
            icon: '👁️',
            title: 'Admin-Übersicht',
            text: 'Admins sehen in der Anmeldungsübersicht, wer ein gegenseitiges Wunschpaar hat und wer noch offen ist.',
          },
        ]} />
      </Section>

      {/* 3 ─ Turnierformate */}
      <Section title="Turnierformate" icon="🏟️">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))', gap: 14 }}>
          <FormatCard
            badge="Round Robin"
            title="Jeder gegen jeden"
            icon="🔄"
            color="#e0fdf4"
            accent="#059669"
            features={[
              'Jedes Team spielt gegen jedes andere',
              'Maximale Spielpraxis für alle Teilnehmer',
              'Platzierung nach Punkten / Torverhältnis',
              'Ideal für kleine Gruppen (4 – 8 Teams)',
            ]}
          />
          <FormatCard
            badge="Knockout"
            title="K.o.-System"
            icon="⚔️"
            color="#eef2ff"
            accent="#0025D1"
            features={[
              'Eine Niederlage = sofort ausgeschieden',
              'Bracket wird automatisch aufgestellt',
              'Klarer Turniersieger am Ende',
              'Ideal für 4, 8 oder 16 Teams',
            ]}
          />
          <FormatCard
            badge="Group + Knockout"
            title="Gruppe + K.o."
            icon="🏆"
            color="#fef9c3"
            accent="#d97706"
            features={[
              'Zuerst Gruppenphase (Round Robin)',
              'Beste N Teams pro Gruppe kommen weiter',
              'K.o.-Phase ab Viertelfinale oder Halbfinale',
              'Mix aus Sicherheit und Spannung',
            ]}
          />
        </div>
      </Section>

      {/* 4 ─ Interactive bracket */}
      <Section title="Interaktiver K.o.-Turnierbaum" icon="🌳">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>
          Klicke auf ein Team, um es als Sieger eines Spiels festzulegen.
          Sieger rücken automatisch in die nächste Runde vor – genau so funktioniert es im echten Turnier.
        </p>
        <BracketDemo />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Layout helpers
══════════════════════════════════════════════════════════ */

function Section({ title, icon, children }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Steps({ steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '12px 16px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0051D4, #0025D1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.82rem',
          }}>{i + 1}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{s.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          padding: 16, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{item.icon}</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{item.title}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.55 }}>{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function FormatCard({ badge, title, icon, color, accent, features }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ background: color, padding: '16px 18px', borderBottom: `2px solid ${accent}30` }}>
        <div style={{ fontSize: '1.7rem', marginBottom: 8 }}>{icon}</div>
        <div style={{
          fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: accent, marginBottom: 5,
        }}>{badge}</div>
        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{title}</div>
      </div>
      <ul style={{ padding: '14px 18px', margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {features.map((f, i) => (
          <li key={i} style={{ fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Interactive bracket
══════════════════════════════════════════════════════════ */

function BracketDemo() {
  const [results, setResults] = useState({});

  // Recursively resolve which team occupies a given bracket position
  const getTeam = (round, slot, side) => {
    if (round === 0) return DEMO_TEAMS[slot * 2 + side];
    const prevSlot = slot * 2 + side;
    const winner   = results[`${round - 1}-${prevSlot}`];
    if (winner === undefined) return null;
    return getTeam(round - 1, prevSlot, winner);
  };

  const setWinner = (round, slot, side) => {
    setResults((prev) => {
      const next = { ...prev, [`${round}-${slot}`]: side };
      // Clear all results that transitively depend on this match
      const clearDeps = (r, s) => {
        const key = `${r + 1}-${Math.floor(s / 2)}`;
        if (next[key] !== undefined) { delete next[key]; clearDeps(r + 1, Math.floor(s / 2)); }
      };
      clearDeps(round, slot);
      return next;
    });
  };

  const finalResult  = results[`${NUM_ROUNDS - 1}-0`];
  const champion     = finalResult !== undefined ? getTeam(NUM_ROUNDS - 1, 0, finalResult) : null;

  return (
    <div>
      {/* Champion banner */}
      {champion && (
        <div style={{
          padding: '16px 20px', borderRadius: 14, marginBottom: 24,
          background: 'linear-gradient(135deg, #0051D4 0%, #0025D1 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
          boxShadow: '0 4px 20px rgba(0,37,209,0.35)',
        }}>
          <div>
            <div style={{
              fontSize: '0.7rem', fontWeight: 800, opacity: 0.75,
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
            }}>🏆 Turniersieger</div>
            <div style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
              {champion.emoji} {champion.name}
            </div>
          </div>
          <button
            className="btn-sm"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
            onClick={() => setResults({})}
          >
            Neu starten
          </button>
        </div>
      )}

      {/* Bracket */}
      <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', width: 'max-content' }}>

          {Array.from({ length: NUM_ROUNDS }, (_, round) => {
            const numMatches = NUM_QF >> round;        // 4 → 2 → 1
            const slotH      = SLOT_H  << round;       // 82 → 164 → 328
            const hasConn    = round < NUM_ROUNDS - 1;

            return (
              <Fragment key={round}>

                {/* ── Round column ── */}
                <div style={{ width: CARD_W }}>
                  {/* Label */}
                  <div style={{
                    height: LABEL_H,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    paddingBottom: 8,
                    fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: round === NUM_ROUNDS - 1 ? '#0025D1' : 'var(--text-muted)',
                  }}>
                    {ROUND_NAMES[round]}
                  </div>

                  {/* Matches (absolutely positioned within a fixed-height box) */}
                  <div style={{ position: 'relative', height: TOTAL_H, width: CARD_W }}>
                    {Array.from({ length: numMatches }, (_, slot) => (
                      <div key={slot} style={{
                        position: 'absolute', top: slot * slotH, left: 0,
                        width: CARD_W, height: slotH,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '6px 0',
                      }}>
                        <BracketMatch
                          teamA={getTeam(round, slot, 0)}
                          teamB={getTeam(round, slot, 1)}
                          result={results[`${round}-${slot}`]}
                          isFinal={round === NUM_ROUNDS - 1}
                          onSelect={(side) => setWinner(round, slot, side)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Connector column ── */}
                {hasConn && (
                  <div style={{ width: CONN_W }}>
                    {/* Label spacer */}
                    <div style={{ height: LABEL_H }} />
                    {/* Arms */}
                    <div style={{ position: 'relative', height: TOTAL_H, width: CONN_W }}>
                      {Array.from({ length: numMatches / 2 }, (_, pairIdx) => (
                        <div key={pairIdx} style={{
                          position: 'absolute',
                          top: pairIdx * 2 * slotH, left: 0,
                          width: CONN_W, height: 2 * slotH,
                        }}>
                          <BracketArm slotH={slotH} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </Fragment>
            );
          })}
        </div>
      </div>

      {!champion && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-ghost btn-sm" onClick={() => setResults({})}>Zurücksetzen</button>
        </div>
      )}

      <p style={{
        marginTop: 16, fontSize: '0.78rem', color: 'var(--text-light)',
        borderTop: '1px solid var(--border)', paddingTop: 12,
      }}>
        Tipp: Klicke auf einen Teamnamen, um ihn als Sieger zu setzen. Ändere eine frühere Runde – spätere Ergebnisse werden automatisch zurückgesetzt.
      </p>
    </div>
  );
}

/* ── Single match card ───────────────────────────────── */
function BracketMatch({ teamA, teamB, result, isFinal, onSelect }) {
  const canInteract = !!teamA && !!teamB && result === undefined;
  return (
    <div style={{
      width: CARD_W - 10,
      border: `1px solid ${isFinal ? '#0025D1' : 'var(--border)'}`,
      borderRadius: 10, overflow: 'hidden',
      background: 'var(--surface)',
      boxShadow: isFinal
        ? '0 2px 12px rgba(0,37,209,0.15)'
        : '0 1px 4px rgba(0,37,209,0.06)',
    }}>
      <BracketTeamRow team={teamA} side={0} result={result} canInteract={canInteract} onSelect={onSelect} />
      <BracketTeamRow team={teamB} side={1} result={result} canInteract={canInteract} onSelect={onSelect} />
    </div>
  );
}

/* ── Single team row inside a match ──────────────────── */
function BracketTeamRow({ team, side, result, canInteract, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const isWinner  = result === side;
  const isLoser   = result !== undefined && result !== side;
  const clickable = canInteract && !!team;

  let bg = 'transparent';
  if (isWinner) bg = 'linear-gradient(135deg, #0051D4, #0025D1)';
  else if (clickable && hovered) bg = '#eef2ff';

  return (
    <div
      onClick={() => clickable && onSelect(side)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '7px 10px', minHeight: 36,
        cursor: clickable ? 'pointer' : 'default',
        background: bg,
        color: isWinner ? '#fff' : isLoser ? '#c8d5e8' : 'var(--text)',
        textDecoration: isLoser ? 'line-through' : 'none',
        fontWeight: isWinner ? 700 : 500,
        fontSize: '0.82rem',
        borderBottom: side === 0 ? '1px solid var(--border)' : 'none',
        display: 'flex', alignItems: 'center', gap: 7,
        transition: 'background 0.12s, color 0.12s',
        userSelect: 'none',
      }}
    >
      {team ? (
        <>
          <span style={{ fontSize: '0.88rem', flexShrink: 0 }}>{team.emoji}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.name}
          </span>
          {isWinner && (
            <span style={{ flexShrink: 0, fontWeight: 800, fontSize: '0.78rem', opacity: 0.9 }}>✓</span>
          )}
          {clickable && !isWinner && (
            <span style={{
              flexShrink: 0, fontSize: '0.68rem', color: '#0025D1',
              opacity: hovered ? 0.8 : 0, transition: 'opacity 0.12s',
            }}>
              wählen
            </span>
          )}
        </>
      ) : (
        <span style={{ fontStyle: 'italic', color: 'var(--text-light)', fontSize: '0.78rem' }}>
          Sieger ausstehend…
        </span>
      )}
    </div>
  );
}

/* ── Bracket connector arm ───────────────────────────── */
function BracketArm({ slotH }) {
  // Draws the "]" shaped connector between a pair of matches and the next round
  const topY  = slotH / 2;             // center of top slot
  const botY  = slotH + slotH / 2;     // center of bottom slot
  const midY  = slotH;                  // midpoint (= output y)
  const midX  = CONN_W / 2;            // x of the vertical bar
  const line  = 'var(--border-2)';

  return (
    <div style={{ position: 'relative', width: CONN_W, height: 2 * slotH }}>
      {/* Horizontal stub ← top match */}
      <Line left={0}    top={topY - 1}  width={midX}          height={2} bg={line} />
      {/* Horizontal stub ← bottom match */}
      <Line left={0}    top={botY - 1}  width={midX}          height={2} bg={line} />
      {/* Vertical bar */}
      <Line left={midX - 1} top={topY} width={2} height={botY - topY}   bg={line} />
      {/* Horizontal → next round */}
      <Line left={midX - 1} top={midY - 1} width={CONN_W - midX + 1} height={2} bg={line} />
    </div>
  );
}

/* Tiny helper to avoid repetition in BracketArm */
function Line({ left, top, width, height, bg }) {
  return (
    <div style={{ position: 'absolute', left, top, width, height, background: bg }} />
  );
}
