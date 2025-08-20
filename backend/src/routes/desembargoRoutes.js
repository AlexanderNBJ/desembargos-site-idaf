const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");

// cadastrar desembargo
router.post("/", desembargoController.inserir);

// validar
router.put("/:id/validar", desembargoController.validar);

// recusar
router.put("/:id/recusar", desembargoController.recusar);

module.exports = router;
