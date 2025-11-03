document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.initAuth()) return;

  // Módulo do estado da página
  const pageState = {
    currentUserInfo: null, 
    currentPreviewUrl: null,
  };

  // Módulo de elementos de UI
  const ui = {
    form: document.getElementById('desembargoForm'),
    btnBuscar: document.getElementById('btnBuscarProcesso'),
    mensagemBusca: document.getElementById('mensagem-busca'),
    modal: document.getElementById('modalPrevia'),
    iframePreview: document.getElementById('pdfPreview'),
    confirmarBtn: document.getElementById('confirmarEnvio'),
    cancelarBtn: document.getElementById('cancelarEnvio'),
    fecharTopoBtn: document.getElementById('fecharModalTopo'),
  };
  
  // Módulo de utilitários
  const utils = {
    getCurrentUserInfo: () => {
        const u = Auth.getSessionUser();
        return {
            username: u?.username || u?.email || u?.name || null,
            name: u?.name || u?.username || null,
            position: u?.position || null,
        };
    },
    normalizeEmbargoData: (row) => {
        if (!row) return {};
        const pick = (o, ...keys) => {
            for (const k of keys) { if (o && k in o && o[k] !== undefined) return o[k]; }
            return undefined;
        };
        const { numeroSEP, numeroEdocs } = utils.separarSepEdocs(pick(row, 'sep_edocs'));
        return {
            numero: pick(row, 'n_iuf_emb', 'numero_embargo', 'numero'),
            serie: pick(row, 'serie_embargo', 'serie'),
            processoSimlam: pick(row, 'processo', 'processo_simlam'),
            nomeAutuado: pick(row, 'nome_autuado', 'autuado', 'nome'),
            area: pick(row, 'area_desembargada', 'area'),
            coordenadaX: pick(row, 'easting', 'easting_m', 'coordenada_x', 'coordenadaX'),
            coordenadaY: pick(row, 'northing', 'northing_m', 'coordenada_y', 'coordenadaY'),
            descricao: pick(row, 'descricao', 'obs'),
            numeroSEP: pick(row, 'numeroSEP'),
            numeroEdocs: pick(row, 'numeroEdocs'),
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
  };

  // Módulo da view
  const view = {
    fillForm: (data) => {
        if (!data) return;
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                const el = ui.form.elements[key];
                if (el) { el.value = data[key]; }
            }
        });
    },
    displayValidationErrors: (errors) => {
        document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
        for (const field in errors) {
            const errorEl = document.getElementById(`error-${field}`);
            if (errorEl) { errorEl.textContent = errors[field]; }
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
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `mensagem-validacao ${type}`;
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
    }
  };

  // Módulo de API
  const api = {
    fetchEmbargoByProcesso: async (proc) => {
        const res = await Auth.fetchWithAuth(`/api/embargos/processo?valor=${encodeURIComponent(proc)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Falha na busca por processo');
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

  // Módulo de lógica de negócio
  const businessLogic = {
    prepareDataForSubmit: () => {
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
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        let y = 40;
        const primaryColor = "#17903f"; const secondaryColor = "#444"; const lineHeight = 18;
        const logoEl = document.getElementById("logoPdf");
        if (logoEl) { doc.addImage(logoEl, "PNG", 30, 20, 540, 90); y += 100; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(primaryColor);
        doc.text("www.idaf.es.gov.br", 40, y); y += lineHeight;
        doc.setFont("helvetica", "normal"); doc.setTextColor(secondaryColor);
        doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, 555, y); y += 20;
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(primaryColor);
        let texto_aux_header='OFÍCIO DE INDEFERIMENTO';
        if (formData.tipoDesembargo?.toUpperCase() != 'INDEFERIMENTO'){ texto_aux_header= 'TERMO DE DESEMBARGO'; }
        doc.text(`${texto_aux_header} Nº X/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center'); y += 10;
        doc.setTextColor(secondaryColor); doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, 555, y); y += 30;
        const infoFields = [
          { label: "Termo de Embargo Ambiental", value: `${formData.numero || '-'} ${formData.serie?.toUpperCase() || '-'}` },
          { label: "Processo Simlam", value: formData.processoSimlam || '-' },
          { label: "Processo E-Docs", value: formData.numeroEdocs || '-' },
          { label: "Número do SEP", value: formData.numeroSEP || '-' },
          { label: "Autuado", value: formData.nomeAutuado?.toUpperCase() || '-' },
          { label: "Área Desembargada", value: `${formData.area ?? '-'} ${formData.area && formData.area !== '-' ? 'ha' : ''}` },
          { label: "Tipo de Desembargo", value: (formData.tipoDesembargo || '-').toUpperCase() },
          { label: "Data do Desembargo", value: formData.dataDesembargo ? (new Date(formData.dataDesembargo)).toLocaleDateString() : '-' },
          { label: "Coordenadas UTM", value: `X(m): ${formData.coordenadaX ?? '-'}, Y(m): ${formData.coordenadaY ?? '-'}` },
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
        doc.text("Descrição do Desembargo:", 40, y); y += lineHeight;
        doc.setFont("helvetica", "normal"); doc.setTextColor(secondaryColor);
        const descricaoSplit = doc.splitTextToSize(formData.descricao || '-', 515, { maxWidth: 500,align: 'justify'});
        doc.text(descricaoSplit, 40, y); y += descricaoSplit.length * lineHeight + 10;
        doc.setFont("helvetica", "bold"); doc.setTextColor(secondaryColor);
        doc.text(String(pageState.currentUserInfo.name || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center'); y += lineHeight;
        doc.setFont("helvetica", "normal"); doc.setTextColor(primaryColor);
        doc.text(String(pageState.currentUserInfo.position || "-"), doc.internal.pageSize.getWidth() / 2, y, 'center'); y += 2*lineHeight;
        doc.setFontSize(10); doc.setTextColor("#666");
        const disclaimer = "AVISO: ESTE DOCUMENTO É APENAS UMA PRÉVIA. Uma vez aprovado, o termo somente terá validade após sua inclusão e assinatura no sistema EDOC-s.";
        const discLines = doc.splitTextToSize(disclaimer, 515);
        doc.text(discLines, 40, y);
        const blob = doc.output('blob');
        return URL.createObjectURL(blob);
    }
  };

  // Módulo de event handlers
  const handlers = {
    onFormSubmit: async (e) => {
        e.preventDefault();
        const data = businessLogic.prepareDataForSubmit();
        const isFormValid = await businessLogic.validateFullForm(data);
        if (!isFormValid) return;
        try {
            if (pageState.currentPreviewUrl) URL.revokeObjectURL(pageState.currentPreviewUrl);
            pageState.currentPreviewUrl = businessLogic.gerarPreviewPDF(data);
            if (ui.iframePreview) ui.iframePreview.src = pageState.currentPreviewUrl;
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
        const data = businessLogic.prepareDataForSubmit();
        try {
            await api.createDesembargo(data);
            window.UI.showToast("Desembargo inserido com sucesso!", "success");
            ui.form.reset();
            const dataEl = document.getElementById('dataDesembargo');
            if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
            view.closeModal();
        } catch (error) {
            window.UI.showToast(error.message, "error");
        } finally {
            ui.confirmarBtn.disabled = false;
            ui.confirmarBtn.innerHTML = originalHTML;
        }
    },
    onSearchProcessoClick: async () => {
        const processo = ui.form.elements.processoSimlam.value.trim();
        if (!processo) {
            window.UI.showToast("Informe o número do processo Simlam para buscar.", "info");
            return;
        }
        view.setSearchMessage('', '');
        ui.btnBuscar.disabled = true;
        try {
            const embargoData = await api.fetchEmbargoByProcesso(processo);
            if (embargoData) {
                const dataToFill = utils.normalizeEmbargoData(embargoData);
                const tipoRadio = ui.form.querySelector('input[name="tipoDesembargo"]:checked');
                if (tipoRadio && tipoRadio.value === 'TOTAL') {
                    if (!ui.form.elements.area.value) {
                       dataToFill.area = dataToFill.area;
                    }
                    window.UI.showToast("A área do embargo foi preenchida (válido para desembargo TOTAL).", "info", { duration: 5000 });
                } else {
                    delete dataToFill.area;
                }
                view.fillForm(dataToFill);
                view.setSearchMessage('Dados do embargo preenchidos.', 'sucesso');
            } else {
                view.setSearchMessage('Nenhum embargo encontrado para este processo.', 'erro');
            }
        } catch (error) {
            view.setSearchMessage('Erro ao realizar a busca.', 'erro');
            console.error("Erro na busca por processo:", error);
        } finally {
            ui.btnBuscar.disabled = false;
        }
    },
    onNumeroEmbargoBlur: async (event) => {
        const numero = event.target.value.trim();
        if (!numero) { view.setEmbargoCheckMessage('', 'none'); return; }
        try {
            const validationResult = await api.validateForm({ numero });
            const errorMsg = validationResult.errors?.numero;
            if (errorMsg) {
                view.setEmbargoCheckMessage(errorMsg, 'error'); return;
            }
            const found = await api.checkEmbargoExists(numero);
            if (found) {
                view.setEmbargoCheckMessage('✓ Embargo encontrado', 'success');
            } else {
                view.setEmbargoCheckMessage('Embargo não encontrado no banco de dados.', 'error');
            }
        } catch (error) {
            console.error('Erro ao checar número do embargo:', error);
            view.setEmbargoCheckMessage('Erro ao verificar.', 'error');
        }
    },
    onFieldBlur: async (event) => {
        const field = event.target;
        const fieldName = field.name;
        
        if (!fieldName || fieldName === 'numero') return; 

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
  };
  
  // Inicialização
  function init() {
    pageState.currentUserInfo = utils.getCurrentUserInfo();
    
    // Anexa todos os eventos
    ui.form.addEventListener("submit", handlers.onFormSubmit);
    ui.btnBuscar.addEventListener("click", handlers.onSearchProcessoClick);
    
    // Evento especial para o campo 'numero'
    if (ui.form.elements.numero) {
        ui.form.elements.numero.addEventListener('blur', handlers.onNumeroEmbargoBlur);
    }
    
    const fieldsToValidate = [
        'serie', 'nomeAutuado', 'area', 'processoSimlam',
        'numeroSEP', 'numeroEdocs', 'dataDesembargo',
        'coordenadaX', 'coordenadaY', 'descricao'
    ];
    fieldsToValidate.forEach(fieldName => {
        const el = ui.form.elements[fieldName];
        if (el) {
            el.addEventListener('blur', handlers.onFieldBlur);
        }
    });

    // Eventos do Modal
    if(ui.confirmarBtn) ui.confirmarBtn.addEventListener('click', handlers.onConfirmarEnvio);
    if(ui.cancelarBtn) ui.cancelarBtn.addEventListener('click', view.closeModal);
    if(ui.fecharTopoBtn) ui.fecharTopoBtn.addEventListener('click', view.closeModal);
    if(ui.modal) ui.modal.addEventListener('click', (e) => { if(e.target === ui.modal) view.closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.modal && !ui.modal.classList.contains('hidden')) view.closeModal(); });

    // Define a data atual
    const dataEl = document.getElementById('dataDesembargo');
    if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
  }

  init();
});