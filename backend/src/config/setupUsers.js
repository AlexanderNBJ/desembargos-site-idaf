// backend/src/config/setupUsers.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const db = require('../config/db'); // usa seu db.js existente
const usersTable = 'USERS_TEST';

async function runMigration() {
  const migPath = path.join(__dirname, 'migrations', '001_create_users.sql');
  if (!fs.existsSync(migPath)) throw new Error('Migration file not found: ' + migPath);
  const sql = fs.readFileSync(migPath, 'utf8');
  await db.query(sql);
  console.log('Migration executed.');
}

async function upsertUser(username, password, role, name, position) {
  const hash = await bcrypt.hash(password, 10);
  const q = `
    INSERT INTO ${usersTable} (username, password_hash, role, name, position)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
    RETURNING id;
  `;
  const { rows } = await db.query(q, [username, hash, role, name, position]);
  return rows[0].id;
}

(async () => {
  try {
    await runMigration();
    const id1 = await upsertUser('ahnaiazds',       'senha', 'GERENTE', 'AHNAIÁ ZANOTELLI DIAS DA SILVA', 'Gerente da Gerência de Licenciamento e Controle Florestal – GELCOF');
    const id2 = await upsertUser('fabianocg',       'senha', 'GERENTE', 'FABIANO CAMPOS GRAZZIOTTI', 'Gerente de Licenciamento e Controle Florestal - IDAF');
    const id3 = await upsertUser('fabriciovz',      'senha', 'GERENTE', 'FABRICIO VALENTIM ZANZARINI', 'Gerente da Gerência de Licenciamento e Controle Florestal – GELCOF');
    const id4 = await upsertUser('desconhecido@',   'senha', 'GERENTE', 'DESCONHECIDO', 'Gerente');
    const id5 = await upsertUser('gabrielhf',       'senha', 'GERENTE', 'GABRIEL HECTOR FONTANA', 'Gerente substituto da Gerência de Licenciamento e Controle Florestal – GELCOF');
    const id6 = await upsertUser('isiscs',          'senha', 'GERENTE', 'ISIS DE CASTRO SOUZA', 'Gerente de Licenciamento e Controle Florestal - GELCOF');
    const id7 = await upsertUser('jesusfmb',        'senha', 'GERENTE', 'JÉSUS FERNANDO MIRANDA BARBOSA', 'Gerente da Gerência de Licenciamento e Controle Florestal – GELCOF');
    const id8 = await upsertUser('wilmondesmo',        'senha', 'GERENTE', 'WILMONDES MAGALHÃES DE OLIVEIRA', 'Gerente da Gerência de Licenciamento e Controle Florestal – GELCOF');
    console.log('Users created/updated:', id1, id2, id3, id4, id5, id6, id7, id8);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
