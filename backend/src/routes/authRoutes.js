const express = require('express');
const controller = require('../controllers/authController');
const router = express.Router();

router.post('/login', controller.login);
router.get('/permissions', controller.getPermissions);

module.exports = router;
