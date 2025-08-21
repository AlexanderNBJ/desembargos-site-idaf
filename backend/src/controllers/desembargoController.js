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
        String(d.TERMO ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.PROCESSO_SIMLAM ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.NUMERO_SEP ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.NUMERO_EDOCS ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.NOME_AUTUADO ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.TIPO_DESEMBARGO ?? '').toLowerCase().includes(lowerSearch) ||
        String(d.RESPONSAVEL_DESEMBARGO ?? '').toLowerCase().includes(lowerSearch) ||
        formatDateToSearch(d.DATA_DESEMBARGO).includes(lowerSearch)
      );
    }

    // retorno consistente com o frontend
    res.json({ success: true, data: desembargos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao listar desembargos' });
  }
};

function formatDateToSearch(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // mês começa em 0
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // "17/08/2025"
}