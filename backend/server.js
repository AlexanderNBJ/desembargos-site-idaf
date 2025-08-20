// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const formRoutes = require('./src/routes/formRoutes');
const embargoRoutes = require('./src/routes/embargoRoutes');
const desembargoRoutes = require("./src/routes/desembargoRoutes");
dotenv.config();

const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/desembargos", desembargoRoutes);


// serve frontend
app.use(express.static('../frontend'));

// rotas da API
app.use('/api/desembargos', formRoutes);
app.use('/api/embargos', embargoRoutes);

// rota teste
app.get('/api', (req, res) => {
  res.json({ message: 'API funcionando' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
