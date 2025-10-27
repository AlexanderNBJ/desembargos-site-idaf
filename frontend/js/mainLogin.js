document.addEventListener('DOMContentLoaded', () => {
  // pega por ID os elementos necessários

  const form = document.getElementById('loginForm');
  const usuario = document.getElementById('usuario');
  const senha = document.getElementById('senha');
  const msg = document.getElementById('loginMessage');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  // esconde a mensagem até que ocorra algo
  if (msg){ 
    msg.hidden = true; 
    msg.textContent = '';
  }

  // função de mostrar a mensagem de toast
  window.showToast = function showToast(message, type = "success", options = {}) {
    
    let container = document.getElementById("toast-container");
    
    // cria o container, caso não exista
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.position = "fixed";
      container.style.top = "16px";      
      container.style.right = "16px";    
      container.style.zIndex = "13000";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "8px";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);
    }

    // paleta de cores diferente para sucesso, erro ou informação
    const palette = {
      success: { bg: "#17903f", icon: "fa-solid fa-circle-check" },
      error:   { bg: "#c33a3a", icon: "fa-solid fa-circle-xmark" },
      info:    { bg: "#2f6fb2", icon: "fa-solid fa-circle-info" }
    };

    const p = palette[type] || palette.info;
    const duration = (options && options.duration) || 3500;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.style.pointerEvents = "auto";
    toast.style.cssText = [
      `background: ${p.bg}`,
      "color: #ffffff",
      "padding: 10px 14px",
      "border-radius: 10px",
      "box-shadow: 0 8px 28px rgba(0,0,0,0.18)",
      "display: flex",
      "gap: 10px",
      "align-items: center",
      "min-width: 220px",
      "max-width: 420px",
      "font-weight: 600",
      "font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      "transform: translateY(-12px)",
      "opacity: 0",
      "transition: transform 220ms ease, opacity 220ms ease",
      `z-index: ${options.zIndex || 13001}`
    ].join(";");

    const icon = document.createElement("i");
    icon.className = p.iconClass;
    icon.setAttribute('aria-hidden', 'true');
    icon.style.minWidth = "18px";
    icon.style.fontSize = "18px";
    icon.style.lineHeight = "1";
    icon.style.display = "inline-block";

    const text = document.createElement("div");
    text.textContent = message;
    text.style.cssText = "flex:1; color:#fff;";

    // coloca o íncone e o texto
    toast.appendChild(icon);
    toast.appendChild(text);
    
    // insere
    container.insertBefore(toast, container.firstChild);

    // faz a animação
    requestAnimationFrame(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    });

    // coloca o timeout
    setTimeout(() => {
      toast.style.transform = "translateY(-12px)";
      toast.style.opacity = "0";

      setTimeout(() => {
        try { 
          toast.remove(); 
        } 
        catch (e){}

        if (container && container.children.length === 0){
          try { 
            container.remove();
          } 
          catch (e) {}
        }
        
      }, 220);
    }, duration);
  };

  // define o que será disposto no botão de entrar
  function setSubmitting(isSubmitting) {
    if (!submitBtn) 
      return;

    // está tentando entrar, então vai mostrar um pseudocarregamento no botão
    if (isSubmitting){
      submitBtn.disabled = true;
      submitBtn.dataset._orig = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
      submitBtn.setAttribute('aria-busy', 'true');
    }

    // se não está tentando entrar, o botão fica normal
    else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset._orig || 'Entrar';
      submitBtn.removeAttribute('aria-busy');
    }
  }

  function hideInlineMessage() {
    if (!msg) 
      return;

    msg.hidden = true;
    msg.textContent = '';
  }

  async function doLogin(e) {
    e && e.preventDefault();
    hideInlineMessage();

    // pega os valores dos campos, sem espaços à esquerda ou direita
    const username = usuario ? usuario.value.trim() : '';
    const password = senha ? senha.value.trim() : '';

    // caso não tenha preenchido, avisar o erro na mensagem toast
    if (!username || !password) {
      showToast('Preencha usuário e senha.', 'error');
      return;
    }

    // está tentando fazer login
    setSubmitting(true);

    try {
      // chama a API para login
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let json = null;

      try{ 
        json = await res.json();
      } 
      catch (e){ 
        json = null;
      }
      
      // se está tudo ok, vai fazer login
      if (res.ok && json && json.code === 200 && json.value && json.value.token) {
        
        // chama Auth para fazer a sessão, colocar em cache
        Auth.setSession(json.value.token, json.value.user || { username });

        try {
          // pega as permissões do usuário que logou
          const pRes = await Auth.fetchWithAuth('/auth/permissions');

          if (pRes && pRes.ok) {
            const perm = await pRes.json();
            localStorage.setItem('dashboardPerm', JSON.stringify(perm));
          }
        } 
        catch (err) {}
        
        // vai pro menu principal
        window.location.href = 'menuPrincipal.html'
      }
      
      // se não está ok, retorna o erro
      else {
        const serverMsg = (json && (json.message || json.msg || json.error)) ? (json.message || json.msg || json.error) : 'Login falhou — verifique suas credenciais.';
        showToast(serverMsg, 'error', { duration: 6000 });
      }
    } 
    
    // caso ocorra algum erro, dispõe o erro e altera o estado do botão de login
    catch (err) {
      console.error('login error', err);
      const netMsg = 'Erro de conexão com o servidor.';
      showToast(netMsg, 'error', { duration: 6000 });
    } 
    finally {
      setSubmitting(false);
    }
  }

  if (form) form.addEventListener('submit', doLogin);

  // fazer o login ao apertar enter
  [usuario, senha].forEach(input => input && input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLogin();
    }
  }));

});
