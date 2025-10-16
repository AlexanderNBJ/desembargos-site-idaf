(function () {
  const CACHE_KEY = 'displayName';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  function nowMs() { return Date.now(); }

  function saveCache(name) {
    try {
      const entry = { name, ts: nowMs() };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (e) {}
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.ts || !obj.name) return null;
      if (nowMs() - obj.ts > CACHE_TTL_MS) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return obj.name;
    } catch (e) {
      return null;
    }
  }

  function base64UrlDecodeUtf8(b64url) {
    try {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      const str = atob(b64);
      const pct = Array.prototype.map.call(str, c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
      return decodeURIComponent(pct);
    } catch (e) {
      return null;
    }
  }

  function parseJwt(token) {
    if (!token) return null;
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const json = base64UrlDecodeUtf8(part);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function titleCase(s) {
    if (!s) return s;
    return String(s).split(/\s+/).map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
  }

  function cleanEmailToName(email) {
    if (!email) return null;
    const local = String(email).split('@')[0];
    return titleCase(local.replace(/[._-]+/g, ' '));
  }

  function getStoredToken() {
    if (window.Auth && typeof Auth.getSessionToken === 'function') {
      try { const t = Auth.getSessionToken(); if (t) return t; } catch (e) { /* continue */ }
    }
    return localStorage.getItem('sessionToken') || localStorage.getItem('token') || null;
  }

  function getDisplayNameSync() {
    try {
      if (window.Auth && typeof Auth.getSessionUser === 'function') {
        const u = Auth.getSessionUser();
        if (u) {
          if (u.name) return titleCase(u.name);
          if (u.fullName) return titleCase(u.fullName);
          if (u.nome) return titleCase(u.nome);
          if (u.username && !u.username.includes('@')) return u.username;
          if (u.username && u.username.includes('@')) return cleanEmailToName(u.username);
          if (u.email) return cleanEmailToName(u.email);
        }
      }
    } catch (e) {}

    const t = getStoredToken();
    const p = parseJwt(t);
    if (p) {
      if (p.name) return titleCase(p.name);
      if (p.fullName) return titleCase(p.fullName);
      if (p.nome) return titleCase(p.nome);
      if (p.given_name) return titleCase(p.given_name);
      if (p.username && !p.username.includes('@')) return p.username;
      if (p.username && p.username.includes('@')) return cleanEmailToName(p.username);
      if (p.email) return cleanEmailToName(p.email);
      if (p.sub) return cleanEmailToName(p.sub);
    }

    const fallback = localStorage.getItem('username') || localStorage.getItem('user') || null;
    if (fallback) return fallback.includes('@') ? cleanEmailToName(fallback) : fallback;

    return null;
  }

  async function tryFetchNameFromApi() {
    try {
      const cached = readCache();
      if (cached) return cached;

      const token = getStoredToken();
      if (!token) return null;
      const res = await fetch('/api/usuarios/me', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const j = await res.json();
      let name = null;
      if (j) {
        if (j.name) name = j.name;
        else if (j.data && j.data.name) name = j.data.name;
        else if (j.data && j.data.username && j.data.name) name = j.data.name; 
        else if (j.data && j.data.username && !j.data.name) name = j.data.username;
        else if (j.username) name = j.username;
      }
      if (name) {
        saveCache(name);
        return name;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function ensureUserSpan() {
    let span = document.getElementById('usuarioNome');
    if (!span) {
      const logoutContainer = document.querySelector('header .logout-container');
      if (!logoutContainer) return null;
      span = document.createElement('span');
      span.id = 'usuarioNome';
      span.className = 'usuario-nome';
      span.style.marginRight = '8px';
      logoutContainer.insertBefore(span, logoutContainer.firstChild);
    }
    return span;
  }

  async function renderUserName(force = false) {
    const span = ensureUserSpan();
    if (!span) return;
    if (!force) {
      const cached = readCache();
      if (cached) {
        span.textContent = cached;
        return;
      }
    }

    let name = getDisplayNameSync();
    if (name) {
      span.textContent = name;
      const apiName = await tryFetchNameFromApi();
      if (apiName && apiName !== name) {
        span.textContent = apiName;
      }
      return;
    }

    const apiName = await tryFetchNameFromApi();
    if (apiName) {
      span.textContent = apiName;
      return;
    }

    const t = getStoredToken();
    const p = parseJwt(t);
    let fallback = null;
    if (p) fallback = p.name || p.username || p.email || p.sub || null;
    if (!fallback) fallback = localStorage.getItem('username') || localStorage.getItem('user') || null;
    if (fallback) {
      span.textContent = (typeof fallback === 'string' && fallback.includes('@')) ? cleanEmailToName(fallback) : String(fallback);
      return;
    }

    span.textContent = 'Usuário';
  }

  window.refreshUserName = function (opts = {}) {
    return renderUserName(Boolean(opts.force));
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderUserName();
  });

})();
