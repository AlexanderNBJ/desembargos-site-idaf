const db = require("../config/db");
const { jsPDF } = require("jspdf");

// inserir
async function inserirDesembargo({ numero, serie, nomeAutuado, area, processoSimlam,
                                  numeroSEP, numeroEdocs, tipoDesembargo,
                                  dataDesembargo, coordenadaX, coordenadaY, descricao, responsavelDesembargo }) {

  const query = `
    INSERT INTO desembargos(
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
    FROM desembargos
    ORDER BY DATA_DESEMBARGO DESC
  `;
  const { rows } = await db.query(query);
  return rows;
}

// buscar por ID
async function getDesembargoById(id) {
  const query = `
    SELECT d.*,
           u.name    AS aprovador_name,
           u.position AS aprovador_position
    FROM desembargos d
    LEFT JOIN users u ON d.aprovado_por = u.username
    WHERE d.id = $1
    LIMIT 1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
}


// buscar por SIMLAM
async function getDesembargoByProcesso(processo) {
  const result = await db.query(
    "SELECT * FROM desembargos WHERE processo_simlam = $1",
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
    `UPDATE desembargos
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
  let y = 40;
  const primaryColor = "#17903f"; // verde do site
  const secondaryColor = "#444";   // cinza
  const lineHeight = 18;

  // ================= Cabeçalho =================
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
  y += 25;

  // ================= Disclaimer =================
  doc.setFontSize(10);
  doc.setTextColor("#666");
  doc.text("Este documento somente terá validade após sua inclusão e assinatura no sistema EDOC-s.", 40, y);
  y += 15;

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
  doc.setTextColor(primaryColor);
  infoFields.forEach(item => {
    const label = String(item.label || "");
    const value = String(item.value || "-");

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
  y += lineHeight;
  //TODO ADICIONAR AS INFORMAÇÕES DO USUÁRIO QUE CADASTROU

  //doc.text("Cargo do Usuário", 40, y); y += lineHeight;
  //doc.text("Unidade Técnico-Administrativa Responsável", 40, y); y += lineHeight + 20;

  // retorna buffer para enviar como arquivo
  return doc.output("arraybuffer");
}

module.exports = { inserirDesembargo, listarDesembargos, getDesembargoById, updateDesembargo, gerarPdfDesembargo, getDesembargoByProcesso };
