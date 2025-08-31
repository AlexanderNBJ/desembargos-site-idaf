const db = require('../config/db');

exports.listarUsuarios = async () => {
  const query = 'SELECT id, username, name, position FROM users ORDER BY username';
  const { rows } = await db.query(query);
  return rows;
};

// Pega um usuário pelo ID
exports.buscarUsuarioPorId = async (id) => {
  const query = 'SELECT id, username, name, position FROM users WHERE id = $1';
  const { rows } = await db.query(query, [id]);
  return rows[0];
};
