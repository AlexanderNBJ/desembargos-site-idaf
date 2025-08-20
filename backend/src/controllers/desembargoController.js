const desembargoService = require("../services/desembargoService");

// cadastrar desembargo
exports.inserir = async (req, res) => {
  try {
    const dados = req.body;

    const novoDesembargo = await desembargoService.inserirDesembargo({
      ...dados
    });

    res.status(201).json({ success: true, desembargo: novoDesembargo });
  } catch (error) {
    console.error("Erro ao inserir desembargo:", error);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
};

exports.listarDesembargos = async (req, res) => {
  try {
    const { search } = req.query; // filtro opcional
    let desembargos = await desembargoService.listarDesembargos();

    if (search) {
      const lowerSearch = search.toLowerCase();
      desembargos = desembargos.filter(d =>
        String(d.termo ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.simlam ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.sep ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.edocs ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.autuado ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.tipo ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.responsavel ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.data ?? '').toLowerCase().includes(lowerSearch)
      );
    }

    // retorno consistente com o frontend
    res.json({ success: true, data: desembargos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao listar desembargos' });
  }
};