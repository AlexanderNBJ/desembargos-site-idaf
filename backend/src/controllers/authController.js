const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const audit = require('../utils/auditLogger');

exports.login = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return next(new AppError('Preencha usuário e senha', 400));
  }

  try {
    const data = await authService.login(username, password);
    
    await audit.logAction({
      req,
      username: data.user.username,
      action: 'auth.login.success',
      details: { role: data.user.role } 
    });

    res.status(200).json({ success: true, value: { token: data.token, user: data.user } });

  }
  catch (err) {
    
    await audit.logAction({
      req,
      username: username,
      action: 'auth.login.failure',
      details: { 
        error: err.message 
      }
    });

    return next(err); 
  }
});

exports.getPermissions = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token de autorização ausente ou mal formatado', 401)); 
  }
  
  const token = authHeader.split(' ')[1];
  
  const data = await authService.fetchPermissionsFromToken(token);
  
  res.status(200).json(data);
});

exports.logout = asyncHandler(async (req, res, next) => {
  await audit.logAction({
    req,
    action: 'auth.logout.success'
  });

  res.status(200).json({ success: true, message: 'Logout registrado com sucesso.' });
});