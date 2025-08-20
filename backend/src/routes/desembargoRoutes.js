const express = require("express");
const router = express.Router();
const desembargoController = require("../controllers/desembargoController");

// cadastrar desembargo
router.post("/", desembargoController.inserir);

module.exports = router;
