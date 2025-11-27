require('dotenv').config();
const pool = require('../config/db.js');
const embargosTable = process.env.EMBARGO_TABLE;
const embargosLegacyTable = process.env.EMBARGO_LEGACY_TABLE;
const schema = process.env.SCHEMA;

function _formatEmbargoForFrontend(embargoDb) {
  if (!embargoDb) return null;

  const separarSepEdocs = (valor) => {
    if (!valor) return { numeroSEP: null, numeroEdocs: null };
    if (/^\d{4}-/.test(valor)) return { numeroSEP: null, numeroEdocs: valor };
    return { numeroSEP: valor, numeroEdocs: null };
  };

  const { numeroSEP, numeroEdocs } = separarSepEdocs(embargoDb.sep_edocs);
    
  return {
    numero_embargo: embargoDb.n_iuf_emb,
    serie: embargoDb.serie,
    coordenada_x: embargoDb.easting,
    coordenada_y: embargoDb.northing,
    processo_simlam: embargoDb.processo,
    area: embargoDb.area,
    data_embargo: embargoDb.data_embargo ? new Date(embargoDb.data_embargo).toISOString().split('T')[0] : null,
    numeroSEP: numeroSEP,
    numeroEdocs: numeroEdocs,
  };
}

exports.findByNumero = async (numero) => {

  let isNumero = !isNaN(Number(numero));

  if(!isNumero){
    const resultEmbargoLegacy = await pool.query(
      `SELECT n_iuf_emb FROM ${schema}.${embargosLegacyTable} WHERE n_iuf_emb = $1`,
      [numero]
    );
    
    return resultEmbargoLegacy.rows[0] || null;
  }

  const result = await pool.query(
    `SELECT n_iuf_emb FROM ${schema}.${embargosTable} WHERE n_iuf_emb = $1`,
    [numero]
  );

  if(!result.rows[0]){
    const resultFallbackLegacy = await pool.query(
      `SELECT n_iuf_emb FROM ${schema}.${embargosLegacyTable} WHERE n_iuf_emb = $1`,
      [numero]
    );

    return resultFallbackLegacy.rows[0] || null;
  }
  
  return result.rows[0] || null;
};

exports.findByProcesso = async (processo) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, serie, northing, easting, sep_edocs, processo, area, data_embargo  
      FROM ${schema}.${embargosTable} WHERE processo = $1 LIMIT 1`,
    [processo]
  );
  
  return _formatEmbargoForFrontend(result.rows[0]);
};

exports.findBySEP = async (processo) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, serie, numero_sep, northing, easting
      FROM ${schema}.${embargosLegacyTable} WHERE numero_sep = $1 LIMIT 1`,
    [processo]
  );
  
  return _formatEmbargoForFrontend(result.rows[0]);
};