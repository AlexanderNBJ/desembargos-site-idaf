document.addEventListener('DOMContentLoaded', () => {
  // Elementos de UI
  const ui = {
    form: document.getElementById('loginForm'),
    usuarioInput: document.getElementById('usuario'),
    senhaInput: document.getElementById('senha'),
    submitBtn: document.querySelector('#loginForm button[type="submit"]'),
  };

  // Se o formulário não existir na página, não faz mais nada
  if (!ui.form) return;

  /**
   * Atualiza o estado visual do botão de submit.
   * @param {boolean} isSubmitting - True se o formulário está sendo enviado.
   */
  function setSubmittingState(isSubmitting) {
    if (!ui.submitBtn) return;

    if (isSubmitting) {
      ui.submitBtn.disabled = true;
      ui.submitBtn.dataset.originalHtml = ui.submitBtn.innerHTML;
      ui.submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
    } else {
      ui.submitBtn.disabled = false;
      ui.submitBtn.innerHTML = ui.submitBtn.dataset.originalHtml || 'Entrar';
    }
  }
  
  /**
   * Lida com a resposta de sucesso da API de login.
   * @param {object} loginData - O objeto 'value' da resposta da API.
   */
  async function handleLoginSuccess(loginData) {
    Auth.setSession(loginData.token, loginData.user);

    try {
      const pRes = await Auth.fetchWithAuth('/auth/permissions');
      if (pRes.ok) {
        const perm = await pRes.json();
        localStorage.setItem('dashboardPerm', JSON.stringify(perm));
      }
    } catch (error) {
      console.warn('Não foi possível buscar as permissões após o login.', error);
    }
    
    window.location.href = 'menuPrincipal.html';
  }

  /**
   * Lida com erros de login, mostrando uma mensagem para o usuário.
   * @param {object} errorData - O JSON de erro da resposta da API.
   */
  function handleLoginFailure(errorData) {
    const message = errorData?.message || 'Login falhou. Verifique suas credenciais.';
    UI.showToast(message, 'error', { duration: 5000 });
  }

  /**
   * Orquestra o processo de envio do formulário de login.
   * @param {Event} event - O evento de submit do formulário.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    const username = ui.usuarioInput.value.trim();
    const password = ui.senhaInput.value.trim();

    if (!username || !password) {
      UI.showToast('Preencha usuário e senha.', 'error');
      return;
    }

    setSubmittingState(true);

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();

      if (response.ok) {
        await handleLoginSuccess(data.value);
      } else {
        handleLoginFailure(data);
      }
    } catch (error) {
      console.error('Erro de conexão durante o login:', error);
      UI.showToast('Erro de conexão com o servidor.', 'error', { duration: 5000 });
    } finally {
      setSubmittingState(false);
    }
  }

  // --- Inicialização dos Event Listeners ---
  ui.form.addEventListener('submit', handleSubmit);

  // Permite login com a tecla "Enter"
  [ui.usuarioInput, ui.senhaInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    });
  });
});