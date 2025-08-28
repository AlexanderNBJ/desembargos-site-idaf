const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");
const { route } = require("./formRoutes");

// cadastrar desembargo
router.post("/", desembargoController.inserir);
router.get('/list', desembargoController.listarDesembargos)

// visualizar e editar desembargo
router.get("/:id", desembargoController.getDesembargoById);
router.put("/:id", desembargoController.updateDesembargo);
router.get("/:id/pdf", desembargoController.gerarPdf);

module.exports = router;
