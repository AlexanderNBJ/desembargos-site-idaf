const ApiService = {
    _isResponseJson(res) {
        const contentType = res.headers.get('content-type');
        return contentType && contentType.includes('application/json');
    },

    desembargos: {
        
        async fetchList(pageState) {
            const active = pageState.tabsConfig?.find(t => t.id === pageState.activeTab);
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
            if (!res.ok) throw new Error('Erro ao buscar a lista de deliberações');
            
            return res.json();
        },

        async fetchById(id) {
            const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`);
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`HTTP ${res.status} - ${txt}`);
            }
            const json = await res.json();
            const data = json.data || json.desembargo || json;
            
            return (typeof utils !== 'undefined' && utils.normalizeRow) 
                ? utils.normalizeRow(data) 
                : data;
        },

        async fetchNumeroAno(id) {
            const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`);
            if (!res.ok) throw new Error('Erro ao buscar dados do desembargo');
            const json = await res.json();
            return json.numeroAno;
        },

        async create(data) {
            const res = await Auth.fetchWithAuth('/api/desembargos/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || "Erro ao inserir desembargo");
            return result;
        },

        async update(id, data) {
            const res = await Auth.fetchWithAuth(`/api/desembargos/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || "Erro ao atualizar");
            return result;
        },

        async fetchPdf(id) {
            const res = await Auth.fetchWithAuth(`/api/desembargos/${id}/pdf`);
            if (!res.ok) throw new Error('Erro ao gerar o PDF');
            return res.blob();
        },

        async validateForm(formData) {
            const res = await fetch('/api/desembargos/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            return res.json();
        }
    },

    embargos: {
        async fetchByProcesso(proc) {
            const res = await Auth.fetchWithAuth(`/api/embargos/processo?valor=${encodeURIComponent(proc)}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error('Falha na busca por processo');
            
            const json = await res.json();
            return json.embargo;
        },

        async fetchBySEP(sep) {
            const res = await Auth.fetchWithAuth(`/api/embargos/sep?valor=${encodeURIComponent(sep)}`);
            
            if (res.status === 404) return null;
            
            if (!res.ok) {
                let errorMessage = 'Falha na busca por SEP';
                try {
                    const errorJson = await res.json();
                    if (errorJson && errorJson.message) {
                        errorMessage = errorJson.message;
                    }
                } catch (e) { }
                throw new Error(errorMessage);
            }
            
            const json = await res.json();
            return json.embargo;
        },

        async checkExists(numero) {
            const res = await Auth.fetchWithAuth(`/api/embargos/check/${encodeURIComponent(numero)}`);
            return res.ok;
        }
    },

    auth: { 
        async login(username, password) {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            return response;
        },

        async fetchPermissions() {
            return await Auth.fetchWithAuth('/api/auth/permissions');
        },
        
        async getUsers() {
            const res = await Auth.fetchWithAuth('/api/usuarios');
            if (!res.ok) return null;
            const json = await res.json();
            return json.data || json;
        }
    }
};