require('dotenv').config();
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const AppError = require('../utils/AppError'); 
const { info } = require('console');

const desembargoTable = process.env.DESEMBARGO_TABLE;
const usersTable = process.env.USER_TABLE;
const schema = process.env.SCHEMA;

/**
 * Mapeia uma linha do banco de dados para o formato esperado pelo frontend.
 */
function mapDesembargo(dbRow) {
  if (!dbRow) return null;
  
  // Lógica para Deliberação
  let deliberacao = null;
  if (dbRow.tipo_desembargo) {
      deliberacao = (dbRow.tipo_desembargo === 'INDEFERIMENTO') ? 'INDEFERIDA' : 'DEFERIDA';
  }

  return {
    id: dbRow.id,
    numeroAno: dbRow.numero_ano,
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
    responsavelDesembargo: dbRow.responsavel_desembargo,
    
    // Novos campos
    dataEmbargo: dbRow.data_embargo ? new Date(dbRow.data_embargo).toISOString().split("T")[0] : null,
    areaEmbargada: dbRow.area_embargada,
    parecerTecnico: dbRow.recomendacao_parecer_tecnico,
    deliberacaoAutoridade: deliberacao,
    
    // Campos extras para o PDF (vindos do join)
    aprovadorName: dbRow.aprovador_name,
    aprovadorPosition: dbRow.aprovador_position
  };
}

// --- FUNÇÕES DE PDF (CORRIGIDAS) ---

function _drawPdfHeader(doc) {
  // Ajuste o caminho conforme sua estrutura de pastas
  const imgPath = path.join(__dirname, "../../../frontend/assets/logos.png");
  
  try {
      if (fs.existsSync(imgPath)) {
          const imageData = fs.readFileSync(imgPath).toString("base64");
          doc.addImage("data:image/png;base64," + imageData, "PNG", 30, 20, 540, 90);
      }
  } catch (e) {
      console.warn("Logo não encontrada para o PDF", e);
  }

  let y = 140; // Ajustado para não sobrepor logo
  const primaryColor = "#17903f";
  
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
  // Usa as chaves do objeto mapeado (camelCase)
  if (desembargo.tipoDesembargo === "INDEFERIMENTO") {
    texto_header_aux = 'OFÍCIO DE INDEFERIMENTO';
  }
  else if (desembargo.tipoDesembargo === 'DESINTERDIÇÃO'){
    texto_header_aux = 'TERMO DE DESINTERDIÇÃO';
  }

  // Se não tiver ano separado, usa o ano da data de desembargo ou atual
  const ano = desembargo.dataDesembargo ? desembargo.dataDesembargo.split('-')[0] : new Date().getFullYear();
  const numeroCompleto = desembargo.numeroAno || '-'; 

  doc.text(`${texto_header_aux} Nº ${numeroCompleto}/IDAF`, doc.internal.pageSize.getWidth() / 2, y, 'center');
  
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
    if (typeof d === 'string' && d.includes('-')) {
        const parts = d.split('-');
        if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const date = new Date(d);
    if(isNaN(date.getTime())) return "-";
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Lista completa de campos
  const infoFields = [
    { label: "Termo de Embargo", value: `${desembargo.numero || '-'} ${desembargo.serie || '-'}` },
    { label: "Processo Simlam",            value: desembargo.processoSimlam || '-' },
    { label: "Processo E-Docs",            value: desembargo.numeroEdocs || '-' },
    { label: "Número do SEP",              value: desembargo.numeroSEP || '-' },
    { label: "Autuado",                    value: desembargo.nomeAutuado || '-' },
    
    { label: "Data do Embargo",            value: formatDate(desembargo.dataEmbargo) },
    { label: "Área Embargada",             value: `${desembargo.areaEmbargada || '-'} ha` },
    { label: "Parecer Técnico",            value: (desembargo.parecerTecnico || '-').toUpperCase() },
    { label: "Deliberação",  value: (desembargo.deliberacaoAutoridade || '-').toUpperCase() },
    
    // Este campo será filtrado abaixo se for Indeferimento
    { label: "Tipo de Desembargo",         value: (desembargo.tipoDesembargo || '-').toUpperCase() },
    
    { label: "Área Desembargada",          value: `${desembargo.area || '-'} ha` },
    { label: "Data do Desembargo",         value: formatDate(desembargo.dataDesembargo) },
    { label: "Coordenadas UTM",            value: `X(m): ${desembargo.coordenadaX || '-'}, Y(m): ${desembargo.coordenadaY || '-'}` },
  ];

  // FILTRO: Remove "Tipo de Desembargo" se for INDEFERIMENTO
  const fieldsToDisplay = infoFields.filter(item => {
    if (item.label === "Tipo de Desembargo" && desembargo.tipoDesembargo === "INDEFERIMENTO") {
        return false; // Não exibe
    }
    if(item.label === "Área Desembargada" && desembargo.tipoDesembargo === "INDEFERIMENTO"){
      return false;
    }
    return true; // Exibe os demais
  });

  doc.setFontSize(12);
  
  // Itera sobre a lista filtrada
  fieldsToDisplay.forEach(item => {
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

// --- CRUD EXISTENTE (Mantido igual, apenas garantindo os exports) ---

exports.inserirDesembargo = async (dados) => {
  const { 
    numero, serie, nomeAutuado, area, processoSimlam,
    numeroSEP, numeroEdocs, tipoDesembargo,
    dataDesembargo, coordenadaX, coordenadaY, descricao, responsavelDesembargo,
    dataEmbargo, areaEmbargada, parecerTecnico
  } = dados;

  const query = `
    INSERT INTO ${schema}.${desembargoTable}(
        NUMERO_EMBARGO, SERIE_EMBARGO, NOME_AUTUADO, AREA_DESEMBARGADA, PROCESSO_SIMLAM,
        NUMERO_SEP, NUMERO_EDOCS, TIPO_DESEMBARGO, DATA_DESEMBARGO, COORDENADA_X, COORDENADA_Y,
        DESCRICAO, STATUS, RESPONSAVEL_DESEMBARGO,
        DATA_EMBARGO, AREA_EMBARGADA, RECOMENDACAO_PARECER_TECNICO
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, 'EM ANÁLISE', $13, $14, $15, $16)
    RETURNING *;
  `;
  const values = [
      numero, serie, nomeAutuado, area, processoSimlam, 
      numeroSEP, numeroEdocs, tipoDesembargo, dataDesembargo, coordenadaX, coordenadaY, 
      descricao, responsavelDesembargo,
      dataEmbargo, areaEmbargada, parecerTecnico
  ];
  
  const result = await db.query(query, values);
  return mapDesembargo(result.rows[0]);
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
  let orderClause = 'ORDER BY DATA_DESEMBARGO DESC';
  if (sortKey) {
      // Mapeamento simples de sortKey para coluna do banco se necessário
      const mapSort = { termo: "NUMERO_EMBARGO", processo: "PROCESSO_SIMLAM", autuado: "NOME_AUTUADO", status: "STATUS", data: "DATA_DESEMBARGO", tipo: "TIPO_DESEMBARGO" };
      const col = mapSort[sortKey] || sortKey; 
      const dir = (String(sortDir || '').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      orderClause = `ORDER BY ${col} ${dir}`;
  }

  // SELECT Incluindo novos campos
  const listQuery = `
    SELECT ID as id, CONCAT(NUMERO_EMBARGO, ' ', SERIE_EMBARGO) AS termo, PROCESSO_SIMLAM AS processo, NUMERO_SEP AS sep,
           NUMERO_EDOCS AS edocs, NOME_AUTUADO AS autuado, TIPO_DESEMBARGO AS tipo, STATUS AS status,
           RESPONSAVEL_DESEMBARGO AS responsavel, DATA_DESEMBARGO AS data,
           DATA_EMBARGO, AREA_EMBARGADA, RECOMENDACAO_PARECER_TECNICO, TIPO_DESEMBARGO
    FROM ${schema}.${desembargoTable} ${whereClause} ${orderClause}
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const countQuery = `SELECT COUNT(*)::int AS total FROM ${schema}.${desembargoTable} ${whereClause}`;
  
  const countParams = values.slice();
  const listParams = [...values, limit, offset];

  const countResult = await db.query(countQuery, countParams);
  const total = countResult.rows[0]?.total || 0;

  const listResult = await db.query(listQuery, listParams);
  
  // Mapeia para o formato esperado pela tabela do front
  const mappedRows = listResult.rows.map(row => ({
      id: row.id,
      termo: row.termo,
      processo: row.processo,
      sep: row.sep,
      edocs: row.edocs,
      autuado: row.autuado,
      tipo: row.tipo,
      status: row.status,
      responsavel: row.responsavel,
      data: row.data ? new Date(row.data).toISOString().split('T')[0] : null,
      // Se quiser retornar os novos campos na listagem também:
      dataEmbargo: row.data_embargo,
      areaEmbargada: row.area_embargada,
      parecerTecnico: row.recomendacao_parecer_tecnico
  }));

  return { rows: mappedRows, total };
};

exports.getDesembargoById = async (id) => {
  const query = `
    SELECT d.*, u.name AS aprovador_name, u.position AS aprovador_position
    FROM ${schema}.${desembargoTable} d
    LEFT JOIN ${schema}.${usersTable} u ON d.aprovado_por = u.username
    WHERE d.id = $1 LIMIT 1
  `;
  const result = await db.query(query, [id]);
  return mapDesembargo(result.rows[0]);
};

exports.updateDesembargo = async (id, dados, user) => {
  const antesResult = await db.query(`SELECT * FROM ${schema}.${desembargoTable} WHERE id = $1`, [id]);

  if (antesResult.rows.length === 0) {
    throw new AppError("Desembargo não encontrado para atualização", 404);
  }

  const antes = mapDesembargo(antesResult.rows[0]);
  
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

  const { 
      numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY, 
      nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, status, 
      responsavelDesembargo, aprovado_por,
      dataEmbargo, areaEmbargada, parecerTecnico
  } = dados;
  
  const query = `
     UPDATE ${schema}.${desembargoTable}
     SET numero_embargo = $1, serie_embargo = $2, processo_simlam = $3, numero_sep = $4,
         numero_edocs = $5, coordenada_x = $6, coordenada_y = $7, nome_autuado = $8,
         area_desembargada = $9, tipo_desembargo = $10, data_desembargo = $11::date, descricao = $12,
         status = $13, responsavel_desembargo = $14, aprovado_por = $15,
         DATA_EMBARGO = $16::date, AREA_EMBARGADA = $17, RECOMENDACAO_PARECER_TECNICO = $18
     WHERE id = $19 RETURNING *
  `;

  const values = [
      numero, serie, processoSimlam, numeroSEP, numeroEdocs, coordenadaX, coordenadaY, 
      nomeAutuado, area, tipoDesembargo, dataDesembargo, descricao, status, 
      responsavelDesembargo, aprovado_por, 
      dataEmbargo, areaEmbargada, parecerTecnico,
      id
  ];

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    throw new AppError("Desembargo não encontrado para atualização", 404);
  }

  return { updated: mapDesembargo(result.rows[0]), antes: antes };
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

  const aprovadorName = desembargo.aprovadorName || desembargo.aprovado_por || desembargo.responsavelDesembargo || '-';
  const aprovadorPosition = desembargo.aprovadorPosition || '-';
  
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