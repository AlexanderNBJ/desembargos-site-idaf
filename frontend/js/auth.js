(function (global) {
  const KEY_TOKEN = 'sessionToken';
  const KEY_EXPIRY = 'tokenExpiry';
  const KEY_USER = 'sessionUser';

  function setSession(token, user) {
    if (!token) return;
    localStorage.setItem(KEY_TOKEN, token);
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24h
    localStorage.setItem(KEY_EXPIRY, String(expiryTime));
    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_EXPIRY);
    localStorage.removeItem(KEY_USER);
  }

  function getSessionToken() {
    return localStorage.getItem(KEY_TOKEN);
  }

  function getSessionUser() {
    try {
      const raw = localStorage.getItem(KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function isLoggedIn() {
    const token = getSessionToken();
    const expiry = localStorage.getItem(KEY_EXPIRY);
    if (!token) return false;
    if (expiry && Date.now() > parseInt(expiry)) {
      clearSession();
      return false;
    }
    return true;
  }

  function logout(redirect = true) {
    clearSession();
    if (redirect) window.location.href = 'login.html';
  }

  function parseJwt(token) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(payload)));
    } catch (err) {
      try {
        return JSON.parse(atob(token.split('.')[1]));
      } catch {
        return null;
      }
    }
  }

  async function fetchWithAuth(url, options = {}) {
    const token = getSessionToken();
    const headers = options.headers || {};
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = Object.assign({}, options, { headers });
    return fetch(url, opts);
  }

  function initAuth({ redirectIfMissing = true, onReady } = {}) {
    if (!isLoggedIn()) {
      if (redirectIfMissing) window.location.href = 'login.html';
      return false;
    }
    if (typeof onReady === 'function') {
      const decoded = parseJwt(getSessionToken());
      onReady(decoded, getSessionUser());
    }
    return true;
  }

  global.Auth = {
    setSession,
    clearSession,
    getSessionToken,
    getSessionUser,
    isLoggedIn,
    logout,
    parseJwt,
    fetchWithAuth,
    initAuth
  };

})(window);
