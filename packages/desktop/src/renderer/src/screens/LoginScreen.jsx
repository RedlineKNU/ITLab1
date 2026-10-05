import React, { useState } from 'react';
import { LoginForm } from '@mini-drive/shared';

export function LoginScreen({ initialServerUrl, onLogin, onRegister }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = (fn) => async (payload) => {
    setError(null);
    setLoading(true);
    try {
      await fn(payload);
    } catch (err) {
      setError(err?.message || 'Помилка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <LoginForm
        initialServerUrl={initialServerUrl}
        onSubmit={wrap(onLogin)}
        onRegister={wrap(onRegister)}
        loading={loading}
        error={error}
      />
    </div>
  );
}
