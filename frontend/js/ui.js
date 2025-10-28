// Cria um "namespace" global para nossos componentes de UI para evitar poluir o window
window.UI = (function () {
  
  function showToast(message, type = "success", options = {}) {
    let container = document.getElementById("toast-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      // Estilos do container foram movidos para o CSS para melhor organização
      document.body.appendChild(container);
    }

    const palette = {
      success: { bg: "#17903f", icon: "fa-solid fa-circle-check" },
      error:   { bg: "#c33a3a", icon: "fa-solid fa-circle-xmark" },
      info:    { bg: "#2f6fb2", icon: "fa-solid fa-circle-info" }
    };

    const config = palette[type] || palette.info;
    const duration = options.duration || 3500;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.style.backgroundColor = config.bg;
    
    const icon = document.createElement("i");
    icon.className = `toast__icon ${config.icon}`;
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement("div");
    text.className = 'toast__text';
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.insertBefore(toast, container.firstChild);

    // Animação de entrada
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    // Animação de saída e remoção
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      });
    }, duration);
  }

  // Expõe a função para ser usada globalmente através de UI.showToast
  return {
    showToast,
  };

})();