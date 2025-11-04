const express = require('express');
const router = express.Router();
const embargoController = require('../controllers/embargoController');

router.get('/check/:numero', embargoController.checkEmbargo);
router.get('/processo', embargoController.getByNumero)
router.get('/sep', embargoController.getBySEP)

module.exports = router;
