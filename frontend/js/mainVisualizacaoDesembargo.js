document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica autenticação antes de iniciar
    if (!Auth.initAuth()) return;

    // --- MÓDULO DE ESTADO ---
    const pageState = {
        desembargoId: new URLSearchParams(window.location.search).get('id'),
        currentUserInfo: null, 
        currentRecord: null,
    };

    // --- MÓDULO DE UI (Seletores e Elementos) ---
    const ui = {
        form: document.getElementById('desembargoForm'),
        
        // Botões
        enableEdit: document.getElementById('enableEdit'),
        updateBtn: document.getElementById('updateBtn'),
        btnBuscar: document.getElementById('btnBuscarProcesso'),
        btnBuscarSEP: document.getElementById('btnBuscarSEP'),
        
        // Inputs Específicos
        numeroSEPInput: document.getElementById('numeroSEP'),
        
        // Mensagens e Modais
        mensagemBusca: document.getElementById('mensagem-busca'),
        modal: document.getElementById('modalPrevia'), // Se existir na visualização
        iframePreview: document.getElementById('pdfPreview'),
        confirmarBtn: document.getElementById('confirmarEnvio'), 
        cancelarBtn: document.getElementById('cancelarEnvio'),
        fecharTopoBtn: document.getElementById('fecharModalTopo'),
        
        // Controles de Rádio e Containers
        tipoBuscaRadios: document.querySelectorAll('input[name="tipoBusca"]'),
        
        // Controles de Decisão
        radioDeferida: document.getElementById('radioDeferida'),
        radioIndeferida: document.getElementById('radioIndeferida'),
        containerSubTipo: document.getElementById('containerSubTipo'),
        radioTotal: document.getElementById('radioTotal'),
        radioParcial: document.getElementById('radioParcial'),
        
        // Radios ocultos (Lógica de sistema)
        radioTipoIndeferimento: document.getElementById('radioTipoIndeferimento'),
        radioTipoDesinterdicao: document.getElementById('radioTipoDesinterdicao'),
        
        // Áreas
        containerAreaDesembargada: document.getElementById('containerAreaDesembargada'),
        inputAreaDesembargada: document.getElementById('area'),
        inputAreaEmbargada: document.getElementById('areaEmbargada'),
    };
  
    // --- MÓDULO DE UTILITÁRIOS ---
    const utils = {
        getCurrentUserInfo: () => {
            const u = Auth.getSessionUser();
            return {
                username: u?.username || u?.email || u?.name || null,
                name: u?.name || u?.username || null,
                position: u?.position || null,
                role: utils.normalizeRole(u?.role || u?.roles)
            };
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
        // Transforma dados do backend para o formato do formulário
        normalizeRow: (row) => {
            if (!row) return {};
            
            const pick = (o, ...keys) => {
                for (const k of keys){ 
                    if (o && k in o && o[k] !== undefined && o[k] !== null) {
                        return o[k]; 
                    }
                }
                return undefined;
            };

            const { numeroSEP, numeroEdocs } = utils.separarSepEdocs(pick(row, 'sep_edocs', 'numeroEdocs'));
            
            return {
                id:                     pick(row, 'id'),
                numero:                 pick(row, 'numero', 'numero_embargo', 'n_iuf_emb'),
                serie:                  pick(row, 'serie', 'serie_embargo'), 
                processoSimlam:         pick(row, 'processoSimlam', 'processo_simlam', 'processo'),
                
                numeroSEP:              pick(row, 'numeroSEP', 'numero_sep') || numeroSEP,
                numeroEdocs:            pick(row, 'numeroEdocs', 'numero_edocs') || numeroEdocs,
                
                coordenadaX:            pick(row, 'coordenadaX', 'coordenada_x', 'easting'), 
                coordenadaY:            pick(row, 'coordenadaY', 'coordenada_y', 'northing'),
                nomeAutuado:            pick(row, 'nomeAutuado', 'nome_autuado', 'autuado'), 
                
                area:                   pick(row, 'area', 'area_desembargada'),
                areaEmbargada:          pick(row, 'areaEmbargada', 'area_embargada'),
                
                dataDesembargo:         pick(row, 'dataDesembargo', 'data_desembargo'),
                dataEmbargo:            pick(row, 'dataEmbargo', 'data_embargo'),
                
                tipoDesembargo:         pick(row, 'tipoDesembargo', 'tipo_desembargo'), 
                parecerTecnico:         pick(row, 'parecerTecnico', 'recomendacao_parecer_tecnico'),
                deliberacaoAutoridade:  pick(row, 'deliberacaoAutoridade', 'deliberacao_autoridade'), 
                
                descricao:              pick(row, 'descricao', 'obs'), 
                status:                 pick(row, 'status', 'estado'),
                responsavelDesembargo:  pick(row, 'responsavelDesembargo', 'responsavel_desembargo')
            };
        },
        separarSepEdocs: (valor) => {
            if (!valor) return { numeroSEP: null, numeroEdocs: null };
            const seped = String(valor);
            if (/^\d{4}-/.test(seped) || seped.includes('-')) {
                return { numeroSEP: null, numeroEdocs: seped };
            }
            return { numeroSEP: seped, numeroEdocs: null };
        },
        setSelectValue: (selectEl, value) => {
            if (!selectEl) return;
            const vStr = String(value ?? '');
            const exact = Array.from(selectEl.options).find(o => o.value === vStr);
            if (exact) { 
                selectEl.value = exact.value; 
                return;
            }
            const ci = Array.from(selectEl.options).find(o => (o.value && o.value.toLowerCase() === vStr.toLowerCase()));
            if (ci) selectEl.value = ci.value;
        }
    };

    // --- MÓDULO DE API ---
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
             if (!res.ok) throw new Error('Erro na busca por processo');
             const json = await res.json();
             return json.embargo;
        },
        fetchEmbargoBySEP: async (sep) => {
             const res = await Auth.fetchWithAuth(`/api/embargos/sep?valor=${encodeURIComponent(sep)}`);
             
             if (res.status === 404) return null;
             
             if (!res.ok) {
                // Tenta ler a mensagem de erro específica enviada pelo backend
                let errorMessage = 'Erro na busca por SEP';
                try {
                    const errorJson = await res.json();
                    if (errorJson && errorJson.message) {
                        errorMessage = errorJson.message;
                    }
                } catch (e) { /* falha ao ler json, usa msg padrao */ }
                
                throw new Error(errorMessage);
             }
             
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
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
            });
            return res.json();
        },
        checkEmbargoExists: async (numero) => {
            const res = await Auth.fetchWithAuth(`/api/embargos/check/${encodeURIComponent(numero)}`);
            return res.ok;
        },
    };

    // --- MÓDULO DE LÓGICA DE NEGÓCIO (Regras, Permissões e Dados) ---
    // Este módulo estava faltando no código anterior e causava o erro.
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
            
            // 1. Garante Radios
            const radioTipo = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
            data.tipoDesembargo = radioTipo ? radioTipo.value : null;
            
            const radioParecer = ui.form.querySelector('input[name="parecerTecnico"]:checked');
            data.parecerTecnico = radioParecer ? radioParecer.value : null;
            
            const radioDeliberacao = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
            data.deliberacaoAutoridade = radioDeliberacao ? radioDeliberacao.value : null;

            // 2. Datas
            if (ui.form.dataDesembargo?.value) {
                const [ano, mes, dia] = ui.form.dataDesembargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataDesembargo = dt.toISOString();
            } else { data.dataDesembargo = null; }
            
            if (ui.form.dataEmbargo?.value) {
                const [ano, mes, dia] = ui.form.dataEmbargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataEmbargo = dt.toISOString();
            } else { data.dataEmbargo = null; }

            // 3. Limpeza e CONVERSÃO DE NÚMEROS (IMPORTANTE)
            ['area', 'areaEmbargada', 'coordenadaX', 'coordenadaY'].forEach(k => {
                if (data[k] && typeof data[k] === 'string') {
                    data[k] = data[k].replace(',', '.'); // Troca vírgula por ponto
                }
                if (data[k] === "") data[k] = null;
            });
            if (data.numeroSEP === "") data.numeroSEP = null;
            if (data.numeroEdocs === "") data.numeroEdocs = null;

            // 4. Lógica Área Total
            if (data.tipoDesembargo === 'TOTAL' && data.areaEmbargada) {
                data.area = data.areaEmbargada;
            }

            // 5. Status
            if (pageState.currentUserInfo.role === 'COMUM') {
                data.status = 'EM ANÁLISE';
                if (!data.responsavelDesembargo) 
                    data.responsavelDesembargo = pageState.currentUserInfo.username;
            }
            
            return data;
        },
        validateFullForm: async () => {
            const data = businessLogic.prepareDataForUpdate();
            const validationResult = await api.validateForm(data);

            if (validationResult.errors && Object.keys(validationResult.errors).length > 0) {
                view.displayValidationErrors(validationResult.errors);
                window.UI.showToast("Corrija os erros no formulário.", "error");
                return false;
            }
            if (!data.numeroSEP && !data.numeroEdocs) {
                window.UI.showToast("Preencha SEP ou E-Docs.", "error");
                return false;
            }
            return true;
        }
    };

    // --- MÓDULO DE LÓGICA VISUAL (Mostrar/Esconder Campos) ---
    const visualLogic = {
        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) return;
            
            if (ui.radioDeferida.checked) {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'flex';
                
                // Se mudar de Indeferida para Deferida, limpa seleções antigas para forçar escolha
                if (ui.radioTipoIndeferimento && ui.radioTipoIndeferimento.checked && ui.enableEdit.checked) {
                    ui.radioTipoIndeferimento.checked = false;
                    if(ui.radioTotal) ui.radioTotal.checked = false;
                    if(ui.radioParcial) ui.radioParcial.checked = false;
                }
            } 
            else if (ui.radioIndeferida.checked) {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'none';
                if (ui.radioTipoIndeferimento) ui.radioTipoIndeferimento.checked = true;
                
                if (ui.enableEdit.checked) {
                    if (ui.radioTotal) ui.radioTotal.checked = false;
                    if (ui.radioParcial) ui.radioParcial.checked = false;
                    if (ui.inputAreaDesembargada) ui.inputAreaDesembargada.value = '';
                }
                if(ui.containerAreaDesembargada) ui.containerAreaDesembargada.style.display = 'none';
            }
            visualLogic.handleTipoChange();
        },

        handleTipoChange: () => {
            if (!ui.containerAreaDesembargada || !ui.inputAreaDesembargada) return;

            // Se for oculto (Desinterdição ou Indeferimento), esconde a área
            if ((ui.radioTipoDesinterdicao && ui.radioTipoDesinterdicao.checked) || 
                (ui.radioTipoIndeferimento && ui.radioTipoIndeferimento.checked)) {
                 ui.containerAreaDesembargada.style.display = 'none'; 
                 return;
            }

            if (ui.radioTotal && ui.radioTotal.checked) {
                // TOTAL: Esconde o input, mas mantém no DOM para o FormData pegar (opcional, pois o businessLogic garante)
                // A melhor UX aqui é esconder ou deixar readonly. Vamos esconder conforme seu padrão.
                ui.containerAreaDesembargada.style.display = 'none'; // ou 'flex' com readonly se preferir ver
                
                if (ui.enableEdit.checked) {
                    visualLogic.copyAreaEmbargadaToDesembargada();
                    ui.inputAreaDesembargada.readOnly = true; 
                }
            } 
            else if (ui.radioParcial && ui.radioParcial.checked) {
                // PARCIAL: Mostra e libera edição
                ui.containerAreaDesembargada.style.display = 'flex';
                
                if (ui.enableEdit.checked) {
                    ui.inputAreaDesembargada.readOnly = false;
                    ui.inputAreaDesembargada.style.backgroundColor = "#fff";
                }
            } else {
                ui.containerAreaDesembargada.style.display = 'none';
            }
        },

        copyAreaEmbargadaToDesembargada: () => {
            if (ui.radioTotal && ui.radioTotal.checked && ui.inputAreaEmbargada && ui.inputAreaDesembargada) {
                if(ui.inputAreaEmbargada.value) {
                    ui.inputAreaDesembargada.value = ui.inputAreaEmbargada.value;
                } else {
                    ui.inputAreaDesembargada.value = '';
                }
            }
        }
    };

    // --- MÓDULO DA VIEW (Manipulação do DOM) ---
    const view = {
        fillForm: (data) => {
            if (!data || !ui.form) return;

            // 1. Preenche inputs básicos
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    const el = ui.form.elements[key];
                    if (el && el.type !== 'radio') {
                        if (el.nodeName === 'SELECT') { 
                            utils.setSelectValue(el, data[key]);
                        } 
                        else if (el.type === 'date' && typeof data[key] === 'string' && data[key].includes('T')) { 
                            el.value = data[key].split('T')[0];
                        }
                        else { 
                            el.value = data[key] ?? ''; 
                        }
                    }
                }
            });

            // 2. Marca Parecer
            if (data.parecerTecnico) {
                 const r = ui.form.querySelector(`input[name="parecerTecnico"][value="${data.parecerTecnico}"]`);
                 if(r) r.checked = true;
            }

            // 3. Marca Deliberação
            // Se não tiver dado salvo (legado), tenta inferir pelo tipo
            let deliberacaoVal = data.deliberacaoAutoridade;
            if (!deliberacaoVal && data.tipoDesembargo) {
                deliberacaoVal = (data.tipoDesembargo === 'INDEFERIMENTO') ? 'INDEFERIDA' : 'DEFERIDA';
            }
            if (deliberacaoVal) {
                 const r = ui.form.querySelector(`input[name="deliberacaoAutoridade"][value="${deliberacaoVal}"]`);
                 if(r) r.checked = true;
            }

            // 4. Marca Tipo
            if (data.tipoDesembargo) {
                const tipoValue = String(data.tipoDesembargo).toUpperCase();
                
                // Trata Desinterdição (mostra label oculta)
                const labelDesinterdicao = document.getElementById('labelDesinterdicao');
                if (labelDesinterdicao && (tipoValue === 'DESINTERDIÇÃO' || tipoValue === 'DESINTERDICAO')) {
                    labelDesinterdicao.style.display = 'inline-flex';
                }
                
                // Marca o radio (seja Total, Parcial, Indeferimento ou Desinterdição)
                const radio = ui.form.querySelector(`input[name="tipoDesembargo"][value="${tipoValue}"]`);
                if (radio) radio.checked = true;
            }

            // 5. Atualiza o estado visual
            visualLogic.handleDeliberacaoChange();
            visualLogic.handleTipoChange();
        },
        
        clearForm: (preserveField = null) => {
            if (!ui.form) return;
            // ... (mesma lógica de limpeza do cadastro) ...
            // Como é visualização, geralmente não limpamos o form todo, mas se usar para busca:
            const fieldsToClear = ['numero','serie','nomeAutuado','processoSimlam','area','numeroSEP','numeroEdocs','coordenadaX','coordenadaY','descricao','dataEmbargo','areaEmbargada'];
            fieldsToClear.forEach(f => { if(f!==preserveField && ui.form.elements[f]) ui.form.elements[f].value = ''; });
            
            if(ui.form.dataDesembargo) ui.form.dataDesembargo.value = new Date().toISOString().split('T')[0];
            
            // Reseta radios
            if (ui.radioDeferida) ui.radioDeferida.checked = false;
            if (ui.radioIndeferida) ui.radioIndeferida.checked = false;
            if (ui.radioTotal) ui.radioTotal.checked = false;
            if (ui.radioParcial) ui.radioParcial.checked = false;
            
            view.displayValidationErrors({});
            visualLogic.handleDeliberacaoChange();
        },

        toggleFormLock: (isUnlocked) => {
            if (!ui.form) return;
            const role = pageState.currentUserInfo?.role;

            Array.from(ui.form.elements).forEach(el => {
                if (el.id !== 'enableEdit') {
                    el.disabled = !isUnlocked;
                }
            });

            // Regra Especial: Área Total sempre ReadOnly na edição
            if (isUnlocked && ui.radioTotal && ui.radioTotal.checked) {
                if(ui.inputAreaDesembargada) {
                    ui.inputAreaDesembargada.disabled = false; 
                    ui.inputAreaDesembargada.readOnly = true;  
                    ui.inputAreaDesembargada.style.backgroundColor = "#f0f0f0";
                }
            } 
            else if (isUnlocked && ui.radioParcial && ui.radioParcial.checked) {
                 if(ui.inputAreaDesembargada) {
                    ui.inputAreaDesembargada.disabled = false;
                    ui.inputAreaDesembargada.readOnly = false;
                    ui.inputAreaDesembargada.style.backgroundColor = "#fff";
                }
            }

            if (role === 'COMUM') {
                if (ui.form.elements.status) ui.form.elements.status.disabled = true;
                if (document.getElementById('responsavelDesembargo')) document.getElementById('responsavelDesembargo').disabled = true;
            } else if (role === 'GERENTE') {
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
        updateUIAfterPermissions: (canEdit) => {
            const editToggleContainer = document.querySelector('.edit-toggle');
            if (!editToggleContainer) return;
            if (canEdit) { editToggleContainer.style.display = 'flex'; } 
            else { editToggleContainer.style.display = 'none'; }
        },
        displayValidationErrors: (errors) => {
            document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
            for (const field in errors) {
                const errorEl = document.getElementById(`error-${field}`);
                if (errorEl) errorEl.textContent = errors[field];
            }
        },
        updateBuscaVisibility: () => {
            if (!ui.enableEdit) return;
            const isEditing = ui.enableEdit.checked;
            if (!isEditing) {
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'none';
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'none';
                return;
            }
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
        setSearchMessage: (msg, type) => { if(ui.mensagemBusca) { ui.mensagemBusca.textContent=msg; ui.mensagemBusca.className=`mensagem-validacao ${type}`; } },
        setEmbargoCheckMessage: (msg, type) => { const el = document.getElementById('error-numero'); if(el) { el.textContent=msg; el.className=(type==='success')?'mensagem-validacao sucesso':'error-msg'; } },
        closeModal: () => { if(ui.modal) ui.modal.classList.add('hidden'); }
    };

    // --- HANDLERS ---
    const handlers = {
        onUpdateClick: async (e) => {
            e.preventDefault();
            
            // 1. Verifica permissão básica
            const canEdit = businessLogic.canUserEdit(pageState.currentUserInfo, pageState.currentRecord);
            if (!canEdit) { window.UI.showToast("Sem permissão.", "error"); return; }

            // 2. BLOQUEIO MANUAL DE SEGURANÇA (A validação matemática)
            // Impede o envio se for Parcial e a Área Desembargada >= Embargada
            if (ui.radioParcial && ui.radioParcial.checked && ui.inputAreaDesembargada && ui.inputAreaEmbargada) {
                const valArea = parseFloat(ui.inputAreaDesembargada.value.replace(',', '.'));
                const valEmbargada = parseFloat(ui.inputAreaEmbargada.value.replace(',', '.'));

                if (!isNaN(valArea) && !isNaN(valEmbargada)) {
                    if (valArea >= valEmbargada) {
                        // Mostra msg no campo
                        const errorEl = document.getElementById('error-area');
                        if (errorEl) errorEl.textContent = 'A área desembargada deve ser menor que a área embargada.';
                        
                        // Mostra Toast e Aborta
                        window.UI.showToast("Corrija os erros no formulário.", "error");
                        ui.inputAreaDesembargada.focus();
                        return; // <--- BLOQUEIO
                    }
                }
            }
            
            // 3. Validação completa via API (Joi)
            const isFormValid = await businessLogic.validateFullForm();
            if (!isFormValid) return;

            // 4. Envio
            const data = businessLogic.prepareDataForUpdate();
            try {
                await api.update(pageState.desembargoId, data);
                window.UI.showToast("Desembargo atualizado!", "success");
                setTimeout(() => { window.location.href = "listaDesembargos.html"; }, 1200);
            } catch (err) { window.UI.showToast(err.message, "error"); }
        },
        onFieldBlur: async (event) => {
            if (!ui.enableEdit || !ui.enableEdit.checked) return;
            const field = event.target;
            const fieldName = field.name;
            if (!fieldName) return;

            // Limpa erro anterior
            const currentErrorEl = document.getElementById(`error-${fieldName}`);
            if (currentErrorEl) currentErrorEl.textContent = '';

            // --- 1. VALIDAÇÃO MANUAL VISUAL (Feedback imediato) ---
            if ((fieldName === 'area' || fieldName === 'areaEmbargada') && ui.radioParcial && ui.radioParcial.checked) {
                const areaInput = document.getElementById('area');
                const embargadaInput = document.getElementById('areaEmbargada');
                const errorAreaEl = document.getElementById('error-area');

                if (areaInput && embargadaInput && errorAreaEl) {
                    const valArea = parseFloat(areaInput.value.replace(',', '.'));
                    const valEmbargada = parseFloat(embargadaInput.value.replace(',', '.'));

                    if (!isNaN(valArea) && !isNaN(valEmbargada)) {
                        if (valArea >= valEmbargada) {
                            errorAreaEl.textContent = 'A área desembargada deve ser menor que a área embargada.';
                            // Se o campo atual é a área, paramos aqui para a API não limpar essa mensagem
                            if (fieldName === 'area') return; 
                        } else {
                            errorAreaEl.textContent = '';
                        }
                    }
                }
            }

            // --- 2. Validação via API (Joi) ---
            let dataToValidate = { [fieldName]: field.value };

            // Lógica de Contexto Cruzado
            const camposCruzados = ['area', 'areaEmbargada', 'tipoDesembargo', 'deliberacaoAutoridade', 'parecerTecnico'];
            
            if (camposCruzados.includes(fieldName)) {
                const formData = new FormData(ui.form);
                dataToValidate = Object.fromEntries(formData.entries());

                // Força envio dos Radios
                const tipoRadio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
                if (tipoRadio) dataToValidate.tipoDesembargo = tipoRadio.value;

                const delibRadio = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
                if (delibRadio) dataToValidate.deliberacaoAutoridade = delibRadio.value;

                // Tratamento Numérico (Vírgula -> Ponto) para a API entender
                if (dataToValidate.area) dataToValidate.area = dataToValidate.area.replace(',', '.');
                if (dataToValidate.areaEmbargada) dataToValidate.areaEmbargada = dataToValidate.areaEmbargada.replace(',', '.');

                // Limpeza de nulos
                if(dataToValidate.numeroSEP === '') dataToValidate.numeroSEP = null;
                if(dataToValidate.numeroEdocs === '') dataToValidate.numeroEdocs = null;
            }

            try {
                const result = await api.validateForm(dataToValidate);
                
                // Só atualiza o erro da API na 'area' se não houver erro manual pendente ou se não for Parcial
                if (fieldName === 'area' && ui.radioParcial && ui.radioParcial.checked) {
                     if (result.errors?.area) {
                        if (currentErrorEl) currentErrorEl.textContent = result.errors.area;
                     }
                } else {
                     if (currentErrorEl) currentErrorEl.textContent = result.errors?.[fieldName] ?? '';
                }
                
                // Validação Cruzada: Atualiza erro da área se mexer na embargada
                if (fieldName === 'areaEmbargada') {
                    const errorArea = document.getElementById(`error-area`);
                    if(errorArea && result.errors?.area) {
                        errorArea.textContent = result.errors.area;
                    }
                }
            } catch (e) { console.error(e); }
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
        onTipoBuscaChange: () => view.updateBuscaVisibility(),
        onSearchProcessoClick: async () => {
            const processo = ui.form.elements.processoSimlam.value.trim().replace(/^0+/, '');
            if (!processo) return;
            view.setSearchMessage('', '');
            ui.btnBuscar.disabled = true;
            try {
                const embargoData = await api.fetchEmbargoByProcesso(processo);
                if (embargoData) {
                    const dataToFill = utils.normalizeRow(embargoData); 
                    view.fillForm(dataToFill);
                    window.UI.showToast('Dados atualizados via busca.', 'success');
                } else { window.UI.showToast('Não encontrado.', 'error'); }
            } catch(e) { window.UI.showToast('Erro na busca.', 'error'); }
            finally { ui.btnBuscar.disabled = false; }
        },
        onSearchSEPClick: async () => {
             const sep = ui.numeroSEPInput.value.trim();
             
             if (!sep) {
                 window.UI.showToast("Informe o número do SEP para buscar.", "info");
                 return;
             }

             view.setSearchMessage('', '');
             // Opcional: Limpar campos antes de preencher, se desejar comportamento igual ao cadastro
             // view.clearForm('numeroSEP'); 
             
             ui.btnBuscarSEP.disabled = true;
             
             try {
                const embargoData = await api.fetchEmbargoBySEP(sep);
                
                if (embargoData) {
                    // Normaliza usando a função do utils existente nesta página
                    const dataToFill = utils.normalizeRow(embargoData);
                    view.fillForm(dataToFill);
                    window.UI.showToast('Dados atualizados via SEP.', 'success');
                } else { 
                    window.UI.showToast('Nenhum embargo encontrado para este SEP.', 'error'); 
                }
             } catch(e) { 
                 window.UI.showToast(e.message, 'error'); 
             } finally { 
                 ui.btnBuscarSEP.disabled = false; 
             }
        },
         onNumeroEmbargoBlur: async (event) => { 
            const numero = event.target.value.trim();
            view.setEmbargoCheckMessage('', ''); 
            
            if(!numero) return;

            try {
                const validationResult = await api.validateForm({ numero: numero });
                if (validationResult.errors && validationResult.errors.numero) {
                    view.setEmbargoCheckMessage(validationResult.errors.numero, 'error');
                    return; 
                }
            } catch (e) {
                console.error("Erro na validação local do número", e);
                return;
            }

            try {
                const found = await api.checkEmbargoExists(numero);
                if(found) {
                    view.setEmbargoCheckMessage('Embargo encontrado', 'success');
                } else {
                    view.setEmbargoCheckMessage('Embargo não encontrado.', 'error');
                }
            } catch(e) { 
                view.setEmbargoCheckMessage('Erro ao consultar.', 'error'); 
            }
        }
    };
    
    // --- INICIALIZAÇÃO ---
    async function init() {
        if (!pageState.desembargoId) {
            alert("ID inválido."); window.location.href = "listaDesembargos.html"; return;
        }
        
        // Listeners Principais
        if (ui.updateBtn) ui.updateBtn.addEventListener("click", handlers.onUpdateClick);
        if (ui.enableEdit) ui.enableEdit.addEventListener("change", handlers.onEditToggle);
        if (ui.btnBuscar) ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
        if (ui.btnBuscarSEP) ui.btnBuscarSEP.addEventListener("click", handlers.onSearchSEPClick);
        if (ui.tipoBuscaRadios) ui.tipoBuscaRadios.forEach(r => r.addEventListener('change', handlers.onTipoBuscaChange));

        // Listeners Lógica de Negócio
        if (ui.radioDeferida && ui.radioIndeferida) {
            ui.radioDeferida.addEventListener('change', (e) => { visualLogic.handleDeliberacaoChange(); handlers.onFieldBlur(e); });
            ui.radioIndeferida.addEventListener('change', (e) => { visualLogic.handleDeliberacaoChange(); handlers.onFieldBlur(e); });
        }
        if (ui.radioTotal && ui.radioParcial) {
            ui.radioTotal.addEventListener('change', (e) => { visualLogic.handleTipoChange(); handlers.onFieldBlur(e); });
            ui.radioParcial.addEventListener('change', (e) => { visualLogic.handleTipoChange(); handlers.onFieldBlur(e); });
        }
        const radiosParecer = document.querySelectorAll('input[name="parecerTecnico"]');
        radiosParecer.forEach(r => r.addEventListener('change', handlers.onFieldBlur));

        if (ui.inputAreaEmbargada) {
            ui.inputAreaEmbargada.addEventListener('input', visualLogic.copyAreaEmbargadaToDesembargada);
        }

        // Validação no Blur
        const fieldsToValidate = [
            'serie', 'nomeAutuado', 'area', 'processoSimlam',
            'dataDesembargo', 'coordenadaX', 'coordenadaY', 'descricao', 'numero',
            'dataEmbargo', 'areaEmbargada', 'numeroSEP', 'numeroEdocs'
        ];
        fieldsToValidate.forEach(fieldName => {
            const el = ui.form.elements[fieldName];
            if (el) el.addEventListener('blur', handlers.onFieldBlur);
        });
        if (ui.form.elements.numero) ui.form.elements.numero.addEventListener('blur', handlers.onNumeroEmbargoBlur);

        // Carregar Dados Iniciais
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
            console.error(err);
            window.UI.showToast("Erro ao carregar dados.", "error");
        }
    }
    
    init();
});