const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const embargoRoutes = require('./src/routes/embargoRoutes');
const desembargoRoutes = require("./src/routes/desembargoRoutes");
const authRoutes = require('./src/routes/authRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const errorHandler = require('./src/middleware/errorHandler');

dotenv.config();

const app = express();

app.set('trust proxy', true);

// Middlewares básicos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas da API
app.use("/api/desembargos", desembargoRoutes);
app.use('/api/embargos', embargoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/auth', authRoutes);

// Servir o frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

// Middleware de erros
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));