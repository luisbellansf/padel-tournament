import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api, setToken, getToken } from './api';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tournament from './pages/Tournament.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import Help from './pages/Help.jsx';
import Profile from './pages/Profile.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) return setLoading(false);
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const login  = (token, u) => { setToken(token); setUser(u); };
  const logout = () => { setToken(null); setUser(null); };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b', fontSize: '0.9rem' }}>
      Lädt…
    </div>
  );

  return (
    <AuthCtx.Provider value={{ user, login, logout, setUser }}>
      <div className="app">
        <div className="hero-bar" />
        <TopBar />
        <Routes>
          <Route path="/login"       element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register"    element={user ? <Navigate to="/" /> : <Register />} />
          <Route path="/"            element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/t/:id"       element={user ? <Tournament /> : <Navigate to="/login" />} />
          <Route path="/profile"     element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/help"        element={user ? <Help /> : <Navigate to="/login" />} />
          <Route path="/admin/users" element={user?.role === 'ADMIN' ? <AdminUsers /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </AuthCtx.Provider>
  );
}

/* ─── Top bar ─────────────────────────────────────────── */
function TopBar() {
  const { user, logout } = useAuth();
  const nav      = useNavigate();
  const location = useLocation();

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        fontSize: '0.85rem', fontWeight: 600,
        color: location.pathname === to ? 'var(--sf-digital)' : 'var(--text-muted)',
        borderBottom: location.pathname === to ? '2px solid var(--sf-digital)' : '2px solid transparent',
        paddingBottom: 2,
        transition: 'color 0.15s',
      }}
    >
      {label}
    </Link>
  );

  return (
    <div className="topbar">
      {/* Left: logo + nav links */}
      <div className="row" style={{ gap: 24 }}>
        <Link to="/" className="logo">
          <img src="/fivy.svg" width={34} height={29} alt="Fivy" style={{ flexShrink: 0 }} />
          <div className="logo-text">
            Salesfive <span className="logo-sub">Tournaments</span>
          </div>
        </Link>
        {user?.role === 'ADMIN' && navLink('/admin/users', 'Benutzer')}
        {user && navLink('/help', 'Hilfe')}
      </div>

      {/* Right: profile chip + logout */}
      <div className="row" style={{ gap: 8 }}>
        {user && (
          <>
            <Link to="/profile" className="user-chip" style={{ textDecoration: 'none' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0051D4, #0025D1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0,
              }}>
                {user.name[0].toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.name}</span>
            </Link>
            <button className="btn-ghost btn-sm" onClick={() => { logout(); nav('/login'); }}>
              Abmelden
            </button>
          </>
        )}
      </div>
    </div>
  );
}
