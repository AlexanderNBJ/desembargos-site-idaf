document.addEventListener('DOMContentLoaded', () => {
  // se o usuário não estiver autenticado, ele será redirecionado pelo Auth
  if (!Auth.initAuth()) {
    return;
  }

  // logout do botão
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      // O true no Auth.logout garante o redirecionamento para a página de login.
      Auth.logout(true);
    });
  }
});