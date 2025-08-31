document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
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
  const btnBuscar = document.getElementById("btnBuscarProcesso");
  const mensagemBusca = document.getElementById("mensagem-busca");
  const mensagemInsercao = document.getElementById("mensagem-insercao");

  // inicial: bloquear inputs (permitir checkbox e botões de ação)
  Array.from(form.elements).forEach(el => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = true;
  });
  if (updateBtn) updateBtn.disabled = true;
  if (btnBuscar) btnBuscar.disabled = true; // lupa só funciona quando habilitar edição = true

  // util: normaliza linha retornada do backend (vários formatos)
  function normalizeRow(row) {
    if (!row) return null;
    const pick = (o, ...keys) => {
      for (const k of keys) {
        if (!o) continue;
        if (k in o && o[k] !== undefined) return o[k];
      }
      return undefined;
    };

    return {
      id: pick(row, 'id'),
      numero: pick(row, 'numero', 'numero_embargo', 'numero_embargo'),
      serie: pick(row, 'serie', 'serie_embargo'),
      processoSimlam: pick(row, 'processoSimlam', 'processo_simlam', 'processo'),
      numeroSEP: pick(row, 'numeroSEP', 'numero_sep'),
      numeroEdocs: pick(row, 'numeroEdocs', 'numero_edocs'),
      coordenadaX: pick(row, 'coordenadaX', 'coordenada_x'),
      coordenadaY: pick(row, 'coordenadaY', 'coordenada_y'),
      nomeAutuado: pick(row, 'nomeAutuado', 'nome_autuado', 'autuado', 'nome'),
      area: pick(row, 'area', 'area_desembargada'),
      tipoDesembargo: pick(row, 'tipoDesembargo', 'tipo_desembargo', 'tipo'),
      dataDesembargo: pick(row, 'dataDesembargo', 'data_desembargo', 'data'),
      descricao: pick(row, 'descricao', 'descricao'),
      status: pick(row, 'status', 'estado', 'situacao'),
      responsavelDesembargo: pick(row, 'responsavelDesembargo', 'responsavel_desembargo', 'responsavel', 'usuario', 'responsavel_nome')
    };
  }

  function setSelectValue(selectEl, value) {
    if (!selectEl) return;
    if (value === null || value === undefined) {
      selectEl.value = '';
      return;
    }
    // tentativa direta
    const vStr = String(value);
    const exact = Array.from(selectEl.options).find(o => o.value === vStr);
    if (exact) {
      selectEl.value = exact.value;
      return;
    }
    // case-insensitive match
    const ci = Array.from(selectEl.options).find(o => o.value.toLowerCase() === vStr.toLowerCase() || (o.text && o.text.toLowerCase() === vStr.toLowerCase()));
    if (ci) {
      selectEl.value = ci.value;
      return;
    }
    // fallback: leave blank
    selectEl.value = '';
  }

  // preenche valores no form a partir do objeto normalizado
  function preencherFormulario(obj) {
    if (!obj) return;
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    if (form.numero) form.numero.value = obj.numero ?? '';
    if (form.serie) form.serie.value = obj.serie ?? '';
    if (form.nomeAutuado) form.nomeAutuado.value = obj.nomeAutuado ?? '';
    if (form.processoSimlam) form.processoSimlam.value = obj.processoSimlam ?? '';
    if (form.area) form.area.value = obj.area ?? '';
    if (form.numeroSEP) form.numeroSEP.value = obj.numeroSEP ?? '';
    if (form.numeroEdocs) form.numeroEdocs.value = obj.numeroEdocs ?? '';
    if (form.coordenadaX) form.coordenadaX.value = obj.coordenadaX ?? '';
    if (form.coordenadaY) form.coordenadaY.value = obj.coordenadaY ?? '';
    if (form.descricao) form.descricao.value = obj.descricao ?? '';
    if (form.responsavelDesembargo) form.responsavelDesembargo.value = obj.responsavelDesembargo ?? '';

    // status (tenta casamentos robustos)
    if (form.status) setSelectValue(form.status, obj.status ?? '');

    // data -> manter somente YYYY-MM-DD (se vier ISO)
    const dt = obj.dataDesembargo ?? '';
    if (form.dataDesembargo) {
      if (typeof dt === 'string' && dt.includes('T')) form.dataDesembargo.value = dt.split('T')[0];
      else form.dataDesembargo.value = dt || '';
    }

    // radio tipo
    if (obj.tipoDesembargo) {
      const v = String(obj.tipoDesembargo).toUpperCase();
      const radio = form.querySelector(`input[name="tipoDesembargo"][value="${v}"]`);
      if (radio) radio.checked = true;
    } else {
      form.querySelectorAll('input[name="tipoDesembargo"]').forEach(r => r.checked = false);
    }
  }

  // valida todos os campos via backend e mostra mensagens (retorna true se há erros)
  async function validateAllAndShow() {
    const payload = {
      numero: form.numero ? form.numero.value : null,
      serie: form.serie ? form.serie.value : null,
      nomeAutuado: form.nomeAutuado ? form.nomeAutuado.value : null,
      area: form.area ? form.area.value : null,
      processoSimlam: form.processoSimlam ? form.processoSimlam.value : null,
      numeroSEP: form.numeroSEP ? (form.numeroSEP.value || null) : null,
      numeroEdocs: form.numeroEdocs ? (form.numeroEdocs.value || null) : null,
      tipoDesembargo: (() => {
        const r = document.querySelector('input[name="tipoDesembargo"]:checked');
        return r ? r.value : '';
      })(),
      dataDesembargo: form.dataDesembargo ? form.dataDesembargo.value : null,
      coordenadaX: form.coordenadaX ? form.coordenadaX.value : null,
      coordenadaY: form.coordenadaY ? form.coordenadaY.value : null,
      descricao: form.descricao ? form.descricao.value : null,
      responsavelDesembargo: form.responsavelDesembargo ? form.responsavelDesembargo.value : null
    };

    try {
      const res = await fetch('/api/desembargos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      // limpar
      document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
      if (data && data.errors) {
        Object.keys(data.errors).forEach(k => {
          const el = document.getElementById(`error-${k}`);
          if (el) el.textContent = data.errors[k];
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro na validação global:', err);
      mensagemBusca.textContent = 'Aviso: validação indisponível (ver console)';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
      return false;
    }
  }

  // busca por processo SIMLAM (chamada pela lupa) - só funciona se enableEdit.checked === true
  async function buscarPorProcessoSimlam(proc) {
    if (!enableEdit.checked) {
      mensagemBusca.textContent = 'Habilite edição para usar a busca por processo.';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
      return;
    }

    if (!proc) {
      mensagemBusca.textContent = 'Informe o processo para buscar.';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
      return;
    }

    // validar antes de buscar
    const hasErr = await validateAllAndShow();
    if (hasErr) {
      mensagemBusca.textContent = 'Corrija os erros antes de buscar.';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
      return;
    }

    mensagemBusca.textContent = '';
    try {
      btnBuscar.classList.add('loading');
      btnBuscar.disabled = true;

      const resp = await fetch(`/api/desembargos/processo?valor=${encodeURIComponent(proc)}`);
      if (resp.status === 404) {
        mensagemBusca.textContent = 'Nenhum registro encontrado para este processo.';
        mensagemBusca.classList.remove('sucesso');
        mensagemBusca.classList.add('erro');
        return;
      }
      if (!resp.ok) throw new Error('Falha na consulta');

      const data = await resp.json();

      // trata formatos: data, desembargo, array, direct row
      let payload = data;
      if (!payload) {
        mensagemBusca.textContent = 'Resposta vazia do servidor.';
        mensagemBusca.classList.remove('sucesso');
        mensagemBusca.classList.add('erro');
        return;
      }
      if (payload.data) payload = payload.data;
      if (payload.desembargo) payload = payload.desembargo;
      if (Array.isArray(payload) && payload.length > 0) payload = payload[0];

      const norm = normalizeRow(payload);
      preencherFormulario(norm);

      mensagemBusca.textContent = 'Dados preenchidos a partir do banco.';
      mensagemBusca.classList.remove('erro');
      mensagemBusca.classList.add('sucesso');

      // revalidar para atualizar mensagens de erro
      await validateAllAndShow();
    } catch (err) {
      console.error('Erro ao buscar por processo:', err);
      mensagemBusca.textContent = 'Erro ao buscar. Tente novamente.';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
    } finally {
      btnBuscar.classList.remove('loading');
      // só reabilita se enableEdit ainda estiver true
      btnBuscar.disabled = !enableEdit.checked;
    }
  }

  // botão da lupa
  if (btnBuscar) {
    btnBuscar.addEventListener('click', async () => {
      const current = (form.processoSimlam && form.processoSimlam.value) ? form.processoSimlam.value.trim() : '';
      let proc = current;
      if (!proc) {
        proc = prompt("Informe o número do Processo Simlam (ex: 12345/2025):");
        if (!proc) return;
      }
      await buscarPorProcessoSimlam(proc);
    });
  }

  // busca desembargo por ID ao abrir a página
async function fetchById() {
  try {
    const res = await fetch(`/api/desembargos/${id}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} - ${txt}`);
    }
    const json = await res.json();
    let payload = json;
    if (payload.data) payload = payload.data;
    if (payload.desembargo) payload = payload.desembargo;
    if (Array.isArray(payload) && payload.length) payload = payload[0];

    const norm = normalizeRow(payload);
    preencherFormulario(norm);

    // 🚨 Se aprovado → travar edição
    if (norm.status && norm.status.toUpperCase() === "APROVADO") {
      // 🔒 Esconde o bloco inteiro (checkbox + label)
      const editToggle = document.querySelector(".edit-toggle");
      if (editToggle) {
        editToggle.style.display = "none"; // some com checkbox + label
      }

      // Garante que não tem como ativar depois
      if (enableEdit) {
        enableEdit.checked = false;
        enableEdit.disabled = true;
      }

      if (updateBtn) updateBtn.disabled = true;
      if (btnBuscar) btnBuscar.disabled = true;

      // trava todos os inputs/seletores permanentemente
      Array.from(form.elements).forEach(el => {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = true;
      });

      mensagemInsercao.textContent = "Este desembargo foi APROVADO e não pode mais ser editado.";
      mensagemInsercao.classList.remove("sucesso");
      mensagemInsercao.classList.add("erro");
    }

  } catch (err) {
    console.error("Erro ao buscar desembargo por ID:", err);
    alert("Erro ao carregar desembargo. Veja console.");
  }
}


  // habilitar edição — controla todos os inputs do form e a lupa
  enableEdit.addEventListener("change", () => {
    const enable = enableEdit.checked;
    Array.from(form.elements).forEach(el => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = !enable;
    });
    // manter checkbox e actions visíveis; lupa ficará habilitada conforme enable
    if (btnBuscar) btnBuscar.disabled = !enable;
    if (updateBtn) updateBtn.disabled = !enable;
  });

  // blur validation simples por campo (opcional)
  const campos = [
    'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
    'numeroSEP', 'numeroEdocs', 'dataDesembargo',
    'coordenadaX', 'coordenadaY', 'descricao', 'responsavelDesembargo'
  ];
  campos.forEach(c => {
    const el = document.getElementById(c);
    if (!el) return;
    el.addEventListener('blur', async () => {
      try {
        const res = await fetch('/api/desembargos/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [c]: el.value })
        });
        const json = await res.json();
        const errEl = document.getElementById(`error-${c}`);
        if (errEl) errEl.textContent = json.errors?.[c] ?? '';
      } catch (err) {
        console.error('Erro na validação por campo', c, err);
      }
    });
  });

  // salvar / atualizar desembargo
  updateBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form).entries());
    const radio = document.querySelector('input[name="tipoDesembargo"]:checked');
    if (radio) dados.tipoDesembargo = radio.value;

    if (form.dataDesembargo && form.dataDesembargo.value) {
      const [ano, mes, dia] = form.dataDesembargo.value.split('-');
      const dt = new Date(ano, Number(mes) - 1, Number(dia));
      dados.dataDesembargo = dt.toISOString();
    } else {
      dados.dataDesembargo = null;
    }

    // converter vazios para null
    Object.keys(dados).forEach(k => { if (dados[k] === "") dados[k] = null; });

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
        mensagemInsercao.textContent = 'Atualizado com sucesso!';
        mensagemInsercao.classList.remove('erro');
        mensagemInsercao.classList.add('sucesso');
        setTimeout(() => { window.location.href = "listaDesembargos.html"; }, 900);
      } else {
        console.error(result);
        mensagemInsercao.textContent = result.message || 'Erro ao atualizar desembargo';
        mensagemInsercao.classList.remove('sucesso');
        mensagemInsercao.classList.add('erro');
      }
    } catch (err) {
      console.error('Erro ao atualizar desembargo:', err);
      mensagemInsercao.textContent = 'Erro ao atualizar desembargo';
      mensagemInsercao.classList.remove('sucesso');
      mensagemInsercao.classList.add('erro');
    }
  });

  // inicializa preenchendo por ID
  fetchById();
});
