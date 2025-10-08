// backend/src/controllers/authController.js
const authService = require('../services/authService');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ code: 400, message: 'Username and password are required' });
      }

      const data = await authService.login(username, password);
      
      // retorna no formato que seu frontend espera
      return res.json({ code: 200, value: { token: data.token, user: data.user } });
    } catch (err) {
      console.error('login error', err);
      return res.status(403).json({ code: 403, message: 'User not authorized', error: err.message });
    }
  }

  async getPermissions(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Missing Authorization header' });
      const data = await authService.fetchPermissionsFromToken(token);
      return res.status(200).json(data);
    } catch (err) {
      console.error('permissions error', err);
      return res.status(403).json({ message: 'Failed to get permissions', error: err.message });
    }
  }
}

module.exports = new AuthController();
