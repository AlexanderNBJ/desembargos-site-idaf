require('dotenv').config();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { fetchPermissions } = require('../utils/fetchPermissions');
const AppError = require('../utils/AppError');

const JWT_SECRET = process.env.SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SCHEMA = process.env.SCHEMA;
const USER_TABLE = process.env.USER_TABLE;
const MAPPIA_DB_URL = process.env.MAPPIA_DB_URL;

/**
 * Realiza o login, autenticando contra o serviço Mappia e buscando dados locais.
 */
exports.login = async (username, password) => {

  if (MAPPIA_DB_URL) {
    try {
      const body = new URLSearchParams();
      body.append('username', username);
      body.append('password', password);

      const resp = await fetch(`${MAPPIA_DB_URL.replace(/\/$/, '')}/user/login`, {
        method: 'POST',
        body,
      });

      if (!resp.ok) {
        throw new AppError('Usuário ou senha inválidos', 401);
      }

      const json = await resp.json();
      const mappiaToken = json?.value?.token || json?.token || json?.data?.token || json?.access_token;
      let userFromMappia = json?.value || json?.user || json?.data || null;

      if (mappiaToken) {
        const userIdentifierFromMappia = (userFromMappia && (userFromMappia.email || userFromMappia.username)) || username;
        let role = 'NONE';
        
        try {
          const perms = await fetchPermissions(mappiaToken);
          role = perms[1] ? 'GERENTE' : (perms[0] ? 'COMUM' : 'NONE');
        } 
        catch (err) {
          console.error('Erro ao buscar permissões após login Mappia:', err);
        }

        if (!['COMUM', 'GERENTE'].includes(role)) {
          // Lançar um erro de autorização se o usuário não tiver a permissão necessária
          throw new AppError('Usuário não possui permissão para acessar o sistema.', 403);
        }

        const queryResult = await db.query(
          `SELECT name, username, position FROM ${SCHEMA}.${USER_TABLE} WHERE username = $1`,
          [userIdentifierFromMappia]
        );

        const localUser = queryResult.rows[0];

        if (!localUser) {
          throw new AppError('Usuário autenticado, mas não encontrado no banco de dados do sistema.', 404);
        }

        const payload = {
          id: localUser.id,
          username: localUser.username,
          role,
          mappiaToken: mappiaToken
        };

        const localJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
        const user = {
          id: localUser.id,
          username: localUser.username,
          name: localUser.name,
          position: localUser.position,
          role
        };

        return { token: localJwt, user };
      } 
      else {
        throw new AppError('Usuário ou senha inválidos', 401);
      }
    } 
    catch (err) {
      console.error('Erro no processo de login:', err);

      // Se o erro já for um AppError, apenas o relance. Caso contrário, encapsule-o.
      if (err instanceof AppError) {
        throw err;
      }

      throw new AppError('Ocorreu um erro durante a autenticação.', 500);
    }
  }

  // Fallback, caso MAPPIA_DB_URL não esteja configurado
  throw new AppError('Serviço de autenticação não configurado.', 500);
};


/**
 * Verifica a validade de um token JWT local.
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Busca as permissões a partir de um token.
 */
exports.fetchPermissionsFromToken = async (token) => {
  const decoded = exports.verifyToken(token); // Chama a função exportada
  
  if (decoded && decoded.mappiaToken && MAPPIA_DB_URL) {
    try {
      const perms = await fetchPermissions(decoded.mappiaToken);
      if (Array.isArray(perms) && perms.length === 2) return perms;
    } catch (err) {
      console.error('Erro fetchPermissionsFromToken usando decoded.mappiaToken:', err);
    }
  }

  if (MAPPIA_DB_URL) {
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
};