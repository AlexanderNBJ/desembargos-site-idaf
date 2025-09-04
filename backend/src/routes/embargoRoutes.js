const express = require('express');
const router = express.Router();
const embargoController = require('../controllers/embargoController');

// rota de checagem de embargo
router.get('/check/:numero', embargoController.checkEmbargo);
router.get('/processo', embargoController.getByNumero)

module.exports = router;
