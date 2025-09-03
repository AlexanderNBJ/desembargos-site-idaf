// js/mainFormularios.js
// Mantém as assinaturas e comportamentos originais,
// adiciona modal de confirmação no submit (prévia no iframe, sem download).

document.addEventListener('DOMContentLoaded', () => {

  // ------------------ AUTH HELPERS (expostos globalmente) ------------------
  window.getStoredToken = function getStoredToken() {
    if (window.Auth && typeof Auth.getSessionToken === 'function') {
      try { const t = Auth.getSessionToken(); if (t) return t; } catch {}
    }
    return localStorage.getItem('sessionToken') || localStorage.getItem('token') || null;
  };

  window.getAuthHeaders = function getAuthHeaders(contentType = 'application/json') {
    const token = getStoredToken();
    const headers = {};
    if (contentType && contentType !== 'form') headers['Content-Type'] = contentType;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  };

  window.getUsuarioLogado = async function getUsuarioLogado() {
    // tenta endpoints em ordem (português/english)
    const tries = ['/api/usuarios/me', '/api/users/me'];
    for (const path of tries) {
      try {
        const res = await fetch(path, { method: 'GET', headers: getAuthHeaders() });
        if (!res.ok) continue; // tenta próximo
        const data = await res.json();
        // aceita { success: true, name, position } ou { name, position }
        const name = data.name || (data.data && data.data.name) || null;
        const position = data.position || (data.data && data.data.position) || null;
        return {
          name: name || '-',
          position: position || '-'
        };
      } catch (err) {
        // tenta próximo
      }
    }
    console.error('Erro ao buscar usuário logado: não foi possível obter resposta válida');
    return { name: '-', position: '-' };
  };

  // ------------------ elementos do DOM ------------------
  const form = document.getElementById('desembargoForm');
  const modal = document.getElementById('modalPrevia');
  const iframePreview = document.getElementById('pdfPreview');
  const confirmarBtn = document.getElementById('confirmarEnvio');
  const cancelarBtn = document.getElementById('cancelarEnvio');
  const fecharTopo = document.getElementById('fecharModalTopo');
  const previewBtn = document.getElementById('previewBtn'); // se existir
  const mensagemDiv = document.getElementById('mensagem-insercao');

  let currentPreviewUrl = null;

  // ------------------ CAMPOS DO FORMULÁRIO ------------------
  const campos = [
    'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
    'numeroSEP', 'numeroEdocs', 'tipoDesembargo', 'dataDesembargo',
    'coordenadaX', 'coordenadaY', 'descricao'
  ];

  // ------------------ FUNÇÃO GENÉRICA DE VALIDAÇÃO DE CAMPO ------------------
  window.validarCampo = async function validarCampo(nomeDoCampo, valor) {
    try {
      const res = await fetch('/api/desembargos/validate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ [nomeDoCampo]: valor })
      });
      const data = await res.json();
      return data.errors?.[nomeDoCampo] || '';
    } catch (err) {
      console.error('Erro na validação:', err);
      return 'Erro ao validar';
    }
  };

  // ======= ADICIONA LISTENERS DE VALIDAÇÃO (por campo) =======
  campos.forEach(campo => {
    if (campo === 'tipoDesembargo') {
      document.querySelectorAll('input[name="tipoDesembargo"]').forEach(radio => {
        radio.addEventListener('change', async () => {
          const erro = await validarCampo('tipoDesembargo', radio.value.toUpperCase());
          const el = document.getElementById('error-tipoDesembargo');
          if (el) el.textContent = erro;
        });
      });
    } else {
      const input = document.getElementById(campo);
      if (!input) return;
      input.addEventListener('blur', async () => {
        const erro = await validarCampo(campo, input.value);
        const el = document.getElementById(`error-${campo}`);
        if (el) el.textContent = erro;
      });
    }
  });

  // ======= FUNÇÃO PARA PREENCHER FORMULÁRIO (exposta globalmente) =======
  window.preencherFormulario = function preencherFormulario(data) {
    campos.forEach(campo => {
      if (campo === 'tipoDesembargo' && data.tipoDesembargo) {
        document.querySelectorAll('input[name="tipoDesembargo"]').forEach(radio => {
          radio.checked = radio.value.toUpperCase() === data.tipoDesembargo.toUpperCase();
        });
      } else if (campo === 'dataDesembargo' && data.dataDesembargo) {
        document.getElementById('dataDesembargo').value = new Date(data.dataDesembargo).toISOString().split("T")[0];
      } else {
        const input = document.getElementById(campo);
        if (input) input.value = data[campo] ?? '';
      }
    });
  };

  // ======= FUNÇÃO PARA OBTER DADOS DO FORMULÁRIO (exposta globalmente, igual ao original) =======
  window.obterDadosFormulario = function obterDadosFormulario() {
    const dataInput = document.getElementById('dataDesembargo').value; // YYYY-MM-DD
    const [ano, mes, dia] = dataInput.split('-');
    const dataLocal = new Date(ano, mes - 1, dia); // 00:00 local
    return {
      numero: parseInt(document.getElementById('numero').value),
      serie: document.getElementById('serie').value,
      nomeAutuado: document.getElementById('nomeAutuado').value,
      area: parseFloat(document.getElementById('area').value),
      processoSimlam: document.getElementById('processoSimlam').value,
      numeroSEP: document.getElementById('numeroSEP').value.trim() || null,
      numeroEdocs: document.getElementById('numeroEdocs').value.trim() || null,
      tipoDesembargo: (() => {
        const radio = document.querySelector('input[name="tipoDesembargo"]:checked');
        return radio ? radio.value.toUpperCase() : '';
      })(),
      dataDesembargo: dataLocal.toISOString(),
      coordenadaX: parseFloat(document.getElementById('coordenadaX').value),
      coordenadaY: parseFloat(document.getElementById('coordenadaY').value),
      descricao: document.getElementById('descricao').value
    };
  };

  // ======= FUNÇÃO DE VALIDAÇÃO COMPLETA VIA BACKEND (exposta globalmente) =======
  window.validarFormularioBackend = async function validarFormularioBackend(formData) {
    campos.forEach(campo => {
      const el = document.getElementById(`error-${campo}`);
      if (el) el.textContent = '';
    });

    try {
      const res = await fetch('/api/desembargos/validate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success === false && data.errors) {
        Object.keys(data.errors).forEach(campo => {
          const el = document.getElementById(`error-${campo}`);
          if (el) el.textContent = data.errors[campo];
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Erro ao validar formulário:', err);
      return false;
    }
  };

  // ------------------ VALIDAÇÃO NÚMERO DO PROCESSO + CHECK (igual ao original) ------------------
  window.validarNumeroESerieEmbargo = async function validarNumeroESerieEmbargo() {
    const numero = document.getElementById('numero').value.trim();
    const erroNumero = document.getElementById('error-numero');
    const mensagemSpan = document.getElementById('mensagem-numero');
    if (erroNumero) erroNumero.textContent = '';
    if (mensagemSpan) {
      mensagemSpan.textContent = '';
      mensagemSpan.classList.remove('sucesso', 'erro');
    }

    try {
      const res = await fetch('/api/desembargos/validate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ numero })
      });
      const data = await res.json();
      if (data.errors?.numero) {
        if (erroNumero) erroNumero.textContent = data.errors.numero;
        return;
      }

      const checkRes = await fetch(`/api/embargos/check/${encodeURIComponent(numero)}`, { headers: getAuthHeaders(), method: 'GET' });
      const checkData = await checkRes.json();
      if (mensagemSpan) {
        mensagemSpan.textContent = checkData.message;
        mensagemSpan.classList.add(checkData.success ? 'sucesso' : 'erro');
      }
    } catch (err) {
      console.error('Erro na validação/busca:', err);
      if (mensagemSpan) {
        mensagemSpan.textContent = 'Erro ao validar ou consultar o servidor';
        mensagemSpan.classList.add('erro');
      }
    }
  };

  const numeroEl = document.getElementById('numero');
  if (numeroEl) numeroEl.addEventListener('blur', validarNumeroESerieEmbargo);

  // ------------------ SETA DATA DO DIA (igual ao original) ------------------
  const dataEl = document.getElementById('dataDesembargo');
  if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];

  // ------------------ BUSCA POR PROCESSO SIMLAM (igual ao original, preservado) ------------------
  const btnBuscarProcesso = document.getElementById('btnBuscarProcesso');
  if (btnBuscarProcesso) {
    btnBuscarProcesso.addEventListener('click', async () => {
      const proc = document.getElementById('processoSimlam').value.trim();
      if (!proc) return;

      try {
        const res = await fetch(`/api/desembargos/processo?valor=${encodeURIComponent(proc)}`, {
          method: 'GET',
          headers: getAuthHeaders()
        });

        const data = await res.json();

        if (res.ok) {
          const msgEl = document.getElementById("mensagem-busca");
          if (msgEl) { msgEl.textContent = "Processo encontrado!"; msgEl.classList.add("sucesso"); }
          preencherFormulario(data);

          // Validação backend após preencher
          const formData = obterDadosFormulario();
          await validarFormularioBackend(formData);

          console.log("Processo:", data);
        } else {
          const msgEl = document.getElementById("mensagem-busca");
          if (msgEl) { msgEl.textContent = data.message || "Não encontrado"; msgEl.classList.add("erro"); }
        }

      } catch (err) {
        console.error("Erro na busca:", err);
        const msgEl = document.getElementById("mensagem-busca");
        if (msgEl) { msgEl.textContent = "Erro ao consultar o servidor"; msgEl.classList.add("erro"); }
      }
    });
  }

  // ------------------ GERAR PRÉVIA (reaproveitado, sem salvar arquivo) ------------------
  function gerarPreviewPDFDoc(previewObj) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 40;
    const primaryColor = "#17903f"; // verde do site
    const secondaryColor = "#444";   // cinza
    const lineHeight = 18;

    // ================= Cabeçalho =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primaryColor);
    doc.text("www.idaf.es.gov.br", 40, y);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(secondaryColor);
    doc.setDrawColor(200);
    doc.setLineWidth(0.8);
    doc.line(40, y, 555, y);
    y += 20;

    // ================= Título =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor);
    doc.text(`TERMO DE DESEMBARGO Nº ${previewObj.numero_embargo || 'X'}/${previewObj.serie_embargo || ''}`, 40, y);
    y += 25;

    // ================= Disclaimer =================
    doc.setFontSize(10);
    doc.setTextColor("#666");
    const disclaimer = "AVISO: ESTE DOCUMENTO É APENAS UMA PRÉVIA. Somente terá validade após inclusão e assinatura no sistema EDOC-s.";
    const discLines = doc.splitTextToSize(disclaimer, 515);
    doc.text(discLines, 40, y);
    y += discLines.length * (lineHeight - 4);
    y += 6;

    doc.setTextColor(secondaryColor);
    doc.setDrawColor(200);
    doc.setLineWidth(0.8);
    doc.line(40, y, 555, y);
    y += 30;

    // ================= Informações principais =================
    const infoFields = [
      { label: "Termo de Embargo Ambiental", value: `${previewObj.numero_embargo || '-'} ${previewObj.serie_embargo || '-'}` },
      { label: "Processo Simlam", value: previewObj.processo_simlam || '-' },
      { label: "Processo E-Docs", value: previewObj.numero_edocs || '-' },
      { label: "Número do SEP", value: previewObj.numero_sep || '-' },
      { label: "Autuado", value: previewObj.nome_autuado || '-' },
      { label: "Área Desembargada", value: `${previewObj.area_desembargada ?? '-'} ${previewObj.area_desembargada && previewObj.area_desembargada !== '-' ? 'ha' : ''}` },
      { label: "Tipo de Desembargo", value: (previewObj.tipo_desembargo || '-').toUpperCase() },
      { label: "Data do Desembargo", value: previewObj.data_desembargo ? (new Date(previewObj.data_desembargo)).toLocaleDateString() : '-' },
      { label: "Coordenadas UTM", value: `X(m): ${previewObj.coordenada_x ?? '-'}, Y(m): ${previewObj.coordenada_y ?? '-'}` },
    ];

    const labelX = 40;
    const valueX = 250;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primaryColor);

    infoFields.forEach(item => {
      const label = String(item.label || "");
      const value = String(item.value ?? "-");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor);
      doc.text(label + ":", labelX, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(secondaryColor);

      // quebra de linha se value for longo
      const valLines = doc.splitTextToSize(value, 280);
      doc.text(valLines, valueX, y);
      y += valLines.length * lineHeight;
    });

    y += 10;

    // ================= Descrição =================
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Descrição do Desembargo:", 40, y);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(secondaryColor);
    const descricaoSplit = doc.splitTextToSize(previewObj.descricao || '-', 515);
    doc.text(descricaoSplit, 40, y);
    y += descricaoSplit.length * lineHeight + 10;

    // ================= Assinatura =================
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Prévia de Desembargo feita por:", 40, y);
    y += lineHeight;

    doc.setTextColor(secondaryColor);
    doc.text(String(previewObj.responsavel_desembargo || "-"), 40, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text(String(previewObj.cargo_responsavel || "-"), 40, y);
    y += lineHeight;

    return doc;
  }

  async function gerarPreviewBlob(formData) {
    const usuario = await getUsuarioLogado();
    const previewObj = {
      id: formData.numero ?? '-', // só para título
      numero_embargo: formData.numero ?? '-',
      serie_embargo: formData.serie ?? '-',
      processo_simlam: formData.processoSimlam ?? '-',
      numero_edocs: formData.numeroEdocs ?? '-',
      numero_sep: formData.numeroSEP ?? '-',
      nome_autuado: formData.nomeAutuado ?? '-',
      area_desembargada: (Number.isFinite(formData.area) ? formData.area : (formData.area ?? '-')),
      tipo_desembargo: (formData.tipoDesembargo || '-'),
      data_desembargo: formData.dataDesembargo || null,
      coordenada_x: Number.isFinite(formData.coordenadaX) ? formData.coordenadaX : (formData.coordenadaX ?? '-'),
      coordenada_y: Number.isFinite(formData.coordenadaY) ? formData.coordenadaY : (formData.coordenadaY ?? '-'),
      descricao: formData.descricao || '-',
      responsavel_desembargo: usuario.name || '-',
      cargo_responsavel: usuario.position || '-'
    };

    const doc = gerarPreviewPDFDoc(previewObj);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }

  // ------------------ MODAL: open / close ------------------
  function openModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (currentPreviewUrl) {
      try { URL.revokeObjectURL(currentPreviewUrl); } catch (e) { /* ignore */ }
      currentPreviewUrl = null;
    }
    if (iframePreview) iframePreview.src = 'about:blank';
    // focus no primeiro campo pra continuar preenchimento
    try { document.getElementById('numero').focus(); } catch (e) { /* ignore */ }
  }

  // ------------------ SUBMIT DO FORMULÁRIO: mostra modal com prévia ------------------
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const formData = obterDadosFormulario();

      // Validação local SEP ou eDocs obrigatórios
      if (!formData.numeroSEP && !formData.numeroEdocs) {
        const elSep = document.getElementById('error-numeroSEP');
        const elEdocs = document.getElementById('error-numeroEdocs');
        if (elSep) elSep.textContent = 'Preencha pelo menos SEP ou e-Docs';
        if (elEdocs) elEdocs.textContent = 'Preencha pelo menos SEP ou e-Docs';
        return;
      }

      const valido = await validarFormularioBackend(formData);
      if (!valido) return;

      // gera preview e abre modal (preview no iframe; sem download)
      try {
        if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
        currentPreviewUrl = await gerarPreviewBlob(formData);
        if (iframePreview) iframePreview.src = currentPreviewUrl;
        openModal();
        showToast('Prévia gerada — revise e confirme antes de enviar.', 'info');
      } catch (err) {
        console.error('Erro ao gerar preview para modal:', err);
        showToast('Erro ao gerar prévia', 'error');
      }
    });
  }

  // ------------------ CONFIRMAR ENVIO: realiza POST (mantendo comportamento original) ------------------
// ------------------ CONFIRMAR ENVIO: realiza POST com toasts melhores ------------------
if (confirmarBtn) {
  confirmarBtn.addEventListener('click', async () => {
    // previne cliques repetidos e dá feedback visual imediato
    confirmarBtn.disabled = true;
    const originalHTML = confirmarBtn.innerHTML;
    confirmarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    // limpa mensagens de erro anteriores (se houver)
    campos.forEach(campo => {
      const el = document.getElementById(`error-${campo}`);
      if (el) el.textContent = '';
    });

    const formData = obterDadosFormulario();

    try {
      const resInsert = await fetch('/api/desembargos/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      // tenta ler resposta como json, mesmo em erro HTTP
      let dataInsert = null;
      try {
        dataInsert = await resInsert.json();
      } catch (parseErr) {
        // resposta não é json
        console.error('Resposta do servidor não foi JSON:', parseErr);
      }

      // caso 2xx com success true
      if (resInsert.ok && dataInsert && dataInsert.success) {
        showToast("Desembargo inserido com sucesso!", "success");
        form.reset();
        if (document.getElementById("dataDesembargo")) {
          document.getElementById("dataDesembargo").value = new Date().toISOString().split('T')[0];
        }
        closeModal();
      } else {
        // tenta extrair mensagens úteis do backend
        // Prioridade: dataInsert.message -> dataInsert.errors (obj de campos) -> status text
        const serverMsg = dataInsert && (dataInsert.message || dataInsert.msg || dataInsert.error) ? (dataInsert.message || dataInsert.msg || dataInsert.error) : null;

        // se houver erros de validação por campo, exibe nos elementos #error-<campo>
        if (dataInsert && dataInsert.errors && typeof dataInsert.errors === 'object') {
          Object.keys(dataInsert.errors).forEach(campo => {
            const el = document.getElementById(`error-${campo}`);
            if (el) el.textContent = dataInsert.errors[campo];
          });
          showToast("Existem erros no formulário. Verifique os campos em destaque.", "error", { duration: 6000 });
          // mantém o modal aberto para correção
        } else if (serverMsg) {
          // mensagem genérica do servidor (p.ex. erro no BD)
          showToast(`Erro: ${serverMsg}`, "error", { duration: 6000 });
        } else {
          // fallback usando status
          const statusText = resInsert.status ? `(${resInsert.status} ${resInsert.statusText || ''})` : '';
          showToast(`Erro ao inserir desembargo ${statusText}`, "error", { duration: 6000 });
        }
      }
    } catch (err) {
      // erro de rede / fetch
      console.error('Erro ao processar formulário:', err);
      showToast("Erro de rede ao comunicar com o servidor. Verifique sua conexão.", "error", { duration: 6000 });
    } finally {
      // restaura botão
      confirmarBtn.disabled = false;
      confirmarBtn.innerHTML = originalHTML || '<i class="fa-solid fa-check"></i> Confirmar Envio';
    }
  });
}


  // ------------------ CANCELAR / FECHAR ------------------
  if (cancelarBtn) cancelarBtn.addEventListener('click', () => closeModal());
  if (fecharTopo) fecharTopo.addEventListener('click', () => closeModal());

  if (modal) {
    // fechar clicando no overlay (fora do modal-content)
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });
  }

  // Esc fecha
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal();
  });

  // ------------------ showToast (mantido) ------------------
// ------------------ showToast (versão robusta, cria container se necessário) ------------------
// ------------------ showToast (substitua a versão anterior por esta) ------------------
window.showToast = function showToast(message, type = "success", options = {}) {
  // garante container
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.position = "fixed";
    container.style.right = "16px";
    container.style.bottom = "16px";
    container.style.zIndex = "12000";   // alto pra ficar acima do modal
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    document.body.appendChild(container);
  }

  // cores por tipo
  const palette = {
    success: { bg: "#17903f", icon: "fa-solid fa-circle-check" },
    error:   { bg: "#c33a3a", icon: "fa-solid fa-circle-xmark" },
    info:    { bg: "#2f6fb2", icon: "fa-solid fa-circle-info" }
  };
  const p = palette[type] || palette.info;
  const duration = (options && options.duration) || 3500;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  // inline style para evitar conflito com CSS global
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
    "transform: translateY(12px)",
    "opacity: 0",
    "transition: transform 220ms ease, opacity 220ms ease",
    `z-index: ${options.zIndex || 12001}`
  ].join(";");

  const icon = document.createElement("i");
  icon.className = p.icon;
  icon.style.cssText = "color: #ffffff; min-width:18px; font-size:18px;";

  const text = document.createElement("div");
  text.textContent = message;
  text.style.cssText = "flex:1; color:#fff;";

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // anima entrada
  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });

  // remove depois do tempo
  setTimeout(() => {
    toast.style.transform = "translateY(12px)";
    toast.style.opacity = "0";
    setTimeout(() => {
      try { toast.remove(); } catch (e) {}
      if (container && container.children.length === 0) {
        try { container.remove(); } catch (e) {}
      }
    }, 220);
  }, duration);
};



}); // fim DOMContentLoaded
