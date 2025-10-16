const pool = require('../config/db.js');
const embargosTable = 'p_selo_verde_es_2025__inp_areas_fiscalizadas_es_idaf';
const schema = '_desembargo';

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