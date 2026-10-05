import React, { useState } from 'react';

export function LoginForm({
  initialServerUrl = 'http://localhost:3000',
  onSubmit,
  onRegister,
  loading = false,
  error,
  collapseServerUrl = false,
}) {
  const [mode, setMode] = useState('login');
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const payload = { serverUrl: serverUrl.trim(), login: login.trim(), password };
    if (mode === 'login') onSubmit?.(payload);
    else onRegister?.(payload);
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <h1>Mini Drive</h1>
      <p className="muted">Вхід у віртуальний диск</p>

      {collapseServerUrl ? (
        <details>
          <summary>Додатково: адреса сервера</summary>
          <label style={{ marginTop: 8 }}>
            Адреса сервера
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              autoComplete="off"
              data-testid="server-url"
            />
          </label>
        </details>
      ) : (
        <label>
          Адреса сервера
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:3000"
            autoComplete="off"
            data-testid="server-url"
          />
        </label>
      )}

      <label>
        Логін
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          required
          data-testid="login"
        />
      </label>

      <label>
        Пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          data-testid="password"
        />
      </label>

      {error ? <p className="error" role="alert">{error}</p> : null}

      <div className="login-actions">
        <button type="submit" disabled={loading} data-testid="submit">
          {loading ? '...' : mode === 'login' ? 'Увійти' : 'Зареєструватись'}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Створити акаунт' : 'Уже маю акаунт'}
        </button>
      </div>
    </form>
  );
}
