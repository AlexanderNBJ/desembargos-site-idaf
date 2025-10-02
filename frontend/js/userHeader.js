// userHeader.js
// incluir DEPOIS de auth.js
(function () {
  const CACHE_KEY = 'displayName';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  function nowMs() { return Date.now(); }

  function saveCache(name) {
    try {
      const entry = { name, ts: nowMs() };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (e) { /* ignore */ }
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

  // robust base64 -> utf8 decode for JWT payload
  function base64UrlDecodeUtf8(b64url) {
    try {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      const str = atob(b64);
      // convert binary string to percent-encoded, then decode
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

  // try sync methods (Auth.getSessionUser or JWT payload) — quick and no network
  function getDisplayNameSync() {
    // 1) Auth.getSessionUser()
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
    } catch (e) { /* ignore */ }

    // 2) token payload
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

    // 3) fallback localStorage raw
    const fallback = localStorage.getItem('username') || localStorage.getItem('user') || null;
    if (fallback) return fallback.includes('@') ? cleanEmailToName(fallback) : fallback;

    return null;
  }

  // async fetch from backend /api/usuarios/me
  async function tryFetchNameFromApi() {
    try {
      // check cache first
      const cached = readCache();
      if (cached) return cached;

      const token = getStoredToken();
      if (!token) return null;
      const res = await fetch('/api/usuarios/me', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const j = await res.json();
      // support { success:true, data: {...} } or { name, position } or { success:true, name, position }
      let name = null;
      if (j) {
        if (j.name) name = j.name;
        else if (j.data && j.data.name) name = j.data.name;
        else if (j.data && j.data.username && j.data.name) name = j.data.name; // defensive
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
    // if not forced, try cache first
    if (!force) {
      const cached = readCache();
      if (cached) {
        span.textContent = cached;
        return;
      }
    }

    // try sync fast options
    let name = getDisplayNameSync();
    // if sync returned something useful, show it but still try API to get nicer name (unless forced=false and we accept sync)
    if (name) {
      span.textContent = name;
      // try update from API in background to improve UX
      const apiName = await tryFetchNameFromApi();
      if (apiName && apiName !== name) {
        span.textContent = apiName;
      }
      return;
    }

    // no sync name — try full API
    const apiName = await tryFetchNameFromApi();
    if (apiName) {
      span.textContent = apiName;
      return;
    }

    // fallback to token/email cleaned or generic
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

  // expose refresh function (useful after login/logout)
  window.refreshUserName = function (opts = {}) {
    return renderUserName(Boolean(opts.force));
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderUserName();
  });

})();
