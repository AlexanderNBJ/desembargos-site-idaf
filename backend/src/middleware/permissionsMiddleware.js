// backend/src/middleware/permissionsMiddleware.js
const authService = require('../services/authService');

const canSeeDashboard = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No given token' });

    const permissions = await authService.fetchPermissionsFromToken(token);
    if (!permissions[0]) return res.status(403).json({ message: 'Unauthorized' });

    next();
  } catch (error) {
    console.error('permissions middleware error', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

const canSeeWebsiteMetrics = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No given token' });

    const permissions = await authService.fetchPermissionsFromToken(token);
    if (!permissions[1]) return res.status(403).json({ message: 'Unauthorized' });

    next();
  } catch (error) {
    console.error('permissions middleware error', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

const checkPermissions = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No given token' });

    const permissions = await authService.fetchPermissionsFromToken(token);
    if (!permissions[0] || !permissions[1]) return res.status(403).json({ message: 'Unauthorized' });

    next();
  } catch (error) {
    console.error('permissions middleware error', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = {
  canSeeDashboard,
  canSeeWebsiteMetrics,
  checkPermissions,
};
