// campos do formulário
const campos = [
  'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
  'numeroSEP', 'numeroEdocs', 'tipoDesembargo', 'dataDesembargo',
  'coordenadaX', 'coordenadaY', 'descricao'
];

const mensagemDiv = document.getElementById('mensagem-insercao');

// função genérica para validar um campo via backend (sem token)
async function validarCampo(nomeDoCampo, valor) {
  const body = {};
  body[nomeDoCampo] = valor;

  try {
    const res = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.errors && data.errors[nomeDoCampo]) {
      return data.errors[nomeDoCampo];
    } else {
      return '';
    }
  } catch (err) {
    console.error('Erro na validação:', err);
    return 'Erro ao validar';
  }
}

// adiciona listeners para todos os campos
campos.forEach((campo) => {
  const input = document.getElementById(campo);
  if (!input) return;

  if (campo === 'tipoDesembargo') {
    const radios = document.querySelectorAll('input[name="tipoDesembargo"]');
    radios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        const valor = radio.value.toUpperCase();
        const erro = await validarCampo('tipoDesembargo', valor);
        document.getElementById('error-tipoDesembargo').textContent = erro;
      });
    });
  } else {
    input.addEventListener('blur', async () => {
      const valor = input.value;
      const erro = await validarCampo(campo, valor);
      document.getElementById(`error-${campo}`).textContent = erro;
    });
  }
});

// validação completa no submit
const form = document.getElementById('desembargoForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // limpa erros
  campos.forEach(campo => document.getElementById(`error-${campo}`).textContent = '');

  const formData = {
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
    dataDesembargo: document.getElementById('dataDesembargo').value,
    coordenadaX: parseFloat(document.getElementById('coordenadaX').value),
    coordenadaY: parseFloat(document.getElementById('coordenadaY').value),
    descricao: document.getElementById('descricao').value,
  };

  // VALIDAÇÃO LOCAL: pelo menos SEP ou eDocs
  if (!formData.numeroSEP && !formData.numeroEdocs) {
    document.getElementById('error-numeroSEP').textContent = 'Preencha pelo menos SEP ou e-Docs';
    document.getElementById('error-numeroEdocs').textContent = 'Preencha pelo menos SEP ou e-Docs';
  }

  try {
    // validação completa via backend (Joi)
    const resValidate = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const dataValidate = await resValidate.json();

    // combina erros do backend com a regra local
    if (dataValidate.success === false && dataValidate.errors) {
      Object.keys(dataValidate.errors).forEach(campo => {
        document.getElementById(`error-${campo}`).textContent = dataValidate.errors[campo];
      });

      // se a regra local de SEP/eDocs falhou, mantém a mensagem
      if (!formData.numeroSEP && !formData.numeroEdocs) {
        document.getElementById('error-numeroSEP').textContent = 'Preencha pelo menos SEP ou e-Docs';
        document.getElementById('error-numeroEdocs').textContent = 'Preencha pelo menos SEP ou e-Docs';
      }

      return; // não envia se houver erro
    }

    // envia para inserir no banco
    const resInsert = await fetch('/api/desembargos/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const dataInsert = await resInsert.json();

    if (dataInsert.success) {
      mensagemDiv.textContent = 'Desembargo inserido com sucesso!';
      mensagemDiv.classList.remove('erro');
      mensagemDiv.classList.add('sucesso');
      form.reset();
      document.getElementById("dataDesembargo").value = new Date().toISOString().split('T')[0];
      document.getElementById("mensagem-numero").textContent = '';
    } else {
      mensagemDiv.textContent = dataInsert.message || 'Erro ao inserir desembargo';
      mensagemDiv.classList.remove('sucesso');
      mensagemDiv.classList.add('erro');
    }

  } catch (err) {
    console.error('Erro ao processar formulário:', err);
    mensagemDiv.textContent = 'Erro ao processar formulário';
    mensagemDiv.classList.remove('sucesso');
    mensagemDiv.classList.add('erro');
  }
});

// validação do número do processo + busca no banco
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

    if (data.errors && data.errors.numero) {
      erroNumero.textContent = data.errors.numero;
      return;
    }

    const checkRes = await fetch(`/api/embargos/check/${numero}`);
    const checkData = await checkRes.json();

    if (checkData.success) {
      mensagemSpan.textContent = checkData.message;
      mensagemSpan.classList.add('sucesso');
    } else {
      mensagemSpan.textContent = checkData.message;
      mensagemSpan.classList.add('erro');
    }

  } catch (err) {
    console.error('Erro na validação/busca:', err);
    mensagemSpan.textContent = 'Erro ao validar ou consultar o servidor';
    mensagemSpan.classList.add('erro');
  }
}

// listener do número
document.getElementById('numero').addEventListener('blur', validarNumeroESerieEmbargo);

// seta data do dia automaticamente
document.getElementById('dataDesembargo').value = new Date().toISOString().split('T')[0];
