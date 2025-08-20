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
