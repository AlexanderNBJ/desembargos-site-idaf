// frontend/js/mainMenu.js
document.addEventListener('DOMContentLoaded', () => {
  // se não estiver logado, manda pro login
  if (!Auth.initAuth({ redirectIfMissing: true })) return;

  const userSpan = document.getElementById('usuarioNome');
  const logoutBtn = document.getElementById('logoutBtn');

  // tenta pegar nome do token (username)
  const token = Auth.getSessionToken();
  const decoded = Auth.parseJwt(token);
  const display = decoded?.username || decoded?.sub || Auth.getSessionUser()?.username || 'Usuário';
  if (userSpan) userSpan.textContent = display;

  // NÃO ocultamos o botão de cadastrar — fica visível para todos os perfis

  // logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout(true);
    });
  }
});
