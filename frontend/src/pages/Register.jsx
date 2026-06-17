import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App.jsx';

const SKILLS = [
  { v: 'ASSOCIATE',  label: 'Associate'  },
  { v: 'CONSULTANT', label: 'Consultant' },
  { v: 'EXPERT',     label: 'Expert'     },
];

export default function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', password: '', skillLevel: 'ASSOCIATE' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      nav('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-wrap">
      <div className="tag">Registrieren</div>
      <h1>Konto erstellen</h1>
      <p className="sub">Wähle einen Benutzernamen – damit loggst du dich ein.</p>
      <div className="card">
        <label>Benutzername</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="z.B. MaxMustermann"
          autoComplete="username"
        />
        <label>Passwort (mind. 8 Zeichen)</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <label>Level</label>
        <select value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}>
          {SKILLS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={submit} disabled={loading || !form.name.trim()}>
            {loading ? 'Wird erstellt…' : 'Konto erstellen'}
          </button>
          <Link to="/login">Schon registriert?</Link>
        </div>
      </div>
    </div>
  );
}
