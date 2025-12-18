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
    const logoutContainer = document.querySelector('header .logout-container');
    if (!logoutContainer) return;

    // 1. Garante que o span do NOME existe
    let spanNome = document.getElementById('usuarioNome');
    if (!spanNome) {
      spanNome = document.createElement('span');
      spanNome.id = 'usuarioNome';
      spanNome.className = 'usuario-nome';
      logoutContainer.insertBefore(spanNome, logoutContainer.firstChild);
    }

    // 2. Garante que o span da ROLE existe (logo após o nome)
    let spanRole = document.getElementById('usuarioRole');
    if (!spanRole) {
      spanRole = document.createElement('span');
      spanRole.id = 'usuarioRole';
      spanNome.insertAdjacentElement('beforebegin', spanRole);
    }
    
    const user = Auth.getSessionUser();

    if (user) {
      // Define o Nome
      spanNome.textContent = user.name ? titleCase(user.name) : (user.username || 'Usuário');

      // Define a Badge de Role
      const role = (user.role || 'COMUM').toUpperCase();
      if (role === 'GERENTE') {
        spanRole.textContent = 'GERENTE';
        spanRole.className = 'role-badge badge-gerente';
      } 
      else {
        spanRole.textContent = 'TÉCNICO';
        spanRole.className = 'role-badge badge-tecnico';
      }
    } 
    else {
      spanNome.textContent = 'Usuário';
      spanRole.textContent = '';
      spanRole.className = '';
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