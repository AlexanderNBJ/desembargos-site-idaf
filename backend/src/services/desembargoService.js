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


async function listarDesembargos () {
  const query = `
    SELECT 
      CONCAT(NUMERO_EMBARGO, ' ', SERIE_EMBARGO) AS termo,
      PROCESSO_SIMLAM AS processo,
      NUMERO_SEP AS sep,
      NUMERO_EDOCS AS edocs,
      NOME_AUTUADO AS autuado,
      TIPO_DESEMBARGO AS tipo,
      AREA_DESEMBARGADA AS area,
      RESPONSAVEL_DESEMBARGO AS responsavel,
      DATA_DESEMBARGO AS data
    FROM DESEMBARGOS_PENDENTES
    ORDER BY DATA_DESEMBARGO DESC

  `;
  const { rows } = await db.query(query);
  return rows;
};

module.exports = { inserirDesembargo, listarDesembargos };
