import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App.jsx';

const SKILLS = ['ASSOCIATE', 'CONSULTANT', 'EXPERT'];

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [globalErr, setErr] = useState('');

  const load = () => api.adminUsers().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="container">
      <div className="tag">Verwaltung</div>
      <h1>Benutzer</h1>
      <p className="sub">{users.length} registrierte{users.length === 1 ? 'r' : ''} Benutzer</p>
      {globalErr && (
        <div className="error" style={{ marginBottom: 16 }}>
          {globalErr}
          <button
            onClick={() => setErr('')}
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '0.85rem' }}
          >
            ✕
          </button>
        </div>
      )}
      {users.map((u) => (
        <UserRow key={u.id} u={u} isMe={u.id === me.id} onRefresh={load} onError={setErr} />
      ))}
    </div>
  );
}

function UserRow({ u, isMe, onRefresh, onError }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName]               = useState(u.name);
  const [skill, setSkill]             = useState(u.skillLevel);
  const [showPw, setShowPw]           = useState(false);
  const [newPw, setNewPw]             = useState('');
  // Only one confirm panel open at a time: 'role' | 'delete' | null
  const [confirm, setConfirm]         = useState(null);
  const [saving, setSaving]           = useState(false);

  const isAdmin = u.role === 'ADMIN';

  const saveName = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      await api.updateUser(u.id, { name: name.trim() });
      setEditingName(false);
      onRefresh();
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  const saveSkill = async (val) => {
    setSkill(val);
    try { await api.updateUser(u.id, { skillLevel: val }); onRefresh(); }
    catch (e) { onError(e.message); setSkill(u.skillLevel); }
  };

  const resetPw = async () => {
    if (newPw.length < 8) { onError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    setSaving(true);
    try {
      await api.resetPassword(u.id, { password: newPw });
      setNewPw('');
      setShowPw(false);
    } catch (e) { onError(e.message); }
    finally { setSaving(false); }
  };

  const changeRole = async () => {
    const newRole = isAdmin ? 'PLAYER' : 'ADMIN';
    try { await api.changeRole(u.id, newRole); onRefresh(); }
    catch (e) { onError(e.message); }
    finally { setConfirm(null); }
  };

  const deleteUser = async () => {
    try { await api.deleteUser(u.id); onRefresh(); }
    catch (e) { onError(e.message); setConfirm(null); }
  };

  return (
    <div className="card" style={{ marginBottom: 10 }}>

      {/* ── Main row ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>

        {/* Left: avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: isAdmin
              ? 'linear-gradient(135deg, #d97706, #92400e)'
              : 'linear-gradient(135deg, #0051D4, #0025D1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '1.05rem',
          }}>
            {u.name[0].toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            {editingName ? (
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <input
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') { setEditingName(false); setName(u.name); }
                  }}
                  style={{ width: 200, padding: '5px 10px', fontSize: '0.9rem' }}
                />
                <button className="btn-primary btn-sm" onClick={saveName} disabled={saving}>Speichern</button>
                <button className="btn-ghost btn-sm" onClick={() => { setEditingName(false); setName(u.name); }}>✕</button>
              </div>
            ) : (
              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.97rem' }}>{u.name}</span>
                {isMe  && <span className="badge status-RUNNING">Du</span>}
                {isAdmin && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Admin</span>
                )}
                <button
                  className="btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.73rem' }}
                  onClick={() => setEditingName(true)}
                >
                  Umbenennen
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
              {u.email
                ? <span className="muted" style={{ fontSize: '0.8rem' }}>{u.email}</span>
                : <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Keine E-Mail</span>
              }
              <span className="muted" style={{ fontSize: '0.8rem' }}>seit {fmtDate(u.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Right: controls (only when no confirm panel is open) */}
        {confirm === null && (
          <div className="row" style={{ gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Skill dropdown */}
            <select
              value={skill}
              onChange={(e) => saveSkill(e.target.value)}
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem' }}
            >
              {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Password reset */}
            <button
              className="btn-ghost btn-sm"
              onClick={() => { setShowPw(!showPw); setNewPw(''); }}
            >
              Passwort
            </button>

            {/* Role toggle — hidden for self */}
            {!isMe && (
              <button
                className="btn-sm"
                style={isAdmin
                  ? { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                  : { background: '#eef2ff', color: '#0025D1', border: '1px solid #c7d2fe' }
                }
                onClick={() => setConfirm('role')}
              >
                {isAdmin ? 'Admin entziehen' : 'Zum Admin machen'}
              </button>
            )}

            {/* Delete — hidden for self */}
            {!isMe && (
              <button
                className="btn-sm"
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                onClick={() => setConfirm('delete')}
              >
                Löschen
              </button>
            )}
          </div>
        )}

        {/* ── Confirm panels (replace the whole right side) ─── */}
        {confirm === 'role' && (
          <ConfirmPanel
            message={isAdmin
              ? `Admin-Rechte von „${u.name}" entziehen?`
              : `„${u.name}" zum Admin machen?`
            }
            confirmLabel={isAdmin ? 'Admin entziehen' : 'Zum Admin machen'}
            confirmStyle={isAdmin
              ? { background: '#d97706', color: '#fff', border: 'none' }
              : { background: '#0025D1', color: '#fff', border: 'none' }
            }
            onConfirm={changeRole}
            onCancel={() => setConfirm(null)}
          />
        )}

        {confirm === 'delete' && (
          <ConfirmPanel
            message={`„${u.name}" wirklich löschen?`}
            confirmLabel="Endgültig löschen"
            confirmStyle={{ background: '#dc2626', color: '#fff', border: 'none' }}
            onConfirm={deleteUser}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>

      {/* ── Password reset inline form ────────────────────── */}
      {showPw && (
        <div className="row" style={{
          marginTop: 14, paddingTop: 14,
          borderTop: '1px solid var(--border)',
          gap: 8, flexWrap: 'wrap',
        }}>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && resetPw()}
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            style={{ maxWidth: 280 }}
            autoFocus
          />
          <button className="btn-primary btn-sm" onClick={resetPw} disabled={saving || newPw.length < 8}>
            Setzen
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { setShowPw(false); setNewPw(''); }}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmPanel({ message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div className="row" style={{ gap: 10, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>{message}</span>
      <button className="btn-sm" style={confirmStyle} onClick={onConfirm}>{confirmLabel}</button>
      <button className="btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>
    </div>
  );
}
