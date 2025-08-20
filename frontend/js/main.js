// campos do formulário
const campos = [
  'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
  'numeroSEP', 'numeroEdocs', 'tipoDesembargo', 'dataDesembargo',
  'latitude', 'longitude', 'descricao'
];

const mensagemDiv = document.getElementById('mensagem-insercao');

// função genérica para validar um campo via backend
async function validarCampo(nomeDoCampo, valor) {
  const body = {};
  body[nomeDoCampo] = valor;
  const token = localStorage.getItem("token");

  try {
    const res = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
       },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // retorna o erro específico do campo
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

  if (!input) return; // pula se o campo não existir

  // para radio buttons (tipoDesembargo)
  if (campo === 'tipoDesembargo') {
    const radios = document.querySelectorAll('input[name="tipoDesembargo"]');
    radios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        console.log('Radio alterado para:', radio.value);
        const valor = radio.value.toUpperCase();
        const erro = await validarCampo('tipoDesembargo', valor);
        document.getElementById('error-tipoDesembargo').textContent = erro;
      });
    });
  } else {
    // para inputs normais e textareas
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

  const formData = {
    numero: parseInt(document.getElementById('numero').value),
    serie: document.getElementById('serie').value,
    nomeAutuado: document.getElementById('nomeAutuado').value,
    area: parseFloat(document.getElementById('area').value),
    processoSimlam: document.getElementById('processoSimlam').value,
    numeroSEP: parseInt(document.getElementById('numeroSEP').value),
    numeroEdocs: document.getElementById('numeroEdocs').value,
    tipoDesembargo: (() => {
      const radio = document.querySelector('input[name="tipoDesembargo"]:checked');
      return radio ? radio.value.toUpperCase() : '';
    })(),
    dataDesembargo: document.getElementById('dataDesembargo').value,
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value),
    descricao: document.getElementById('descricao').value,
  };
  const token = localStorage.getItem("token");

  // 1️⃣ validação Joi
  const resValidate = await fetch('/api/desembargos/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
     },
    body: JSON.stringify(formData),
  });
  const dataValidate = await resValidate.json();

  // limpa erros
  campos.forEach(campo => document.getElementById(`error-${campo}`).textContent = '');

  if (dataValidate.success === false && dataValidate.errors) {
    Object.keys(dataValidate.errors).forEach(campo => {
      document.getElementById(`error-${campo}`).textContent = dataValidate.errors[campo];
    });
    return; // se tiver erro, não envia
  }

  // 2️⃣ envia para inserir no banco
  
  const resInsert = await fetch('/api/desembargos/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
     },
    body: JSON.stringify(formData)
  });
  const dataInsert = await resInsert.json();

  if (dataInsert.success) {
    //alert(dataInsert.message);
    console.log('Desembargo inserido:', dataInsert.data);
    mensagemDiv.textContent = 'Desembargo inserido com sucesso!';
    mensagemDiv.classList.remove('erro');
    mensagemDiv.classList.add('sucesso');

    form.reset();
    document.getElementById("dataDesembargo").value = new Date().toISOString().split('T')[0];
    document.getElementById("mensagem-numero").textContent = ''
  } else {
    alert(dataInsert.message || 'Erro ao inserir desembargo');
    mensagemDiv.textContent = dataInsert.message || 'Erro ao inserir desembargo';
    mensagemDiv.classList.remove('sucesso');
    mensagemDiv.classList.add('erro');
  }
});


async function validarNumeroESerieEmbargo() {
  const numero = document.getElementById('numero').value.trim();
  const erroNumero = document.getElementById('error-numero');
  const mensagemSpan = document.getElementById('mensagem-numero');
  const token = localStorage.getItem("token");

  // limpa mensagens
  erroNumero.textContent = '';
  mensagemSpan.textContent = '';
  mensagemSpan.classList.remove('sucesso', 'erro');

  // valida via Joi no backend
  try {
    const res = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
       },
      body: JSON.stringify({ numero})
    });

    const data = await res.json();

    let temErro = false;

    if (data.errors) {
      if (data.errors.numero) {
        erroNumero.textContent = data.errors.numero;
        temErro = true;
      }
    }

    if (temErro) return; // se tiver erro, não faz busca no banco

    // se passou na validação Joi, faz a busca no banco
    const checkRes = await fetch(`/api/embargos/check/${numero}`);
    const checkData = await checkRes.json();

    if (checkData.success) {
      mensagemSpan.textContent = checkData.message;
      mensagemSpan.classList.add('sucesso');
      //console.log('Dados do embargo:', checkData.data);
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

// adiciona listeners
document.getElementById('numero').addEventListener('blur', validarNumeroESerieEmbargo);
