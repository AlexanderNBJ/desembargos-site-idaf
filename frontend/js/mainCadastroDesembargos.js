document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.initAuth()) { 
        return;
    }

    const pageState = {
        currentUserInfo: null, 
        currentPreviewUrl: null,
    };

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
        // Novos radios ocultos
        radioTipoIndeferimento: document.getElementById('radioTipoIndeferimento'),
        radioTipoDesinterdicao: document.getElementById('radioTipoDesinterdicao'),
        
        containerAreaDesembargada: document.getElementById('containerAreaDesembargada'),
        inputAreaDesembargada: document.getElementById('area'),
        inputAreaEmbargada: document.getElementById('areaEmbargada'),
        enableEdit: document.getElementById('enableEdit'),
    };
  
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
            if (!row) 
                return {};
            
            const pick = (o, ...keys) => {
                for (const k of keys){ 
                    if (o && k in o && o[k] !== undefined) {
                        return o[k]; 
                    }
                }
                return undefined;
            };

            
            return {
                numero:         pick(row, 'n_iuf_emb', 'numero_embargo', 'numero'),
                serie:          pick(row, 'serie_embargo', 'serie'),
                processoSimlam: pick(row, 'processo', 'processo_simlam'),
                nomeAutuado:    pick(row, 'nome_autuado', 'autuado', 'nome'),
                areaEmbargada:  pick(row, 'area_embargada', 'area', 'area_desembargada'), 
                coordenadaX:    pick(row, 'easting', 'easting_m', 'coordenada_x', 'coordenadaX'),
                coordenadaY:    pick(row, 'northing', 'northing_m', 'coordenada_y', 'coordenadaY'),
                dataEmbargo:    pick(row, 'data_embargo', 'data'),
                descricao:      pick(row, 'descricao', 'obs'),
                numeroSEP:      pick(row, 'numeroSEP'),
                numeroEdocs:    pick(row, 'numeroEdocs')
            };
        },
    };

    const view = {
        fillForm: (data) => {
            if (!data || !ui.form) 
                return;
            
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    const el = ui.form.elements[key];

                    if (el && el.type !== 'radio') { 
                        if (el.type === 'date' && typeof data[key] === 'string' && data[key].includes('T')) {
                            el.value = data[key].split('T')[0];
                        }
                        else {
                            el.value = data[key];
                        }
                    }

                    if (el.type === 'date' && typeof data[key] === 'string' && data[key].includes('T')) {
                        el.value = data[key].split('T')[0];
                    } 
                    else {
                        el.value = data[key];
                    }
                }
            });
            

            if (data.deliberacaoAutoridade) {
                const r = ui.form.querySelector(`input[name="deliberacaoAutoridade"][value="${data.deliberacaoAutoridade}"]`);
                
                if(r)
                    r.checked = true;
            }

            if (data.tipoDesembargo) {
                const tipoValue = String(data.tipoDesembargo).toUpperCase();
                const labelDesinterdicao = document.getElementById('labelDesinterdicao');

                if (labelDesinterdicao && (tipoValue === 'DESINTERDIÇÃO' || tipoValue === 'DESINTERDICAO')) {
                    labelDesinterdicao.style.display = 'inline-flex';
                }

                const radio = ui.form.querySelector(`input[name="tipoDesembargo"][value="${tipoValue}"]`);

                if (radio) 
                    radio.checked = true;
            }

            logic.handleDeliberacaoChange();
            logic.handleTipoChange();
            logic.copyAreaEmbargadaToDesembargada();
        },
        clearForm: (preserveField = null) => {
            if (!ui.form) 
                return;

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

            if (!msgEl) 
                return;

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
            if (!ui.modal) 
                return;

            ui.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        },
        closeModal: () => {
            if (!ui.modal) 
                return;
            ui.modal.classList.add('hidden');
            document.body.style.overflow = '';

            if (pageState.currentPreviewUrl) {
                URL.revokeObjectURL(pageState.currentPreviewUrl);
                pageState.currentPreviewUrl = null;
            }

            if (ui.iframePreview) 
                ui.iframePreview.src = 'about:blank';
        },
        updateBuscaVisibility: (tipo) => {
            if (tipo === 'ate2012') {
                if (ui.btnBuscarSEP) 
                    ui.btnBuscarSEP.style.display = 'flex';

                if (ui.btnBuscar) 
                    ui.btnBuscar.style.display = 'none';
            } 
            else {
                if (ui.btnBuscar) 
                    ui.btnBuscar.style.display = 'flex';

                if (ui.btnBuscarSEP) 
                    ui.btnBuscarSEP.style.display = 'none';
            }
        },
    };

    const api = {
        fetchEmbargoByProcesso: async (proc) => {
            const res = await Auth.fetchWithAuth(`/api/embargos/processo?valor=${encodeURIComponent(proc)}`);

            if (res.status === 404) 
                return null;
            
            if (!res.ok) 
                throw new Error('Falha na busca por processo');
            
            const json = await res.json();
            return json.embargo;
        },
        fetchEmbargoBySEP: async (sep) => {
            const res = await Auth.fetchWithAuth(`/api/embargos/sep?valor=${encodeURIComponent(sep)}`);

            if (res.status === 404) 
                return null;
            
            if (!res.ok) 
                throw new Error('Falha na busca por SEP');

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
            
            if (!res.ok) 
                throw new Error(result.message || "Erro ao inserir desembargo");

            return result;
        }
    };

    const logic = {
        prepareDataForSubmit: () => {
            const data = Object.fromEntries(new FormData(ui.form).entries());
            
            // Pega rádio de Tipo de Desembargo
            const radioTipo = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
            if (radioTipo) data.tipoDesembargo = radioTipo.value;

            // Pega rádio de Deliberação
            const radioDeliberacao = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
            if (radioDeliberacao) data.deliberacaoAutoridade = radioDeliberacao.value;

            // Trata data desembargo
            if (ui.form.dataDesembargo?.value) {
                const [ano, mes, dia] = ui.form.dataDesembargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataDesembargo = dt.toISOString();
            } 
            else {
                data.dataDesembargo = null;
            }

            // Trata data embargo
            if (ui.form.dataEmbargo?.value) {
                const [ano, mes, dia] = ui.form.dataEmbargo.value.split('-');
                const dt = new Date(ano, Number(mes) - 1, Number(dia));
                data.dataEmbargo = dt.toISOString();
            } 
            else {
                data.dataEmbargo = null;
            }

            const camposNumericos = ['area', 'areaEmbargada', 'coordenadaX', 'coordenadaY'];
            
            // Troca vírgula por ponto
            camposNumericos.forEach(key => {
                if (data[key] && typeof data[key] === 'string') {        
                    data[key] = data[key].replace(',', '.');
                }
            });

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
            
            // Lógica do Título
            let texto_aux_header = 'TERMO DE DESEMBARGO';
            const tipoUpper = formData.tipoDesembargo?.toUpperCase();
            const deliberacaoUpper = formData.deliberacaoAutoridade?.toUpperCase();

            if (tipoUpper === 'INDEFERIMENTO' || deliberacaoUpper === 'INDEFERIDA'){ 
                texto_aux_header = 'OFÍCIO DE INDEFERIMENTO';
            }
            else if (tipoUpper === 'DESINTERDIÇÃO'){ 
                texto_aux_header = 'TERMO DE DESINTERDIÇÃO';
            }

            doc.text(`${texto_aux_header} Nº X/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center'); 
            y += 10;

            doc.setTextColor(secondaryColor); doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, 555, y);
            y += 30;

            // Lista completa de campos
            const infoFields = [
                { label: "Termo de embargo",  value: `${formData.numero || '-'} ${formData.serie?.toUpperCase() || '-'}` },
                { label: "Processo SIMLAM",             value: formData.processoSimlam || '-' },
                { label: "Processo E-docs",             value: formData.numeroEdocs || '-' },
                { label: "Número do SEP",               value: formData.numeroSEP || '-' },
                { label: "Autuado",                     value: formData.nomeAutuado?.toUpperCase() || '-' },

                { label: "Data do embargo",             value: formData.dataEmbargo ? (new Date(formData.dataEmbargo)).toLocaleDateString() : '-' },
                { label: "Área embargada",              value: `${formData.areaEmbargada ?? '-'} ${formData.areaEmbargada ? 'ha' : ''}` },
                { label: "Parecer técnico",                 value: formData.deliberacaoAutoridade == 'DEFERIDA' ? 'DEFERIMENTO' : 'INDEFERIMENTO' || '-' },
                
                // Este campo será filtrado se for indeferimento
                { label: "Tipo de desembargo",          value: (formData.tipoDesembargo || '-').toUpperCase() },
                
                { label: "Área desembargada",           value: `${formData.area ?? '-'} ${formData.area && formData.area !== '-' ? 'ha' : ''}` },
                { label: "Data do desembargo",          value: formData.dataDesembargo ? (new Date(formData.dataDesembargo)).toLocaleDateString() : '-' },
                { label: "Coordenadas UTM",             value: `X(m): ${formData.coordenadaX ?? '-'}, Y(m): ${formData.coordenadaY ?? '-'}` },
            ];

            // --- FILTRO LÓGICO ---
            const fieldsToDisplay = infoFields.filter(item => {
                if (item.label === "Tipo de desembargo") {
                    if (tipoUpper === 'INDEFERIMENTO' || deliberacaoUpper === 'INDEFERIDA') {
                        return false; // Não exibe a linha
                    }
                }
                if(item.label === 'Área desembargada'){
                    if(tipoUpper === 'INDEFERIMENTO' || deliberacaoUpper === 'INDEFERIDA'){
                        return false;
                    }
                }
                return true;
            });

            const labelX = 40; const valueX = 250;
            doc.setFont("helvetica", "bold"); doc.setFontSize(12);

            // Itera sobre a lista FILTRADA
            fieldsToDisplay.forEach(item => {
                const label = String(item.label || ""); const value = String(item.value ?? "-");
                doc.setFont("helvetica", "bold"); doc.text(label + ":", labelX, y);
                doc.setFont("helvetica", "normal");
                const valLines = doc.splitTextToSize(value, 280);
                doc.text(valLines, valueX, y); y += valLines.length * lineHeight;
            });

            y += 10;

            doc.setFont("helvetica", "bold"); doc.setTextColor(primaryColor);
            doc.text("Justificativa da deliberação:", 40, y); 
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
        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) 
                return;
            
            if (ui.radioDeferida.checked) {
                if(ui.containerSubTipo)
                    ui.containerSubTipo.style.display = 'flex';
            } 
            else {
                if(ui.containerSubTipo)
                    ui.containerSubTipo.style.display = 'none';

                if (ui.radioTotal)
                    ui.radioTotal.checked = false;

                if (ui.radioParcial)
                    ui.radioParcial.checked = false;

                // Esconde area
                if(ui.containerAreaDesembargada)
                    ui.containerAreaDesembargada.style.display = 'none';

                if(ui.inputAreaDesembargada)
                    ui.inputAreaDesembargada.value = '';
            }
        },
        handleTipoChange: () => {
            if (!ui.radioTotal || !ui.radioParcial) 
                return;

            if (ui.radioTotal.checked) {
                if(ui.containerAreaDesembargada) 
                    ui.containerAreaDesembargada.style.display = 'none';

                logic.copyAreaEmbargadaToDesembargada();
            } 
            else if (ui.radioParcial.checked) {
                if(ui.containerAreaDesembargada) 
                    ui.containerAreaDesembargada.style.display = 'flex';

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
        },
        handleDeliberacaoChange: () => {
            if (!ui.radioDeferida || !ui.radioIndeferida) 
                return;
            
            if (ui.radioDeferida.checked) {
                if(ui.containerSubTipo) 
                    ui.containerSubTipo.style.display = 'flex';

                if (ui.radioTipoIndeferimento.checked) {
                    ui.radioTipoIndeferimento.checked = false;
                    ui.radioTotal.checked = false;
                    ui.radioParcial.checked = false;
                }
                
                logic.handleTipoChange();

            } 
            else if (ui.radioIndeferida.checked) {
                if(ui.containerSubTipo) 
                    ui.containerSubTipo.style.display = 'none';
                
                if (ui.radioTipoIndeferimento) {
                    ui.radioTipoIndeferimento.checked = true;
                }
                
                if (ui.radioTotal) 
                    ui.radioTotal.checked = false;

                if (ui.radioParcial) 
                    ui.radioParcial.checked = false;
                
                if(ui.containerAreaDesembargada)
                    ui.containerAreaDesembargada.style.display = 'none';

                if(ui.inputAreaDesembargada)
                    ui.inputAreaDesembargada.value = '';
            }
            else{
                if(ui.containerSubTipo)
                    ui.containerSubTipo.style.display = 'none';

                if (ui.radioTotal)
                    ui.radioTotal.checked = false;

                if (ui.radioParcial)
                    ui.radioParcial.checked = false;
            }
        },
        handleTipoChange: () => {
            if (!ui.containerAreaDesembargada || !ui.inputAreaDesembargada) 
                return;

            if (ui.radioTipoDesinterdicao && ui.radioTipoDesinterdicao.checked) {
                ui.containerAreaDesembargada.style.display = 'none';
                return;
            }
            
            if (ui.radioTipoIndeferimento && ui.radioTipoIndeferimento.checked) {
                ui.containerAreaDesembargada.style.display = 'none';
                return;
            }

            if (ui.radioTotal && ui.radioTotal.checked) {
                ui.containerAreaDesembargada.style.display = 'none';
                logic.copyAreaEmbargadaToDesembargada();
            } 
            else if (ui.radioParcial && ui.radioParcial.checked) {
                ui.containerAreaDesembargada.style.display = 'flex';
                
                if(!ui.inputAreaDesembargada.value) {
                    ui.inputAreaDesembargada.focus();
                }
            }
            else {
                ui.containerAreaDesembargada.style.display = 'none';
            }
        },

        copyAreaEmbargadaToDesembargada: () => {
            if (ui.radioTotal && ui.radioTotal.checked && ui.inputAreaEmbargada && ui.inputAreaDesembargada) {
                if(ui.inputAreaEmbargada.value) {
                    ui.inputAreaDesembargada.value = ui.inputAreaEmbargada.value;
                }
            }
        }
    };

    const handlers = {
        onFormSubmit: async (e) => {
            e.preventDefault();

            if (ui.radioParcial.checked && ui.inputAreaDesembargada && ui.inputAreaEmbargada) {
                const valArea = parseFloat(ui.inputAreaDesembargada.value.replace(',', '.'));
                const valEmbargada = parseFloat(ui.inputAreaEmbargada.value.replace(',', '.'));

                if (!isNaN(valArea) && !isNaN(valEmbargada)) {
                    if (valArea >= valEmbargada) {
                        const errorEl = document.getElementById('error-area');
                        if (errorEl) 
                            errorEl.textContent = 'A área desembargada deve ser menor que a área embargada.';

                        window.UI.showToast("Corrija os erros no formulário antes de enviar.", "error");
                        ui.inputAreaDesembargada.focus();
                        return;
                    }
                }
            }

            const data = logic.prepareDataForSubmit();
            const isFormValid = await logic.validateFullForm(data);

            if (!isFormValid) 
                return;

            try {
                if (pageState.currentPreviewUrl) 
                    URL.revokeObjectURL(pageState.currentPreviewUrl);

                pageState.currentPreviewUrl = logic.gerarPreviewPDF(data);

                if (ui.iframePreview) 
                    ui.iframePreview.src = pageState.currentPreviewUrl;

                view.openModal();
                window.UI.showToast('Prévia gerada. Revise e confirme o envio.', 'info');
            } 
            catch (error) {
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
            } 
            catch (error) {
                window.UI.showToast(error.message, "error");
            } 
            finally {
                ui.confirmarBtn.disabled = false;
                ui.confirmarBtn.innerHTML = originalHTML;
            }
        },
        onSearchProcessoClick: async () => {
            const processo = ui.form.elements.processoSimlam.value.trim().replace(/^0+/, '');

            if (!processo) {
                window.UI.showToast("Informe o número do processo SIMLAM para buscar.", "info");
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
                } 
                else {
                    window.UI.showToast('Nenhum embargo encontrado para este processo.', 'error');
                }
            } 
            catch (error) {
                window.UI.showToast('Erro ao realizar a busca.', 'error');
            } 
            finally {
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
                } 
                else {
                    window.UI.showToast('Nenhum embargo encontrado para este SEP.', 'error');
                }
            } 
            catch (error) {
                window.UI.showToast('Erro ao realizar a busca.', 'error');
            }
            finally {
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
            const fieldValue = field.value.trim();
            
            if (!fieldName) 
                return;

            if ((fieldName === 'area' || fieldName === 'areaEmbargada') && ui.radioParcial.checked) {
                const areaInput = document.getElementById('area');
                const embargadaInput = document.getElementById('areaEmbargada');
                const errorAreaEl = document.getElementById('error-area');

                if (areaInput && embargadaInput && errorAreaEl) {
                    const valArea = parseFloat(areaInput.value.replace(',', '.'));
                    const valEmbargada = parseFloat(embargadaInput.value.replace(',', '.'));

                    if (!isNaN(valArea) && !isNaN(valEmbargada)) {
                        if (valArea >= valEmbargada) {
                            errorAreaEl.textContent = 'A área desembargada deve ser menor que a área embargada.';

                            if (fieldName === 'area') 
                                return; 
                        } 
                        else {
                            errorAreaEl.textContent = '';
                        }
                    }
                }
            }

            if (fieldName === 'numero') {
                const msgEl = document.getElementById('error-numero');

                if (msgEl){ 
                    msgEl.textContent = 'Verificando...'; 
                    msgEl.className = 'mensagem-validacao error-msg';
                }

                const dataToValidate = { numero: fieldValue };
                try {
                    const result = await api.validateForm(dataToValidate);

                    if (result.errors && result.errors.numero) {
                        if (msgEl) { msgEl.textContent = result.errors.numero; msgEl.classList.add('erro'); }
                        return;
                    }

                    if (fieldValue) {
                        const existe = await api.checkEmbargoExists(fieldValue); 

                        if (msgEl) {
                            if (existe) { 
                                msgEl.textContent = 'Embargo encontrado.'; 
                                msgEl.classList.add('sucesso');
                            } 
                            else { 
                                msgEl.textContent = 'Embargo não encontrado.'; 
                                msgEl.classList.add('alerta'); 
                            }
                        }
                    } 
                    else { 
                        if(msgEl) 
                            msgEl.textContent = ''; 
                    }
                } 
                catch(e) { 
                    console.error(e); 
                }
                return;
            }
            
            let dataToValidate = {};

            if (['area', 'areaEmbargada', 'deliberacaoAutoridade', 'tipoDesembargo'].includes(fieldName)) {
                const formData = new FormData(ui.form);
                dataToValidate = Object.fromEntries(formData.entries());
                
                // Tratamento manual para garantir envio correto
                if (dataToValidate.area) dataToValidate.area = dataToValidate.area.replace(',', '.');
                if (dataToValidate.areaEmbargada) dataToValidate.areaEmbargada = dataToValidate.areaEmbargada.replace(',', '.');
                
                // Força rádios
                const rDelib = ui.form.querySelector('input[name="deliberacaoAutoridade"]:checked');
                dataToValidate.deliberacaoAutoridade = rDelib ? rDelib.value : null;
                const rTipo = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
                dataToValidate.tipoDesembargo = rTipo ? rTipo.value : null;
            } 
            else {
                dataToValidate = { [fieldName]: fieldValue };
            }

            try {
                const result = await api.validateForm(dataToValidate);
                const errorEl = document.getElementById(`error-${fieldName}`);
                
                if (fieldName === 'area' && ui.radioParcial.checked) {
                    if (result.errors?.area) 
                        errorEl.textContent = result.errors.area;
                } 
                else {
                    if (errorEl) 
                        errorEl.textContent = result.errors?.[fieldName] ?? '';
                }

                // Cruzamento
                if (fieldName === 'areaEmbargada') {
                    const errorAreaEl = document.getElementById(`error-area`);

                    if(result.errors?.area) 
                        errorAreaEl.textContent = result.errors.area;
                }

            } 
            catch (error) { 
                console.error(`Erro validação ${fieldName}`, error); 
            }
        },
    };
    
    function init() {
        pageState.currentUserInfo = utils.getCurrentUserInfo();
        
        if(ui.form) 
            ui.form.addEventListener("submit", handlers.onFormSubmit);
        if(ui.btnBuscar)    
            ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
        if(ui.btnBuscarSEP) 
            ui.btnBuscarSEP.addEventListener("click", handlers.onSearchSEPClick);
        if(ui.confirmarBtn) 
            ui.confirmarBtn.addEventListener('click', handlers.onConfirmarEnvio);
        if(ui.cancelarBtn)      
            ui.cancelarBtn.addEventListener('click', view.closeModal);
        if(ui.fecharTopoBtn)    
            ui.fecharTopoBtn.addEventListener('click', view.closeModal);
        if(ui.modal)            
            ui.modal.addEventListener('click', (e) => { if(e.target === ui.modal) view.closeModal(); });

        ui.tipoBuscaRadios.forEach(radio => radio.addEventListener('change', handlers.onTipoBuscaChange));

        const fieldsToValidate = [
            'serie', 'nomeAutuado', 'area', 'processoSimlam',
            'numeroSEP', 'numeroEdocs', 'dataDesembargo',
            'coordenadaX', 'coordenadaY', 'descricao', 'numero', 'dataEmbargo', 'areaEmbargada'
        ];
        fieldsToValidate.forEach(fieldName => {
            const el = ui.form.elements[fieldName];
            if (el) {
                el.addEventListener('blur', handlers.onFieldBlur);
            }
        });

        const radioGroups = ['tipoBusca', 'tipoDesembargo', 'deliberacaoAutoridade'];

        radioGroups.forEach(groupName => {
            const radios = document.querySelectorAll(`input[name="${groupName}"]`);

            radios.forEach(radio => {
                if (groupName === 'tipoBusca') {
                    radio.addEventListener('change', handlers.onTipoBuscaChange);
                } 
                else if (groupName === 'deliberacaoAutoridade') {
                    radio.addEventListener('change', (e) => {
                        logic.handleDeliberacaoChange();
                        handlers.onFieldBlur(e); 
                    });
                }
                else if (groupName === 'tipoDesembargo') {
                    radio.addEventListener('change', (e) => {
                        logic.handleTipoChange();
                        handlers.onFieldBlur(e);
                    });
                }
                else {
                    radio.addEventListener('change', handlers.onFieldBlur);
                }
            });
        });

        if (ui.inputAreaEmbargada) {
            ui.inputAreaEmbargada.addEventListener('input', logic.copyAreaEmbargadaToDesembargada);
        }

        const dataEl = document.getElementById('dataDesembargo');
        if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
        
        logic.handleDeliberacaoChange();
        view.updateBuscaVisibility('ate2012');
    }

    init();
});