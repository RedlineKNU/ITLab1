import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient, ApiError } from '@mini-drive/shared';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { DriveScreen } from './screens/DriveScreen.jsx';
import { clearSession, loadSession, saveSession } from './session.js';

export function App() {
  const [session, setSession] = useState(() => loadSession());
  const [toast, setToast] = useState(null);

  const api = useMemo(
    () => new ApiClient({ baseUrl: session.serverUrl, token: session.token }),
    [session.serverUrl, session.token]
  );

  useEffect(() => {
    api.setToken(session.token);
  }, [api, session.token]);

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleUnauthorized = useCallback(() => {
    setSession((s) => {
      const next = { ...s, token: null, login: null };
      saveSession(next);
      return next;
    });
    showToast('Сесія закінчилась. Увійдіть знову.', 'error');
  }, [showToast]);

  const handleLogin = async ({ serverUrl, login, password }) => {
    const client = new ApiClient({ baseUrl: serverUrl });
    const result = await client.login(login, password);
    const next = saveSession({ serverUrl, token: result.token, login: result.user.login });
    setSession(next);
  };

  const handleRegister = async ({ serverUrl, login, password }) => {
    const client = new ApiClient({ baseUrl: serverUrl });
    await client.register(login, password);
    const result = await client.login(login, password);
    const next = saveSession({ serverUrl, token: result.token, login: result.user.login });
    setSession(next);
  };

  const handleLogout = () => {
    clearSession();
    setSession((s) => ({ ...s, token: null, login: null }));
  };

  return (
    <>
      {session.token ? (
        <DriveScreen
          api={api}
          session={session}
          onLogout={handleLogout}
          onUnauthorized={handleUnauthorized}
          showToast={showToast}
        />
      ) : (
        <LoginScreen
          initialServerUrl={session.serverUrl}
          onLogin={handleLogin}
          onRegister={handleRegister}
          showToast={showToast}
        />
      )}
      {toast ? <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>{toast.message}</div> : null}
    </>
  );
}

export { ApiError };
