// Uso: DATABASE_URL=... node scripts/crear-staff.js email@estudio.com 'una-clave-larga'
const { conTxGlobal, pool } = require('../db');
const { hashPassword } = require('../auth');
const [email, pass] = process.argv.slice(2);
if (!email || !pass || pass.length < 8) { console.error('Uso: node scripts/crear-staff.js <email> <clave de 8+ caracteres>'); process.exit(1); }
conTxGlobal((c) => c.query("insert into usuarios(email, password_hash, rol) values ($1,$2,'staff')", [email, hashPassword(pass)]))
  .then(() => console.log('Usuario del estudio creado.')).catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
