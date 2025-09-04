const embargoService = require('../services/embargoService');

exports.checkEmbargo = async (req, res) => {
  try {
    const { numero } = req.params;
    const embargo = await embargoService.findByNumero(numero);

    if (embargo) {
      res.json({ success: true, message: 'Termo de embargo encontrado' });
    } else {
      res.json({ success: false, message: 'Termo de embargo não encontrado' });
    }
  } catch (error) {
    console.error('Erro na checagem de embargo:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
};


exports.getByNumero = async(req, res) => {
  const valor = req.query.valor;
  if (!valor) return res.status(400).json({ success: false, message: 'Parâmetro valor é obrigatório' });

  try {
    const emb = await embargoService.findByProcesso(valor);
    if (!emb) return res.status(404).json({ success: false, message: 'Embargo não encontrado' });
    return res.json(emb);
  } catch (err) {
    console.error('Erro /api/embargos/processo:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
};