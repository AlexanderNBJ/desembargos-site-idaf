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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero })
    });
    const data = await res.json();
    if (data.errors?.numero) {
      erroNumero.textContent = data.errors.numero;
      return;
    }

    const checkRes = await fetch(`/api/embargos/check/${numero}`);
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
    const res = await fetch(`/api/desembargos/processo?valor=${encodeURIComponent(proc)}`);
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

  // Gera PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;
  campos.forEach(campo => {
    doc.text(`${campo}: ${formData[campo] ?? ''}`, 10, y);
    y += 10;
  });
  doc.save(`Desembargo_${formData.numero}.pdf`);
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
