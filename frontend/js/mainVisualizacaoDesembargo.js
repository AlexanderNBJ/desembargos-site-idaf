document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  // Pega o ID da URL
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("Nenhum desembargo selecionado.");
    window.location.href = "listaDesembargos.html";
    return;
  }

  const form = document.getElementById("desembargoForm");
  const enableEdit = document.getElementById("enableEdit");
  const updateBtn = document.getElementById("updateBtn");

  // Bloqueia inputs inicialmente
  Array.from(form.elements).forEach(el => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = true;
  });
  updateBtn.disabled = true;

  // Busca desembargo pelo ID
  async function fetchDesembargo() {
    try {
      const res = await fetch(`/api/desembargos/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errText}`);
      }
      return res.json();
    } catch (err) {
      console.error("Erro na fetchDesembargo:", err);
      alert("Erro ao buscar desembargo. Veja console para detalhes.");
      return null;
    }
  }

  const desembargo = await fetchDesembargo();
  if (!desembargo) return;

  // Preenche formulário
  form.numero.value = desembargo.numero_embargo ?? "";
  form.serie.value = desembargo.serie_embargo ?? "";
  form.nomeAutuado.value = desembargo.nome_autuado ?? "";
  form.processoSimlam.value = desembargo.processo_simlam ?? "";
  form.area.value = desembargo.area_desembargada ?? "";
  form.numeroSEP.value = desembargo.numero_sep ?? "";
  form.numeroEdocs.value = desembargo.numero_edocs ?? "";
  // Ajuste correto da data: envia/mostra como YYYY-MM-DD, sem converter para Date
  form.dataDesembargo.value = desembargo.data_desembargo?.split("T")[0] ?? "";
  form.coordenadaX.value = desembargo.coordenada_x ?? "";
  form.coordenadaY.value = desembargo.coordenada_y ?? "";
  form.descricao.value = desembargo.descricao ?? "";

  const radio = form.querySelector(
    `input[name="tipoDesembargo"][value="${desembargo.tipo_desembargo}"]`
  );
  if (radio) radio.checked = true;

  if (form.status) form.status.value = desembargo.status ?? "";

  // Habilitar edição
  enableEdit.addEventListener("change", () => {
    const enable = enableEdit.checked;
    Array.from(form.elements).forEach(el => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = !enable;
    });
    updateBtn.disabled = !enable;
  });

  // VALIDAÇÃO EM TEMPO REAL (backend Joi)
  const campos = [
    'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
    'numeroSEP', 'numeroEdocs', 'tipoDesembargo', 'dataDesembargo',
    'coordenadaX', 'coordenadaY', 'descricao'
  ];

  campos.forEach(campo => {
    const input = document.getElementById(campo);
    if (!input) return;

    if (campo === 'tipoDesembargo') {
      const radios = document.querySelectorAll('input[name="tipoDesembargo"]');
      radios.forEach(radio => {
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
      return (data.errors && data.errors[nomeDoCampo]) ? data.errors[nomeDoCampo] : '';
    } catch (err) {
      console.error('Erro na validação:', err);
      return 'Erro ao validar';
    }
  }

  // Atualizar desembargo
  updateBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form).entries());
    const dataInput = form.dataDesembargo.value; // "YYYY-MM-DD"
    const [ano, mes, dia] = dataInput.split('-');
    const dataLocal = new Date(ano, mes - 1, dia); // hora 00:00 local
    dados.dataDesembargo = dataLocal.toISOString(); // envia ISO UTC


    // Converte campos vazios para null
    Object.keys(dados).forEach(k => {
      if (dados[k] === "") dados[k] = null;
    });

    // IMPORTANTE: manter data como string YYYY-MM-DD para não alterar dia
    // Se houver hora no backend, converta lá para DATE ou ajuste timezone
    try {
      const res = await fetch(`/api/desembargos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(dados)
      });
      const result = await res.json();

      if (res.ok && result.success) {
        alert("Atualizado com sucesso!");
        window.location.href = "listaDesembargos.html"; // volta para a lista
      } else {
        console.error(result);
        alert("Erro ao atualizar desembargo. Veja console para detalhes.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar desembargo. Veja console para detalhes.");
    }
  });
});
