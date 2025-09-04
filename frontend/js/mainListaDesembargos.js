// frontend/js/mainListaDesembargos.js (badge integrada no final de renderRows)
document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('desembargos-list');
  const template = document.getElementById('row-template').content;
  const searchInput = document.getElementById('search');
  const tabsContainer = document.getElementById('tabs');
  const pageSizeSelect = document.getElementById('pageSize');
  const paginationControls = document.getElementById('paginationControls');
  const summaryText = document.getElementById('summaryText');
  const currentFilterLabel = document.getElementById('current-filter');

  function getStoredToken() {
    if (window.Auth && typeof Auth.getSessionToken === 'function') {
      const t = Auth.getSessionToken();
      if (t) return t;
    }
    return localStorage.getItem('sessionToken') || localStorage.getItem('token') || null;
  }

  function decodeJwtPayload(token) {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (err) {
      return null;
    }
  }

  function getCurrentUser() {
    try {
      if (window.Auth && typeof Auth.getCurrentUser === 'function') {
        const u = Auth.getCurrentUser();
        return { username: u.username || u.name || u.email, role: (u.role||'COMUM').toString().toUpperCase() };
      }
    } catch (e) {}
    const token = getStoredToken();
    const payload = decodeJwtPayload(token);
    if (payload) {
      return {
        username: payload.username || payload.preferred_username || payload.sub || payload.name || null,
        role: (payload.role || payload.roles || '').toString().toUpperCase()
      };
    }
    return { username: null, role: 'COMUM' };
  }

  const currentUser = getCurrentUser();
  const isGerente = String(currentUser.role || '').toUpperCase() === 'GERENTE';

  // tabs config
  const tabsConfig = [
    { id: 'mine', label: 'Meus Desembargos', ownerParam: 'mine' },
    { id: 'approved', label: 'Desembargos Aprovados', status: 'APROVADO' }
  ];
  if (isGerente) tabsConfig.push({ id: 'analysis', label: 'Desembargos em Análise', status: 'EM ANÁLISE,REVISÃO PENDENTE' });

  let activeTab = 'mine';
  let page = 1;
  let pageSize = parseInt(pageSizeSelect.value, 10) || 10;
  let sortKey = null;
  let sortDir = null;

  function renderTabs() {
    tabsContainer.innerHTML = '';
    tabsConfig.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      if (t.id === activeTab) btn.classList.add('active');
      btn.addEventListener('click', () => {
        activeTab = t.id;
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        page = 1;
        fetchAndRender();
      });
      tabsContainer.appendChild(btn);
    });
    updateCurrentFilterLabel();
  }

  function updateCurrentFilterLabel() {
    const active = tabsConfig.find(t => t.id === activeTab);
    currentFilterLabel.textContent = active ? `${active.label}` : '';
  }

  function buildListUrl() {
    const active = tabsConfig.find(t => t.id === activeTab);
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('pageSize', pageSize);
    const q = (searchInput.value || '').trim();
    if (q) params.set('search', q);
    if (active && active.status) params.set('status', active.status);
    if (active && active.ownerParam) params.set('owner', active.ownerParam);
    if (sortKey) params.set('sortKey', sortKey);
    if (sortDir) params.set('sortDir', sortDir);
    return `/api/desembargos/list?${params.toString()}`;
  }

  async function fetchAndRender() {
    try {
      const url = buildListUrl();
      const token = getStoredToken();
      const res = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        console.error('Erro fetch list:', res.status, txt);
        throw new Error('Erro ao buscar desembargos');
      }
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.message || 'Erro desconhecido');
      const rows = payload.data || [];
      const meta = payload.meta || { total: 0, page: 1, pageSize };

      renderRows(rows);
      renderPagination(meta);
      summaryText.textContent = `Resultados: ${meta.total || 0}`;
      updateCurrentFilterLabel();
      highlightSortHeader();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="9">Erro ao carregar desembargos.</td></tr>`;
    }
  }

  function renderRows(rows) {
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">Nenhum desembargo encontrado.</td></tr>';
      return;
    }
    rows.forEach(d => {
      const clone = document.importNode(template, true);
      const tr = clone.querySelector('tr');
      tr.dataset.id = d.id;

      clone.querySelector('.col-termo').textContent = d.termo || `${d.numero || ''} ${d.serie || ''}`.trim();
      clone.querySelector('.col-processo').textContent = d.processo || '';
      clone.querySelector('.col-sep').textContent = d.sep || '';
      clone.querySelector('.col-edocs').textContent = d.edocs || '';
      clone.querySelector('.col-autuado').textContent = d.autuado || '';
      clone.querySelector('.col-tipo').textContent = d.tipo || '';
      // ensure status cell is plain text first (we'll decorate after DOM insertion)
      clone.querySelector('.col-status').textContent = d.status || '';
      clone.querySelector('.col-data').textContent = (d.data) ? new Date(d.data).toLocaleDateString('pt-BR') : '';

      const viewBtn = clone.querySelector('button[data-action="view"]');
      const pdfBtn = clone.querySelector('button[data-action="pdf"]');
      const editBtn = clone.querySelector('button[data-action="edit"]');

      if (viewBtn) viewBtn.addEventListener('click', () => window.location.href = `visualizacaoDesembargo.html?id=${d.id}`);
      if (pdfBtn) {
        const isAprovado = String(d.status ?? '').trim().toUpperCase() === 'APROVADO';
        pdfBtn.disabled = !isAprovado;
        pdfBtn.setAttribute('aria-disabled', (!isAprovado).toString());
        pdfBtn.title = isAprovado ? 'Gerar PDF' : 'PDF disponível somente para desembargos com status "APROVADO"';
        pdfBtn.addEventListener('click', async () => {
          if (!isAprovado) return;
          try {
            const token = getStoredToken();
            const resp = await fetch(`/api/desembargos/${d.id}/pdf`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {}});
            if (!resp.ok) throw new Error('Erro ao gerar PDF');
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `termo_desembargo_${d.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
          } catch (err) {
            console.error(err);
            alert('Não foi possível gerar o PDF.');
          }
        });
      }
      if (editBtn) {
        const isOwner = currentUser.username && String(d.responsavel || '').toLowerCase() === String(currentUser.username).toLowerCase();
        if (isGerente || isOwner) {
          editBtn.style.display = '';
          editBtn.addEventListener('click', () => window.location.href = `formularioDesembargos.html?id=${d.id}`);
        } else {
          editBtn.style.display = 'none';
        }
      }

      tbody.appendChild(clone);
    });

    // Depois que todas as linhas foram inseridas no DOM, decora os status como badges
    decorateStatusBadges();
  }

  function renderPagination(meta) {
    paginationControls.innerHTML = '';
    const { total = 0, page: current = 1, pageSize: ps = pageSize, totalPages = 1 } = meta;

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = 'Anterior';
    if (current <= 1) prev.classList.add('disabled');
    prev.addEventListener('click', () => {
      if (current > 1) { page = current - 1; fetchAndRender(); }
    });
    paginationControls.appendChild(prev);

    // Range pages
    const maxLinks = 7;
    let startPage = Math.max(1, current - Math.floor(maxLinks / 2));
    let endPage = Math.min(totalPages, startPage + maxLinks - 1);
    if (endPage - startPage + 1 < maxLinks) {
      startPage = Math.max(1, endPage - maxLinks + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      if (p === current) btn.style.fontWeight = '700';
      btn.textContent = p;
      btn.addEventListener('click', () => { page = p; fetchAndRender(); });
      paginationControls.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = 'Próximo';
    if (current >= totalPages) next.classList.add('disabled');
    next.addEventListener('click', () => {
      if (current < totalPages) { page = current + 1; fetchAndRender(); }
    });
    paginationControls.appendChild(next);

    const info = document.createElement('div');
    info.className = 'small-muted';
    info.style.marginLeft = '12px';
    const startIndex = (current - 1) * ps + 1;
    const endIndex = Math.min(total, current * ps);
    info.textContent = `Mostrando ${startIndex}-${endIndex} de ${total}`;
    paginationControls.appendChild(info);
  }

  // sorting headers
  function highlightSortHeader() {
    document.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('asc','desc');
      const key = th.dataset.key;
      if (key && key === sortKey) {
        th.classList.add(sortDir === 'asc' ? 'asc' : 'desc');
      }
    });
  }

  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (!key) return;
      if (sortKey === key) {
        if (!sortDir) sortDir = 'asc';
        else if (sortDir === 'asc') sortDir = 'desc';
        else sortDir = null;
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      page = 1;
      fetchAndRender();
    });
  });

  function debounce(fn, delay = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  searchInput.addEventListener('input', debounce(() => { page = 1; fetchAndRender(); }, 300));
  pageSizeSelect.addEventListener('change', () => {
    pageSize = parseInt(pageSizeSelect.value, 10) || 10;
    page = 1;
    fetchAndRender();
  });

  // inicial
  renderTabs();
  fetchAndRender();

  /* ===== função que cria badges de status - sempre chamada APÓS renderRows ===== */
  function decorateStatusBadges(){
    // normaliza e remove diacríticos (acentos)
    const normalize = s => String(s||'').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim();
    const map = {
      'APROVADO': 'status-aprovado',
      'APROVADOS': 'status-aprovado',
      'EM ANALISE': 'status-em-analise',
      'EM ANALISES': 'status-em-analise',
      'REVISAO PENDENTE': 'status-revisao-pendente',
      'REVISAO PENDENTES': 'status-revisao-pendente',
      'REVISAO PENDENTE': 'status-revisao-pendente',
      'REVISÃO PENDENTE': 'status-revisao-pendente',
      'REJEITADO': 'status-rejeitado',
      'REJEITADOS': 'status-rejeitado'
    };

    document.querySelectorAll('#desembargos-list .col-status').forEach(td => {
      const raw = (td.textContent || '').trim();
      if (!raw) return;
      // se já tem badge, skip
      if (td.querySelector('.status-badge')) return;
      const key = normalize(raw.replace(/\s+/g,' '));
      const cls = map[key] || null;
      const span = document.createElement('span');
      span.className = 'status-badge' + (cls ? ` ${cls}` : '');
      span.textContent = raw;
      td.innerHTML = '';
      td.appendChild(span);
    });
  }

});
