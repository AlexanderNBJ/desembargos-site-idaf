document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const tbody = document.getElementById('desembargos-list');
  const template = document.getElementById('row-template').content;
  const searchInput = document.getElementById('search');

  // formata data dd/mm/yyyy
  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    return d.toLocaleDateString('pt-BR');
  }

  // busca desembargos do backend
  async function fetchDesembargos(searchTerm = '') {
    try {
      const url = `/api/desembargos/list${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Erro ao buscar desembargos');
      return data.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  // renderiza tabela
  function renderTable(data) {
    tbody.innerHTML = '';
    data.forEach(d => {
      const clone = document.importNode(template, true);
      clone.querySelector('.col-termo').textContent = d.termo;
      clone.querySelector('.col-processo').textContent = d.processo;
      clone.querySelector('.col-sep').textContent = d.sep || '';
      clone.querySelector('.col-edocs').textContent = d.edocs || '';
      clone.querySelector('.col-autuado').textContent = d.autuado;
      clone.querySelector('.col-tipo').textContent = d.tipo;
      clone.querySelector('.col-status').textContent = d.status ? `${d.status}` : '';
      clone.querySelector('.col-responsavel').textContent = d.responsavel;
      clone.querySelector('.col-data').textContent = formatDate(d.data);

      const actions = clone.querySelectorAll('.action-btn');
      actions.forEach(btn => {
        const action = btn.dataset.action;
        btn.addEventListener('click', () => handleAction(action, d));
      });

      tbody.appendChild(clone);
    });
  }

  // actions
  function handleAction(action, desembargo) {
    switch(action) {
      case 'view': alert(`Visualizar: ${desembargo.termo}`); break;
      case 'edit': alert(`Editar: ${desembargo.termo}`); break;
      case 'pdf': alert(`Gerar PDF: ${desembargo.termo}`); break;
    }
  }

  // busca inicial
  renderTable(await fetchDesembargos());

  // debounce helper
  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  // live search
  searchInput.addEventListener('input', debounce(async () => {
    const term = searchInput.value.trim();
    const resultados = await fetchDesembargos(term);
    renderTable(resultados);
  }, 300));
});