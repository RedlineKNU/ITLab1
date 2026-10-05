const KEY = 'mini-drive.session.v1';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw);
    return { ...defaultSession(), ...parsed };
  } catch {
    return defaultSession();
  }
}

export function saveSession(patch) {
  const next = { ...loadSession(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession() {
  const next = { ...loadSession(), token: null, login: null };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function defaultSession() {
  return {
    serverUrl: inferDefaultServer(),
    token: null,
    login: null,
  };
}

function inferDefaultServer() {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return window.location.origin;
}
