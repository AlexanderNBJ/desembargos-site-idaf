// backend/src/routes/formRoutes.js
const express = require('express');
const router = express.Router();
const { validarFormulario , criarDesembargo} = require('../controllers/formController');

// rota de validação usando POST
router.post('/validate', validarFormulario);
router.post('/create', criarDesembargo);

module.exports = router;
