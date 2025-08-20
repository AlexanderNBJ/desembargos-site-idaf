// src/controllers/formController.js
const { formSchema } = require('../validators/formValidator');
const desembargoService  = require('../services/desembargoService');

async function validarFormulario(req, res) {
  try {
    // Recebe o objeto parcial (pode ter apenas um campo)
    const options = { abortEarly: false, allowUnknown: true };

    const { error } = formSchema.validate(req.body, options);

    if (error) {
      const erros = {};
      error.details.forEach((d) => {
        erros[d.path[0]] = d.message;
      });
      return res.status(200).json({ success: false, errors: erros }); // 200 pois é só validação
    }

    res.status(200).json({ success: true, errors: null }); // nenhum erro
  } catch (err) {
    console.error('Erro na validação:', err);
    res.status(500).json({ success: false, errors: { geral: 'Erro no servidor' } });
  }
}

async function criarDesembargo(req, res) {
  try {
    // 1️⃣ Valida os dados com Joi
    const { error, value } = formSchema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = {};
      error.details.forEach((err) => {
        errors[err.path[0]] = err.message;
      });
      return res.status(400).json({ errors });
    }

    // 2️⃣ Refatora / normaliza os dados
    const refatorado = {
      numero: value.numero,
      serie: value.serie?.toUpperCase().trim() || null,
      nomeAutuado: value.nomeAutuado?.trim().toUpperCase() || null,
      area: value.area ?? null,
      processoSimlam: value.processoSimlam?.trim() || null,
      numeroSEP: value.numeroSEP ?? null,
      numeroEdocs: value.numeroEdocs?.trim().toUpperCase() || null,
      tipoDesembargo: value.tipoDesembargo?.toUpperCase() || null,
      dataDesembargo: value.dataDesembargo || null,
      latitude: value.latitude ?? null,
      longitude: value.longitude ?? null,
      descricao: value.descricao?.trim() || null,
    };

    console.log('Dados refatorados para inserção:', refatorado);

    // 3️⃣ Insere no banco
    const novo = await desembargoService.inserirDesembargo(refatorado);

    return res.status(201).json({ success: true, data: novo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro interno no servidor' });
  }
}

module.exports = { validarFormulario, criarDesembargo };
