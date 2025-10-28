require('dotenv').config();
const db = require('../config/db'); 
const jwt = require('jsonwebtoken');
const { fetchPermissions } = require('../utils/fetchPermissions');

const JWT_SECRET = process.env.SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SCHEMA = process.env.SCHEMA;
const USER_TABLE = process.env.USER_TABLE;

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
          // O identificador do usuário que vem do Mappia (geralmente email ou CPF)
          const userIdentifierFromMappia = (userFromMappia && (userFromMappia.email || userFromMappia.username)) || username;

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

          // --- ALTERAÇÃO 1: Consulta SQL corrigida para corresponder à sua tabela ---
          // Seleciona as colunas da sua tabela '_desembargo.users_info'
          // A cláusula WHERE busca pelo username que veio do Mappia
          const queryResult = await db.query(
            `SELECT id, name, username, position FROM ${SCHEMA}.${USER_TABLE} WHERE username = $1`, 
            [userIdentifierFromMappia]
          );

          const localUser = queryResult.rows[0];

          if (!localUser) {
            throw new Error('Usuário autenticado, mas não encontrado no banco de dados do sistema.');
          }

          // --- ALTERAÇÃO 2: Use os dados de 'localUser' para construir o payload e o usuário ---
          
          // O payload do seu token JWT interno. Usar o ID do seu banco é uma boa prática.
          const payload = {
            id: localUser.id,
            username: localUser.username,
            role,
            mappiaToken: mappiaToken
          };

          const localJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
          
          // O objeto 'user' que será enviado para o frontend, agora com os dados completos.
          const user = {
            id: localUser.id,
            username: localUser.username,
            name: localUser.name,       // <-- O campo NOME que estava faltando
            position: localUser.position, // <-- O campo CARGO, um bônus útil
            role
          };

          // Retorna o token da sua aplicação e o objeto de usuário completo
          return { token: localJwt, user };
        }
      } catch (err) {
        // Renomeei a variável de erro para não conflitar com a externa
        console.error('Erro no processo de login:', err);
        // Propaga o erro para o controller tratar a resposta HTTP
        throw err; 
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
    // ... (este método pode permanecer como está) ...
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