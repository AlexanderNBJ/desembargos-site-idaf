const authService = require('../services/authService');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
  const token = header.split(' ')[1];
  const decoded = authService.verifyToken(token);
  if (!decoded) return res.status(401).json({ message: 'Invalid token' });
  req.user = decoded;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
    const token = header.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (!decoded) return res.status(401).json({ message: 'Invalid token' });
    if (decoded.role !== role) return res.status(403).json({ message: 'Insufficient role' });
    req.user = decoded;
    next();
  };
}

module.exports = { requireAuth, requireRole };
