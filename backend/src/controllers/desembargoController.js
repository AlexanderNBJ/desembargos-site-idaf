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
    const desembargos = await desembargoService.listarDesembargos();
    res.json({ success: true, data: desembargos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao buscar desembargos' });
  }
};
