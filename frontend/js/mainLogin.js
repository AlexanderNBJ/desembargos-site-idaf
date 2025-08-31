// frontend/js/mainLogin.js
// espera inputs com id="usuario" e id="senha" no login.html
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const usuario = document.getElementById('usuario');
  const senha = document.getElementById('senha');
  const msg = document.getElementById('loginMessage');

  function showError(text) {
    if (!msg) return;
    msg.style.display = 'block';
    msg.textContent = text;
  }

  async function doLogin(e) {
    e && e.preventDefault();
    msg && (msg.style.display = 'none');

    const username = usuario.value.trim();
    const password = senha.value.trim();

    if (!username || !password) {
      showError('Preencha usuário e senha.');
      return;
    }

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const json = await res.json();
      if (res.ok && json && json.code === 200 && json.value && json.value.token) {
        // guarda sessão e redireciona
        Auth.setSession(json.value.token, json.value.user || { username });
        // opcional: buscar permissões (se precisar ficar em localStorage)
        try {
          const pRes = await Auth.fetchWithAuth('/auth/permissions');
          if (pRes && pRes.ok) {
            const perm = await pRes.json();
            // você pode armazenar as permissões se quiser
            localStorage.setItem('dashboardPerm', JSON.stringify(perm));
          }
        } catch (err) { /* não bloqueia o login */ }

        // redireciona para menu principal
        window.location.href = 'menuPrincipal.html';
      } else {
        showError((json && json.message) ? json.message : 'Login falhou — verifique suas credenciais.');
      }
    } catch (err) {
      console.error('login error', err);
      showError('Erro de conexão com o servidor.');
    }
  }

  form.addEventListener('submit', doLogin);
  // suporte enter
  [usuario, senha].forEach(input => input && input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLogin();
    }
  }));
});
