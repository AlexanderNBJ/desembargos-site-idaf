// src/validators/formValidator.js
const Joi = require('joi');

// regex que aceita letras (inclui acentos) e espaços — usa u flag para Unicode
const nomeRegex = /^[\p{L}\s'.-]+$/u;
// série: uma letra (maiúscula ou minúscula)
const serieRegex = /^[A-Za-z]$/;

const formSchema = Joi.object({
  numero: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Deve ser um número',
      'number.integer': 'Deve ser inteiro',
      'number.positive': 'Deve ser maior que zero',
      'any.required': 'Campo obrigatório',
    }),

  serie: Joi.string()
    .pattern(serieRegex)
    .uppercase()
    .required()
    .messages({
      'string.empty':'Campo obrigatório',
      'string.pattern.base': 'Deve conter uma única letra',
      'any.required': 'Campo obrigatório',
    }),

  nomeAutuado: Joi.string()
    .trim()
    .min(3)
    .pattern(nomeRegex)
    .allow(null, '')
    .uppercase()
    .messages({
      'string.min': 'Deve conter ao menos 3 caracteres',
      'string.pattern.base': 'O nome contém caracteres inválidos',
    }),

  area: Joi.number()
    .positive()
    .allow(null, '')
    .messages({
      'number.base': 'Deve deve ser um número',
      'number.positive': 'Deve ser maior que zero',
    }),

  processoSimlam: Joi.string()
    .trim()
    .pattern(/^\d+\/\d+$/)
    .required()
    .messages({
      'string.empty': 'Campo obrigatório',
      'string.pattern.base': 'Deve ter o formato NUMERO/NUMERO (ex: 12345/2025)',
    }),

  numeroSEP: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Deve ser número inteiro',
      'number.positive': 'Deve ser positivo',
      'number.base': 'Deve conter apenas números',
    }),

  numeroEdocs: Joi.string()
    .pattern(/^\d+-[A-Za-z0-9]+$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'e-Docs deve ter formato NUMERO-ALFA (ex: 2024-AB123)',
    }),

  tipoDesembargo: Joi.string()
    .valid('PARCIAL', 'TOTAL', 'INDEFERIMENTO')
    .required()
    .messages({
      'any.only': 'Tipo de desembargo inválido',
      'any.required': 'Tipo de desembargo é obrigatório',
    }),

  dataDesembargo: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Deve deve ser uma data válida',
      'date.max': ' A data de desembargo não pode ser posterior à data atual',
      'any.required': 'Campo obrigatório',
    }),

    // 39°39’ a 41°52’ Oeste de longitude
    coordenadaX: Joi.number()
    .required()
    .min(202611.74437293)
    .max(431142.9821811)
    .messages({
        'number.base': 'Latitude deve ser um número',
        'number.min': 'Latitude fora do retângulo do ES',
        'number.max': 'Latitude fora do retângulo do ES',
        'any.required': 'Campo obrigatório'
    }),
    
    // 17°53’a 21°19’ Sul de latitude
    coordenadaY: Joi.number()
    .required()
    .min(7640099.3226997)
    .max(8022601.9848009)
    .messages({
        'number.base': 'Longitude deve ser um número',
        'number.min': 'Longitude fora do retângulo do ES',
        'number.max': 'Longitude fora do retângulo do ES',
        'any.required': 'Campo obrigatório'
    }),

  descricao: Joi.string()
    .max(4000)
    .allow('', null)
    .messages({
      'string.max': 'Descrição pode ter no máximo 4000 caracteres',
    }),

});

module.exports = { formSchema };
