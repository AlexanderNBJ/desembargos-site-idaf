require('dotenv').config();
const pool = require('../config/db.js');
const embargosTable = process.env.EMBARGO_TABLE;
const schema = process.env.SCHEMA;

exports.findByNumero = async (numero) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, northing, easting, sep_edocs, processo FROM ${schema}.${embargosTable} WHERE n_iuf_emb = $1`,
    [numero]
  );
  return result.rows[0] || null;
};

exports.findByProcesso = async (processo) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, northing, easting, sep_edocs, processo, 
      (public.ST_area(geom)/1000.00) AS area    
      FROM ${schema}.${embargosTable} WHERE processo = $1 LIMIT 1`,
    [processo]
  );
  return result.rows[0] || null;
};