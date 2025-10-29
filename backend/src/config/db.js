const { Pool } = require('pg');
require('dotenv').config();

let poolInstance; // Padrão Singleton, única instância

const getPool = () => {
  if (!poolInstance) {
    poolInstance = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
	
    poolInstance.on('error', (err, client) => {
      console.error('Erro inesperado em um cliente ocioso do pool', err);
      process.exit(-1); // Encerra a aplicação em caso de erro grave no DB
    });
  }
  return poolInstance;
};

module.exports = {
  query: (text, params) => getPool().query(text, params)
};