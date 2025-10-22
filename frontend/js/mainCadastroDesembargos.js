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
      } 
      else if (campo === 'dataDesembargo' && !data.dataDesembargo) {
        document.getElementById('dataDesembargo').value = new Date().toISOString().split('T')[0];
      } 
      else {
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

// ------------------ BUSCA POR PROCESSO (usa tabela embargos) - versão com loading/clear ------------------
const btnBuscarProcesso = document.getElementById('btnBuscarProcesso');

if (btnBuscarProcesso) {

  // helper: cria e mostra overlay de loading (se já existir, apenas mostra)
  function showLoadingOverlay(msg = "Buscando processo...") {
    let overlay = document.getElementById('overlayLoading');
    if (!overlay) {
      // estilo base do overlay e spinner (injetado via JS pra evitar editar CSS externo)
      const style = document.createElement('style');
      style.id = 'overlayLoadingStyles';
      style.innerHTML = `
        #overlayLoading {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 13000;
        }
        #overlayLoading .box {
          background: #fff;
          padding: 14px 18px;
          border-radius: 10px;
          display:flex;
          align-items:center;
          gap:12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          font-weight:600;
          color:#222;
        }
        #overlayLoading .spinner {
          width:28px;
          height:28px;
          border-radius:50%;
          border:4px solid rgba(0,0,0,0.12);
          border-top-color: #17903f;
          animation: overlaySpin 800ms linear infinite;
          box-sizing: border-box;
        }
        @keyframes overlaySpin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);

      overlay = document.createElement('div');
      overlay.id = 'overlayLoading';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = `<div class="box"><div class="spinner" aria-hidden="true"></div><div class="text">${msg}</div></div>`;
      document.body.appendChild(overlay);
    } else {
      const text = overlay.querySelector('.text');
      if (text) text.textContent = msg;
      overlay.style.display = 'flex';
    }
    // sinal de busy para leitores de tela
    document.body.setAttribute('aria-busy', 'true');
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('overlayLoading');
    if (overlay) overlay.style.display = 'none';
    document.body.removeAttribute('aria-busy');
  }

  // helper: limpa formulário e mensagens
  function limparFormularioEMensagens() {
    try {
      if (form) form.reset();
      // data volta para hoje (mesma lógica anterior)
      const dataElLocal = document.getElementById('dataDesembargo');
      if (dataElLocal) dataElLocal.value = new Date().toISOString().split('T')[0];

      // limpa erros por campo
      const els = document.querySelectorAll('[id^="error-"]');
      els.forEach(e => { e.textContent = ''; });

      // limpa mensagens de busca/insercao
      const msgBusca = document.getElementById('mensagem-busca');
      if (msgBusca) { msgBusca.textContent = ''; msgBusca.classList.remove('sucesso', 'erro'); }

      const mensagemInsercao = document.getElementById('mensagem-insercao');
      if (mensagemInsercao) mensagemInsercao.textContent = '';

      // limpa iframe preview se estiver aberto
      const iframePreviewLocal = document.getElementById('pdfPreview');
      if (iframePreviewLocal) iframePreviewLocal.src = 'about:blank';
    } catch (e) {
      // se algo falhar ao limpar, ignora, mas loga
      console.error('Erro ao limpar formulário:', e);
    }
  }

  btnBuscarProcesso.addEventListener('click', async () => {
    const proc = document.getElementById('processoSimlam').value.trim();
    if (!proc) return;

    // desabilita botão e mostra overlay
    btnBuscarProcesso.disabled = true;
    showLoadingOverlay('Buscando processo...');

    try {
      // novo endpoint: /api/embargos/processo?valor=...
      const res = await fetch(`/api/embargos/processo?valor=${encodeURIComponent(proc)}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      // tenta ler json; se falhar, assume sem resultado
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }

      // sucesso HTTP e payload com algo útil
      if (res.ok && data && Object.keys(data).length > 0) {
        // mensagem de sucesso na UI
        const msgEl = document.getElementById("mensagem-busca");
        if (msgEl) { msgEl.textContent = "Registro de embargo encontrado!"; msgEl.classList.remove('erro'); msgEl.classList.add("sucesso"); }

        // mapear campos do registro de embargo para o formato esperado pelo preencherFormulario
        const mapped = {
          numero: data.n_iuf_emb || data.numero || '',
          serie: data.serie || '',
          processoSimlam: data.processo || data.processo_simlam || proc,
          numeroSEP: null,
          numeroEdocs: null,
          nomeAutuado: data.nome_autuado || data.autuado || data.nome || '',
          area: (data.area_desembargada ?? data.area) ?? '',
          coordenadaX: (data.easting ?? data.easting_m ?? data.coordenada_x ?? data.coordenadaX ?? '') ,
          coordenadaY: (data.northing ?? data.northing_m ?? data.coordenada_y ?? data.coordenadaY ?? ''),
          descricao: data.descricao || data.obs || ''
        };

        let effectiveTipo = mapped.tipoDesembargo;
        if (!effectiveTipo) {
          const sel = document.querySelector('input[name="tipoDesembargo"]:checked');
          if (sel && sel.value) effectiveTipo = sel.value.toString().toUpperCase();
        }

        // Preenche a área somente se for TOTAL
        if (effectiveTipo === 'TOTAL') {
          mapped.area = (data.area_desembargada ?? data.area ?? '') ;
          showToast("O valor de área é válido apenas para desembargo TOTAL", "info", { duration: 4500 });
        } else {
          // garante string vazia (campo não será preenchido)
          mapped.area = '';
        }

        if (data.sep_edocs) {
          const seped = String(data.sep_edocs);
          if (seped.includes('-')) mapped.numeroEdocs = seped;
          else mapped.numeroSEP = seped;
        } else if (data.sep) {
          mapped.numeroSEP = String(data.sep);
        } else if (data.numero_edocs) {
          mapped.numeroEdocs = String(data.numero_edocs);
        }

        // Preenche o formulário usando sua função existente
        preencherFormulario(mapped);

        // Validação backend após preencher (mantém comportamento original)
        const formData = obterDadosFormulario();
        await validarFormularioBackend(formData);

      } else {
        // nenhum registro encontrado: limpa formulário e dá feedback
        limparFormularioEMensagens();
        showToast("Nenhum registro encontrado para o processo informado.", "info", { duration: 4500 });
      }

    } catch (err) {
      console.error("Erro na busca (embargos):", err);
      // erro de rede: limpa e avisa
      limparFormularioEMensagens();
      const msgEl = document.getElementById("mensagem-busca");
      if (msgEl) { msgEl.textContent = "Erro ao consultar o servidor"; msgEl.classList.remove('sucesso'); msgEl.classList.add("erro"); }
      showToast("Erro ao consultar o servidor. Verifique sua conexão.", "error", { duration: 6000 });
    } finally {
      // sempre reativa botão e remove overlay
      btnBuscarProcesso.disabled = false;
      hideLoadingOverlay();
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
    const logoEl = document.getElementById("logoPdf");

    if (logoEl) {
      doc.addImage(logoEl, "PNG", 30, 20, 540, 90);
      y += 100;
    }

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
    texto_aux_header='OFÍCIO DE INDEFERIMENTO';

    if (previewObj.tipo_desembargo.toUpperCase() != 'INDEFERIMENTO'){
      texto_aux_header= 'TERMO DE DESEMBARGO';
    }
    
    doc.text(`${texto_aux_header} Nº X/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center');

    
    y += 10;

    doc.setTextColor(secondaryColor);
    doc.setDrawColor(200);
    doc.setLineWidth(0.8);
    doc.line(40, y, 555, y);
    y += 30;

    // ================= Informações principais =================
    const infoFields = [
      { label: "Termo de Embargo Ambiental", value: `${previewObj.numero_embargo || '-'} ${previewObj.serie_embargo.toUpperCase() || '-'}` },
      { label: "Processo Simlam", value: previewObj.processo_simlam || '-' },
      { label: "Processo E-Docs", value: previewObj.numero_edocs || '-' },
      { label: "Número do SEP", value: previewObj.numero_sep || '-' },
      { label: "Autuado", value: previewObj.nome_autuado.toUpperCase() || '-' },
      { label: "Área Desembargada", value: `${previewObj.area_desembargada ?? '-'} ${previewObj.area_desembargada && previewObj.area_desembargada !== '-' ? 'ha' : ''}` },
      { label: "Tipo de Desembargo", value: (previewObj.tipo_desembargo || '-').toUpperCase() },
      { label: "Data do Desembargo", value: previewObj.data_desembargo ? (new Date(previewObj.data_desembargo)).toLocaleDateString() : '-' },
      { label: "Coordenadas UTM", value: `X(m): ${previewObj.coordenada_x ?? '-'}, Y(m): ${previewObj.coordenada_y ?? '-'}` },
    ];

    const labelX = 40;
    const valueX = 250;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    //doc.setTextColor(primaryColor);

    infoFields.forEach(item => {
      const label = String(item.label || "");
      const value = String(item.value ?? "-");

      doc.setFont("helvetica", "bold");
      //doc.setTextColor(primaryColor);
      doc.text(label + ":", labelX, y);

      doc.setFont("helvetica", "normal");
      //doc.setTextColor(secondaryColor);

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
    const descricaoSplit = doc.splitTextToSize(previewObj.descricao || '-', 515, { maxWidth: 500,align: 'justify'});
    doc.text(descricaoSplit, 40, y);
    y += descricaoSplit.length * lineHeight + 10;

    // ================= Assinatura =================
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    //doc.text("Prévia de Desembargo feita por:", 40, y);
    //y += lineHeight;

    doc.setTextColor(secondaryColor);
    doc.text(String(previewObj.responsavel_desembargo || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center');
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(primaryColor);
    doc.text(String(previewObj.cargo_responsavel || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center');
    y += 2*lineHeight;

    // ================= Disclaimer =================
    doc.setFontSize(10);
    doc.setTextColor("#666");
    const disclaimer = "AVISO: ESTE DOCUMENTO É APENAS UMA PRÉVIA. Uma vez aprovado, o termo somente terá validade após sua inclusão e assinatura no sistema EDOC-s.";
    const discLines = doc.splitTextToSize(disclaimer, 515);
    doc.text(discLines, 40, y);
    y += discLines.length * (lineHeight - 4);
    y += 6;

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
