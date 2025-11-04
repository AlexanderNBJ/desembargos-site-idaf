document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.initAuth()) return;

  // Módulo de estado da página
  const pageState = {
    desembargoId: new URLSearchParams(window.location.search).get('id'),
    currentUserInfo: null, 
    currentRecord: null,
  };

  // Módulo de elementos de UI
  const ui = {
    form: document.getElementById('desembargoForm'),
    enableEdit: document.getElementById('enableEdit'),
    updateBtn: document.getElementById('updateBtn'),
    btnBuscar: document.getElementById('btnBuscarProcesso'),
    mensagemBusca: document.getElementById('mensagem-busca'),
    btnBuscarSEP: document.getElementById('btnBuscarSEP'),
    numeroSEPInput: document.getElementById('numeroSEP'),
  };
  
  // Módulo de utilitários
  const utils = {
    getCurrentUserInfo: () => {
        const u = Auth.getSessionUser();
        const t = Auth.getSessionToken();
        const p = utils.parseJwtPayload(t);
        return {
            username: (u?.username || u?.email || u?.name) || (p?.username || p?.email || p?.name || p?.sub) || null,
            role: utils.normalizeRole((p?.role || p?.roles) || u?.role),
        };
    },
    parseJwtPayload: (token) => {
        if (!token) return null;
        try {
            const part = token.split('.')[1];
            if (!part) return null;
            const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decodeURIComponent(escape(json)));
        } catch { return null; }
    },
    normalizeRole: (raw) => {
        if (!raw) return null;
        if (Array.isArray(raw)) {
            const u = raw.map(r => String(r).toUpperCase());
            if (u.includes('GERENTE')) return 'GERENTE';
            if (u.includes('COMUM')) return 'COMUM';
            return u[0];
        }
        return String(raw).toUpperCase();
    },
    normalizeRow: (row) => {
        if (!row) return null;
        const pick = (o, ...keys) => {
            for (const k of keys) { if (o && k in o && o[k] !== undefined) return o[k]; }
            return undefined;
        };
        return {
            id: pick(row, 'id'), numero: pick(row, 'numero', 'numero_embargo'),
            serie: pick(row, 'serie', 'serie_embargo'), processoSimlam: pick(row, 'processoSimlam', 'processo_simlam', 'processo'),
            numeroSEP: pick(row, 'numeroSEP', 'numero_sep'), numeroEdocs: pick(row, 'numeroEdocs', 'numero_edocs'),
            coordenadaX: pick(row, 'coordenadaX', 'coordenada_x'), coordenadaY: pick(row, 'coordenadaY', 'coordenada_y'),
            nomeAutuado: pick(row, 'nomeAutuado', 'nome_autuado', 'autuado', 'nome'), area: pick(row, 'area', 'area_desembargada'),
            tipoDesembargo: pick(row, 'tipoDesembargo', 'tipo_desembargo', 'tipo'), dataDesembargo: pick(row, 'dataDesembargo', 'data_desembargo', 'data'),
            descricao: pick(row, 'descricao', 'descricao'), status: pick(row, 'status', 'estado', 'situacao'),
            responsavelDesembargo: pick(row, 'responsavelDesembargo', 'responsavel_desembargo', 'responsavel', 'usuario', 'responsavel_nome')
        };
    },
    setSelectValue: (selectEl, value) => {
        if (!selectEl) return;
        const vStr = String(value ?? '');
        const exact = Array.from(selectEl.options).find(o => o.value === vStr);
        if (exact) { selectEl.value = exact.value; return; }
        const ci = Array.from(selectEl.options).find(o => (o.value && o.value.toLowerCase() === vStr.toLowerCase()) || (o.text && o.text.toLowerCase() === vStr.toLowerCase()));
        if (ci) selectEl.value = ci.value;
    },
  };

  // Módulo da view
  const view = {
    fillForm: (data) => {
        if (!data) return;
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                const el = ui.form.elements[key];
                if (el && el.type !== 'radio') {
                    if (el.nodeName === 'SELECT') { utils.setSelectValue(el, data[key]); } 
                    else if (el.type === 'date' && data[key]?.includes('T')) { el.value = data[key].split('T')[0]; } 
                    else { el.value = data[key] ?? ''; }
                }
            }
        });
        if (data.tipoDesembargo) {
            const radio = ui.form.querySelector(`input[name="tipoDesembargo"][value="${String(data.tipoDesembargo).toUpperCase()}"]`);
            if (radio) radio.checked = true;
        }
    },
    toggleFormLock: (isUnlocked) => {
        const role = pageState.currentUserInfo?.role;
        Array.from(ui.form.elements).forEach(el => {
            if (el.id !== 'enableEdit') {
                el.disabled = !isUnlocked;
            }
        });
        if (role === 'COMUM') {
            if (ui.form.elements.status) ui.form.elements.status.disabled = true;
            if (document.getElementById('responsavelDesembargo')) document.getElementById('responsavelDesembargo').disabled = true;
        } else if (role === 'GERENTE') {
            const respEl = document.getElementById('responsavelDesembargo');
            if(respEl) respEl.disabled = !isUnlocked;
        }
        ui.updateBtn.disabled = !isUnlocked;
        ui.btnBuscar.disabled = !isUnlocked;
    },
    renderUserDropdown: async (currentResponsavel) => {
        if (pageState.currentUserInfo?.role !== 'GERENTE') return;
        const el = document.getElementById('responsavelDesembargo');
        const users = await api.getUsers();
        if (!users) { window.UI.showToast("Aviso: lista de usuários não carregada.", "info"); return; }
        const select = document.createElement('select');
        select.id = el.id; select.name = el.name; select.className = el.className;
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username; opt.textContent = u.name || u.username;
            select.appendChild(opt);
        });
        el.parentNode.replaceChild(select, el);
        utils.setSelectValue(select, currentResponsavel);
    },
    // Checar permissões de ediao do usuário
    updateUIAfterPermissions: (canEdit) => {
        const editToggleContainer = document.querySelector('.edit-toggle');
        if (canEdit) {
            editToggleContainer.style.display = 'flex';
        } else {
            editToggleContainer.style.display = 'none';
            // Se o motivo de não poder editar é o status 'APROVADO', mostra um toast específico
            if (pageState.currentRecord?.status?.toUpperCase() === 'APROVADO') {
                window.UI.showToast('Este desembargo já foi aprovado e não pode mais ser editado.', 'info', { duration: 5000 });
            } else {
                // Para outros casos (ex: usuário comum tentando editar registro de outro), mostra aviso genérico
                window.UI.showToast('Você não tem permissão para editar este registro.', 'info');
            }
        }
    },
    setSearchMessage: (message, type) => {
        ui.mensagemBusca.textContent = message;
        ui.mensagemBusca.className = `mensagem-validacao ${type}`;
    },
    setEmbargoCheckMessage: (message, type) => {
        const msgEl = document.getElementById('error-numero');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = type === 'success' ? 'mensagem-validacao sucesso' : 'error-msg';
        }
    },
    setEmbargoSEPMessage: (message, type) => {
        const msgEl = document.getElementById('error-numeroSEP');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = type === 'success' ? 'mensagem-validacao sucesso' : 'error-msg';
        }
    },
    displayValidationErrors: (errors) => {
        document.querySelectorAll('.error-msg').forEach(el => {
            if(el.id !== 'error-numero') el.textContent = '';
        });
        for (const field in errors) {
            const errorEl = document.getElementById(`error-${field}`);
            if (errorEl) {
                errorEl.textContent = errors[field];
            }
        }
    },
  };

  // Módulo de API
  const api = {
    fetchDesembargoById: async (id) => {
        const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`);
        if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status} - ${txt}`); }
        const json = await res.json();
        return utils.normalizeRow(json.data || json.desembargo || json);
    },
    fetchEmbargoByProcesso: async (proc) => {
        const res = await Auth.fetchWithAuth(`/api/embargos/processo?valor=${encodeURIComponent(proc)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Falha na busca por processo');
        const json = await res.json();
        return json.embargo;
    },
        fetchEmbargoBySEP: async (sep) => {
        const res = await Auth.fetchWithAuth(`/api/embargos/sep?valor=${encodeURIComponent(sep)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Falha na busca por SEP');
        const json = await res.json();
        return json.embargo;
    },
    getUsers: async () => {
        const res = await Auth.fetchWithAuth('/api/usuarios');
        return res.ok ? res.json().then(j => j.data || j) : null;
    },
    update: async (id, data) => {
        const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Erro ao atualizar");
        return result;
    },
    validateForm: async (formData) => {
        const res = await fetch('/api/desembargos/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });
        return res.json();
    },
    checkEmbargoExists: async (numero) => {
        const res = await Auth.fetchWithAuth(`/api/embargos/check/${encodeURIComponent(numero)}`);
        return res.ok;
    },
  };

  // Módulo de lógica de negócio
  const businessLogic = {
    canUserEdit: (userInfo, record) => {
        if (!userInfo || !record) return false;
        const { role, username } = userInfo;
        const status = (record.status || '').toUpperCase();
        const responsavel = (record.responsavelDesembargo || '').toLowerCase();
        if (status === 'APROVADO') return false;
        if (role === 'GERENTE') return true;
        if (role === 'COMUM') {
            return status === 'REVISÃO PENDENTE' && username && responsavel === username.toLowerCase();
        }
        return false;
    },
    prepareDataForUpdate: () => {
        const data = Object.fromEntries(new FormData(ui.form).entries());
        const radio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
        if (radio) data.tipoDesembargo = radio.value;
        if (ui.form.dataDesembargo?.value) {
            const [ano, mes, dia] = ui.form.dataDesembargo.value.split('-');
            const dt = new Date(ano, Number(mes) - 1, Number(dia));
            data.dataDesembargo = dt.toISOString();
        } else {
            data.dataDesembargo = null;
        }
        if (pageState.currentUserInfo.role === 'COMUM') {
            data.status = 'EM ANÁLISE';
            if (!data.responsavelDesembargo) data.responsavelDesembargo = pageState.currentUserInfo.username;
        }
        Object.keys(data).forEach(k => { if (data[k] === "") data[k] = null; });
        return data;
    },
    async validateFullForm() {
        const data = businessLogic.prepareDataForUpdate();
        const validationResult = await api.validateForm(data);
        if (validationResult.errors && Object.keys(validationResult.errors).length > 0) {
            view.displayValidationErrors(validationResult.errors);
            window.UI.showToast("Corrija os erros no formulário antes de salvar.", "error");
            return false;
        }
        if (!data.numeroSEP && !data.numeroEdocs) {
            view.displayValidationErrors({ 
                numeroSEP: 'Preencha pelo menos um dos campos: SEP ou E-Docs', 
                numeroEdocs: 'Preencha pelo menos um dos campos: SEP ou E-Docs' 
            });
            window.UI.showToast("É obrigatório preencher o número SEP ou E-Docs.", "error");
            return false;
        }
        view.displayValidationErrors({});
        return true;
    }
  };

  // Módulo de event handlers
  const handlers = {
    onUpdateClick: async (e) => {
        e.preventDefault();
        const canEdit = businessLogic.canUserEdit(pageState.currentUserInfo, pageState.currentRecord);
        if (!canEdit) {
            window.UI.showToast("Você não tem permissão para editar.", "error"); return;
        }
        const isFormValid = await businessLogic.validateFullForm();
        if (!isFormValid) return;
        const data = businessLogic.prepareDataForUpdate();
        try {
            await api.update(pageState.desembargoId, data);
            window.UI.showToast("Desembargo atualizado com sucesso!", "success");
            setTimeout(() => { window.location.href = "listaDesembargos.html"; }, 1200);
        } catch (err) {
            window.UI.showToast(err.message, "error");
        }
    },
    fillFormWithEmbargoData: (embargoData, searchType) => {
        if (embargoData) {
            const dataToFill = utils.normalizeRow(embargoData);
            const tipoRadio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');

            // Lógica para preencher (ou não) o campo de área
            if (tipoRadio && tipoRadio.value === 'TOTAL') {
                if (!ui.form.elements.area.value) {
                    dataToFill.area = dataToFill.area;
                }
            } else {
                delete dataToFill.area; // Não preenche a área se não for desembargo TOTAL
            }

            view.fillForm(dataToFill);
            //view.setSearchMessage(`Dados do embargo preenchidos via ${searchType.toUpperCase()}.`, 'sucesso');
        } else {
            //view.setSearchMessage(`Nenhum embargo encontrado para este ${searchType}.`, 'erro');
        }
    },
    onEditToggle: () => {
        const canEdit = businessLogic.canUserEdit(pageState.currentUserInfo, pageState.currentRecord);
        if (!canEdit) {
            ui.enableEdit.checked = false;
            window.UI.showToast("Você não tem permissão para editar.", "error");
            return;
        }
        view.toggleFormLock(ui.enableEdit.checked);
    },
    onSearchSEPClick: async () => {
        const sep = ui.numeroSEPInput.value.trim(); // Usando o input de SEP
        if (!sep) {
            window.UI.showToast("Informe o número do SEP para buscar.", "info");
            return;
        }
        view.setEmbargoCheckMessage('', ''); // Limpa mensagem do SEP/NÚMERO
        ui.btnBuscarSEP.disabled = true; // Desabilita botão de busca de SEP
        try {
            const embargoData = await api.fetchEmbargoBySEP(sep);
            await handlers.fillFormWithEmbargoData(embargoData, 'sep'); // Chama o handler unificado

            if(embargoData){
                window.UI.showToast("Dados LEGADO preenchidos por meio do número SEP", "info");
            }
            else{
                window.UI.showToast("Nenhum dado LEGADO encontrado para esse número SEP", "error");
            }
        } catch (error) {
            view.setEmbargoSEPMessage('Erro ao realizar a busca.', 'erro');
            console.error("Erro na busca por SEP:", error);
        } finally {
            ui.btnBuscarSEP.disabled = false; // Reabilita botão
        }
    },
    onSearchProcessoClick: async () => {
        if (!ui.enableEdit.checked) {
            view.setSearchMessage('Habilite a edição para buscar.', 'erro'); return;
        }
        let processo = ui.form.elements.processoSimlam.value.trim();
        if (!processo) {
            window.UI.showToast("Informe o número do Processo Simlam para realizar a busca.", 'info');
            return;
        }
        view.setSearchMessage('', '');
        ui.btnBuscar.classList.add('loading');
        ui.btnBuscar.disabled = true;
        try {
            const embargoData = await api.fetchEmbargoByProcesso(processo);
            if (embargoData) {
                const dataToFill = utils.normalizeRow(embargoData);
                const tipoRadio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
                if (tipoRadio && tipoRadio.value === 'TOTAL') {
                    if (!ui.form.elements.area.value) {
                       dataToFill.area = dataToFill.area;
                    }
                    window.UI.showToast("A área do embargo foi preenchida, sendo válida para APENAS para desembargo TOTAL.", "info", { duration: 5000 });
                } else {
                    delete dataToFill.area;
                }
                view.fillForm(dataToFill);
                window.UI.showToast('Dados do embargo preenchidos.', 'success');
            } else {
                window.UI.showToast('Nenhum embargo encontrado para este processo.', 'error');
            }
        } catch (error) {
            window.UI.showToast('Erro ao realizar a busca.', 'error');
            console.error("Erro na busca por processo:", error);
        } finally {
            ui.btnBuscar.classList.remove('loading');
            ui.btnBuscar.disabled = false;
        }
    },
    onNumeroEmbargoBlur: async (event) => {
        const field = event.target;
        const fieldName = field.name;
        const numero = field.value.trim();
        if (!numero) {
            view.setEmbargoCheckMessage('', 'none');
            return;
        }
        try {
            const validationResult = await api.validateForm({ [fieldName]: numero });
            const errorMsg = validationResult.errors?.[fieldName];
            if (errorMsg) {
                view.setEmbargoCheckMessage(errorMsg, 'error');
                return;
            }
            const found = await api.checkEmbargoExists(numero);
            if (found) {
                view.setEmbargoCheckMessage('✓ Embargo encontrado', 'success');
            } else {
                view.setEmbargoCheckMessage('Embargo não encontrado no banco de dados.', 'error');
            }
        } catch (error) {
            console.error('Erro ao checar número do embargo:', error);
            view.setEmbargoCheckMessage('Erro ao verificar. Tente novamente.', 'error');
        }
    },
    onSepEdocsBlur: async (event) => {
        const field = event.target;
        const fieldName = field.name;
        const value = field.value.trim();
        const errorEl = document.getElementById(`error-${fieldName}`);

        if (ui.enableEdit && !ui.enableEdit.checked) return;
        
        if (!value) {
            const numeroSEP = ui.form.elements.numeroSEP.value.trim();
            const numeroEdocs = ui.form.elements.numeroEdocs.value.trim();
            if (!numeroSEP && !numeroEdocs) {
                const msg = 'Preencha SEP ou E-Docs';
                document.getElementById('error-numeroSEP').textContent = msg;
                document.getElementById('error-numeroEdocs').textContent = msg;
            }
            return;
        }

        try {
            const validationResult = await api.validateForm({ [fieldName]: value });
            const errorMsg = validationResult.errors?.[fieldName];

            if (errorMsg) {
                if (errorEl) errorEl.textContent = errorMsg;
            } else {
                if (errorEl) errorEl.textContent = '';
                
                const otherField = fieldName === 'numeroSEP' ? 'numeroEdocs' : 'numeroSEP';
                const otherErrorEl = document.getElementById(`error-${otherField}`);
                if (otherErrorEl) otherErrorEl.textContent = '';
            }
        } catch (error) {
            console.error(`Erro na validação do campo ${fieldName}:`, error);
        }
    },
  };
  
  // Inicialização
  async function init() {
    if (!pageState.desembargoId) {
        alert("Nenhum desembargo selecionado."); window.location.href = "listaDesembargos.html"; return;
    }
    
    ui.updateBtn.addEventListener("click", handlers.onUpdateClick);
    ui.enableEdit.addEventListener("change", handlers.onEditToggle);
    ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
    ui.btnBuscarSEP.addEventListener("click", handlers.onSearchSEPClick);

    if (ui.form.elements.numero) {
        ui.form.elements.numero.addEventListener('blur', handlers.onNumeroEmbargoBlur);
    }

    if (ui.form.elements.numeroSEP) {
        ui.form.elements.numeroSEP.addEventListener('blur', handlers.onSepEdocsBlur);
    }
    if (ui.form.elements.numeroEdocs) {
        ui.form.elements.numeroEdocs.addEventListener('blur', handlers.onSepEdocsBlur);
    }

    try {
        pageState.currentUserInfo = utils.getCurrentUserInfo();
        view.toggleFormLock(false);
        pageState.currentRecord = await api.fetchDesembargoById(pageState.desembargoId);
        await view.renderUserDropdown(pageState.currentRecord.responsavelDesembargo);
        view.fillForm(pageState.currentRecord);
        const canEdit = businessLogic.canUserEdit(pageState.currentUserInfo, pageState.currentRecord);
        view.updateUIAfterPermissions(canEdit);
        view.toggleFormLock(false);
    } catch (err) {
        console.error("Erro ao carregar a página:", err);
        alert("Erro ao carregar desembargo. Veja o console para detalhes.");
    }
  }

  init();
});