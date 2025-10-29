const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.login = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;

  // Para erros esperados (validação de entrada), nós chamamos 'next' com um erro customizado.
  if (!username || !password) {
    return next(new AppError('Preencha usuário e senha', 400)); // 400: Bad Request
  }

  const data = await authService.login(username, password);
  
  // A resposta de sucesso continua a mesma.
  res.status(200).json({ success: true, value: { token: data.token, user: data.user } });
});

exports.getPermissions = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Validação mais robusta do token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token de autorização ausente ou mal formatado', 401)); // 401: Unauthorized
  }
  
  const token = authHeader.split(' ')[1];
  
  const data = await authService.fetchPermissionsFromToken(token);
  
  res.status(200).json(data);
});