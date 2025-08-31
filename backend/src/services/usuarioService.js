const db = require('../config/db');

exports.listarUsuarios = async () => {
  const query = 'SELECT id, username FROM users ORDER BY username';
  const { rows } = await db.query(query);
  return rows;
};
