// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSession, saveSession, clearSession } from '../src/session.js';

describe('session storage', () => {
  beforeEach(() => localStorage.clear());

  it('повертає порожню сесію за замовчуванням', () => {
    const s = loadSession();
    expect(s.token).toBeNull();
    expect(s.login).toBeNull();
    expect(s.serverUrl).toBeTypeOf('string');
  });

  it('saveSession зберігає й повертає оновлене', () => {
    const next = saveSession({ token: 'tok', login: 'alice' });
    expect(next.token).toBe('tok');
    expect(loadSession().login).toBe('alice');
  });

  it('clearSession чистить токен, але залишає serverUrl', () => {
    saveSession({ token: 'tok', login: 'alice', serverUrl: 'https://api.example.com' });
    const next = clearSession();
    expect(next.token).toBeNull();
    expect(next.login).toBeNull();
    expect(next.serverUrl).toBe('https://api.example.com');
  });
});
