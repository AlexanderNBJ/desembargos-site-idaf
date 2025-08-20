const db = require("../config/db");

// inserir
async function inserirDesembargo({ numero, serie, nomeAutuado, area, processoSimlam,
                                  numeroSEP, numeroEdocs, tipoDesembargo,
                                  dataDesembargo, latitude, longitude, descricao, usuarioId }) {

  const query = `
    INSERT INTO desembargos(
        numero, serie, autuado, areaDesembargada, simlam, SEP, eDocs,
        tipoDesembargo, dataDesembargo, latitude, longitude, descricao,
        usuario_id, status
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PENDENTE')
    RETURNING *;
  `;
  const values = [numero, serie, nomeAutuado, area, processoSimlam,
                  numeroSEP, numeroEdocs, tipoDesembargo, dataDesembargo,
                  latitude, longitude, descricao, usuarioId];

  const result = await db.query(query, values);
  return result.rows[0];
}

// atualizar status
async function atualizarStatus(id, novoStatus) {
  const query = `
    UPDATE desembargos SET status = $1 WHERE id = $2 RETURNING *;
  `;
  const result = await db.query(query, [novoStatus, id]);
  return result.rows[0];
}

module.exports = { inserirDesembargo, atualizarStatus };
