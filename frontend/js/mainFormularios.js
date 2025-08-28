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

const previewBtn = document.getElementById('previewBtn');
previewBtn.addEventListener('click', async () => {
  const form = document.getElementById('desembargoForm');
  const formData = Object.fromEntries(new FormData(form).entries());

  // Validação local: SEP ou EDOCS obrigatórios
  if (!formData.numeroSEP && !formData.numeroEdocs) {
    document.getElementById('error-numeroSEP').textContent = 'Preencha pelo menos SEP ou e-Docs';
    document.getElementById('error-numeroEdocs').textContent = 'Preencha pelo menos SEP ou e-Docs';
    return;
  }

  // Validação completa via Joi
  try {
    const resValidate = await fetch('/api/desembargos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const dataValidate = await resValidate.json();
    if (!dataValidate.success) {
      Object.keys(dataValidate.errors).forEach(campo => {
        document.getElementById(`error-${campo}`).textContent = dataValidate.errors[campo];
      });
      return;
    }
  } catch (err) {
    console.error('Erro ao validar formulário:', err);
    return;
  }

  // Formata a data
  const formatDate = (d) => {
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2,'0');
    const month = String(date.getMonth()+1).padStart(2,'0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const dataDesembargoFormat = formatDate(formData.dataDesembargo);

  // Criação do PDF
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const primaryColor = "#17903f"; // verde do site
  const secondaryColor = "#444";   // cinza
  const lineHeight = 18;

  // ================= Cabeçalho =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(primaryColor);
  doc.text("www.idaf.es.gov.br", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(secondaryColor);
  //doc.text("Av. Jerônimo Monteiro, nº 1.000, Ed. Trade Center, loja 01 - Centro - CEP: 29010-935 - Vitória / ES", 40, y); y += lineHeight;
  //doc.text("Tel.: (27) 3636-3761", 40, y); y += lineHeight + 10;
  doc.setDrawColor(200);
  doc.setLineWidth(0.8);
  doc.line(40, y, 555, y); 
  y += 20;

  // ================= Título =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor);
  doc.text(`TERMO DE DESEMBARGO Nº ${formData.numero}/${formData.serie}/IDAF`, 40, y); 
  y += 25;

  // ================= Informações principais =================
  const infoFields = [
    { label: "Processo E-Docs", value: `${formData.numeroEdocs || '-'}` },
    { label: "Processo Simlam", value: `${formData.processoSimlam}` },
    { label: "Instrumento Único de Fiscalização", value: `${formData.numeroSEP || '-'} Série ${formData.serie}` },
    { label: "Autuado", value: formData.nomeAutuado },
    { label: "Área Desembargada", value: `${formData.area || '-'} ha` },
    { label: "Tipo de Desembargo", value: formData.tipoDesembargo.toUpperCase() },
    { label: "Data do Desembargo", value: dataDesembargoFormat },
    { label: "Coordenadas UTM", value: `X(m): ${formData.coordenadaX}, Y(m): ${formData.coordenadaY}` },
  ];

  const labelX = 40;
  const valueX = 250; // valores alinhados à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(primaryColor);
  infoFields.forEach(item => {
    doc.setFont("helvetica", "bold");
    doc.text(`${item.label}:`, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(secondaryColor);
    doc.text(item.value, valueX, y);
    y += lineHeight;
  });
  y += 10;

  // ================= Descrição =================
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text("Descrição do Desembargo:", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(secondaryColor);
  const descricaoSplit = doc.splitTextToSize(formData.descricao, 500);
  doc.text(descricaoSplit, 40, y); 
  y += descricaoSplit.length * lineHeight + 10;

  // ================= Corpo do Termo =================
  //const tipoTexto = formData.tipoDesembargo.toUpperCase(); // DEFERIDO TOTALMENTE/PARCIALMENTE ou INDEFERIDO
  //const corpo = `Tendo em vista o conteúdo do processo E-Docs nº ${formData.numeroEdocs || '-'}, processo Simlam ${formData.processoSimlam}, em nome de ${formData.nomeAutuado}, ${tipoTexto} O DESEMBARGO da área embargada através do Instrumento Único de Fiscalização nº ${formData.numeroSEP || '-'} Série ${formData.serie}, devendo ser procedida a atualização do Cadastro Ambiental Rural da propriedade, de modo a representar a realidade florestal do imóvel.`;
  //const corpoSplit = doc.splitTextToSize(corpo, 500);
  //doc.text(corpoSplit, 40, y); 
  //y += corpoSplit.length * lineHeight + 20;

  // ================= Assinatura =================
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text("Nome do Usuário", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.text("Cargo do Usuário", 40, y); y += lineHeight;
  doc.text("Unidade Técnico-Administrativa Responsável", 40, y); y += lineHeight + 20;

  // ================= Disclaimer =================
  doc.setFontSize(10);
  doc.setTextColor("#666");
  doc.text("Este documento somente terá validade após sua inclusão e assinatura no sistema EDOC-s.", 40, y);

  // ================= Abre PDF =================
  doc.output("dataurlnewwindow");
});
