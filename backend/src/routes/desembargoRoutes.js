const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");
const { route } = require("./formRoutes");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/processo", desembargoController.getDesembargoByProcesso);

// cadastrar desembargo
router.post("/", requireAuth, desembargoController.inserir);
router.get('/list', desembargoController.listarDesembargos)

// visualizar e editar desembargo
router.get("/:id", desembargoController.getDesembargoById);
router.put("/:id",requireAuth, desembargoController.updateDesembargo);
router.get("/:id/pdf", requireAuth, desembargoController.gerarPdf);

module.exports = router;
