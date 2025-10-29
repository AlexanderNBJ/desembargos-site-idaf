const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");
const { requireAuth } = require("../middleware/authMiddleware");

router.post('/validate', desembargoController.validarFormulario);
router.post('/create', requireAuth, desembargoController.inserir);
router.post('/', requireAuth, desembargoController.inserir);
router.get("/processo", desembargoController.getDesembargoByProcesso);
router.get('/list', desembargoController.listarDesembargos);
router.get("/:id", desembargoController.getDesembargoById);
router.put("/:id", requireAuth, desembargoController.updateDesembargo);
router.get("/:id/pdf", requireAuth, desembargoController.gerarPdf);

module.exports = router;