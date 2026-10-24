import { useState, useEffect } from 'react';
import RegisterPage from './pages/RegisterPage';
import VerifyPage from './pages/VerifyPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import { checkAuth, clearToken } from './api';
import './App.css';
import './pages/Admin.css';

export default function App() {
  const [tab, setTab] = useState('register');
  // 'checking' while we ask the server, null = logged out, or { username, is_admin }
  const [user, setUser] = useState('checking');

  const refreshUser = () => checkAuth().then(setUser);
  useEffect(() => { refreshUser(); }, []);

  if (user === 'checking') return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (!user) return <AuthPage onAuthed={refreshUser} />;

  const logout = () => { clearToken(); setTab('register'); setUser(null); };

  // Admins only review files (Admin panel). Register / Verify / Dashboard are for normal users.
  const tabs = user.is_admin
    ? [{ id: 'admin', label: 'Admin' }]
    : [
        { id: 'register', label: 'Register' },
        { id: 'verify', label: 'Verify' },
        { id: 'dashboard', label: 'Dashboard' },
      ];
  const activeTab = user.is_admin ? 'admin' : tab;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">FG</span>
          <div>
            <div className="brand-title">FileGuard</div>
            <div className="brand-sub">Integrity · Authenticity · SHA-256 + RSA</div>
          </div>
        </div>
        {!user.is_admin && <nav className="tabs">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id ? 'tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-num">{i + 1}</span>
              {t.label}
            </button>
          ))}
                </nav>}
        <div className="topbar-user">
          <span>{user.username}</span>
          <button className="btn-logout" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="content">
        {activeTab === 'register' && <RegisterPage />}
        {activeTab === 'verify' && <VerifyPage />}
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'admin' && <AdminPage />}
      </main>

      <footer className="footer">
        FileGuard Mini Project · SHA-256 for integrity, RSA digital signatures for authenticity
      </footer>
    </div>
  );
}