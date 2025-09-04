// backend/src/controllers/desembargoController.js
const { formSchema } = require("../validators/formValidator");
const desembargoService = require("../services/desembargoService");

// inserir (mantido igual)
exports.inserir = async (req, res) => {
  try {
    const { error, value } = formSchema.validate(req.body, { allowUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const novoDesembargo = await desembargoService.inserirDesembargo(value);
    res.status(201).json({ success: true, data: novoDesembargo });
  } catch (err) {
    console.error("Erro ao inserir desembargo:", err);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
};

// listar com paginação/filtros/ordem server-side (melhorado para extrair username do token caso req.user não exista)
exports.listarDesembargos = async (req, res) => {
  try {
    // params esperados: page, pageSize, search, status, owner, sortKey, sortDir
    const {
      page = 1,
      pageSize = 10,
      search = '',
      status = '',
      owner = '',
      sortKey = '',
      sortDir = ''
    } = req.query;

    // trying to get requesting user from req.user (set by auth middleware)
    let requestingUser = req.user || null;

    // if owner=mine and req.user is missing, try to decode username from Authorization header (best-effort, no verification)
    if (!requestingUser && String(owner || '').toLowerCase() === 'mine') {
      const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
      if (authHeader && typeof authHeader === 'string') {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          const token = parts[1];
          try {
            // decode payload (base64url) without verification
            const payloadB64 = token.split('.')[1] || '';
            const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
            const json = Buffer.from(b64, 'base64').toString('utf8');
            const parsed = JSON.parse(json);
            requestingUser = {
              username: parsed.username || parsed.preferred_username || parsed.sub || parsed.name || null,
              role: (parsed.role || parsed.roles || '').toString().toUpperCase()
            };
          } catch (e) {
            // ignore decode errors - we'll treat as unauthenticated
            requestingUser = null;
          }
        }
      }
    }

    // transforma page/pageSize em inteiros defensivos
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 10));

    const params = {
      page: p,
      pageSize: ps,
      search,
      status,
      owner,
      sortKey,
      sortDir,
      requestingUser
    };

    const result = await desembargoService.listarDesembargos(params);
    // result: { rows, total }
    const totalPages = Math.max(1, Math.ceil((result.total || 0) / ps));

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.total || 0,
        page: p,
        pageSize: ps,
        totalPages
      }
    });
  } catch (err) {
    console.error("Erro ao listar desembargos:", err);
    res.status(500).json({ success: false, message: 'Erro ao listar desembargos' });
  }
};

// pegar por ID
exports.getDesembargoById = async (req, res) => {
  try {
    const desembargo = await desembargoService.getDesembargoById(req.params.id);
    if (!desembargo) return res.status(404).json({ error: "Desembargo não encontrado" });
    res.json(desembargo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar desembargo" });
  }
};

// atualizar
exports.updateDesembargo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const { error, value } = formSchema.validate(req.body, { allowUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    // se estiver sendo alterado para APROVADO, somente GERENTE pode
    if (value.status && String(value.status).trim().toUpperCase() === 'APROVADO') {
      if (!req.user || req.user.role !== 'GERENTE') {
        return res.status(403).json({ error: "Apenas usuários com papel GERENTE podem aprovar desembargos" });
      }
      // marca quem aprovou
      value.aprovado_por = req.user.username;
    }
    // se responsavel não foi enviado, tenta preencher com info do usuário autenticado
    if (!value.responsavelDesembargo || value.responsavelDesembargo === '') {
      if (req.user) {
        value.responsavelDesembargo = req.user.username || req.user.name || req.user.id || null;
      }
    }

    const updated = await desembargoService.updateDesembargo(id, value);
    if (!updated) return res.status(404).json({ error: "Desembargo não encontrado" });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Erro ao atualizar desembargo:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
};

exports.gerarPdf = async (req, res) => {
  const { id } = req.params;

  try {
    // busca desembargo pelo ID
    const desembargo = await desembargoService.getDesembargoById(id);

    if (!desembargo) {
      return res.status(404).json({ error: "Desembargo não encontrado" });
    }

    // gera PDF usando service
    const pdfBuffer = await desembargoService.gerarPdfDesembargo(desembargo);

    // envia PDF para o navegador
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=desembargo_${id}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: "Erro ao gerar PDF" });
  }
};

exports.getDesembargoByProcesso = async (req, res) => {
  try {
    const { valor } = req.query; // exemplo: 12345/2025
    const desembargo = await desembargoService.getDesembargoByProcesso(valor);
    if (!desembargo) {
      return res.status(404).json({ message: "Processo não encontrado" });
    }
    res.json(mapDesembargo(desembargo));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Falha na consulta por processo" });
  }
};

function mapDesembargo(dbRow) {
  if (!dbRow) return null;

  return {
    id:             dbRow.id,
    numero:         dbRow.numero_embargo,
    serie:          dbRow.serie_embargo,
    processoSimlam: dbRow.processo_simlam,
    numeroSEP:      dbRow.numero_sep,
    numeroEdocs:    dbRow.numero_edocs,
    coordenadaX:    dbRow.coordenada_x,
    coordenadaY:    dbRow.coordenada_y,
    nomeAutuado:    dbRow.nome_autuado,
    area:           dbRow.area_desembargada,
    dataDesembargo: dbRow.data_desembargo 
      ? new Date(dbRow.data_desembargo).toISOString().split("T")[0] 
      : null,
    tipoDesembargo: dbRow.tipo_desembargo,
    descricao:      dbRow.descricao,
    status:         dbRow.status,
    responsavelDesembargo:  dbRow.responsavel_desembargo
  };
}
