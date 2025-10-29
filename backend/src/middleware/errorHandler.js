const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  // Se o erro já é um AppError que criamos, usamos seu status e mensagem.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Para erros inesperados (erros de programação, etc.)
  console.error('ERRO INESPERADO :', err);
  return res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno no servidor.',
  });
};

module.exports = errorHandler;