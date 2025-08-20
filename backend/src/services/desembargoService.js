const db = require("../config/db");

// inserir
async function inserirDesembargo({ numero, serie, nomeAutuado, area, processoSimlam,
                                  numeroSEP, numeroEdocs, tipoDesembargo,
                                  dataDesembargo, latitude, longitude, descricao }) {

  const query = `
    INSERT INTO desembargos(
        numero, serie, autuado, areaDesembargada, simlam, SEP, eDocs,
        tipoDesembargo, dataDesembargo, latitude, longitude, descricao
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *;
  `;
  const values = [numero, serie, nomeAutuado, area, processoSimlam,
                  numeroSEP, numeroEdocs, tipoDesembargo, dataDesembargo,
                  latitude, longitude, descricao];

  const result = await db.query(query, values);
  return result.rows[0];
}


async function listarDesembargos () {
  const query = `
    SELECT 
      CONCAT(numero, CONCAT(' ', serie)) AS termo,
      simlam,
      sep,
      edocs,
      autuado,
      tipodesembargo AS tipo,
      areadesembargada as area,
      ' ',
      datadesembargo AS data
    FROM desembargos
    ORDER BY datadesembargo DESC
  `;
  const { rows } = await db.query(query);
  return rows;
};

module.exports = { inserirDesembargo, listarDesembargos };
