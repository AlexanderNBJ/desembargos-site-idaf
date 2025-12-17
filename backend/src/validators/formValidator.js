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
  
  numero: Joi.string()
    .pattern(validationConstants.NUMERO_REGEX)
    .required()
    .messages({
      'string.base': 'O campo número é obrigatório',
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
      'string.base': 'O campo série é obrigatório.',
      'string.empty': commonMessages.string.empty,
      'string.pattern.base': 'A série deve conter uma única letra.',
      'any.only': 'A série deve ser A, B, C, D ou E.',
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
      'string.min': 'O nome do autuado deve ter no mínimo 3 caracteres.',
      'string.pattern.base': 'O nome do autuado contém caracteres inválidos.',
    }),

  processoSimlam: Joi.string()
    .trim()
    .empty('')
    .pattern(validationConstants.PROCESSO_REGEX)
    .required()
    .messages({
      'string.base': 'O campo processo SIMLAM é obrigatório',
      'any.only': 'O processo SIMLAM é inválido.',
      'string.empty': commonMessages.string.empty,
      'string.pattern.base': 'O processo SIMLAM deve ter o formato NÚMERO/ANO (ex: 12345/2025).',
      'any.required': commonMessages.required.any,
    }),

  numeroSEP: Joi.number()
    .integer()
    .positive()
    .empty('')
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
      'string.pattern.base': 'O E-docs deve ter o formato NÚMERO-CÓDIGO (ex: 2024-AB123).',
    }),

  coordenadaX: Joi.number()
    .empty('') 
    .min(validationConstants.COORD_X_MIN)
    .max(validationConstants.COORD_X_MAX)
    .required()
    .messages({
      'number.base': commonMessages.number.base,
      'number.min': 'A coordenada X está fora dos limites do ES.',
      'number.max': 'A coordenada X está fora dos limites do ES.',
      'any.required': commonMessages.required.any,
    }),

  coordenadaY: Joi.number()
    .empty('')
    .min(validationConstants.COORD_Y_MIN)
    .max(validationConstants.COORD_Y_MAX)
    .required()
    .messages({
      'number.base': commonMessages.number.base,
      'number.min': 'A coordenada Y está fora dos limites do ES.',
      'number.max': 'A coordenada Y está fora dos limites do ES.',
      'any.required': commonMessages.required.any,
    }),

  descricao: Joi.string()
    .trim()
    .max(4000)
    .empty('')
    .allow(null)
    .messages({
      'string.max': 'A descrição pode ter no máximo 4000 caracteres.',
    }),


  // 2. Deliberação da Autoridade (Obrigatório e Enum)
  deliberacaoAutoridade: Joi.string()
    .valid('DEFERIDA', 'INDEFERIDA')
    .required()
    .messages({
      'any.only': 'O parecer técnico deve ser DEFERIMENTO ou INDEFERIMENTO.',
      'any.required': 'O parecer técnico é obrigatório.',
    }),

  // 3. Tipo de Desembargo
  tipoDesembargo: Joi.string()
    .valid('PARCIAL', 'TOTAL', 'INDEFERIMENTO', 'DESINTERDIÇÃO')
    .required()
    .messages({
      'any.only': 'O tipo de desembargo é inválido.',
      'any.required': 'O tipo de desembargo é obrigatório.',
    }),

  // 4. Data do Embargo (Novo Campo Obrigatório)
  dataEmbargo: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.base': 'Data do embargo inválida.',
      'date.max': 'A data do embargo não pode ser no futuro.',
      'any.required': 'A data do embargo é obrigatória.',
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
    .empty('')
    .positive()
    .required()
    .messages({
      'number.base': 'A área embargada deve ser um número.',
      'number.positive': 'A área embargada deve ser positiva.',
      'any.required': 'A área embargada é obrigatória.',
    }),

  // 7. Área Desembargada (Lógica Condicional Complexa)
  // 7. Área Desembargada (Lógica Condicional Complexa)
  area: Joi.number()
    .empty('')
    .positive()
    .when('tipoDesembargo', {
      is: 'INDEFERIMENTO',
      then: Joi.allow(null).optional(), 
      otherwise: Joi.when('deliberacaoAutoridade', { 
        is: 'DEFERIDA',
        then: Joi.when('tipoDesembargo', {
          is: 'PARCIAL',
          // O 'adjust' converte o valor de referência para número antes de comparar
          then: Joi.number().required().less(Joi.ref('areaEmbargada', { adjust: (val) => Number(val) }))
            .messages({
              'number.less': 'A área desembargada deve ser menor que a área embargada.',
              'any.required': 'A área desembargada é obrigatória para deferimentos parciais.',
              'number.base': commonMessages.number.base,
            }),
          is: 'TOTAL', 
          then: Joi.number().required().messages({
              'any.required': 'A área desembargada é obrigatória.'
          }),
          otherwise: Joi.number().required()
        }),
        otherwise: Joi.allow(null) 
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
  'object.missing': 'É obrigatório preencher o número do SEP ou do E-docs.'
});

module.exports = { formSchema };