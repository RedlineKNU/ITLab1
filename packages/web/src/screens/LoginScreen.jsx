import React, { useState } from 'react';
import { LoginForm } from '@mini-drive/shared';

export function LoginScreen({ initialServerUrl, onLogin, onRegister, showToast }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = (fn) => async (payload) => {
    setError(null);
    setLoading(true);
    try {
      await fn(payload);
    } catch (err) {
      const msg = err?.message || 'Помилка';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <LoginForm
        initialServerUrl={initialServerUrl}
        collapseServerUrl
        onSubmit={wrap(onLogin)}
        onRegister={wrap(onRegister)}
        loading={loading}
        error={error}
      />
    </div>
  );
}
