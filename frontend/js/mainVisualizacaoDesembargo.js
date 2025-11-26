document.addEventListener('DOMContentLoaded', () => {
    // Verifica autenticação antes de tudo
    if (!Auth.initAuth()) return;

    // Módulo de estado da página
    const pageState = {
        desembargoId: new URLSearchParams(window.location.search).get('id'),
        currentUserInfo: null, 
        currentRecord: null,
    };

    // Módulo de elementos de UI (Cache de seletores)
    const ui = {
        form: document.getElementById('desembargoForm'),
        enableEdit: document.getElementById('enableEdit'),
        updateBtn: document.getElementById('updateBtn'),
        // Botões de busca podem não existir se o HTML for simplificado, então tratamos com cuidado
        btnBuscar: document.getElementById('btnBuscarProcesso'),
        btnBuscarSEP: document.getElementById('btnBuscarSEP'),
        mensagemBusca: document.getElementById('mensagem-busca'),
        numeroSEPInput: document.getElementById('numeroSEP'),
        tipoBuscaRadios: document.querySelectorAll('input[name="tipoBusca"]'),
        radioDeferida: document.getElementById('radioDeferida'),
        radioIndeferida: document.getElementById('radioIndeferida'),
        containerSubTipo: document.getElementById('containerSubTipo'),
        radioTotal: document.getElementById('radioTotal'),
        radioParcial: document.getElementById('radioParcial'),
        containerAreaDesembargada: document.getElementById('containerAreaDesembargada'),
        inputAreaDesembargada: document.getElementById('area'),
        inputAreaEmbargada: document.getElementById('areaEmbargada'),
    };
    
    const logic = {
        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) return;
            
            if (ui.radioDeferida.checked) {
                ui.containerSubTipo.style.display = 'flex';
            } else {
                ui.containerSubTipo.style.display = 'none';
                // Se indeferida, reseta visualmente (se estivesse editando)
                if(ui.enableEdit.checked) {
                    ui.radioTotal.checked = false;
                    ui.radioParcial.checked = false;
                    ui.inputAreaDesembargada.value = '';
                }
                ui.containerAreaDesembargada.style.display = 'none';
            }
        },
        handleTipoChange: () => {
            if (!ui.radioTotal || !ui.radioParcial) return;

            if (ui.radioTotal.checked) {
                ui.containerAreaDesembargada.style.display = 'none';
                // Copia valor se estiver editando
                if(ui.enableEdit.checked && ui.inputAreaEmbargada) {
                    ui.inputAreaDesembargada.value = ui.inputAreaEmbargada.value;
                }
            } else if (ui.radioParcial.checked) {
                ui.containerAreaDesembargada.style.display = 'flex';
            }
            
            // Regra Especial: Desinterdição
            const radioDesinterdicao = ui.form.querySelector('input[value="DESINTERDIÇÃO"]');
            if (radioDesinterdicao && radioDesinterdicao.checked) {
                 ui.containerAreaDesembargada.style.display = 'none'; // Geralmente desinterdição não pede área parcial, ajuste conforme regra
            }
        },
        prepareDataForSubmit: () => {
            const data = Object.fromEntries(new FormData(ui.form).entries());
            const radioTipo = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
            if (radioTipo) data.tipoDesembargo = radioTipo.value;
            const radioParecer = ui.form.querySelector('input[name="parecerTecnico"]:checked');
            if (radioParecer) data.parecerTecnico = radioParecer.value;
            const radioDeliberacao = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
            if (radioDeliberacao) data.deliberacaoAutoridade = radioDeliberacao.value;

            if (ui.form.dataDesembargo?.value) {
                const [ano, mes, dia] = ui.form.dataDesembargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataDesembargo = dt.toISOString();
            } else {
                data.dataDesembargo = null;
            }
             if (ui.form.dataEmbargo?.value) {
                const [ano, mes, dia] = ui.form.dataEmbargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataEmbargo = dt.toISOString();
            } else {
                data.dataEmbargo = null;
            }
            if (pageState.currentUserInfo.role === 'COMUM') {
                data.status = 'EM ANÁLISE';
                if (!data.responsavelDesembargo) 
                    data.responsavelDesembargo = pageState.currentUserInfo.username;
            }
            Object.keys(data).forEach(k => { if (data[k] === "") data[k] = null; });
            return data;
        },
        async validateFullForm(data) {
            const validationResult = await api.validateForm(data);
            if (validationResult.errors && Object.keys(validationResult.errors).length > 0) {
                view.displayValidationErrors(validationResult.errors);
                window.UI.showToast("Corrija os erros no formulário antes de salvar.", "error");
                return false;
            }
            if (!data.numeroSEP && !data.numeroEdocs) {
                view.displayValidationErrors({ numeroSEP: 'Preencha SEP ou E-Docs', numeroEdocs: 'Preencha SEP ou E-Docs' });
                return false;
            }
            view.displayValidationErrors({});
            return true;
        },
        gerarPreviewPDF: (formData) => {
            // ... (Mantenha sua função de PDF exatamente como estava) ...
            // Vou omitir aqui para economizar espaço, mas não altere nada nela.
            // Se precisar que eu repita o código do PDF, me avise.
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "pt", format: "a4" });
            // ... restante da lógica do PDF ...
            return URL.createObjectURL(doc.output('blob')); 
        },
        
        // --- FUNÇÕES DE CONTROLE VISUAL ---

        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) return;
            
            if (ui.radioDeferida.checked) {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'flex';
            } else {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'none';
                
                // Se indeferida, reseta seleção visualmente se estiver editando
                if (ui.enableEdit && ui.enableEdit.checked) {
                    if (ui.radioTotal) ui.radioTotal.checked = false;
                    if (ui.radioParcial) ui.radioParcial.checked = false;
                    if (ui.inputAreaDesembargada) ui.inputAreaDesembargada.value = '';
                }
                // Esconde área pois indeferimento não libera área
                if(ui.containerAreaDesembargada) ui.containerAreaDesembargada.style.display = 'none';
            }
        },

        handleTipoChange: () => {
            // Se o container de área não existe, sai
            if (!ui.containerAreaDesembargada || !ui.inputAreaDesembargada) return;

            // 1. Verifica se é Desinterdição
            const radioDesinterdicao = ui.form.querySelector('input[value="DESINTERDIÇÃO"]');
            if (radioDesinterdicao && radioDesinterdicao.checked) {
                 ui.containerAreaDesembargada.style.display = 'none'; 
                 return;
            }

            // 2. Verifica Total ou Parcial
            if (ui.radioTotal && ui.radioTotal.checked) {
                // TOTAL: Mostra o campo, copia o valor, mas bloqueia edição manual
                ui.containerAreaDesembargada.style.display = 'flex';
                
                // Se estiver em modo de edição, força a cópia e bloqueia
                if (ui.enableEdit && ui.enableEdit.checked) {
                    logic.copyAreaEmbargadaToDesembargada();
                    ui.inputAreaDesembargada.readOnly = true; // Bloqueia escrita
                    ui.inputAreaDesembargada.style.backgroundColor = "#f0f0f0"; // Visual de bloqueado
                }
            } 
            else if (ui.radioParcial && ui.radioParcial.checked) {
                // PARCIAL: Mostra o campo e permite edição
                ui.containerAreaDesembargada.style.display = 'flex';
                
                if (ui.enableEdit && ui.enableEdit.checked) {
                    ui.inputAreaDesembargada.readOnly = false; // Libera escrita
                    ui.inputAreaDesembargada.style.backgroundColor = "#fff";
                }
            }
        },

        copyAreaEmbargadaToDesembargada: () => {
            // Só copia se for TOTAL e tivermos os inputs
            if (ui.radioTotal && ui.radioTotal.checked && ui.inputAreaEmbargada && ui.inputAreaDesembargada) {
                // Copia apenas se o campo de origem tiver valor
                if(ui.inputAreaEmbargada.value) {
                    ui.inputAreaDesembargada.value = ui.inputAreaEmbargada.value;
                }
            }
        }
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
            } catch { 
                return null;
            }
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
                for (const k of keys) {
                    if (o && k in o && o[k] !== undefined) return o[k];
                }
                return undefined;
            };

            return {
                id:                     pick(row, 'id'), 
                numero:                 pick(row, 'numero', 'numero_embargo'),
                serie:                  pick(row, 'serie', 'serie_embargo'), 
                processoSimlam:         pick(row, 'processoSimlam', 'processo_simlam', 'processo'),
                numeroSEP:              pick(row, 'numeroSEP', 'numero_sep'), 
                numeroEdocs:            pick(row, 'numeroEdocs', 'numero_edocs'),
                coordenadaX:            pick(row, 'coordenadaX', 'coordenada_x'), 
                coordenadaY:            pick(row, 'coordenadaY', 'coordenada_y'),
                nomeAutuado:            pick(row, 'nomeAutuado', 'nome_autuado', 'autuado', 'nome'), 
                area:                   pick(row, 'area', 'area_desembargada'),
                tipoDesembargo:         pick(row, 'tipoDesembargo', 'tipo_desembargo', 'tipo'), 
                dataDesembargo:         pick(row, 'dataDesembargo', 'data_desembargo', 'data'),
                
                // Novos campos mapeados (Data Embargo e Area Embargada)
                dataEmbargo:            pick(row, 'dataEmbargo', 'data_embargo'),
                areaEmbargada:          pick(row, 'areaEmbargada', 'area_embargada'),
                
                descricao:              pick(row, 'descricao', 'descricao'), 
                status:                 pick(row, 'status', 'estado', 'situacao'),
                responsavelDesembargo:  pick(row, 'responsavelDesembargo', 'responsavel_desembargo', 'responsavel', 'usuario', 'responsavel_nome')
            };
        },
        setSelectValue: (selectEl, value) => {
            if (!selectEl) return;
            const vStr = String(value ?? '');
            const exact = Array.from(selectEl.options).find(o => o.value === vStr);
            if (exact) { 
                selectEl.value = exact.value; 
                return;
            }
            const ci = Array.from(selectEl.options).find(o => (o.value && o.value.toLowerCase() === vStr.toLowerCase()) || (o.text && o.text.toLowerCase() === vStr.toLowerCase()));
            if (ci) selectEl.value = ci.value;
        },
    };

    // Módulo da view
    const view = {
        fillForm: (data) => {
            if (!data || !ui.form) return;

            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    const el = ui.form.elements[key];

                    if (el && el.type !== 'radio') {
                        if (el.nodeName === 'SELECT') { 
                            utils.setSelectValue(el, data[key]);
                        } 
                        else if (el.type === 'date' && data[key]?.includes('T')) { 
                            el.value = data[key].split('T')[0];
                        }
                        else { 
                            el.value = data[key] ?? ''; 
                        }
                    }
                }
            });

            // Preenche Parecer e Deliberação
            if (data.parecerTecnico) {
                 const r = ui.form.querySelector(`input[name="parecerTecnico"][value="${data.parecerTecnico}"]`);
                 if(r) r.checked = true;
            }
            if (data.deliberacaoAutoridade) {
                 const r = ui.form.querySelector(`input[name="deliberacaoAutoridade"][value="${data.deliberacaoAutoridade}"]`);
                 if(r) r.checked = true;
            }

            // Lógica de Tipo e Desinterdição
            if (data.tipoDesembargo) {
                const tipoValue = String(data.tipoDesembargo).toUpperCase();
                const labelDesinterdicao = document.getElementById('labelDesinterdicao');
                const isDesinterdicao = (tipoValue === 'DESINTERDIÇÃO' || tipoValue === 'DESINTERDICAO');

                if (labelDesinterdicao) {
                    if (isDesinterdicao) {
                        labelDesinterdicao.style.display = 'inline-flex';
                        const radioInput = labelDesinterdicao.querySelector('input');
                        if (radioInput) radioInput.value = tipoValue;
                    } else {
                        labelDesinterdicao.style.display = 'none';
                    }
                }
                const radio = ui.form.querySelector(`input[name="tipoDesembargo"][value="${tipoValue}"]`);
                if (radio) radio.checked = true;
            }

            // Atualiza visual (Isso vai fazer o campo área aparecer se for Total ou Parcial)
            logic.handleDeliberacaoChange();
            logic.handleTipoChange();
        },
        clearForm: (preserveField = null) => {
            if (!ui.form) return;

            const fieldsToClear = [
                'numero', 'serie', 'nomeAutuado', 'processoSimlam',
                'area', 'numeroSEP', 'numeroEdocs', 'coordenadaX',
                'coordenadaY', 'descricao', 'dataEmbargo', 'areaEmbargada'
            ];

            fieldsToClear.forEach(fieldName => {
                const el = ui.form.elements[fieldName];
                if (fieldName !== preserveField && el) { 
                    el.value = '';
                }
            });

            // Reseta data para hoje se existir
            const dataEl = ui.form.elements.dataDesembargo;
            if (dataEl) {
                dataEl.value = new Date().toISOString().split('T')[0];
            }

            const tipoTotalRadio = ui.form.querySelector('input[name="tipoDesembargo"][value="TOTAL"]');
            if (tipoTotalRadio) tipoTotalRadio.checked = true;

            document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
            if (ui.mensagemBusca) ui.mensagemBusca.textContent = '';
        },
        toggleFormLock: (isUnlocked) => {
            if (!ui.form) return;

            const role = pageState.currentUserInfo?.role;

            // 1. Trava/Destrava geral
            Array.from(ui.form.elements).forEach(el => {
                if (el.id !== 'enableEdit') {
                    el.disabled = !isUnlocked;
                }
            });

            // 2. Regra específica para Área Desembargada no modo TOTAL
            // Se destravou o formulário (isUnlocked = true) e é TOTAL, o campo area deve continuar readOnly (mas não disabled)
            if (isUnlocked && ui.radioTotal && ui.radioTotal.checked) {
                if(ui.inputAreaDesembargada) {
                    ui.inputAreaDesembargada.disabled = false; // Habilita o envio
                    ui.inputAreaDesembargada.readOnly = true;  // Mas impede digitação
                    ui.inputAreaDesembargada.style.backgroundColor = "#f0f0f0";
                }
            } else if (isUnlocked && ui.radioParcial && ui.radioParcial.checked) {
                 if(ui.inputAreaDesembargada) {
                    ui.inputAreaDesembargada.disabled = false;
                    ui.inputAreaDesembargada.readOnly = false;
                    ui.inputAreaDesembargada.style.backgroundColor = "#fff";
                }
            }

            // 3. Regras de perfil (Comum vs Gerente)
            if (role === 'COMUM') {
                if (ui.form.elements.status) 
                    ui.form.elements.status.disabled = true;

                if (document.getElementById('responsavelDesembargo'))
                    document.getElementById('responsavelDesembargo').disabled = true;

            } 
            else if (role === 'GERENTE') {
                const respEl = document.getElementById('responsavelDesembargo');
                if(respEl) respEl.disabled = !isUnlocked;
            }

            if (ui.updateBtn) ui.updateBtn.disabled = !isUnlocked;
            
            if (ui.btnBuscar) ui.btnBuscar.disabled = !isUnlocked;
            if (ui.btnBuscarSEP) ui.btnBuscarSEP.disabled = !isUnlocked;
        },
        renderUserDropdown: async (currentResponsavel) => {
            if (pageState.currentUserInfo?.role !== 'GERENTE') return;

            const el = document.getElementById('responsavelDesembargo');
            if (!el) return;

            const users = await api.getUsers();
            if (!users) {
                window.UI.showToast("Aviso: lista de usuários não carregada.", "info");
                return;
            }

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
        updateUIAfterPermissions: (canEdit) => {
            const editToggleContainer = document.querySelector('.edit-toggle');
            if (!editToggleContainer) return;

            if (canEdit) {
                editToggleContainer.style.display = 'flex';
            } 
            else {
                editToggleContainer.style.display = 'none';
                
                if (pageState.currentRecord?.status?.toUpperCase() === 'APROVADO') {
                    window.UI.showToast('Este desembargo já foi aprovado e não pode mais ser editado.', 'info', { duration: 5000 });
                } else {
                    window.UI.showToast('Você não tem permissão para editar este registro.', 'info');
                }
            }
        },
        setSearchMessage: (message, type) => {
            if (ui.mensagemBusca) {
                ui.mensagemBusca.textContent = message;
                ui.mensagemBusca.className = `mensagem-validacao ${type}`;
            }
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
        updateBuscaVisibility: () => {
            // Se o elemento não existe, não faz nada
            if (!ui.enableEdit) return;

            const isEditing = ui.enableEdit.checked;

            // Se a edição não estiver habilitada, esconde ambos os botões
            if (!isEditing) {
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'none';
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'none';
                return;
            }

            // Verifica qual rádio está selecionado com segurança
            const radioChecked = document.querySelector('input[name="tipoBusca"]:checked');
            if (!radioChecked) return;

            const selectedType = radioChecked.value;

            if (selectedType === 'ate2012') {
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'flex';
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'none';
            } else {
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'flex';
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'none';
            }
        },
    };

    // Módulo de API
    const api = {
        fetchDesembargoById: async (id) => {
            const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`);
            if (!res.ok) { 
                const txt = await res.text();
                throw new Error(`HTTP ${res.status} - ${txt}`);
            }
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
            
            // Trata data do embargo (novo campo)
             if (ui.form.dataEmbargo?.value) {
                const [ano, mes, dia] = ui.form.dataEmbargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataEmbargo = dt.toISOString();
            } else {
                data.dataEmbargo = null;
            }

            if (pageState.currentUserInfo.role === 'COMUM') {
                data.status = 'EM ANÁLISE';
                if (!data.responsavelDesembargo) 
                    data.responsavelDesembargo = pageState.currentUserInfo.username;
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
        fillFormWithEmbargoData: (embargoData) => {
            if (embargoData) {
                const dataToFill = utils.normalizeRow(embargoData);
                const tipoRadio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');

                // Lógica para preencher (ou não) o campo de área desembargada
                // Se o embargo encontrado tem área, e o tipo é TOTAL, preenchemos a area desembargada
                // Se não, deixamos em branco para o usuário digitar
                if (tipoRadio && tipoRadio.value === 'TOTAL') {
                    if (dataToFill.areaEmbargada && !ui.form.elements.area.value) {
                        dataToFill.area = dataToFill.areaEmbargada; // Copia area embargada para area desembargada
                    }
                } 
                view.fillForm(dataToFill);
            }
        },
        onFieldBlur: async (event) => {
            if (!ui.enableEdit || !ui.enableEdit.checked) return;

            const field = event.target;
            const fieldName = field.name;

            try {
                const result = await api.validateForm({ [fieldName]: field.value });
                const errorEl = document.getElementById(`error-${fieldName}`);
                if (errorEl) {
                    errorEl.textContent = result.errors?.[fieldName] ?? '';
                }
            } catch (error) {
                console.error(`Erro na validação do campo ${fieldName}:`, error);
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
            view.updateBuscaVisibility();
        },
        onTipoBuscaChange: () => {
            view.updateBuscaVisibility();
        },
        onSearchSEPClick: async () => {
            const sep = ui.numeroSEPInput.value.trim();
            if (!sep) {
                window.UI.showToast("Informe o número do SEP para buscar.", "info");
                return;
            }
            view.setEmbargoCheckMessage('', '');
            view.clearForm('numeroSEP');
            
            if(ui.btnBuscarSEP) ui.btnBuscarSEP.disabled = true;

            try {
                const embargoData = await api.fetchEmbargoBySEP(sep);
                // Preenche o formulário com dados encontrados
                handlers.fillFormWithEmbargoData(embargoData);

                if(embargoData){
                    window.UI.showToast("Dados LEGADO preenchidos por meio do número SEP", "info");
                } else{
                    window.UI.showToast("Nenhum dado LEGADO encontrado para esse número SEP", "error");
                }
            } catch (error) {
                view.setEmbargoSEPMessage('Erro ao realizar a busca.', 'erro');
                console.error("Erro na busca por SEP:", error);
            } finally {
                if(ui.btnBuscarSEP) ui.btnBuscarSEP.disabled = false;
            }
        },
        onSearchProcessoClick: async () => {
            if (ui.enableEdit && !ui.enableEdit.checked) {
                view.setSearchMessage('Habilite a edição para buscar.', 'erro'); return;
            }

            let processo = ui.form.elements.processoSimlam.value.trim().replace(/^0+/, '');
            if (!processo) {
                window.UI.showToast("Informe o número do Processo Simlam para realizar a busca.", 'info');
                return;
            }
            
            view.setSearchMessage('', '');
            if(ui.btnBuscar) {
                ui.btnBuscar.classList.add('loading');
                ui.btnBuscar.disabled = true;
            }
            
            view.clearForm('processoSimlam');
            
            try {
                const embargoData = await api.fetchEmbargoByProcesso(processo);
                if (embargoData) {
                    handlers.fillFormWithEmbargoData(embargoData);
                    window.UI.showToast('Dados do embargo preenchidos.', 'success');
                } else {
                    window.UI.showToast('Nenhum embargo encontrado para este processo.', 'error');
                }
            } catch (error) {
                window.UI.showToast('Erro ao realizar a busca.', 'error');
                console.error("Erro na busca por processo:", error);
            } finally {
                if(ui.btnBuscar) {
                    ui.btnBuscar.classList.remove('loading');
                    ui.btnBuscar.disabled = false;
                }
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
                    const elSep = document.getElementById('error-numeroSEP');
                    const elEdocs = document.getElementById('error-numeroEdocs');
                    if(elSep) elSep.textContent = msg;
                    if(elEdocs) elEdocs.textContent = msg;
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
    
    // Inicialização segura
    async function init() {
        if (!pageState.desembargoId) {
            alert("Nenhum desembargo selecionado."); 
            window.location.href = "listaDesembargos.html"; 
            return;
        }
        
        // Adiciona listeners com verificação de existência para evitar o TypeError
        if (ui.updateBtn) 
            ui.updateBtn.addEventListener("click", handlers.onUpdateClick);
        
        if (ui.enableEdit) 
            ui.enableEdit.addEventListener("change", handlers.onEditToggle);
        
        if (ui.btnBuscar) 
            ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
        
        if (ui.btnBuscarSEP) 
            ui.btnBuscarSEP.addEventListener("click", handlers.onSearchSEPClick);

        if (ui.form && ui.form.elements.numero) {
            ui.form.elements.numero.addEventListener('blur', handlers.onNumeroEmbargoBlur);
        }

        if (ui.form && ui.form.elements.numeroSEP) {
            ui.form.elements.numeroSEP.addEventListener('blur', handlers.onSepEdocsBlur);
        }
        if (ui.form && ui.form.elements.numeroEdocs) {
            ui.form.elements.numeroEdocs.addEventListener('blur', handlers.onSepEdocsBlur);
        }

        if (ui.radioDeferida && ui.radioIndeferida) {
            ui.radioDeferida.addEventListener('change', logic.handleDeliberacaoChange);
            ui.radioIndeferida.addEventListener('change', logic.handleDeliberacaoChange);
        }
        if (ui.radioTotal && ui.radioParcial) {
            ui.radioTotal.addEventListener('change', logic.handleTipoChange);
            ui.radioParcial.addEventListener('change', logic.handleTipoChange);
        }

        const fieldsToValidateOnBlur = [
            'serie', 'nomeAutuado', 'area', 'processoSimlam',
            'dataDesembargo', 'coordenadaX', 'coordenadaY', 'descricao',
            'dataEmbargo', 'areaEmbargada'
        ];

        fieldsToValidateOnBlur.forEach(fieldName => {
            if (ui.form && ui.form.elements[fieldName]) {
                ui.form.elements[fieldName].addEventListener('blur', handlers.onFieldBlur);
            }
        });

        if (ui.tipoBuscaRadios) {
            ui.tipoBuscaRadios.forEach(radio => {
                radio.addEventListener('change', handlers.onTipoBuscaChange);
            });
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
            view.updateBuscaVisibility();
        } 
        catch (err) {
            console.error("Erro ao carregar a página:", err);
            // alert("Erro ao carregar desembargo. Veja o console para detalhes.");
            window.UI.showToast("Erro ao carregar desembargo: " + err.message, "error");
        }
    }

    // Inicia
    init();
});