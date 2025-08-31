// backend/src/services/authService.js
require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SECRET || 'dev_secret_change';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  async login(username, password) {
    // busca usuário no Postgres
    const q = 'SELECT id, username, password_hash, role FROM users WHERE username = $1';
    const { rows } = await db.query(q, [username]);
    const user = rows[0];
    if (!user) throw new Error('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new Error('Invalid credentials');

    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // format compatível com seu frontend (ex.: { code:200, value: { token, user } })
    return { token, user: payload };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  // retorna array booleana [canSeeDashboard, canSeeWebsiteMetrics]
  async fetchPermissionsFromToken(token) {
    const decoded = this.verifyToken(token);
    if (!decoded) throw new Error('Invalid token');
    const role = decoded.role;
    const canSeeDashboard = role === 'GERENTE' || role === 'COMUM';
    const canSeeWebsiteMetrics = role === 'GERENTE';
    return [canSeeDashboard, canSeeWebsiteMetrics];
  }
}

module.exports = new AuthService();
