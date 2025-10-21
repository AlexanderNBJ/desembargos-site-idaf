document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.initAuth({ redirectIfMissing: true })) return;

  const userSpan = document.getElementById('usuarioNome');
  const logoutBtn = document.getElementById('logoutBtn');
  const token = Auth.getSessionToken();
  const decoded = Auth.parseJwt(token);

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout(true);
    });
  }
});
