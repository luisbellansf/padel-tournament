import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App.jsx';

const SKILL_COLORS = {
  ASSOCIATE:  { bg: '#e0f9fb', fg: '#00757a' },
  CONSULTANT: { bg: '#dbeafe', fg: '#1d4ed8' },
  EXPERT:     { bg: '#eef2ff', fg: '#0025D1' },
};

function ProfileSection({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: '0.95rem', fontWeight: 800 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();

  // ── Username ──────────────────────────────────────────
  const [name, setName]         = useState(user.name);
  const [nameMsg, setNameMsg]   = useState('');
  const [nameErr, setNameErr]   = useState('');
  const [savingName, setSavingN] = useState(false);

  const saveName = async () => {
    setNameMsg(''); setNameErr('');
    if (name.trim().length < 2) { setNameErr('Benutzername muss mindestens 2 Zeichen haben.'); return; }
    setSavingN(true);
    try {
      const updated = await api.updateProfile({ name: name.trim() });
      setUser(updated);
      setNameMsg('Benutzername erfolgreich geändert.');
    } catch (e) { setNameErr(e.message); }
    finally { setSavingN(false); }
  };

  // ── E-Mail (optional) ─────────────────────────────────
  const [email, setEmail]         = useState(user.email ?? '');
  const [emailMsg, setEmailMsg]   = useState('');
  const [emailErr, setEmailErr]   = useState('');
  const [savingEmail, setSavingE] = useState(false);

  const saveEmail = async () => {
    setEmailMsg(''); setEmailErr('');
    if (email.trim() && !email.includes('@')) { setEmailErr('Ungültige E-Mail-Adresse.'); return; }
    setSavingE(true);
    try {
      const updated = await api.updateProfile({ email: email.trim().toLowerCase() || undefined });
      setUser(updated);
      setEmailMsg('E-Mail erfolgreich gespeichert.');
    } catch (e) { setEmailErr(e.message); }
    finally { setSavingE(false); }
  };

  // ── Password ──────────────────────────────────────────
  const [pw, setPw]              = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]        = useState('');
  const [pwErr, setPwErr]        = useState('');
  const [savingPw, setSavingPw]  = useState(false);

  const savePw = async () => {
    setPwMsg(''); setPwErr('');
    if (!pw.current) { setPwErr('Bitte aktuelles Passwort eingeben.'); return; }
    if (pw.next.length < 8) { setPwErr('Neues Passwort muss mind. 8 Zeichen haben.'); return; }
    if (pw.next !== pw.confirm) { setPwErr('Passwörter stimmen nicht überein.'); return; }
    setSavingPw(true);
    try {
      await api.updateProfile({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Passwort erfolgreich geändert.');
    } catch (e) { setPwErr(e.message); }
    finally { setSavingPw(false); }
  };

  const skillColor = SKILL_COLORS[user.skillLevel] ?? { bg: '#f1f5f9', fg: '#64748b' };

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #0051D4, #0025D1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 900, fontSize: '1.6rem',
          boxShadow: '0 4px 14px rgba(0,37,209,0.3)',
        }}>
          {user.name[0].toUpperCase()}
        </div>
        <div>
          <h1 style={{ marginBottom: 4, fontSize: '1.6rem' }}>{user.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {user.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{user.email}</span>}
            {user.role === 'ADMIN' && (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Admin</span>
            )}
            <span className="badge" style={{ background: skillColor.bg, color: skillColor.fg }}>
              {user.skillLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Benutzername */}
      <ProfileSection title="Benutzername ändern">
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          Der Benutzername ist dein Login-Identifikator und muss einzigartig sein.
        </p>
        <label>Benutzername</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
          placeholder="Dein Benutzername"
        />
        {nameErr && <div className="error">{nameErr}</div>}
        {nameMsg && <div className="success">{nameMsg}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary btn-sm" onClick={saveName}
            disabled={savingName || name.trim() === user.name || name.trim().length < 2}>
            {savingName ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </ProfileSection>

      {/* E-Mail (optional) */}
      <ProfileSection title="E-Mail (optional)">
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          E-Mail ist optional und wird nicht zum Einloggen benötigt.
        </p>
        <label>E-Mail-Adresse</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
          placeholder="optional@email.de"
        />
        {emailErr && <div className="error">{emailErr}</div>}
        {emailMsg && <div className="success">{emailMsg}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary btn-sm" onClick={saveEmail}
            disabled={savingEmail || email.trim().toLowerCase() === (user.email ?? '')}>
            {savingEmail ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </ProfileSection>

      {/* Passwort */}
      <ProfileSection title="Passwort ändern">
        <label>Aktuelles Passwort</label>
        <input type="password" value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
          placeholder="••••••••" autoComplete="current-password" />
        <label>Neues Passwort (mind. 8 Zeichen)</label>
        <input type="password" value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
          placeholder="••••••••" autoComplete="new-password" />
        <label>Neues Passwort bestätigen</label>
        <input type="password" value={pw.confirm}
          onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && savePw()}
          placeholder="••••••••" autoComplete="new-password" />
        {pw.next && pw.confirm && pw.next !== pw.confirm && (
          <div className="error">Passwörter stimmen nicht überein.</div>
        )}
        {pwErr && <div className="error">{pwErr}</div>}
        {pwMsg && <div className="success">{pwMsg}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary btn-sm" onClick={savePw}
            disabled={savingPw || !pw.current || pw.next.length < 8 || pw.next !== pw.confirm}>
            {savingPw ? 'Passwort wird geändert…' : 'Passwort ändern'}
          </button>
        </div>
      </ProfileSection>
    </div>
  );
}
