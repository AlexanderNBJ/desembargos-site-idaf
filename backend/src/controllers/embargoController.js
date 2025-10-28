// backend/src/controllers/embargoController.js (MODIFICADO)

const embargoService = require('../services/embargoService');

// Função auxiliar para separar SEP e E-Docs
function separarSepEdocs(valor) {
  if (!valor) return { numeroSEP: null, numeroEdocs: null };
  
  // Tenta identificar se é E-Docs (começa com ano, ex: "2024-...")
  if (/^\d{4}-/.test(valor)) {
    return { numeroSEP: null, numeroEdocs: valor };
  }
  // Se não, assume que é SEP
  return { numeroSEP: valor, numeroEdocs: null };
}

exports.checkEmbargo = async (req, res) => {
    const { numero } = req.params;
    if (!numero) {
        return res.status(400).json({ found: false, message: 'Número do embargo é obrigatório.' });
    }
    
    try {
        // Supondo que você tenha um método no serviço para buscar por número.
        // Se o nome do método for diferente (ex: findByNumero), ajuste aqui.
        const embargo = await embargoService.findByNumero(numero); 
        
        if (embargo) {
            // Encontrou o embargo
            return res.json({ found: true, embargo });
        } else {
            // Não encontrou
            return res.status(404).json({ found: false });
        }
    } catch (error) {
        console.error('Erro ao checar embargo:', error);
        return res.status(500).json({ found: false, message: 'Erro interno no servidor.' });
    }
};

exports.getByNumero = async (req, res) => {
  const valor = req.query.valor;
  if (!valor) {
    return res.status(400).json({ success: false, message: 'Parâmetro valor é obrigatório' });
  }

  try {
    const embargoDb = await embargoService.findByProcesso(valor);
    if (!embargoDb) {
      return res.status(404).json({ success: false, message: 'Embargo não encontrado' });
    }

    // --- TRANSFORMAÇÃO DOS DADOS AQUI ---
    // Mapeia os nomes das colunas do DB para os nomes esperados pelo formulário.
    const { numeroSEP, numeroEdocs } = separarSepEdocs(embargoDb.sep_edocs);
    
    const embargoFormatado = {
      // O normalizeRow do frontend busca por 'numero' ou 'numero_embargo'
      numero_embargo: embargoDb.n_iuf_emb,
      // O normalizeRow busca por 'coordenadaX' ou 'coordenada_x'
      coordenada_x: embargoDb.easting,
      coordenada_y: embargoDb.northing,
      // O normalizeRow busca por 'processoSimlam', 'processo_simlam' ou 'processo'
      processo_simlam: embargoDb.processo,
      // O normalizeRow busca por 'area'
      area: embargoDb.area,
      // Novos campos separados
      numeroSEP: numeroSEP,
      numeroEdocs: numeroEdocs,
    };

    // A resposta agora contém um objeto 'embargo' padronizado
    return res.json({ success: true, embargo: embargoFormatado });

  } catch (err) {
    console.error('Erro /api/embargos/processo:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
};