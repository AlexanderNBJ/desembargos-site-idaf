const pool = require('../config/db.js');

exports.findByNumero = async (numero) => {
  const result = await pool.query(
    'SELECT * FROM embargos WHERE numero = $1',
    [numero]
  );
  return result.rows[0] || null;
};
