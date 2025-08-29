const { formSchema } = require("../validators/formValidator");
const desembargoService = require("../services/desembargoService");

// inserir
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

// listar
exports.listarDesembargos = async (req, res) => {
  try {
    const { search } = req.query;
    let desembargos = await desembargoService.listarDesembargos();

    if (search) {
      const lowerSearch = search.toLowerCase();
      desembargos = desembargos.filter(d =>
        String(d.termo ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.processo ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.sep ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.edocs ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.autuado ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.tipo ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.responsavel ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.status ?? '').toLowerCase().includes(lowerSearch) ||
        formatDateToSearch(d.data).includes(lowerSearch)
      );
    }

    res.json({ success: true, data: desembargos });
  } catch (err) {
    console.error(err);
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

    const updated = await desembargoService.updateDesembargo(id, value);
    if (!updated) return res.status(404).json({ error: "Desembargo não encontrado" });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Erro ao atualizar desembargo:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
};

function formatDateToSearch(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}


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
