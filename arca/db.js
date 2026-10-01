const { Pool } = require('pg');

// Conexión con el rol app_user (sin bypass de RLS). DATABASE_URL va solo en variables de entorno.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
});

async function conTx(comercioId, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Con esto la base solo deja ver/tocar filas de ESTE comercio (políticas RLS del esquema).
    await client.query("select set_config('app.comercio_id', $1, true)", [comercioId || '']);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Para tablas sin comercio_id (usuarios, sesiones, comercios, auditoria). */
const conTxGlobal = (fn) => conTx('', fn);

module.exports = { pool, conTx, conTxGlobal };
