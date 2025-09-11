const pool = require('../config/db.js');
const embargosTable = 'embargos';

exports.findByNumero = async (numero) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, northing, easting, sep_edocs, processo FROM ${embargosTable} WHERE n_iuf_emb = $1`,
    [numero]
  );
  return result.rows[0] || null;
};

exports.findByProcesso = async (processo) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, northing, easting, sep_edocs, processo FROM ${embargosTable} WHERE processo = $1 LIMIT 1`,
    [processo]
  );
  return result.rows[0] || null;
};