const Joi = require('joi');

const validationConstants = {
  NUMERO_REGEX: /^\d+(\/\d+)?$/,
  NOME_REGEX: /^[\p{L}\s'.-]+$/u,
  SERIE_REGEX: /^[A-Za-z]$/,
  PROCESSO_REGEX: /^\d+\/\d+$/,
  EDOCS_REGEX: /^\d+-[A-Za-z0-9]+$/,
  COORD_X_MIN: 202611.74437293,
  COORD_X_MAX: 431142.9821811,
  COORD_Y_MIN: 7640099.3226997,
  COORD_Y_MAX: 8022601.9848009,
};

const commonMessages = {
  string: {
    base: 'Este campo deve ser um texto.',
    empty: 'Este campo é obrigatório.',
  },
  number: {
    base: 'Este campo deve ser um número.',
    positive: 'Este campo deve ser um número positivo.',
    integer: 'Este campo deve ser um número inteiro.',
  },
  date: {
    base: 'Deve ser uma data válida.',
    max: 'A data não pode ser no futuro.',
  },
  required: {
    any: 'Este campo é obrigatório.',
  },
};

const formSchema = Joi.object({
  // --- Campos Existentes ---
  numero: Joi.string()
    .pattern(validationConstants.NUMERO_REGEX)
    .required()
    .messages({
      'string.base': 'O campo Número é obrigatório',
      'string.empty': commonMessages.string.empty,
      'string.pattern.base': 'O número deve seguir o padrão NÚMERO ou NÚMERO/NÚMERO',
      'any.required': commonMessages.required.any,
    }),

  serie: Joi.string()
    .pattern(validationConstants.SERIE_REGEX)
    .uppercase()
    .required()
    .valid('A', 'B', 'C', 'D', 'E')
    .messages({
      'string.base': 'O campo Série é obrigatório.',
      'string.empty': commonMessages.string.empty,
      'string.pattern.base': 'A Série deve conter uma única letra.',
      'any.only': 'A Série deve ser A, B, C, D ou E.',
      'any.required': commonMessages.required.any,
    }),

  nomeAutuado: Joi.string()
    .trim()
    .min(3)
    .pattern(validationConstants.NOME_REGEX)
    .empty('')
    .allow(null)
    .uppercase()
    .messages({
      'string.min': 'O Nome do Autuado deve ter no mínimo 3 caracteres.',
      'string.pattern.base': 'O Nome do Autuado contém caracteres inválidos.',
    }),

  processoSimlam: Joi.string()
    .trim()
    .pattern(validationConstants.PROCESSO_REGEX)
    .required()
    .messages({
      'any.only': 'O Processo Simlam é inválido.',
      'string.empty': commonMessages.string.empty,
      'string.pattern.base': 'O Processo Simlam deve ter o formato NÚMERO/ANO (ex: 12345/2025).',
      'any.required': commonMessages.required.any,
    }),

  numeroSEP: Joi.number()
    .integer()
    .positive()
    .allow(null)
    .allow(0)
    .messages({
      'number.base': 'O número SEP deve conter apenas números.',
      'number.integer': commonMessages.number.integer,
      'number.positive': commonMessages.number.positive,
    }),

  numeroEdocs: Joi.string()
    .pattern(validationConstants.EDOCS_REGEX)
    .empty('')
    .allow(null)
    .messages({
      'string.pattern.base': 'O E-Docs deve ter o formato NÚMERO-CÓDIGO (ex: 2024-AB123).',
    }),

  coordenadaX: Joi.number()
    .min(validationConstants.COORD_X_MIN)
    .max(validationConstants.COORD_X_MAX)
    .required()
    .messages({
      'number.base': commonMessages.number.base,
      'number.min': 'A Coordenada X está fora dos limites do ES.',
      'number.max': 'A Coordenada X está fora dos limites do ES.',
      'any.required': commonMessages.required.any,
    }),

  coordenadaY: Joi.number()
    .min(validationConstants.COORD_Y_MIN)
    .max(validationConstants.COORD_Y_MAX)
    .required()
    .messages({
      'number.base': commonMessages.number.base,
      'number.min': 'A Coordenada Y está fora dos limites do ES.',
      'number.max': 'A Coordenada Y está fora dos limites do ES.',
      'any.required': commonMessages.required.any,
    }),

  descricao: Joi.string()
    .trim()
    .max(4000)
    .empty('')
    .allow(null)
    .messages({
      'string.max': 'A Descrição pode ter no máximo 4000 caracteres.',
    }),

  // --- NOVOS CAMPOS E LÓGICAS ---

  // 1. Parecer Técnico (Obrigatório e Enum)
  parecerTecnico: Joi.string()
    .valid('DEFERIMENTO', 'INDEFERIMENTO')
    .required()
    .messages({
      'any.only': 'A Recomendação deve ser DEFERIMENTO ou INDEFERIMENTO.',
      'any.required': 'A Recomendação do parecer técnico é obrigatória.',
    }),

  // 2. Deliberação da Autoridade (Obrigatório e Enum)
  deliberacaoAutoridade: Joi.string()
    .valid('DEFERIDA', 'INDEFERIDA')
    .required()
    .messages({
      'any.only': 'A Deliberação deve ser DEFERIDA ou INDEFERIDA.',
      'any.required': 'A Deliberação da autoridade é obrigatória.',
    }),

  // 3. Tipo de Desembargo
  tipoDesembargo: Joi.string()
    .valid('PARCIAL', 'TOTAL', 'INDEFERIMENTO', 'DESINTERDIÇÃO')
    .required()
    .messages({
      'any.only': 'O Tipo de Desembargo é inválido.',
      'any.required': 'O Tipo de Desembargo é obrigatório.',
    }),

  // 4. Data do Embargo (Novo Campo Obrigatório)
  dataEmbargo: Joi.date()
    .max('now')
    .messages({
      'date.base': 'Data do Embargo inválida.',
      'date.max': 'A Data do Embargo não pode ser no futuro.',
      'any.required': 'A Data do Embargo é obrigatória.',
    }),

  // 5. Data do Desembargo (Existente)
  dataDesembargo: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': commonMessages.date.base,
      'date.max': commonMessages.date.max,
      'any.required': commonMessages.required.any,
    }),

  // 6. Área Embargada (Novo Campo Obrigatório)
  areaEmbargada: Joi.number()
    .positive()
    .required()
    .messages({
      'number.base': 'A Área Embargada deve ser um número.',
      'number.positive': 'A Área Embargada deve ser positiva.',
      'any.required': 'A Área Embargada é obrigatória.',
    }),

  // 7. Área Desembargada (Lógica Condicional Complexa)
  area: Joi.number()
    .positive()
    .allow(null)
    .when('deliberacaoAutoridade', {
      is: 'DEFERIDA',
      then: Joi.when('tipoDesembargo', {
        // Se for PARCIAL: Obrigatório e MENOR que a área embargada
        is: 'PARCIAL',
        then: Joi.number().required().less(Joi.ref('areaEmbargada'))
          .messages({
            'number.less': 'A Área Desembargada deve ser menor que a Área Embargada.',
            'any.required': 'A Área Desembargada é obrigatória para deferimentos parciais.',
            'number.base': commonMessages.number.base,
          }),
        // Se for TOTAL: Obrigatório (O front deve copiar, mas validamos aqui)
        otherwise: Joi.when('tipoDesembargo', {
            is: 'TOTAL',
            then: Joi.number().required().messages({
                'any.required': 'A Área Desembargada é obrigatória.'
            })
        })
      })
    })
    .messages({
      'number.base': commonMessages.number.base,
      'number.positive': commonMessages.number.positive,
    }),

})
// Validação Cruzada de Documentos
.or('numeroSEP', 'numeroEdocs')
.messages({
  'object.missing': 'É obrigatório preencher o número do SEP ou do E-Docs.'
});

module.exports = { formSchema };