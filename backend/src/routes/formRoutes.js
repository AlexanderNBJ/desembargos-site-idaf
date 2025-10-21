const express = require('express');
const router = express.Router();
const { validarFormulario , criarDesembargo} = require('../controllers/formController');
const { requireAuth } = require('../middleware/authMiddleware');

// rota de validação usando POST
router.post('/validate', validarFormulario);
router.post('/create', requireAuth, criarDesembargo);

module.exports = router;
