const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const embargoRoutes = require('./src/routes/embargoRoutes');
const desembargoRoutes = require("./src/routes/desembargoRoutes");
const authRoutes = require('./src/routes/authRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const errorHandler = require('./src/middleware/errorHandler');

dotenv.config();

const app = express();

app.set('trust proxy', true);

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(errorHandler);


// serve frontend
app.use(express.static('../frontend'));

// rotas da API
app.use("/api/desembargos", desembargoRoutes);
app.use('/api/embargos', embargoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));