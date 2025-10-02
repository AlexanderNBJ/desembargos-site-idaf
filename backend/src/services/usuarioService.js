const db = require('../config/db');
const userTable = 'users';
const schema = '_desembargo';

exports.listarUsuarios = async () => {
  const query = `SELECT id, username, name, position FROM ${schema}.${userTable} ORDER BY username`;
  const { rows } = await db.query(query);
  return rows;
};

// Pega um usuário pelo ID
exports.buscarUsuarioPorId = async (id) => {
  const query = `SELECT id, username, name, position FROM ${schema}.${userTable} WHERE id = $1`;
  const { rows } = await db.query(query, [id]);
  return rows[0];
};

exports.buscarUsuarioPorUsername = async (username) => {
  const query = `SELECT id, username, name, position FROM ${schema}.${userTable} WHERE username = $1`;
  const { rows } = await db.query(query, [username]);
  return rows[0];
};

