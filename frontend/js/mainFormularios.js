function getStoredToken() {
  if (window.Auth && typeof Auth.getSessionToken === 'function') {
    try { const t = Auth.getSessionToken(); if (t) return t; } catch {}
  }
  return localStorage.getItem('sessionToken') || localStorage.getItem('token') || null;
}

function getAuthHeaders(contentType = 'application/json') {
  const token = getStoredToken();
  const headers = {};
  if (contentType && contentType !== 'form') headers['Content-Type'] = contentType;
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

async function getUsuarioLogado() {
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
}



// ======= CAMPOS DO FORMULÁRIO =======
const campos = [
  'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
  'numeroSEP', 'numeroEdocs', 'tipoDesembargo', 'dataDesembargo',
  'coordenadaX', 'coordenadaY', 'descricao'
];

const mensagemDiv = document.getElementById('mensagem-insercao');

// ======= FUNÇÃO GENÉRICA DE VALIDAÇÃO DE CAMPO =======
async function validarCampo(nomeDoCampo, valor) {
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
}

// ======= ADICIONA LISTENERS DE VALIDAÇÃO =======
campos.forEach(campo => {
  if (campo === 'tipoDesembargo') {
    document.querySelectorAll('input[name="tipoDesembargo"]').forEach(radio => {
      radio.addEventListener('change', async () => {
        const erro = await validarCampo('tipoDesembargo', radio.value.toUpperCase());
        document.getElementById('error-tipoDesembargo').textContent = erro;
      });
    });
  } else {
    const input = document.getElementById(campo);
    if (!input) return;
    input.addEventListener('blur', async () => {
      const erro = await validarCampo(campo, input.value);
      document.getElementById(`error-${campo}`).textContent = erro;
    });
  }
});

// ======= FUNÇÃO PARA PREENCHER FORMULÁRIO =======
function preencherFormulario(data) {
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
}

// ======= FUNÇÃO PARA OBTER DADOS DO FORMULÁRIO =======
function obterDadosFormulario() {
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
}
// ======= FUNÇÃO DE VALIDAÇÃO COMPLETA VIA BACKEND =======
async function validarFormularioBackend(formData) {
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
}

// ======= SUBMIT DO FORMULÁRIO =======
const form = document.getElementById('desembargoForm');
form.addEventListener('submit', async e => {
  e.preventDefault();

  const formData = obterDadosFormulario();

  // Validação local SEP ou eDocs obrigatórios
  if (!formData.numeroSEP && !formData.numeroEdocs) {
    document.getElementById('error-numeroSEP').textContent = 'Preencha pelo menos SEP ou e-Docs';
    document.getElementById('error-numeroEdocs').textContent = 'Preencha pelo menos SEP ou e-Docs';
    return;
  }

  const valido = await validarFormularioBackend(formData);
  if (!valido) return;

  try {
    const resInsert = await fetch('/api/desembargos/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(formData)
    });
    const dataInsert = await resInsert.json();

    if (dataInsert.success) {
      showToast("Desembargo inserido com sucesso!", "success");
      form.reset();
      document.getElementById("dataDesembargo").value = new Date().toISOString().split('T')[0];
    } else {
      showToast(dataInsert.message || "Erro ao inserir desembargo", "error");
    }
  } catch (err) {
    console.error('Erro ao processar formulário:', err);
    showToast("Erro ao processar formulário", "error");
  }
});

// ======= VALIDAÇÃO NÚMERO DO PROCESSO + CHECK =======
async function validarNumeroESerieEmbargo() {
  const numero = document.getElementById('numero').value.trim();
  const erroNumero = document.getElementById('error-numero');
  const mensagemSpan = document.getElementById('mensagem-numero');
  erroNumero.textContent = '';
  mensagemSpan.textContent = '';
  mensagemSpan.classList.remove('sucesso', 'erro');

  try {
    const res = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ numero })
    });
    const data = await res.json();
    if (data.errors?.numero) {
      erroNumero.textContent = data.errors.numero;
      return;
    }

    const checkRes = await fetch(`/api/embargos/check/${numero}`, { headers: getAuthHeaders(), method: 'GET' });
    const checkData = await checkRes.json();
    mensagemSpan.textContent = checkData.message;
    mensagemSpan.classList.add(checkData.success ? 'sucesso' : 'erro');

  } catch (err) {
    console.error('Erro na validação/busca:', err);
    mensagemSpan.textContent = 'Erro ao validar ou consultar o servidor';
    mensagemSpan.classList.add('erro');
  }
}
document.getElementById('numero').addEventListener('blur', validarNumeroESerieEmbargo);

// ======= SETA DATA DO DIA =======
document.getElementById('dataDesembargo').value = new Date().toISOString().split('T')[0];

// ======= BUSCA POR PROCESSO SIMLAM =======
document.getElementById('btnBuscarProcesso').addEventListener('click', async () => {
  const proc = document.getElementById('processoSimlam').value.trim();
  if (!proc) return;

  try {
    const res = await fetch(`/api/desembargos/processo?valor=${encodeURIComponent(proc)}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    const data = await res.json();

    if (res.ok) {
      document.getElementById("mensagem-busca").textContent = "Processo encontrado!";
      document.getElementById("mensagem-busca").classList.add("sucesso");
      preencherFormulario(data);

      // Validação backend após preencher
      const formData = obterDadosFormulario();
      await validarFormularioBackend(formData);

      console.log("Processo:", data);
    } else {
      document.getElementById("mensagem-busca").textContent = data.message || "Não encontrado";
      document.getElementById("mensagem-busca").classList.add("erro");
    }

  } catch (err) {
    console.error("Erro na busca:", err);
    document.getElementById("mensagem-busca").textContent = "Erro ao consultar o servidor";
    document.getElementById("mensagem-busca").classList.add("erro");
  }
});

// ======= BOTÃO GERAR PRÉVIA =======
const previewBtn = document.getElementById('previewBtn');
previewBtn.addEventListener('click', async () => {
  const formData = obterDadosFormulario();

  // Validação local: SEP ou eDocs obrigatórios
  if (!formData.numeroSEP && !formData.numeroEdocs) {
    alert('Preencha pelo menos SEP ou e-Docs antes de gerar a prévia.');
    return;
  }

  const valido = await validarFormularioBackend(formData);
  if (!valido) {
    alert('Corrija os erros antes de gerar a prévia.');
    return;
  }

  const usuario = await getUsuarioLogado();

  // Gera PDF
  function formatDateISO(d) {
    if (!d) return "-";
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2,'0');
      const month = String(date.getMonth()+1).padStart(2,'0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return "-";
    }
  }

  // Monta um "desembargo" no shape esperado pelo layout (mapeando nomes do form)
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
  doc.text(`TERMO DE DESEMBARGO Nº X/IDAF`, 40, y);
  y += 25;

  // ================= Disclaimer (EXPLÍCITO: PRÉVIA) =================
  doc.setFontSize(10);
  doc.setTextColor("#666");
  // usar splitTextToSize para evitar overflow
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
    { label: "Data do Desembargo", value: formatDateISO(previewObj.data_desembargo) },
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


  // salva PDF (preview)
  const nomeArquivo = `Desembargo_preview_${String(previewObj.numero_embargo || 'sem-numero')}.pdf`;
  doc.save(nomeArquivo);
});

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = document.createElement("i");
  icon.className = type === "success" ? "fa-solid fa-circle-check icon" : "fa-solid fa-circle-xmark icon";

  const text = document.createElement("span");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // animação de entrada
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // remove depois de 4s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
