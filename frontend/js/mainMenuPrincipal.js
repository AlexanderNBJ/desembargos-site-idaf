document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.initAuth()) {
    return;
  }

  // logout do botão
  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout(true);
    });
  }
});