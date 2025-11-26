document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica autenticação antes de iniciar
    if (!Auth.initAuth()) { 
        return;
    }

    // --- MÓDULO DE ESTADO ---
    const pageState = {
        currentUserInfo: null, 
        currentPreviewUrl: null,
    };

    // --- MÓDULO DE UI (Seletores e Elementos) ---
    const ui = {
        form: document.getElementById('desembargoForm'),
        
        // Botões de busca
        btnBuscar: document.getElementById('btnBuscarProcesso'),
        btnBuscarSEP: document.getElementById('btnBuscarSEP'),
        
        // Inputs Específicos
        numeroSEPInput: document.getElementById('numeroSEP'),
        
        // Mensagens
        mensagemBusca: document.getElementById('mensagem-busca'),
        
        // Modal de Prévia
        modal: document.getElementById('modalPrevia'),
        iframePreview: document.getElementById('pdfPreview'),
        confirmarBtn: document.getElementById('confirmarEnvio'),
        cancelarBtn: document.getElementById('cancelarEnvio'),
        fecharTopoBtn: document.getElementById('fecharModalTopo'),
        
        // Controles de Rádio e Containers
        tipoBuscaRadios: document.querySelectorAll('input[name="tipoBusca"]'),
        
        // Novos controles de lógica de negócio (Deliberação)
        radioDeferida: document.getElementById('radioDeferida'),
        radioIndeferida: document.getElementById('radioIndeferida'),
        containerSubTipo: document.getElementById('containerSubTipo'),
        
        radioTotal: document.getElementById('radioTotal'),
        radioParcial: document.getElementById('radioParcial'),
        
        containerAreaDesembargada: document.getElementById('containerAreaDesembargada'),
        inputAreaDesembargada: document.getElementById('area'), // input 'area'
        inputAreaEmbargada: document.getElementById('areaEmbargada'), // input origem
    };
  
    // --- MÓDULO DE UTILITÁRIOS ---
    const utils = {
        getCurrentUserInfo: () => {
            const u = Auth.getSessionUser();
            return {
                username: u?.username || u?.email || u?.name || null,
                name: u?.name || u?.username || null,
                position: u?.position || null,
            };
        },
        // Transforma dados brutos do banco para o formato do formulário
        normalizeEmbargoData: (row) => {
            if (!row) return {};
            
            const pick = (o, ...keys) => {
                for (const k of keys){ 
                    if (o && k in o && o[k] !== undefined) {
                        return o[k]; 
                    }
                }
                return undefined;
            };

            const { numeroSEP, numeroEdocs } = utils.separarSepEdocs(pick(row, 'sep_edocs'));
            
            return {
                numero:         pick(row, 'n_iuf_emb', 'numero_embargo', 'numero'),
                serie:          pick(row, 'serie_embargo', 'serie'),
                processoSimlam: pick(row, 'processo', 'processo_simlam'),
                nomeAutuado:    pick(row, 'nome_autuado', 'autuado', 'nome'),
                
                // Mapeia área original do embargo (se vier do banco)
                areaEmbargada:  pick(row, 'area_embargada', 'area', 'area_desembargada'), 
                
                coordenadaX:    pick(row, 'easting', 'easting_m', 'coordenada_x', 'coordenadaX'),
                coordenadaY:    pick(row, 'northing', 'northing_m', 'coordenada_y', 'coordenadaY'),
                
                // Mapeia data original do embargo
                dataEmbargo:    pick(row, 'data_embargo', 'data'),

                descricao:      pick(row, 'descricao', 'obs'),
                numeroSEP:      pick(row, 'numeroSEP') || numeroSEP,
                numeroEdocs:    pick(row, 'numeroEdocs') || numeroEdocs,
            };
        },
        separarSepEdocs: (valor) => {
            if (!valor) return { numeroSEP: null, numeroEdocs: null };
            const seped = String(valor);
            // Verifica formato simples de E-Docs (ex: 2024-...)
            if (/^\d{4}-/.test(seped) || seped.includes('-')) {
                return { numeroSEP: null, numeroEdocs: seped };
            }
            return { numeroSEP: seped, numeroEdocs: null };
        },
    };

    // --- MÓDULO DA VIEW (Manipulação do DOM) ---
    const view = {
        fillForm: (data) => {
            if (!data || !ui.form) return;
            
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    const el = ui.form.elements[key];
                    if (el && el.type !== 'radio') { 
                        // Tratamento para datas
                        if (el.type === 'date' && typeof data[key] === 'string' && data[key].includes('T')) {
                             el.value = data[key].split('T')[0];
                        } else {
                             el.value = data[key];
                        }
                    }
                }
            });
            
            // Dispara lógica de UI após preencher área embargada
            logic.copyAreaEmbargadaToDesembargada();
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

            // Reseta data para hoje
            const dataEl = ui.form.elements.dataDesembargo;
            if (dataEl) {
                dataEl.value = new Date().toISOString().split('T')[0];
            }

            // Reseta rádios e lógica
            const radioDeferida = document.getElementById('radioDeferida');
            if (radioDeferida) radioDeferida.checked = false;
            
            const radioIndeferida = document.getElementById('radioIndeferida');
            if (radioIndeferida) radioIndeferida.checked = false;

            // Limpa erros e mensagens
            document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
            if (ui.mensagemBusca) ui.mensagemBusca.textContent = '';
            
            // Atualiza visibilidade dos campos
            logic.handleDeliberacaoChange();
        },
        displayValidationErrors: (errors) => {
            document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
            for (const field in errors) {
                const errorEl = document.getElementById(`error-${field}`);
                if (errorEl) {
                    errorEl.textContent = errors[field];
                }
            }
        },
        setSearchMessage: (message, type) => {
            if(ui.mensagemBusca) {
                ui.mensagemBusca.textContent = message;
                ui.mensagemBusca.className = `mensagem-validacao ${type}`;
            }
        },
        setEmbargoCheckMessage: (message, type) => {
            const msgEl = document.getElementById('mensagem-numero');
            if (!msgEl) return;
            msgEl.textContent = '';
            msgEl.classList.remove('sucesso', 'erro');
            if (message) {
                msgEl.textContent = message;
                if (type === 'success' || type === 'error') {
                    msgEl.className = `mensagem-validacao ${type}`;
                }
            }
        },
        openModal: () => {
            if (!ui.modal) return;
            ui.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        },
        closeModal: () => {
            if (!ui.modal) return;
            ui.modal.classList.add('hidden');
            document.body.style.overflow = '';
            if (pageState.currentPreviewUrl) {
                URL.revokeObjectURL(pageState.currentPreviewUrl);
                pageState.currentPreviewUrl = null;
            }
            if (ui.iframePreview) ui.iframePreview.src = 'about:blank';
        },
        updateBuscaVisibility: (tipo) => {
            if (tipo === 'ate2012') {
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'flex';
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'none';
            } else {
                if (ui.btnBuscar) ui.btnBuscar.style.display = 'flex';
                if (ui.btnBuscarSEP) ui.btnBuscarSEP.style.display = 'none';
            }
        },
    };

    // --- MÓDULO DE API ---
    const api = {
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
        createDesembargo: async (data) => {
            const res = await Auth.fetchWithAuth('/api/desembargos/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || "Erro ao inserir desembargo");
            return result;
        }
    };

    // --- MÓDULO DE LÓGICA DE NEGÓCIO ---
    const logic = {
        prepareDataForSubmit: () => {
            const data = Object.fromEntries(new FormData(ui.form).entries());
            
            // Pega rádio de Tipo de Desembargo
            const radioTipo = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
            if (radioTipo) data.tipoDesembargo = radioTipo.value;

            // Pega rádio de Parecer
            const radioParecer = ui.form.querySelector('input[name="parecerTecnico"]:checked');
            if (radioParecer) data.parecerTecnico = radioParecer.value;

            // Pega rádio de Deliberação
            const radioDeliberacao = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
            if (radioDeliberacao) data.deliberacaoAutoridade = radioDeliberacao.value;

            // Trata data desembargo
            if (ui.form.dataDesembargo?.value) {
                const [ano, mes, dia] = ui.form.dataDesembargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataDesembargo = dt.toISOString();
            } else {
                data.dataDesembargo = null;
            }

             // Trata data embargo
             if (ui.form.dataEmbargo?.value) {
                const [ano, mes, dia] = ui.form.dataEmbargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataEmbargo = dt.toISOString();
            } else {
                data.dataEmbargo = null;
            }
            
            Object.keys(data).forEach(k => { if (data[k] === "") data[k] = null; });
            return data;
        },
        async validateFullForm(data) {
            const validationResult = await api.validateForm(data);
            if (validationResult.errors && Object.keys(validationResult.errors).length > 0) {
                view.displayValidationErrors(validationResult.errors);
                window.UI.showToast("Corrija os erros no formulário antes de enviar.", "error");
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
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "pt", format: "a4" });
            let y = 40;
            const primaryColor = "#17903f"; const secondaryColor = "#444"; const lineHeight = 18;
            
            const logoEl = document.getElementById("logoPdf");
            if (logoEl) { 
                doc.addImage(logoEl, "PNG", 30, 20, 540, 90); 
                y += 100;
            }

            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(primaryColor);
            doc.text("www.idaf.es.gov.br", 40, y); y += lineHeight;

            doc.setFont("helvetica", "normal"); doc.setTextColor(secondaryColor);
            doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, 555, y); 
            y += 20;

            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(primaryColor);
            let texto_aux_header='TERMO DE DESEMBARGO';

            if (formData.tipoDesembargo?.toUpperCase() === 'INDEFERIMENTO' || formData.deliberacaoAutoridade === 'INDEFERIDA'){ 
                texto_aux_header= 'OFÍCIO DE INDEFERIMENTO';
            }
            else if (formData.tipoDesembargo?.toUpperCase() === 'DESINTERDIÇÃO'){ 
                texto_aux_header= 'TERMO DE DESINTERDIÇÃO';
            }

            doc.text(`${texto_aux_header} Nº X/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center'); 
            y += 10;

            doc.setTextColor(secondaryColor); doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, 555, y);
            y += 30;

            const infoFields = [
                { label: "Termo de Embargo Ambiental",  value: `${formData.numero || '-'} ${formData.serie?.toUpperCase() || '-'}` },
                { label: "Processo Simlam",             value: formData.processoSimlam || '-' },
                { label: "Processo E-Docs",             value: formData.numeroEdocs || '-' },
                { label: "Número do SEP",               value: formData.numeroSEP || '-' },
                { label: "Autuado",                     value: formData.nomeAutuado?.toUpperCase() || '-' },
                { label: "Área Desembargada",           value: `${formData.area ?? '-'} ${formData.area && formData.area !== '-' ? 'ha' : ''}` },
                { label: "Deliberação",                 value: formData.deliberacaoAutoridade || '-' },
                { label: "Tipo de Desembargo",          value: (formData.tipoDesembargo || '-').toUpperCase() },
                { label: "Data do Desembargo",          value: formData.dataDesembargo ? (new Date(formData.dataDesembargo)).toLocaleDateString() : '-' },
                { label: "Coordenadas UTM",             value: `X(m): ${formData.coordenadaX ?? '-'}, Y(m): ${formData.coordenadaY ?? '-'}` },
            ];

            const labelX = 40; const valueX = 250;
            doc.setFont("helvetica", "bold"); doc.setFontSize(12);

            infoFields.forEach(item => {
                const label = String(item.label || ""); const value = String(item.value ?? "-");
                doc.setFont("helvetica", "bold"); doc.text(label + ":", labelX, y);
                doc.setFont("helvetica", "normal");
                const valLines = doc.splitTextToSize(value, 280);
                doc.text(valLines, valueX, y); y += valLines.length * lineHeight;
            });

            y += 10;

            doc.setFont("helvetica", "bold"); doc.setTextColor(primaryColor);
            doc.text("Descrição da Deliberação:", 40, y); 
            y += lineHeight;

            doc.setFont("helvetica", "normal"); doc.setTextColor(secondaryColor);
            const descricaoSplit = doc.splitTextToSize(formData.descricao || '-', 515, { maxWidth: 500,align: 'justify'});
            doc.text(descricaoSplit, 40, y); 
            y += descricaoSplit.length * lineHeight + 10;

            doc.setFont("helvetica", "bold"); doc.setTextColor(secondaryColor);
            doc.text(String(pageState.currentUserInfo.name || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center'); 
            y += lineHeight;

            doc.setFont("helvetica", "normal"); doc.setTextColor(primaryColor);
            doc.text(String(pageState.currentUserInfo.position || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center'); 
            y += 2*lineHeight;

            doc.setFontSize(10); doc.setTextColor("#666");
            const disclaimer = "AVISO: ESTE DOCUMENTO É APENAS UMA PRÉVIA. Uma vez aprovado, o termo somente terá validade após sua inclusão e assinatura no sistema EDOC-s.";
            const discLines = doc.splitTextToSize(disclaimer, 515);
            doc.text(discLines, 40, y);
            
            const blob = doc.output('blob');
            return URL.createObjectURL(blob);
        },
        
        // --- FUNÇÕES DE CONTROLE DE VISIBILIDADE (Deliberação/Área) ---
        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) return;
            
            if (ui.radioDeferida.checked) {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'flex';
            } else {
                if(ui.containerSubTipo) ui.containerSubTipo.style.display = 'none';
                
                // Se indeferida, reseta seleção
                if (ui.radioTotal) ui.radioTotal.checked = false;
                if (ui.radioParcial) ui.radioParcial.checked = false;
                
                // Esconde area
                if(ui.containerAreaDesembargada) ui.containerAreaDesembargada.style.display = 'none';
                if(ui.inputAreaDesembargada) ui.inputAreaDesembargada.value = '';
            }
        },
        handleTipoChange: () => {
            if (!ui.radioTotal || !ui.radioParcial) return;

            if (ui.radioTotal.checked) {
                // TOTAL: Esconde input e copia valor
                if(ui.containerAreaDesembargada) ui.containerAreaDesembargada.style.display = 'none';
                logic.copyAreaEmbargadaToDesembargada();
            } else if (ui.radioParcial.checked) {
                // PARCIAL: Mostra input vazio
                if(ui.containerAreaDesembargada) ui.containerAreaDesembargada.style.display = 'flex';
                if(ui.inputAreaDesembargada) {
                    ui.inputAreaDesembargada.value = '';
                    ui.inputAreaDesembargada.focus();
                }
            }
        },
        copyAreaEmbargadaToDesembargada: () => {
            if (ui.radioTotal && ui.radioTotal.checked && ui.inputAreaEmbargada && ui.inputAreaDesembargada) {
                ui.inputAreaDesembargada.value = ui.inputAreaEmbargada.value;
            }
        }
    };

    // --- MÓDULO DE HANDLERS ---
    const handlers = {
        onFormSubmit: async (e) => {
            e.preventDefault();
            const data = logic.prepareDataForSubmit();
            const isFormValid = await logic.validateFullForm(data);

            if (!isFormValid) return;

            try {
                if (pageState.currentPreviewUrl) 
                    URL.revokeObjectURL(pageState.currentPreviewUrl);

                pageState.currentPreviewUrl = logic.gerarPreviewPDF(data);

                if (ui.iframePreview) 
                    ui.iframePreview.src = pageState.currentPreviewUrl;

                view.openModal();
                window.UI.showToast('Prévia gerada. Revise e confirme o envio.', 'info');
            } catch (error) {
                console.error("Erro ao gerar prévia:", error);
                window.UI.showToast("Erro ao gerar a prévia do documento.", "error");
            }
        },
        onConfirmarEnvio: async () => {
            ui.confirmarBtn.disabled = true;
            const originalHTML = ui.confirmarBtn.innerHTML;
            ui.confirmarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
            const data = logic.prepareDataForSubmit();

            try {
                await api.createDesembargo(data);
                window.UI.showToast("Desembargo inserido com sucesso!", "success");
                view.clearForm();
                view.closeModal();
            } catch (error) {
                window.UI.showToast(error.message, "error");
            } finally {
                ui.confirmarBtn.disabled = false;
                ui.confirmarBtn.innerHTML = originalHTML;
            }
        },
        onSearchProcessoClick: async () => {
            const processo = ui.form.elements.processoSimlam.value.trim().replace(/^0+/, '');
            if (!processo) {
                window.UI.showToast("Informe o número do processo Simlam para buscar.", "info");
                return;
            }
            view.setSearchMessage('', '');
            view.clearForm('processoSimlam');
            ui.btnBuscar.disabled = true;

            try {
                const embargoData = await api.fetchEmbargoByProcesso(processo);
                if (embargoData) {
                    const dataToFill = utils.normalizeEmbargoData(embargoData);
                    view.fillForm(dataToFill);
                    window.UI.showToast('Dados do embargo preenchidos.', 'success');
                } else {
                    window.UI.showToast('Nenhum embargo encontrado para este processo.', 'error');
                }
            } catch (error) {
                window.UI.showToast('Erro ao realizar a busca.', 'error');
            } finally {
                ui.btnBuscar.disabled = false;
            }
        },
        onSearchSEPClick: async () => {
            const sep = ui.numeroSEPInput.value.trim();
            if (!sep) {
                window.UI.showToast("Informe o número do SEP para buscar.", "info");
                return;
            }
            view.setSearchMessage('', '');
            view.clearForm('numeroSEP');
            ui.btnBuscarSEP.disabled = true;

            try {
                const embargoData = await api.fetchEmbargoBySEP(sep);
                if (embargoData) {
                    const dataToFill = utils.normalizeEmbargoData(embargoData);
                    view.fillForm(dataToFill);
                    window.UI.showToast('Dados LEGADO preenchidos via SEP.', 'success');
                } else {
                    window.UI.showToast('Nenhum embargo encontrado para este SEP.', 'error');
                }
            } catch (error) {
                window.UI.showToast('Erro ao realizar a busca.', 'error');
            } finally {
                ui.btnBuscarSEP.disabled = false;
            }
        },
        onTipoBuscaChange: (event) => {
            const selectedValue = event.target.value;
            view.updateBuscaVisibility(selectedValue);
        },
        onFieldBlur: async (event) => {
            const field = event.target;
            const fieldName = field.name;
            if (!fieldName) return;

            try {
                const result = await api.validateForm({ [fieldName]: field.value });
                const errorEl = document.getElementById(`error-${fieldName}`);
                if (errorEl) {
                    errorEl.textContent = result.errors?.[fieldName] ?? '';
                }
            } catch (error) {
                console.error(`Erro validação ${fieldName}`, error);
            }
        },
    };
  
    // --- INICIALIZAÇÃO ---
    function init() {
        pageState.currentUserInfo = utils.getCurrentUserInfo();
        
        // 1. Listeners básicos do formulário
        if(ui.form) ui.form.addEventListener("submit", handlers.onFormSubmit);
        if(ui.btnBuscar) ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
        if(ui.btnBuscarSEP) ui.btnBuscarSEP.addEventListener("click", handlers.onSearchSEPClick);
        if(ui.confirmarBtn) ui.confirmarBtn.addEventListener('click', handlers.onConfirmarEnvio);
        
        // 2. Listeners de Modal
        if(ui.cancelarBtn) ui.cancelarBtn.addEventListener('click', view.closeModal);
        if(ui.fecharTopoBtn) ui.fecharTopoBtn.addEventListener('click', view.closeModal);
        if(ui.modal) ui.modal.addEventListener('click', (e) => { if(e.target === ui.modal) view.closeModal(); });

        // 3. Listeners de Tipos de Busca
        ui.tipoBuscaRadios.forEach(radio => radio.addEventListener('change', handlers.onTipoBuscaChange));

        // 4. Validação em Blur
        const fieldsToValidate = [
            'serie', 'nomeAutuado', 'area', 'processoSimlam',
            'numeroSEP', 'numeroEdocs', 'dataDesembargo',
            'coordenadaX', 'coordenadaY', 'descricao', 'numero'
        ];
        fieldsToValidate.forEach(fieldName => {
            const el = ui.form.elements[fieldName];
            if (el) el.addEventListener('blur', handlers.onFieldBlur);
        });

        // 5. LISTENERS NOVOS (Deliberação e Área)
        if (ui.radioDeferida && ui.radioIndeferida) {
            ui.radioDeferida.addEventListener('change', logic.handleDeliberacaoChange);
            ui.radioIndeferida.addEventListener('change', logic.handleDeliberacaoChange);
        }
        if (ui.radioTotal && ui.radioParcial) {
            ui.radioTotal.addEventListener('change', logic.handleTipoChange);
            ui.radioParcial.addEventListener('change', logic.handleTipoChange);
        }
        if (ui.inputAreaEmbargada) {
            ui.inputAreaEmbargada.addEventListener('input', logic.copyAreaEmbargadaToDesembargada);
        }

        // 6. Configurações Iniciais
        const dataEl = document.getElementById('dataDesembargo');
        if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
        
        // Aplica estado inicial dos campos
        logic.handleDeliberacaoChange();
        view.updateBuscaVisibility('ate2012');
    }

    init();
});