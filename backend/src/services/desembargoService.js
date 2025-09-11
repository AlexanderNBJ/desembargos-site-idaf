// backend/src/services/desembargoService.js
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const desembargoTable = 'desembargos_test';
const usersTable = 'users_test';

// inserir
async function inserirDesembargo({ numero, serie, nomeAutuado, area, processoSimlam,
                                  numeroSEP, numeroEdocs, tipoDesembargo,
                                  dataDesembargo, coordenadaX, coordenadaY, descricao, responsavelDesembargo }) {

  const query = `
    INSERT INTO ${desembargoTable}(
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
                  coordenadaX, coordenadaY, descricao, 'EM ANÁLISE', responsavelDesembargo];

  const result = await db.query(query, values);
  return result.rows[0];
}

// listar com paginação/filtragem/ordenação server-side
async function listarDesembargos(params = {}) {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    status = '',
    owner = '',
    sortKey = '',
    sortDir = '',
    requestingUser = null
  } = params;

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(pageSize, 10));
  const limit = Math.max(1, parseInt(pageSize, 10));

  const where = [];
  const values = [];
  let idx = 1;

  // Busca global (protege colunas não-texto com cast)
  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    // castamos explicitamente colunas que podem ser numéricas para text.
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

  // status filter (comma separated)
  if (status && String(status).trim() !== '') {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      const placeholders = statuses.map(s => {
        values.push(s);
        return `$${idx++}`;
      }).join(', ');
      where.push(`STATUS IN (${placeholders})`);
    }
  }

  // owner filter: if owner === 'mine', use requestingUser.username, else owner can be username string
  if (owner && String(owner).trim() !== '') {
    if (String(owner).toLowerCase() === 'mine') {
      if (!requestingUser || !requestingUser.username) {
        // sem usuário autenticado: não retorna nada
        where.push(`1=0`);
      } else {
        // case-insensitive exact match OR contains (para cobrir formatos diferentes)
        values.push(requestingUser.username);
        where.push(`(LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) = LOWER($${idx}) OR LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) LIKE '%' || LOWER($${idx}) || '%')`);
        idx++;
      }
    } else {
      values.push(owner);
      where.push(`(LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) = LOWER($${idx}) OR LOWER(COALESCE(RESPONSAVEL_DESEMBARGO,'')) LIKE '%' || LOWER($${idx}) || '%')`);
      idx++;
    }
  }

  // monta WHERE final
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // ordenação: só permite chaves conhecidas para evitar SQL injection
  const sortableColumns = {
    termo: "NUMERO_EMBARGO",
    processo: "PROCESSO_SIMLAM",
    sep: "NUMERO_SEP",
    edocs: "NUMERO_EDOCS",
    autuado: "NOME_AUTUADO",
    tipo: "TIPO_DESEMBARGO",
    status: "STATUS",
    data: "DATA_DESEMBARGO"
  };

  let orderClause = 'ORDER BY DATA_DESEMBARGO DESC';
  if (sortKey && sortableColumns[sortKey]) {
    const col = sortableColumns[sortKey];
    const dir = (String(sortDir || '').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    orderClause = `ORDER BY ${col} ${dir}`;
  }

  // query principal com LIMIT/OFFSET
  const listQuery = `
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
    FROM ${desembargoTable}
    ${whereClause}
    ${orderClause}
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  values.push(limit, offset);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM ${desembargoTable}
    ${whereClause}
  `;

  // Execute count e list usando db.query (compatível com sua implementação)
  const countParams = values.slice(0, values.length - 2);
  const countResult = await db.query(countQuery, countParams);
  const total = countResult.rows[0] ? parseInt(countResult.rows[0].total, 10) : 0;

  const listResult = await db.query(listQuery, values);
  return { rows: listResult.rows || [], total };
}

// buscar por ID
async function getDesembargoById(id) {
  const query = `
    SELECT d.*,
           u.name    AS aprovador_name,
           u.position AS aprovador_position
    FROM ${desembargoTable} d
    LEFT JOIN ${usersTable} u ON d.aprovado_por = u.username
    WHERE d.id = $1
    LIMIT 1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
}


// buscar por SIMLAM
async function getDesembargoByProcesso(processo) {
  const result = await db.query(
    `SELECT * FROM ${desembargoTable} WHERE processo_simlam = $1`,
    [processo]
  );
  return result.rows[0];
}
// atualizar
async function updateDesembargo(id, dados) {
  const {
    numero, serie, processoSimlam, numeroSEP, numeroEdocs,
    coordenadaX, coordenadaY, nomeAutuado, area, tipoDesembargo,
    dataDesembargo, descricao, status, responsavelDesembargo, aprovado_por
  } = dados;

  const result = await db.query(
    `UPDATE ${desembargoTable}
     SET numero_embargo = $1, serie_embargo = $2, processo_simlam = $3, numero_sep = $4,
         numero_edocs = $5, coordenada_x = $6, coordenada_y = $7, nome_autuado = $8,
         area_desembargada = $9, tipo_desembargo = $10, data_desembargo = $11::date, descricao = $12,
         status = $13, responsavel_desembargo = $14, aprovado_por = $15
     WHERE id = $16
     RETURNING *`,
    [numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY,
     nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, status, responsavelDesembargo, aprovado_por, id]
  );

  return result.rows[0];
}

async function gerarPdfDesembargo(desembargo) {
  // desembargo já vem como objeto do banco
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const imgPath = path.join(__dirname, "../../../frontend/assets/logos.png");
  const imageData = fs.readFileSync(imgPath).toString("base64");

  let y = 40;
  const primaryColor = "#17903f"; // verde do site
  const secondaryColor = "#444";   // cinza
  const lineHeight = 18;

  // ================= Cabeçalho =================
  doc.addImage("data:image/png;base64,"+imageData,"PNG", 30, 20, 540, 90);
  y += 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(primaryColor);
  doc.text("www.idaf.es.gov.br", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(secondaryColor);
  doc.setDrawColor(200);
  doc.setLineWidth(0.8);
  doc.line(40, y, 555, y);
  y += 20;

  // ================= Título =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor);
  doc.text(`TERMO DE DESEMBARGO Nº ${desembargo.id}/IDAF`, 40, y);
  y += 10;
  doc.setTextColor(secondaryColor);
  doc.setDrawColor(200);
  doc.setLineWidth(0.8);
  doc.line(40, y, 555, y);
  y += 30;

  // ================= Informações principais =================
  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2,'0');
    const month = String(date.getMonth()+1).padStart(2,'0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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

  const labelX = 40;
  const valueX = 250; 
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  
  infoFields.forEach(item => {
    const label = String(item.label || "");
    const value = String(item.value || "-");

    //doc.setTextColor(primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(secondaryColor);
    doc.text(value, valueX, y);
    y += lineHeight;
  });

  y += 10;

  // ================= Descrição =================
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text("Descrição do Desembargo:", 40, y); y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(secondaryColor);
  const descricaoSplit = doc.splitTextToSize(desembargo.descricao || '-', 500);
  doc.text(descricaoSplit, 40, y); 
  y += descricaoSplit.length * lineHeight + 10;

  // ================= Assinatura =================
  const aprovadorName = desembargo.aprovador_name || desembargo.aprovado_por || desembargo.responsavel_desembargo || '-';
  const aprovadorPosition = desembargo.aprovador_position || '-';

  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text("Desembargo aprovado por:", 40, y);
  y += lineHeight;
  doc.setTextColor(secondaryColor);
  doc.text(String(aprovadorName), 40, y);
  y += lineHeight;

  doc.setTextColor(primaryColor);
  doc.setFont("helvetica", "normal");
  doc.text(String(aprovadorPosition), 40, y);
  y += 2*lineHeight;

  // ================= Disclaimer =================
  doc.setFontSize(10);
  doc.setTextColor("#666");
  doc.text("Este documento somente terá validade após sua inclusão e assinatura no sistema EDOC-s.", 40, y);
  y += 15;

  // retorna buffer para enviar como arquivo
  return doc.output("arraybuffer");
}

module.exports = { inserirDesembargo, listarDesembargos, getDesembargoById, updateDesembargo, gerarPdfDesembargo, getDesembargoByProcesso };
