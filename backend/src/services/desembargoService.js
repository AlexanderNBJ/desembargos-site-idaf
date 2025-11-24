require('dotenv').config();
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const AppError = require('../utils/AppError'); 

const desembargoTable = process.env.DESEMBARGO_TABLE;
const usersTable = process.env.USER_TABLE;
const schema = process.env.SCHEMA;

/**
 * Mapeia uma linha do banco de dados para o formato esperado pelo frontend.
 * Esta função agora centraliza a formatação dos dados.
 * @param {object} dbRow - A linha de dados vinda do banco.
 * @returns {object|null} - O objeto formatado ou null.
 */
function mapDesembargo(dbRow) {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    numero: dbRow.numero_embargo,
    serie: dbRow.serie_embargo,
    processoSimlam: dbRow.processo_simlam,
    numeroSEP: dbRow.numero_sep,
    numeroEdocs: dbRow.numero_edocs,
    coordenadaX: dbRow.coordenada_x,
    coordenadaY: dbRow.coordenada_y,
    nomeAutuado: dbRow.nome_autuado,
    area: dbRow.area_desembargada,
    dataDesembargo: dbRow.data_desembargo ? new Date(dbRow.data_desembargo).toISOString().split("T")[0] : null,
    tipoDesembargo: dbRow.tipo_desembargo,
    descricao: dbRow.descricao,
    status: dbRow.status,
    responsavelDesembargo: dbRow.responsavel_desembargo
  };
}


// Funções Auxiliares para a Geração de PDF

function _drawPdfHeader(doc) {
  const imgPath = path.join(__dirname, "../../../frontend/assets/logos.png");
  const imageData = fs.readFileSync(imgPath).toString("base64");
  let y = 40;
  const primaryColor = "#17903f";
  
  doc.addImage("data:image/png;base64," + imageData, "PNG", 30, 20, 540, 90);
  y += 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(primaryColor);
  doc.text("www.idaf.es.gov.br", 40, y);
  y += 18;
  doc.setDrawColor(200);
  doc.setLineWidth(0.8);
  doc.line(40, y, 555, y);
  y += 20;
  return y;
}

function _drawPdfTitle(doc, y, desembargo) {
  const primaryColor = "#17903f";
  const secondaryColor = "#444";
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor);

  let texto_header_aux = 'TERMO DE DESEMBARGO';
  if (desembargo.tipo_desembargo === "INDEFERIMENTO") {
    texto_header_aux = 'OFÍCIO DE INDEFERIMENTO';
  }
  else if (desembargo.tipo_desembargo === 'DESINTERDIÇÃO'){
    texto_header_aux = 'TERMO DE DESINTERDIÇÃO';
  }

  doc.text(`${texto_header_aux} Nº ${desembargo.numero_ano}/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center');
  
  y += 10;
  doc.setTextColor(secondaryColor);
  doc.line(40, y, 555, y);
  y += 30;
  return y;
}

function _drawPdfInfoBlock(doc, y, desembargo) {
  const secondaryColor = "#444";
  const lineHeight = 18;
  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  };

  const infoFields = [
    { label: "Termo de Embargo Ambiental", value: `${desembargo.numero_embargo || '-'} ${desembargo.serie_embargo || '-'}` },
    { label: "Processo Simlam", value: desembargo.processo_simlam || '-' },
    { label: "Processo E-Docs", value: desembargo.numero_edocs || '-' },
    { label: "Número do SEP", value: desembargo.numero_sep || '-' },
    { label: "Autuado", value: desembargo.nome_autuado || '-' },
    { label: "Área Desembargada", value: `${desembargo.area_desembargada || '-'} ha` },
    { label: "Tipo de Desembargo", value: (desembargo.tipo_desembargo || '-').toUpperCase() },
    { label: "Data do Desembargo", value: formatDate(desembargo.data_desembargo) },
    { label: "Coordenadas UTM", value: `X(m): ${desembargo.coordenada_x || '-'}, Y(m): ${desembargo.coordenada_y || '-'}` },
  ];

  doc.setFontSize(12);
  infoFields.forEach(item => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label + ":", 40, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(secondaryColor);
    doc.text(String(item.value), 250, y);
    y += lineHeight;
  });
  y += 10;
  return y;
}

// Funções do service

exports.inserirDesembargo = async (dados) => {
  const { numero, serie, nomeAutuado, area, processoSimlam,
          numeroSEP, numeroEdocs, tipoDesembargo,
          dataDesembargo, coordenadaX, coordenadaY, descricao, responsavelDesembargo } = dados;

  const query = `
    INSERT INTO ${schema}.${desembargoTable}(
        NUMERO_EMBARGO, SERIE_EMBARGO, NOME_AUTUADO, AREA_DESEMBARGADA, PROCESSO_SIMLAM,
        NUMERO_SEP, NUMERO_EDOCS, TIPO_DESEMBARGO, DATA_DESEMBARGO, COORDENADA_X, COORDENADA_Y,
        DESCRICAO, STATUS, RESPONSAVEL_DESEMBARGO
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, 'EM ANÁLISE', $13)
    RETURNING *;
  `;
  const values = [numero, serie, nomeAutuado, area, processoSimlam, numeroSEP, numeroEdocs, tipoDesembargo, dataDesembargo, coordenadaX, coordenadaY, descricao, responsavelDesembargo];
  const result = await db.query(query, values);
  return result.rows[0];
};

exports.listarDesembargos = async (params = {}) => {
  const {
    page = 1, pageSize = 10, search = '', status = '', owner = '',
    sortKey = '', sortDir = '', requestingUser = null
  } = params;

  const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
  const limit = Math.max(1, pageSize);

  const where = [];
  const values = [];
  let idx = 1;

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    where.push(`(
      (COALESCE(CONCAT(COALESCE(NUMERO_EMBARGO::text,''),' ',COALESCE(SERIE_EMBARGO,'')), '') ILIKE $${idx})
      OR (COALESCE(PROCESSO_SIMLAM, '') ILIKE $${idx})
      OR (COALESCE(NUMERO_SEP::text, '') ILIKE $${idx})
      OR (COALESCE(NUMERO_EDOCS::text, '') ILIKE $${idx})
      OR (COALESCE(NOME_AUTUADO, '') ILIKE $${idx})
      OR (COALESCE(TIPO_DESEMBARGO, '') ILIKE $${idx})
      OR (COALESCE(RESPONSAVEL_DESEMBARGO, '') ILIKE $${idx})
      OR (TO_CHAR(DATA_DESEMBARGO,'DD/MM/YYYY') ILIKE $${idx})
    )`);
    values.push(term);
    idx++;
  }

  if (status && String(status).trim() !== '') {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => `$${idx++}`).join(', ');
      where.push(`STATUS IN (${placeholders})`);
      values.push(...statuses);
    }
  }

  if (owner && String(owner).trim() !== '') {
    const ownerName = String(owner).toLowerCase() === 'mine' ? (requestingUser?.username || null) : owner;
    if (!ownerName) {
      where.push(`1=0`);
    } else {
      values.push(ownerName);
      where.push(`(LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) = LOWER($${idx}) OR LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) LIKE '%' || LOWER($${idx}) || '%')`);
      idx++;
    }
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortableColumns = { termo: "NUMERO_EMBARGO", processo: "PROCESSO_SIMLAM", autuado: "NOME_AUTUADO", status: "STATUS", data: "DATA_DESEMBARGO", sep: "NUMERO_SEP", edocs: "NUMERO_EDOCS", tipo: "TIPO_DESEMBARGO" };
  let orderClause = 'ORDER BY DATA_DESEMBARGO DESC';
  if (sortKey && sortableColumns[sortKey]) {
    const dir = (String(sortDir || '').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    orderClause = `ORDER BY ${sortableColumns[sortKey]} ${dir}`;
  }

  const listQuery = `
    SELECT ID as id, CONCAT(NUMERO_EMBARGO, ' ', SERIE_EMBARGO) AS termo, PROCESSO_SIMLAM AS processo, NUMERO_SEP AS sep,
           NUMERO_EDOCS AS edocs, NOME_AUTUADO AS autuado, TIPO_DESEMBARGO AS tipo, STATUS AS status,
           RESPONSAVEL_DESEMBARGO AS responsavel, DATA_DESEMBARGO AS data
    FROM ${schema}.${desembargoTable} ${whereClause} ${orderClause}
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const countQuery = `SELECT COUNT(*)::int AS total FROM ${schema}.${desembargoTable} ${whereClause}`;
  
  const countParams = values.slice();
  const listParams = [...values, limit, offset];

  const countResult = await db.query(countQuery, countParams);
  const total = countResult.rows[0]?.total || 0;

  const listResult = await db.query(listQuery, listParams);
  return { rows: listResult.rows || [], total };
};

exports.getDesembargoById = async (id) => {
  const query = `
    SELECT d.*, u.name AS aprovador_name, u.position AS aprovador_position
    FROM ${schema}.${desembargoTable} d
    LEFT JOIN ${schema}.${usersTable} u ON d.aprovado_por = u.username
    WHERE d.id = $1 LIMIT 1
  `;
  const result = await db.query(query, [id]);

  return result.rows[0];
};

exports.updateDesembargo = async (id, dados, user) => {
  const antesResult = await db.query(`SELECT * FROM ${schema}.${desembargoTable} WHERE id = $1`, [id]);

  if (antesResult.rows.length === 0) {
    throw new AppError("Desembargo não encontrado para atualização", 404);
  }

  const antes = antesResult.rows[0];
  
  if (dados.status && String(dados.status).trim().toUpperCase() === 'APROVADO') {
    if (!user || user.role !== 'GERENTE') {
      throw new AppError("Apenas usuários com papel GERENTE podem aprovar desembargos", 403);
    }
    dados.aprovado_por = user.username;
  }
  
  if (!dados.responsavelDesembargo || dados.responsavelDesembargo === '') {
    if (user) {
      dados.responsavelDesembargo = user.username || user.name || user.id || null;
    }
  }

  const { numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY, nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, status, responsavelDesembargo, aprovado_por } = dados;
  
  const result = await db.query(
    `UPDATE ${schema}.${desembargoTable}
     SET numero_embargo = $1, serie_embargo = $2, processo_simlam = $3, numero_sep = $4,
         numero_edocs = $5, coordenada_x = $6, coordenada_y = $7, nome_autuado = $8,
         area_desembargada = $9, tipo_desembargo = $10, data_desembargo = $11::date, descricao = $12,
         status = $13, responsavel_desembargo = $14, aprovado_por = $15
     WHERE id = $16 RETURNING *`,
    [numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY, nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, status, responsavelDesembargo, aprovado_por, id]
  );

  if (result.rows.length === 0) {
    throw new AppError("Desembargo não encontrado para atualização", 404);
  }

  return { updated: result.rows[0], antes: antes };
};

exports.gerarPdfDesembargo = async (desembargo) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y;

  y = _drawPdfHeader(doc);
  y = _drawPdfTitle(doc, y, desembargo);
  y = _drawPdfInfoBlock(doc, y, desembargo);
  
  const primaryColor = "#17903f";
  const secondaryColor = "#444";
  const lineHeight = 18;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text("Descrição do Desembargo:", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(secondaryColor);
  const descricaoSplit = doc.splitTextToSize(desembargo.descricao || '-', 500);
  doc.text(descricaoSplit, 40, y, { maxWidth: 500, align: 'justify' });
  y += descricaoSplit.length * lineHeight + 20;

  const aprovadorName = desembargo.aprovador_name || desembargo.aprovado_por || desembargo.responsavel_desembargo || '-';
  const aprovadorPosition = desembargo.aprovador_position || '-';
  doc.setTextColor(secondaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(String(aprovadorName), doc.internal.pageSize.getWidth() / 2, y, 'center'); y += lineHeight;
  doc.setTextColor(primaryColor);
  doc.setFont("helvetica", "normal");
  doc.text(String(aprovadorPosition), doc.internal.pageSize.getWidth() / 2, y, 'center'); y += 2 * lineHeight;

  doc.setFontSize(10);
  doc.setTextColor("#666");
  doc.text("Este documento somente terá validade após sua inclusão e assinatura no sistema EDOC-s.", doc.internal.pageSize.getWidth() / 2, y, 'center');

  return doc.output("arraybuffer");
};