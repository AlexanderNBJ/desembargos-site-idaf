// userHeader.js
// incluir DEPOIS de auth.js
(function () {
  function parseJwt(token) {
    if (!token) return null;
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
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
      try { const t = Auth.getSessionToken(); if (t) return t; } catch {}
    }
    return localStorage.getItem('sessionToken') || localStorage.getItem('token') || null;
  }

  // retorna um displayName (preferindo name). NÃO faz fetch por /api (sync)
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
    } catch (e) {}

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

    // fallback
    const fallback = localStorage.getItem('username') || localStorage.getItem('user') || null;
    if (fallback) return fallback.includes('@') ? cleanEmailToName(fallback) : fallback;

    return 'Usuário';
  }

  // opcional: se preferir buscar do backend (assincrono) quando nada for encontrado:
  async function tryFetchNameFromApi() {
    try {
      const token = getStoredToken();
      if (!token) return null;
      const res = await fetch('/api/usuarios/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const j = await res.json();
      // assume { success: true, name, position } or { name, position }
      if (j.name) return j.name;
      if (j.data && j.data.name) return j.data.name;
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

  async function renderUserName() {
    const span = ensureUserSpan();
    if (!span) return;
    // try sync first
    let name = getDisplayNameSync();
    // if the sync method returns 'Usuário' or an email-ish fallback, try API for a nicer name
    if (name === 'Usuário' || (typeof name === 'string' && name.includes('@'))) {
      const apiName = await tryFetchNameFromApi();
      if (apiName) name = apiName;
      else if (name && name.includes('@')) name = cleanEmailToName(name);
    }
    span.textContent = name;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderUserName();
  });
})();
