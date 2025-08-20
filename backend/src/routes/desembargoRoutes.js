const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");
const { route } = require("./formRoutes");

// cadastrar desembargo
router.post("/", desembargoController.inserir);
router.get('/list', desembargoController.listarDesembargos)

module.exports = router;
