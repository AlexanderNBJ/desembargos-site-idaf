(function () {

  // coloca o nome em Title Case
  function titleCase(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .split(/\s+/)
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
      .join(' ');
  }

  // busca e exibe o nome do usuário
  function renderUserName() {

    // garante que o span exista
    let span = document.getElementById('usuarioNome');
    if (!span) {
      const logoutContainer = document.querySelector('header .logout-container');

      if (!logoutContainer) 
        return;

      span = document.createElement('span');
      span.id = 'usuarioNome';
      span.className = 'usuario-nome';
      logoutContainer.insertBefore(span, logoutContainer.firstChild);
    }
    
    // pega o usuario do auth
    const user = Auth.getSessionUser();

    // se existe, coloca o nome
    if (user && user.name) {
      span.textContent = titleCase(user.name);
    } 
    else if (user && user.username) {
      span.textContent = user.username;
    } 
    else {
      span.textContent = 'Usuário';
    }
  }

  function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout(true);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderUserName();
    setupLogoutButton();
  });
})();