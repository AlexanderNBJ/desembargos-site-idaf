document.addEventListener("DOMContentLoaded", () => {
  // pega os parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  // se não tem ID, não faz sentido, então redireciona para a tela de lista de desembargos
  if (!id) {
    alert("Nenhum desembargo selecionado.");
    window.location.href = "listaDesembargos.html";
    return;
  }

  // pega os elementos da página por ID
  const form = document.getElementById("desembargoForm");
  const enableEdit = document.getElementById("enableEdit");
  const updateBtn = document.getElementById("updateBtn");
  const btnBuscar = document.getElementById("btnBuscarProcesso");
  const mensagemBusca = document.getElementById("mensagem-busca");

  // desabilita algumas funções
  Array.from(form.elements).forEach(el => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = true;
  });
  if (updateBtn) updateBtn.disabled = true;
  if (btnBuscar) btnBuscar.disabled = true;

  // pega o token
  function getStoredToken() {
    return (window.Auth && typeof Auth.getSessionToken === 'function')
      ? Auth.getSessionToken()
      : (localStorage.getItem('sessionToken') || localStorage.getItem('token') || null);
  }

  // faz umm parse no JWT
  function parseJwtPayload(token) {
    if (!token) 
      return null;

    try {
      const part = token.split('.')[1];
      
      if (!part)
        return null;

      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));

      return JSON.parse(decodeURIComponent(escape(json)));
    } 
    catch {
      return null;
    }
  }

  // pegar as informações do usuário atual
  function getCurrentUserInfo() {

    // pega do Auth
    if (window.Auth) {
      try {
        const u = (typeof Auth.getSessionUser === 'function') ? Auth.getSessionUser() : null;
        const t = (typeof Auth.getSessionToken === 'function') ? Auth.getSessionToken() : null;
        const p = parseJwtPayload(t);

        return {
          token: t,
          payload: p,
          username: (u && (u.username || u.email || u.name)) || (p && (p.username || p.email || p.name || p.sub)) || null,
          role: (p && (p.role || p.roles)) || (u && u.role) || null
        };

      }
      catch (e) {}
    }

    // pega do token
    const t = getStoredToken();
    const p = parseJwtPayload(t);

    return {
      token: t,
      payload: p,
      username: p ? (p.username || p.email || p.name || p.sub) : null,
      role: p ? (p.role || p.roles) : null
    };
  }

  // normaliza o ROLE
  function normalizeRole(raw) {
    if (!raw) 
      return null;
    
    if (Array.isArray(raw)) {
      const u = raw.map(r => String(r).toUpperCase());

      if (u.includes('GERENTE')) 
        return 'GERENTE';
      
      if (u.includes('COMUM'))
        return 'COMUM';

      return u[0];
    }
    return String(raw).toUpperCase();
  }

  // mapeia o que vem do backend para o frontend, normalizando as informações
  function normalizeRow(row) {
    if (!row) 
      return null;

    const pick = (o, ...keys) => {
      for (const k of keys) {
        if (!o) 
          continue;

        if (k in o && o[k] !== undefined) 
          return o[k];
      }
      return undefined;
    };

    // normaliza os dados em um JSON
    return {
      id: pick(row, 'id'),
      numero: pick(row, 'numero', 'numero_embargo'),
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
    if (!selectEl) 
      return;

    if (value === null || value === undefined) {
      selectEl.value = '';
      return;
    }

    const vStr = String(value);
    const exact = Array.from(selectEl.options).find(o => o.value === vStr);

    if (exact) {
      selectEl.value = exact.value;
      return;
    }

    const ci = Array.from(selectEl.options).find(o => (o.value && o.value.toLowerCase() === vStr.toLowerCase()) || (o.text && o.text.toLowerCase() === vStr.toLowerCase()));
    
    if (ci) {
      selectEl.value = ci.value;
      return;
    }

    selectEl.value = '';
  }

  // preenche o formulário de ocordo com as informações normalizadas
  function preencherFormulario(obj) {
    if (!obj) 
      return;

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
    if (form.status) setSelectValue(form.status, obj.status ?? '');

    // data do desembargo
    const dt = obj.dataDesembargo ?? '';

    if (form.dataDesembargo) {
      if (typeof dt === 'string' && dt.includes('T')) form.dataDesembargo.value = dt.split('T')[0];
      else form.dataDesembargo.value = dt || '';
    }

    // marca o tipo radio adequadamente
    if (obj.tipoDesembargo) {
      const v = String(obj.tipoDesembargo).toUpperCase();
      const radio = form.querySelector(`input[name="tipoDesembargo"][value="${v}"]`);

      if (radio) 
        radio.checked = true;
    } 
    else {
      form.querySelectorAll('input[name="tipoDesembargo"]').forEach(r => r.checked = false);
    }

    // responsavel pelo desembargo
    const respEl = document.getElementById('responsavelDesembargo');
    if (respEl) {

      if (respEl.tagName === 'INPUT') 
        respEl.value = obj.responsavelDesembargo ?? '';

      else if (respEl.tagName === 'SELECT') {
        // coloca o ID dos resposáveis para alterar no BD
        setSelectValue(respEl, obj.responsavelDesembargoId ?? '');
      }
    }

  }

  // GERENTE -> busca os usuários
  async function fetchUsersList() {

    const token = getStoredToken();
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    // busca os usuários no backend
    try {
        const res = await fetch('/api/usuarios', 
                                { headers });

        if (!res.ok) 
          return null;

        const j = await res.json();

        let list = j;

        if (list.data) 
          list = list.data;

        if (Array.isArray(list)) 
          return list;

      } 
      catch (err) {}
    return null;
  }

  // busca o embargo por processo simlam no BD
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

    mensagemBusca.textContent = '';

    // teste buscar as informações
    try {
      btnBuscar.classList.add('loading');
      btnBuscar.disabled = true;

      // faz o fetch
      const resp = await fetch(`/api/desembargos/processo?valor=${encodeURIComponent(proc)}`);

      // não achou
      if (resp.status === 404) {
        mensagemBusca.textContent = 'Nenhum registro encontrado para este processo.';
        mensagemBusca.classList.remove('sucesso');
        mensagemBusca.classList.add('erro');
        return;
      }

      if (!resp.ok) 
        throw new Error('Falha na consulta');

      // achou
      const data = await resp.json();
      let payload = data;

      if (payload.data) 
        payload = payload.data;

      if (payload.desembargo) 
        payload = payload.desembargo;

      if (Array.isArray(payload) && payload.length > 0) 
        payload = payload[0];

      // normaliza os dados e preenche
      const norm = normalizeRow(payload);
      preencherFormulario(norm);

      mensagemBusca.textContent = 'Dados preenchidos a partir do banco.';
      mensagemBusca.classList.remove('erro');
      mensagemBusca.classList.add('sucesso');
    } 
    catch (err) {
      console.error('Erro ao buscar por processo:', err);
      mensagemBusca.textContent = 'Erro ao buscar. Tente novamente.';
      mensagemBusca.classList.remove('sucesso');
      mensagemBusca.classList.add('erro');
    } 
    finally {
      btnBuscar.classList.remove('loading');
      btnBuscar.disabled = !enableEdit.checked;
    }
  }

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

  // buscar desembargo por ID
  async function fetchById() {
    const userInfo = getCurrentUserInfo();
    const username = userInfo.username ? String(userInfo.username).trim().toLowerCase() : null;
    const roleRaw = userInfo.role;
    const role = normalizeRole(roleRaw) || null;

    // tesna buscar no backend
    try {
      const token = getStoredToken();
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch(`/api/desembargos/${id}`, { headers });

      if (!res.ok){
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} - ${txt}`);
      }

      // não houve erro, normaliza e preenche
      const json = await res.json();
      let payload = json;

      if (payload.data) 
        payload = payload.data;

      if (payload.desembargo)
        payload = payload.desembargo;

      if (Array.isArray(payload) && payload.length) 
        payload = payload[0];

      const norm = normalizeRow(payload);
      preencherFormulario(norm);

      // caso o desembargo esteja com STATUS APROVADO, ele não deve ser capaz de editar o desembargo
      if (norm.status && String(norm.status).toUpperCase() === "APROVADO") {
        const editToggle = document.querySelector(".edit-toggle");
        if (editToggle) editToggle.style.display = "none";
        if (enableEdit) { enableEdit.checked = false; enableEdit.disabled = true; }
        if (updateBtn) updateBtn.disabled = true;
        if (btnBuscar) btnBuscar.disabled = true;
        Array.from(form.elements).forEach(el => {
          if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = true;
        });
        showToast("Este desembargo foi APROVADO e não pode mais ser editado.", "info");
        return;
      }

      const responsavel = norm.responsavelDesembargo ? String(norm.responsavelDesembargo).trim().toLowerCase() : null;
      const statusUpper = norm.status ? String(norm.status).toUpperCase() : '';

      // um GERENTE pode editar quando quiser
      // um COMUM só edita no STATUS REVISÃO PENDENTE
      let canEditRecord = false;

      if (role === "GERENTE") {
        canEditRecord = true;
      } 
      else if (role === "COMUM") {
        if (responsavel && username && responsavel === username && statusUpper === "REVISÃO PENDENTE") {
          canEditRecord = true;
        } 
        else {
          canEditRecord = false;
        }
      } 
      else {
        canEditRecord = false;
      }

      const currentRespEl = document.getElementById('responsavelDesembargo');
      
      // se gerente, pode alterar o responsável do desembargo
      if (role === "GERENTE") {
        if (!currentRespEl || currentRespEl.tagName !== 'SELECT') {
          const origValue = currentRespEl ? currentRespEl.value : (norm.responsavelDesembargo ?? '');
          const select = document.createElement('select');
          select.id = 'responsavelDesembargo';
          select.name = 'responsavelDesembargo';
          select.className = currentRespEl ? currentRespEl.className : 'input';
          select.style.minWidth = '180px';
          select.disabled = true;

          if (currentRespEl && currentRespEl.parentNode) {
            currentRespEl.parentNode.replaceChild(select, currentRespEl);
          } 
          else {
            const respContainer = document.querySelector('.responsavel');
            if (respContainer) respContainer.appendChild(select);
          }

          // busca os usuários
          const users = await fetchUsersList();

          if (Array.isArray(users) && users.length){

            // coloca cada usuário na lista
            users.forEach(u => {
            const opt = document.createElement('option');
            const val = u.username || u.id || u.name || u.email;
            const label = u.name || u.username || u.email || String(u.id || '');

            opt.value = val;
            opt.textContent = label;
            opt.dataset.alt = (u.name || u.username || '').toLowerCase();

            opt.dataset.alt = label.toLowerCase();
            select.appendChild(opt);
          });

            setSelectValue(select, norm.responsavelDesembargo ?? '');

            if (norm.responsavelDesembargo) {
              setSelectValue(select, norm.responsavelDesembargo);
            }

            if (!select.value) {
              const maybe = (norm.responsavelDesembargo || '').toLowerCase();
              const matchOpt = Array.from(select.options).find(o =>
                (o.value && o.value.toLowerCase() === maybe) ||
                (o.dataset.alt && o.dataset.alt === maybe) ||
                (o.textContent && o.textContent.toLowerCase() === maybe)
              );
              if (matchOpt) select.value = matchOpt.value;
            }

          } 
          else {
            const opt = document.createElement('option');
            opt.value = norm.responsavelDesembargo ?? '';
            opt.textContent = norm.responsavelDesembargo ?? '(sem responsável)';
            select.appendChild(opt);
            showToast("Aviso: não foi possível carregar lista de usuários; responsável mantido como campo editável.", "warning");
          }
        }
      } 
      else {
        if (!currentRespEl || currentRespEl.tagName === 'SELECT') {
          const sel = document.getElementById('responsavelDesembargo');
          const value = sel ? (sel.value || (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text)) : (norm.responsavelDesembargo ?? '');
          const input = document.createElement('input');
          input.id = 'responsavelDesembargo';
          input.name = 'responsavelDesembargo';
          input.className = sel ? sel.className : 'input';
          input.type = 'text';
          input.value = value;
          if (sel && sel.parentNode) sel.parentNode.replaceChild(input, sel);
        }
      }

      // ajustes na UI em função da edição
      const editToggle = document.querySelector(".edit-toggle");
      if (!canEditRecord) {
        if (editToggle) {
          editToggle.style.opacity = "0.7";

          if (enableEdit){ 
            enableEdit.checked = false;
            enableEdit.disabled = true;
          }
        }

        if (updateBtn) 
          updateBtn.disabled = true;

        if (btnBuscar) 
          btnBuscar.disabled = true;

        if (role === "COMUM") {
          const reason = (!responsavel || !username || responsavel !== username)
            ? "Você não é o responsável por este desembargo."
            : "Este desembargo não está em situação 'REVISÃO PENDENTE'.";
          showToast(`Edição desabilitada: ${reason}`, "warning");

        } 
        else {
          showToast("Edição desabilitada para seu perfil.", "warning");
        }
      } 
      else {
        if (editToggle) {
          editToggle.style.display = "";

          if (enableEdit) 
            enableEdit.disabled = false;
        }
        if (updateBtn) 
          updateBtn.disabled = true;

        if (role === "COMUM") {
          if (form.status) 
            form.status.disabled = true;

          const respElNow = document.getElementById('responsavelDesembargo');
          if (respElNow) 
            respElNow.disabled = true;
        }
      }

      form._currentUser = { username, role };
      form._currentRecord = { responsavel, status: statusUpper, canEditRecord };
    } 
    catch (err) {
      console.error("Erro ao buscar desembargo por ID:", err);
      alert("Erro ao carregar desembargo. Veja console.");
    }
  }

  // lida com o checkbox de habilitar edição
  enableEdit.addEventListener("change", async () => {
    const enable = enableEdit.checked;
    const info = form._currentUser || {};
    const record = form._currentRecord || {};
    const role = normalizeRole(info.role) || info.role || null;

    if (!record.canEditRecord) {
      enableEdit.checked = false;
      if (updateBtn) 
        updateBtn.disabled = true;

      if (btnBuscar) 
        btnBuscar.disabled = true;

      showToast("Você não tem permissão para editar este desembargo.", "warning");
      return;
    }

    Array.from(form.elements).forEach(el => {
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) 
        return;

      if (el === enableEdit)
        return;

      if (role === "COMUM" && (el === form.status || el.id === 'responsavelDesembargo')) {
        el.disabled = true;
        return;
      }

      el.disabled = !enable;

      if (el.id === 'responsavelDesembargo') {
        el.disabled = !enable;
      }
    });

    if (btnBuscar) 
      btnBuscar.disabled = !enable;

    if (updateBtn) 
      updateBtn.disabled = !enable;

  });

  // realiza a validação dos campos
  const campos = [
    'numero', 'serie', 'nomeAutuado', 'area', 'processoSimlam',
    'numeroSEP', 'numeroEdocs', 'dataDesembargo',
    'coordenadaX', 'coordenadaY', 'descricao', 'responsavelDesembargo'
  ];

  campos.forEach(c => {
    const el = document.getElementById(c);
    if (!el) 
      return;

    el.addEventListener('blur', async () => {
      try {
        const res = await fetch('/api/desembargos/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [c]: el.value })
        });

        const json = await res.json();
        const errEl = document.getElementById(`error-${c}`);

        // caso tenha um erro, coloca
        if (errEl) 
          errEl.textContent = json.errors?.[c] ?? '';

      } 
      catch (err) {
        console.error('Erro na validação por campo', c, err);
      }
    });
  });


  // realiza o UPDATE
  updateBtn.addEventListener("click", async (e) => {

    e.preventDefault();

    const info = form._currentUser || {};
    const record = form._currentRecord || {};
    const role = normalizeRole(info.role) || info.role || null;

    if (!record.canEditRecord) {
      showToast("Você não tem permissão para editar este desembargo.", "error");
      return;
    }

    // pega dados do form
    const dados = Object.fromEntries(new FormData(form).entries());

    // radio tipoDesembargo
    const radio = document.querySelector('input[name="tipoDesembargo"]:checked');
    if (radio) dados.tipoDesembargo = radio.value;

    // data -> ISO
    if (form.dataDesembargo && form.dataDesembargo.value) {
      const [ano, mes, dia] = form.dataDesembargo.value.split('-');
      const dt = new Date(ano, Number(mes) - 1, Number(dia));
      dados.dataDesembargo = dt.toISOString();
    } else {
      dados.dataDesembargo = null;
    }

    // Se COMUM: força status para EM ANÁLISE
    if (role === "COMUM") {
      dados.status = "EM ANÁLISE";

      if (!dados.responsavelDesembargo || dados.responsavelDesembargo === "") {
        dados.responsavelDesembargo = info.username || form._currentRecord?.responsavel || null;
      }
    }

    // GERENTE: permite enviar status
    else {
      if (!('status' in dados) || dados.status === '' || dados.status === null || dados.status === undefined) {
        if (form._currentRecord && form._currentRecord.status) 
          dados.status = form._currentRecord.status;

        else 
          dados.status = 'EM ANÁLISE';
      }

      if (!dados.responsavelDesembargo || dados.responsavelDesembargo === "") {
        dados.responsavelDesembargo = form._currentRecord?.responsavel || (info.username || null);
      }
    }

    // converter strings vazias em null (exceto status/reponsavel que já tratamos)
    Object.keys(dados).forEach(k => {
      if (dados[k] === "") 
        dados[k] = null;
    });

    // tenta mandar o desembargo atualizado para o backend
    try {
      const token = getStoredToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/desembargos/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(dados)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showToast("Desembargo atualizado com sucesso!", "success");
        setTimeout(() => { window.location.href = "listaDesembargos.html"; }, 1200);
      }
      else {
        console.error(result);
        const msg = result.message || result.error || "Erro ao atualizar desembargo";
        showToast(msg, "error");
      }
    } 
    catch (err) {
      console.error(err);
      showToast("Erro ao atualizar desembargo. Tente novamente.", "error");
    }
  });

  // o início da execução é aqui, buscando o desembargo por ID
  fetchById();

  // função para gerar o toast
  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = document.createElement("i");

    switch(type) {
      case "success": icon.className = "fa-solid fa-circle-check icon"; break;
      case "error": icon.className = "fa-solid fa-circle-xmark icon"; break;
      case "warning": icon.className = "fa-solid fa-triangle-exclamation icon"; break;
      default: icon.className = "fa-solid fa-circle-info icon";
    }

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // timout do toast
    setTimeout(() => { toast.classList.add("show"); }, 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
});
