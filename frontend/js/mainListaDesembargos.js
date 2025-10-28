// frontend/js/mainListaDesembargos.js (REFATORADO E COMPLETO)

document.addEventListener('DOMContentLoaded', () => {
  // Garante que o usuário esteja logado. Se não, para a execução.
  if (!Auth.initAuth()) return;

  // --- MÓDULO DE ESTADO DA PÁGINA ---
  const pageState = {
    currentUser: null,
    activeTab: 'mine',
    page: 1,
    pageSize: 10,
    sortKey: null,
    sortDir: 'asc',
    searchTerm: '',
    tabsConfig: [],
  };

  // --- MÓDULO DE ELEMENTOS DA UI ---
  const ui = {
    tbody: document.getElementById('desembargos-list'),
    template: document.getElementById('row-template').content,
    searchInput: document.getElementById('search'),
    tabsContainer: document.getElementById('tabs'),
    pageSizeSelect: document.getElementById('pageSize'),
    paginationControls: document.getElementById('paginationControls'),
    summaryText: document.getElementById('summaryText'),
    currentFilterLabel: document.getElementById('current-filter'),
    loader: document.getElementById('sv-loader'),
    mainContainer: document.querySelector('.page-container'),
    sortableHeaders: document.querySelectorAll('th.sortable'),
  };

  // --- MÓDULO DE UTILITÁRIOS ---
  const utils = {
    getCurrentUser: () => {
        const u = Auth.getSessionUser();
        // A função do Auth.js já nos dá o usuário completo.
        // Apenas normalizamos a role para garantir consistência.
        return {
            username: u?.username || u?.email || u?.name,
            role: (u?.role || 'COMUM').toString().toUpperCase(),
        };
    },
    debounce: (fn, delay = 350) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    },
  };

  // --- MÓDULO DA VIEW (Renderização e Manipulação do DOM) ---
  const view = {
    toggleLoading: (isLoading, text = 'Carregando...') => {
        if (!ui.loader) return;
        const controls = [ui.searchInput, ui.pageSizeSelect, ui.paginationControls];
        
        if (isLoading) {
            const loaderTextEl = ui.loader.querySelector('.sv-loader-text');
            if (loaderTextEl) loaderTextEl.textContent = text;
            ui.loader.classList.add('active');
            ui.mainContainer?.setAttribute('aria-busy', 'true');
        } else {
            ui.loader.classList.remove('active');
            ui.mainContainer?.removeAttribute('aria-busy');
        }
        
        controls.forEach(control => {
            if (control) {
                if(control.hasAttribute('disabled')) control.disabled = isLoading;
                control.style.pointerEvents = isLoading ? 'none' : '';
                control.style.opacity = isLoading ? '0.5' : '1';
            }
        });
    },
    renderTabs: () => {
        ui.tabsContainer.innerHTML = '';
        pageState.tabsConfig.forEach(tabInfo => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab';
            btn.textContent = tabInfo.label;
            btn.dataset.tab = tabInfo.id;
            if (tabInfo.id === pageState.activeTab) btn.classList.add('active');
            btn.addEventListener('click', () => handlers.onTabClick(tabInfo.id));
            ui.tabsContainer.appendChild(btn);
        });
        view.updateCurrentFilterLabel();
    },
    renderRows: (rows) => {
        ui.tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            ui.tbody.innerHTML = '<tr><td colspan="9">Nenhum desembargo encontrado.</td></tr>';
            return;
        }
        rows.forEach(d => {
            const clone = document.importNode(ui.template, true);
            const tr = clone.querySelector('tr');
            tr.dataset.id = d.id;

            clone.querySelector('.col-termo').textContent = d.termo || `${d.numero || ''} ${d.serie || ''}`.trim();
            clone.querySelector('.col-processo').textContent = d.processo || '';
            clone.querySelector('.col-sep').textContent = d.sep || '';
            clone.querySelector('.col-edocs').textContent = d.edocs || '';
            clone.querySelector('.col-autuado').textContent = d.autuado || '';
            clone.querySelector('.col-tipo').textContent = d.tipo || '';
            clone.querySelector('.col-status').textContent = d.status || '';
            clone.querySelector('.col-data').textContent = (d.data) ? new Date(d.data).toLocaleDateString('pt-BR') : '';

            // Botões de ação
            const viewBtn = clone.querySelector('button[data-action="view"]');
            const pdfBtn = clone.querySelector('button[data-action="pdf"]');
            
            if (viewBtn) viewBtn.addEventListener('click', () => window.location.href = `visualizacaoDesembargo.html?id=${d.id}`);
            if (pdfBtn) {
                const isAprovado = String(d.status ?? '').trim().toUpperCase() === 'APROVADO';
                pdfBtn.disabled = !isAprovado;
                pdfBtn.title = isAprovado ? 'Gerar PDF' : 'PDF disponível apenas para status "APROVADO"';
                if(isAprovado) pdfBtn.addEventListener('click', () => handlers.onPdfClick(d.id));
            }
            
            ui.tbody.appendChild(clone);
        });
        view.decorateStatusBadges();
    },
       renderPagination: (meta) => {
        ui.paginationControls.innerHTML = '';
        const { total = 0, page: current = 1, pageSize: ps = pageState.pageSize, totalPages = 1 } = meta;

        if (total === 0) return; // Não renderiza nada se não houver resultados

        const createButton = (text, newPage, isDisabled = false, isCurrent = false) => {
            const btn = document.createElement('button');
            btn.className = 'page-btn';
            btn.textContent = text;
            if (isDisabled) btn.classList.add('disabled');
            if (isCurrent) btn.classList.add('active'); // Classe para a página atual
            if (!isDisabled && !isCurrent && newPage) {
                btn.addEventListener('click', () => handlers.onPageChange(newPage));
            }
            return btn;
        };
        
        const createEllipsis = () => {
            const span = document.createElement('span');
            span.className = 'page-ellipsis';
            span.textContent = '...';
            return span;
        };

        ui.paginationControls.appendChild(createButton('Anterior', current - 1, current <= 1));

        // Lógica de paginação inteligente
        const pageLinks = [];
        const pagesToShow = 5; // Total de números a mostrar (ex: 1, ..., 5, 6, 7, ..., 63)
        
        if (totalPages <= pagesToShow + 2) {
            // Se houver poucas páginas, mostra todas
            for (let i = 1; i <= totalPages; i++) {
                pageLinks.push(createButton(i, i, false, i === current));
            }
        } else {
            // Lógica para muitas páginas
            pageLinks.push(createButton(1, 1, false, 1 === current)); // Sempre mostra a primeira página
            
            let start = Math.max(2, current - 1);
            let end = Math.min(totalPages - 1, current + 1);

            if (current > 3) {
                pageLinks.push(createEllipsis());
            }

            if(current === totalPages) start = Math.max(2, totalPages - 3)
            if(current === 1) end = Math.min(totalPages - 1, 3)

            for (let i = start; i <= end; i++) {
                pageLinks.push(createButton(i, i, false, i === current));
            }

            if (current < totalPages - 2) {
                pageLinks.push(createEllipsis());
            }

            pageLinks.push(createButton(totalPages, totalPages, false, totalPages === current)); // Sempre mostra a última
        }
        
        pageLinks.forEach(link => ui.paginationControls.appendChild(link));

        ui.paginationControls.appendChild(createButton('Próximo', current + 1, current >= totalPages));
        
        const info = document.createElement('div');
        info.className = 'small-muted';
        info.style.marginLeft = '12px';
        const startIndex = total > 0 ? (current - 1) * ps + 1 : 0;
        const endIndex = Math.min(total, current * ps);
        info.textContent = `Mostrando ${startIndex}-${endIndex} de ${total}`;
        ui.paginationControls.appendChild(info);
    },
    updateSortIndicators: () => {
        ui.sortableHeaders.forEach(th => {
            th.classList.remove('asc', 'desc');
            th.setAttribute('aria-sort', 'none');
            const key = th.dataset.key;
            if (key === pageState.sortKey) {
                th.classList.add(pageState.sortDir);
                th.setAttribute('aria-sort', pageState.sortDir === 'asc' ? 'ascending' : 'descending');
            }
        });
    },
    updateCurrentFilterLabel: () => {
        const active = pageState.tabsConfig.find(t => t.id === pageState.activeTab);
        ui.currentFilterLabel.textContent = active ? active.label : '';
    },
    decorateStatusBadges: () => { /* Sua função decorateStatusBadges idêntica */
        const normalize = s => String(s||'').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim();
        const map = {
          'APROVADO': 'status-aprovado', 'EM ANALISE': 'status-em-analise', 'REVISAO PENDENTE': 'status-revisao-pendente',
          'REJEITADO': 'status-rejeitado'
        };
        document.querySelectorAll('#desembargos-list .col-status').forEach(td => {
            if (td.querySelector('.status-badge')) return;
            const raw = (td.textContent || '').trim();
            if (!raw) return;
            const key = normalize(raw.replace(/\s+/g,' '));
            const cls = map[key] || '';
            const span = document.createElement('span');
            span.className = `status-badge ${cls}`;
            span.textContent = raw; span.title = raw;
            td.innerHTML = ''; td.appendChild(span);
        });
    },
  };

  // --- MÓDULO DE API ---
  const api = {
    fetchDesembargos: async () => {
        const active = pageState.tabsConfig.find(t => t.id === pageState.activeTab);
        const params = new URLSearchParams({
            page: pageState.page,
            pageSize: pageState.pageSize,
        });
        if (pageState.searchTerm) params.set('search', pageState.searchTerm);
        if (active?.status) params.set('status', active.status);
        if (active?.ownerParam) params.set('owner', active.ownerParam);
        if (pageState.sortKey) params.set('sortKey', pageState.sortKey);
        if (pageState.sortDir) params.set('sortDir', pageState.sortDir);

        const res = await Auth.fetchWithAuth(`/api/desembargos/list?${params.toString()}`);
        if (!res.ok) throw new Error('Erro ao buscar a lista de desembargos');
        return res.json();
    },
    fetchPdf: async (id) => {
        const res = await Auth.fetchWithAuth(`/api/desembargos/${id}/pdf`);
        if (!res.ok) throw new Error('Erro ao gerar o PDF');
        return res.blob();
    },
  };

  // --- MÓDULO DE EVENT HANDLERS ---
  const handlers = {
    fetchAndRender: async () => {
        view.toggleLoading(true, 'Carregando desembargos...');
        try {
            const payload = await api.fetchDesembargos();
            if (!payload.success) throw new Error(payload.message || 'Erro desconhecido');
            view.renderRows(payload.data || []);
            view.renderPagination(payload.meta || {});
            ui.summaryText.textContent = `Resultados: ${payload.meta?.total || 0}`;
        } catch (error) {
            console.error(error);
            ui.tbody.innerHTML = `<tr><td colspan="9">Erro ao carregar desembargos. Tente novamente.</td></tr>`;
        } finally {
            view.toggleLoading(false);
        }
    },
    onTabClick: (tabId) => {
        pageState.activeTab = tabId;
        pageState.page = 1;
        document.querySelectorAll('.tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        view.updateCurrentFilterLabel();
        handlers.fetchAndRender();
    },
    onPageChange: (newPage) => {
        pageState.page = newPage;
        handlers.fetchAndRender();
    },
    onPageSizeChange: (event) => {
        pageState.pageSize = parseInt(event.target.value, 10) || 10;
        pageState.page = 1;
        handlers.fetchAndRender();
    },
    onSearchInput: utils.debounce((event) => {
        pageState.searchTerm = event.target.value.trim();
        pageState.page = 1;
        handlers.fetchAndRender();
    }),
    onSortClick: (key) => {
        if (!key) return;
        if (pageState.sortKey === key) {
            pageState.sortDir = pageState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            pageState.sortKey = key;
            pageState.sortDir = 'asc';
        }
        pageState.page = 1;
        view.updateSortIndicators();
        handlers.fetchAndRender();
    },
    onPdfClick: async (id) => {
        try {
            const blob = await api.fetchPdf(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `termo_desembargo_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Não foi possível gerar o PDF.');
        }
    },
  };
  
  // --- FUNÇÃO DE INICIALIZAÇÃO ---
  function init() {
    pageState.currentUser = utils.getCurrentUser();
    
    // Configura as abas com base no perfil do usuário
    const isGerente = pageState.currentUser.role === 'GERENTE';
    pageState.tabsConfig = [
        { id: 'mine', label: 'Meus Desembargos', ownerParam: 'mine' },
        { id: 'approved', label: 'Desembargos Aprovados', status: 'APROVADO' }
    ];
    if (isGerente) {
        pageState.tabsConfig.push({ id: 'analysis', label: 'Desembargos em Análise', status: 'EM ANÁLISE,REVISÃO PENDENTE' });
    }

    // Anexa todos os eventos
    ui.pageSizeSelect.addEventListener('change', handlers.onPageSizeChange);
    ui.searchInput.addEventListener('input', handlers.onSearchInput);
    ui.sortableHeaders.forEach(th => {
        th.addEventListener('click', () => handlers.onSortClick(th.dataset.key));
    });

    // Renderização inicial
    view.renderTabs();
    handlers.fetchAndRender();
  }

  init();
});