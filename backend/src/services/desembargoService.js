const db = require("../config/db");

// inserir
async function inserirDesembargo({ numero, serie, nomeAutuado, area, processoSimlam,
                                  numeroSEP, numeroEdocs, tipoDesembargo,
                                  dataDesembargo, coordenadaX, coordenadaY, descricao }) {

  const query = `
    INSERT INTO DESEMBARGOS_PENDENTES(
        NUMERO_EMBARGO, SERIE_EMBARGO, NOME_AUTUADO, AREA_DESEMBARGADA, PROCESSO_SIMLAM,
        NUMERO_SEP, NUMERO_EDOCS, TIPO_DESEMBARGO, DATA_DESEMBARGO, COORDENADA_X, COORDENADA_Y,
        DESCRICAO, STATUS, RESPONSAVEL_DESEMBARGO
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, $13, $14)
    RETURNING *;
  `;
  const values = [numero, serie, nomeAutuado, area, processoSimlam,
                  numeroSEP, numeroEdocs, tipoDesembargo, dataDesembargo,
                  coordenadaX, coordenadaY, descricao, 'EM ANÁLISE', 'USUÁRIO'];

  const result = await db.query(query, values);
  return result.rows[0];
}

// listar
async function listarDesembargos () {
  const query = `
    SELECT 
      ID as id,
      CONCAT(NUMERO_EMBARGO, ' ', SERIE_EMBARGO) AS termo,
      PROCESSO_SIMLAM AS processo,
      NUMERO_SEP AS sep,
      NUMERO_EDOCS AS edocs,
      NOME_AUTUADO AS autuado,
      TIPO_DESEMBARGO AS tipo,
      STATUS AS status,
      RESPONSAVEL_DESEMBARGO AS responsavel,
      DATA_DESEMBARGO AS data
    FROM DESEMBARGOS_PENDENTES
    ORDER BY DATA_DESEMBARGO DESC
  `;
  const { rows } = await db.query(query);
  return rows;
}

// buscar por ID
async function getDesembargoById(id) {
  const result = await db.query("SELECT * FROM desembargos_pendentes WHERE id = $1", [id]);
  return result.rows[0];
}

// atualizar
async function updateDesembargo(id, dados) {
  const {
    numero, serie, processoSimlam, numeroSEP, numeroEdocs,
    coordenadaX, coordenadaY, nomeAutuado, area, tipoDesembargo,
    dataDesembargo, descricao
  } = dados;

  const result = await db.query(
    `UPDATE desembargos_pendentes
     SET numero_embargo = $1, serie_embargo = $2, processo_simlam = $3, numero_sep = $4,
         numero_edocs = $5, coordenada_x = $6, coordenada_y = $7, nome_autuado = $8,
         area_desembargada = $9, tipo_desembargo = $10, data_desembargo = $11::date, descricao = $12
     WHERE id = $13
     RETURNING *`,
    [numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY,
     nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, id]
  );

  return result.rows[0];
}

module.exports = { inserirDesembargo, listarDesembargos, getDesembargoById, updateDesembargo };
