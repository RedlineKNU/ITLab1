import React, { useEffect, useState } from 'react';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { DriveScreen } from './screens/DriveScreen.jsx';

export function App() {
  const [config, setConfig] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    window.miniDrive.config.get().then(setConfig);
  }, []);

  if (!config) {
    return <div className="login-screen"><p className="muted">Завантаження…</p></div>;
  }

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async ({ serverUrl, login, password }) => {
    try {
      const next = await window.miniDrive.auth.login({ serverUrl, login, password });
      setConfig(next);
    } catch (err) {
      showToast(err.message || 'Помилка входу', 'error');
      throw err;
    }
  };

  const handleRegister = async ({ serverUrl, login, password }) => {
    try {
      const next = await window.miniDrive.auth.register({ serverUrl, login, password });
      setConfig(next);
    } catch (err) {
      showToast(err.message || 'Помилка реєстрації', 'error');
      throw err;
    }
  };

  const handleLogout = async () => {
    const next = await window.miniDrive.auth.logout();
    setConfig(next);
  };

  return (
    <>
      {config.token ? (
        <DriveScreen config={config} onLogout={handleLogout} showToast={showToast} />
      ) : (
        <LoginScreen
          initialServerUrl={config.serverUrl || 'http://localhost:3000'}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}
      {toast ? <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>{toast.message}</div> : null}
    </>
  );
}
