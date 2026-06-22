import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const { user } = await api.login(form);
      login(user);
      nav('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-wrap">
      <div className="tag">Anmelden</div>
      <h1>Willkommen zurück</h1>
      <p className="sub">Melde dich mit deinem Benutzernamen an.</p>
      <div className="card">
        <label>Benutzername</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Dein Benutzername"
          autoComplete="username"
        />
        <label>Passwort</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={submit} disabled={loading || !form.name.trim()}>
            {loading ? 'Einloggen…' : 'Einloggen'}
          </button>
          <Link to="/register">Noch kein Konto?</Link>
        </div>
      </div>
    </div>
  );
}
