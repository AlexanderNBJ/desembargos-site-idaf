const embargoService = require('../services/embargoService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.checkEmbargo = asyncHandler(async (req, res, next) => {
    const { numero } = req.params;
    if (!numero) {
        return next(new AppError('Número do embargo é obrigatório.', 400));
    }
    
    const embargo = await embargoService.findByNumero(numero); 
    
    if (embargo) {
        res.json({ found: true, embargo });
    } 
    else {
        res.status(404).json({ found: false });
    }
});

exports.getByNumero = asyncHandler(async (req, res, next) => {
  const { valor } = req.query;
  if (!valor) {
    return next(new AppError('Parâmetro valor é obrigatório.', 400));
  }
  
  const embargoFormatado = await embargoService.findByProcesso(valor);

  if (!embargoFormatado) {
    return next(new AppError('Embargo não encontrado para este processo.', 404));
  }

  res.json({ success: true, embargo: embargoFormatado });
});

exports.getBySEP = asyncHandler(async (req, res, next) => {
  const { valor } = req.query;
  if (!valor) {
    return next(new AppError('Parâmetro valor é obrigatório.', 400));
  }
  
  const embargoFormatado = await embargoService.findBySEP(valor);

  if (!embargoFormatado) {
    return next(new AppError('Embargo não encontrado para este processo.', 404));
  }

  res.json({ success: true, embargo: embargoFormatado });
});