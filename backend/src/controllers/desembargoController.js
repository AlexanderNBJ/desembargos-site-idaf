const desembargoService = require("../services/desembargoService");

// cadastrar desembargo
exports.inserir = async (req, res) => {
  try {
    const dados = req.body;

    // pega o usuário do token
    const usuarioId = req.user.id;

    const novoDesembargo = await desembargoService.inserirDesembargo({
      ...dados,
      usuarioId
    });

    res.status(201).json({ success: true, desembargo: novoDesembargo });
  } catch (error) {
    console.error("Erro ao inserir desembargo:", error);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
};

// validar desembargo
exports.validar = async (req, res) => {
  try {
    const { id } = req.params;
    await desembargoService.atualizarStatus(id, "VALIDADO");
    res.json({ success: true, message: "Desembargo validado com sucesso" });
  } catch (error) {
    console.error("Erro ao validar desembargo:", error);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
};

// recusar desembargo
exports.recusar = async (req, res) => {
  try {
    const { id } = req.params;
    await desembargoService.atualizarStatus(id, "RECUSADO");
    res.json({ success: true, message: "Desembargo recusado com sucesso" });
  } catch (error) {
    console.error("Erro ao recusar desembargo:", error);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
};
