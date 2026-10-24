import { useState } from 'react';
import { login, signup, setToken, setUsername } from '../api';
import './AuthPage.css';

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [username, setUsernameField] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signup') {
        await signup(username, password);
        setSuccessMsg('Account created successfully. Please log in below.');
        setMode('login');
        setPassword('');
      } else {
        const data = await login(username, password);
        setToken(data.token);
        setUsername(data.username);
        onAuthed(data.username);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">FG</span>
          <div className="auth-brand-title">FileGuard</div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`} onClick={() => switchMode('login')} type="button">Log In</button>
          <button className={`auth-tab ${mode === 'signup' ? 'auth-tab-active' : ''}`} onClick={() => switchMode('signup')} type="button">Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            Username
            <input className="auth-input" value={username} onChange={(e) => setUsernameField(e.target.value)} autoComplete="username" required />
          </label>

          <label className="auth-label">
            Password
            <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>

          {successMsg && <div className="auth-success">{successMsg}</div>}
          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}