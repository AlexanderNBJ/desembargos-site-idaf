const audit = require('../utils/auditLogger');
const { formSchema } = require("../validators/formValidator");
const desembargoService = require("../services/desembargoService");
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.validarFormulario = asyncHandler(async (req, res, next) => {
  const options = { abortEarly: false, allowUnknown: true };
  const { error } = formSchema.validate(req.body, options);

  if (error) {
    const erros = {};
    error.details.forEach((d) => {
      erros[d.path[0]] = d.message;
    });
    return res.status(200).json({ success: false, errors: erros });
  }
  res.status(200).json({ success: true, errors: null });
});

exports.inserir = asyncHandler(async (req, res, next) => {
  const validationOptions = { 
    abortEarly: false, 
    stripUnknown: true
  };

  const { error, value } = formSchema.validate(req.body, validationOptions);

  if (error) {
    const errors = {};
    error.details.forEach((err) => { errors[err.path[0]] = err.message; });
    return next(new AppError('Erro de validação', 400, { errors })); 
  }

  const responsavel = req.user?.username || req.user?.name || "DESCONHECIDO";
  
  const dadosFormatados = {
    numero: value.numero,
    serie: value.serie?.toUpperCase().trim() || null,
    nomeAutuado: value.nomeAutuado?.trim().toUpperCase() || null,
    area: value.area ?? null,
    processoSimlam: value.processoSimlam?.trim() || null,
    numeroSEP: value.numeroSEP ?? null,
    numeroEdocs: value.numeroEdocs?.trim().toUpperCase() || null,
    tipoDesembargo: value.tipoDesembargo?.toUpperCase() || null,
    dataDesembargo: value.dataDesembargo || null,
    coordenadaX: value.coordenadaX ?? null,
    coordenadaY: value.coordenadaY ?? null,
    descricao: value.descricao?.trim() || null,
    responsavelDesembargo: responsavel,
    
    // --- NOVOS CAMPOS ---
    dataEmbargo: value.dataEmbargo || null,
    areaEmbargada: value.areaEmbargada ?? null,
    parecerTecnico: value.parecerTecnico?.toUpperCase() || null
  };

  const novoDesembargo = await desembargoService.inserirDesembargo(dadosFormatados);

  await audit.logAction({
    req,
    action: 'desembargo.create',
    details: { id: novoDesembargo.id }
  });

  res.status(201).json({ success: true, data: novoDesembargo });
});

exports.listarDesembargos = asyncHandler(async (req, res, next) => {
  const { page, pageSize, search, status, owner, sortKey, sortDir } = req.query;
  let requestingUser = req.user || null;

  if (!requestingUser && String(owner || '').toLowerCase() === 'mine') {
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        try {
          const token = parts[1];
          const payloadB64 = token.split('.')[1] || '';
          const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
          const json = Buffer.from(b64, 'base64').toString('utf8');
          const parsed = JSON.parse(json);
          requestingUser = {
            username: parsed.username || parsed.preferred_username || parsed.sub || parsed.name || null,
            role: (parsed.role || parsed.roles || '').toString().toUpperCase()
          };
        } catch (e) {}
      }
    }
  }

  const result = await desembargoService.listarDesembargos({
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.max(1, Math.min(200, parseInt(pageSize, 10) || 10)),
    search, status, owner, sortKey, sortDir, requestingUser
  });

  res.json({
    success: true,
    data: result.rows,
    meta: {
      total: result.total || 0,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.max(1, Math.min(200, parseInt(pageSize, 10) || 10)),
      totalPages: Math.max(1, Math.ceil((result.total || 0) / (parseInt(pageSize, 10) || 10)))
    }
  });
});

exports.getDesembargoById = asyncHandler(async (req, res, next) => {
  const desembargo = await desembargoService.getDesembargoById(req.params.id);
  if (!desembargo) {
    return next(new AppError("Desembargo não encontrado", 404));
  }
  res.json(desembargo);
});

exports.updateDesembargo = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return next(new AppError("ID inválido", 400));

  // A validação permite unknown, mas o Service espera os campos mapeados
  // O value aqui já deve conter dataEmbargo, areaEmbargada, parecerTecnico se o front mandar
  const { error, value } = formSchema.validate(req.body, { allowUnknown: true });

  if (error) return next(new AppError(error.details[0].message, 400));

  const { updated, antes } = await desembargoService.updateDesembargo(id, value, req.user);
  
  const changed = {};
  for (const campo of Object.keys(updated)) {
    if (antes.hasOwnProperty(campo)) {
      const valorAntigo = antes[campo];
      const valorNovo = updated[campo];
      let mudou = false;
      if (valorAntigo instanceof Date && valorNovo instanceof Date) {
        mudou = valorAntigo.getTime() !== valorNovo.getTime();
      } else {
        mudou = valorAntigo !== valorNovo;
      }
      if (mudou) {
        changed[campo] = { antes: valorAntigo, depois: valorNovo };
      }
    }
  }

  await audit.logAction({ req, action: 'desembargo.update', details: { id, changed } });
  res.json({ success: true, data: updated });
});

exports.gerarPdf = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const desembargo = await desembargoService.getDesembargoById(id);
  if (!desembargo) {
    return next(new AppError("Desembargo não encontrado para gerar PDF", 404));
  }
  const pdfBuffer = await desembargoService.gerarPdfDesembargo(desembargo);
  await audit.logAction({ req, action: 'desembargo.generate_pdf', details: { id } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=desembargo_${id}.pdf`);
  res.send(Buffer.from(pdfBuffer));
});

exports.getDesembargoByProcesso = asyncHandler(async (req, res, next) => {
  const { valor } = req.query;
  const desembargoFormatado = await desembargoService.getDesembargoByProcesso(valor);
  if (!desembargoFormatado) {
    return next(new AppError("Processo não encontrado", 404));
  }
  res.json(desembargoFormatado);
});