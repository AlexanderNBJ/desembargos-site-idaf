require('dotenv').config();
const pool = require('../config/db.js');
const embargosTable = process.env.EMBARGO_TABLE;
const embargosLegacyTable = process.env.EMBARGO_LEGACY_TABLE;
const schema = process.env.SCHEMA;

function _formatEmbargoForFrontend(embargoDb) {
  if (!embargoDb) return null;
    
  return {
    numero_embargo: embargoDb.n_iuf_emb,
    serie: embargoDb.serie,
    coordenada_x: embargoDb.easting,
    coordenada_y: embargoDb.northing,
    processo_simlam: embargoDb.processo,
    area: embargoDb.area,
    nome_autuado: embargoDb.nome_autuado,
    data_embargo: embargoDb.data_embargo ? new Date(embargoDb.data_embargo).toISOString().split('T')[0] : null,
    numeroSEP: embargoDb.numero_sep,
    numeroEdocs: embargoDb.numero_edocs,
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
    `SELECT n_iuf_emb, serie, northing, easting, numero_sep, numero_edocs, processo, area, data_embargo  
      FROM ${schema}.${embargosTable} WHERE processo = $1 LIMIT 1`,
    [processo]
  );
  
  return _formatEmbargoForFrontend(result.rows[0]);
};

exports.findBySEP = async (processo) => {
  const result = await pool.query(
    `SELECT n_iuf_emb, serie, numero_sep, northing, easting, data_embargo, produto, area, nome_autuado
      FROM ${schema}.${embargosLegacyTable} WHERE numero_sep = $1`,
    [processo]
  );
  const termo = _validarTermoUnico(result.rows);
  return _formatEmbargoForFrontend(termo);
};

function _validarTermoUnico(rows) {
  // 1. PRIMEIRO verificamos se existem linhas. Se não, retorna null.
  if (!rows || rows.length === 0) return null;

  // 2. SEGUNDO verificamos se há conflito (mais de 1 linha)
  if (rows.length > 1) {
    const error = new Error('Múltiplos termos encontrados para este SEP. Favor verificar manualmente.');
    error.statusCode = 409;
    throw error;
  }

  // 3. SÓ AGORA é seguro pegar a linha 0.
  const termo = rows[0]; 

  // Verificação de segurança extra: se termo vier undefined por algum motivo bizarro
  if (!termo) return null;

  // 4. Validação do Produto
  const produto = termo.produto || ''; // Garante que não quebre se vier nulo do banco
  const produtoNormalizado = produto.trim().toUpperCase();
  
  // Ajuste a string abaixo conforme está salvo no seu banco (ex: 'AREA - HECTARE (HA)')
  if (!produtoNormalizado.includes('AREA') && !produtoNormalizado.includes('HECTARE')) {
    const error = new Error(`O termo associado não é de área (Produto: ${termo.produto}).`);
    error.statusCode = 422;
    throw error;
  }

  return rows[0];
}
