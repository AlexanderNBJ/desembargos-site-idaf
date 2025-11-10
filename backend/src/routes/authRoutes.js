const express = require('express');
const controller = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/login', controller.login);
router.get('/permissions', controller.getPermissions);
router.post('/logout', authMiddleware.requireAuth, controller.logout);

module.exports = router;
