require('dotenv').config();
const jwt = require('jsonwebtoken');
const { fetchPermissions } = require('../utils/fetchPermissions');

const JWT_SECRET = process.env.SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  constructor() {
    this.MAPPIA_DB_URL = process.env.MAPPIA_DB_URL;
  }

  async login(username, password) {
    if (this.MAPPIA_DB_URL) {
      try {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);

        const resp = await fetch(`${this.MAPPIA_DB_URL.replace(/\/$/, '')}/user/login`, {
          method: 'POST',
          body,
        });

        const json = await resp.json();
        const mappiaToken = json?.value?.token || json?.token || json?.data?.token || json?.access_token;
        let userFromMappia = json?.value || json?.user || json?.data || null;

        if (mappiaToken) {
          const userId = (userFromMappia && (userFromMappia.user_id || userFromMappia.id)) || null;
          const userEmail = (userFromMappia && (userFromMappia.email || userFromMappia.username)) || username;

          let role = 'NONE';
          try {
            const perms = await fetchPermissions(mappiaToken); // [isComum, isGerente]
            role = perms[1] ? 'GERENTE' : (perms[0] ? 'COMUM' : 'NONE');
          } catch (err) {
            console.error('Erro ao buscar permissões após login Mappia:', err);
          }

          if (!['COMUM', 'GERENTE'].includes(role)) {
            throw new Error('User does not have COMUM permission');
          }

          const payload = {
            id: userId,
            username: userEmail,
            role,
            mappiaToken: mappiaToken
          };

          const localJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
          const user = {
            id: userId,
            username: userEmail,
            email: userEmail,
            role
          };

          return { token: localJwt, user };
        }
      } catch (err) {
        console.error('Erro comunicando com Mappia no login:', err);
      }
    }

    throw new Error('Invalid credentials');
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  async fetchPermissionsFromToken(token) {
    const decoded = this.verifyToken(token);
    if (decoded && decoded.mappiaToken && this.MAPPIA_DB_URL) {
      try {
        const perms = await fetchPermissions(decoded.mappiaToken);
        if (Array.isArray(perms) && perms.length === 2) return perms;
      } catch (err) {
        console.error('Erro fetchPermissionsFromToken usando decoded.mappiaToken:', err);
      }
    }

    if (this.MAPPIA_DB_URL) {
      try {
        const perms = await fetchPermissions(token);
        if (Array.isArray(perms) && perms.length === 2) return perms;
      } catch (err) {
        console.error('Erro fetchPermissionsFromToken tentando token como mappia token:', err);
      }
    }

    if (decoded) {
      const role = decoded.role;
      const isComum = role === 'COMUM' || role === 'GERENTE';
      const isGerente = role === 'GERENTE';
      return [isComum, isGerente];
    }

    throw new Error('Invalid token for permission check');
  }
}

module.exports = new AuthService();
