const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/me', requireAuth, usuarioController.me);
router.get('/', usuarioController.listarUsuarios);

module.exports = router;
