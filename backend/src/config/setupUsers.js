// backend/src/config/setupUsers.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const db = require('../config/db'); // usa seu db.js existente

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
    INSERT INTO users (username, password_hash, role, name, position)
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
    const id1 = await upsertUser('gerente@example.com', 'gerente123', 'GERENTE', 'Alexander Gerente', 'Gerente');
    const id2 = await upsertUser('comum1@example.com', 'comum123', 'COMUM', 'Alexander Comum1', 'Secretário');
    const id3 = await upsertUser('comum2@example.com', 'comum123', 'COMUM', 'Alexander Comum2', 'Secretário');
    console.log('Users created/updated:', id1, id2, id3);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
