// backend/src/services/authService.js
require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { fetchPermissions } = require('../utils/fetchPermissions');

const JWT_SECRET = process.env.SECRET || 'dev_secret_change';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const usersTable = 'users';
const schema = '_desembargo';
const MAPPIA_DEBUG = !!process.env.MAPPIA_DEBUG;

class AuthService {
  constructor() {
    this.MAPPIA_DB_URL = process.env.MAPPIA_DB_URL;
  }

  // login: tenta Mappia (se configurado), senão fallback local
  // Quando Mappia responde com token, criamos um JWT local que
  // inclui mappiaToken para futuras consultas de permissão.
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

        if (MAPPIA_DEBUG) console.log('[mappia] /user/login status', resp.status);
        const json = await resp.json();
        if (MAPPIA_DEBUG) console.log('[mappia] /user/login json:', json);

        // heurísticas para extrair token e user
        const mappiaToken = json?.value?.token || json?.token || json?.data?.token || json?.access_token;
        let userFromMappia = json?.value || json?.user || json?.data || null;

        if (mappiaToken) {
          // normalize user fields
          const userId = (userFromMappia && (userFromMappia.user_id || userFromMappia.id)) || null;
          const userEmail = (userFromMappia && (userFromMappia.email || userFromMappia.username)) || username;

          // tenta buscar permissões diretamente usando o mappiaToken
          let role = 'NONE';
          try {
            const perms = await fetchPermissions(mappiaToken); // [isComum, isGerente]
            role = perms[1] ? 'GERENTE' : (perms[0] ? 'COMUM' : 'NONE');
          } catch (err) {
            console.error('Erro ao buscar permissões após login Mappia:', err);
          }

          // cria JWT local contendo mappiaToken para uso futuro
          const payload = {
            id: userId,
            username: userEmail,
            role,
            mappiaToken: mappiaToken
          };

          const localJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

          // user retornado para frontend (normalize)
          const user = {
            id: userId,
            username: userEmail,
            email: userEmail,
            role
          };

          return { token: localJwt, user };
        }

        // se não veio token, fallback local (continua abaixo)
        if (MAPPIA_DEBUG) console.warn('[mappia] login não retornou token, fazendo fallback local. JSON retornado:', JSON.stringify(json));
      } catch (err) {
        console.error('Erro comunicando com Mappia no login:', err);
        // segue para fallback local
      }
    }

    // fallback local: Postgres + bcrypt + JWT
    const q = `SELECT id, username, password_hash, role FROM ${schema}.${usersTable} WHERE username = $1`;
    const { rows } = await db.query(q, [username]);
    const userRow = rows[0];
    if (!userRow) throw new Error('Invalid credentials');

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) throw new Error('Invalid credentials');

    const payload = { id: userRow.id, username: userRow.username, role: userRow.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return { token, user: payload };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  /**
   * Retorna [isComum, isGerente]
   * Lógica:
   * - se o token decodifica para um JWT local que contém mappiaToken => usa esse mappiaToken para consultar Mappia
   * - caso contrário, se MAPPIA_DB_URL definido, tenta usar o token diretamente (suporta raw mappia tokens)
   * - se nenhum dos anteriores funcionar, decodifica o JWT local e infere pela role
   */
  async fetchPermissionsFromToken(token) {
    // tenta decodificar localmente (pode ser nosso JWT)
    const decoded = this.verifyToken(token);
    if (decoded && decoded.mappiaToken && this.MAPPIA_DB_URL) {
      try {
        const perms = await fetchPermissions(decoded.mappiaToken);
        if (Array.isArray(perms) && perms.length === 2) return perms;
      } catch (err) {
        console.error('Erro fetchPermissionsFromToken usando decoded.mappiaToken:', err);
      }
    }

    // se tivermos MAPPIA configurado, tente usar o token direto (caso o token seja o mappia token puro)
    if (this.MAPPIA_DB_URL) {
      try {
        const perms = await fetchPermissions(token);
        if (Array.isArray(perms) && perms.length === 2) return perms;
      } catch (err) {
        console.error('Erro fetchPermissionsFromToken tentando token como mappia token:', err);
      }
    }

    // fallback: inferir a partir do JWT local (caso o token seja JWT)
    if (decoded) {
      const role = decoded.role;
      const isComum = role === 'COMUM' || role === 'GERENTE';
      const isGerente = role === 'GERENTE';
      return [isComum, isGerente];
    }

    // sem informação -> rejeita
    throw new Error('Invalid token for permission check');
  }
}

module.exports = new AuthService();
