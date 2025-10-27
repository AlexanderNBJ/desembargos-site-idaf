document.addEventListener('DOMContentLoaded', () => {

  // se o usuário não estiver logado, redirecionar
  if (!Auth.initAuth({ redirectIfMissing: true })) 
    return;

  // pega os elementos
  const logoutBtn = document.getElementById('logoutBtn');

  // realiza o logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout(true);
    });
  }
});
