// Prueba de punta a punta con ARCA SIMULADO (no emite nada real). Uso: DATABASE_URL=... node test/e2e.js
const assert = require('assert');
const { crearApp } = require('../server');
const { pool } = require('../db');
const { hashPassword } = require('../auth');

let n = 0;
const emisorFalso = async (d) => {
  if (d.importe === 666) throw new Error('ARCA no aprobó el comprobante (simulado)');
  return { numero: ++n, cae: '7' + String(n).padStart(13, '0'), caeVencimiento: '20261231', fecha: '20261001' };
};
const app = crearApp({ emisor: emisorFalso }).listen(0);
const base = `http://127.0.0.1:${app.address().port}`;
const call = async (m, p, body, token, comercio) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json',
    ...(token ? { authorization: 'Bearer ' + token } : {}), ...(comercio ? { 'x-comercio-id': comercio } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, ...(await r.json()) };
};

(async () => {
  await pool.query("insert into usuarios(email,password_hash,rol) values ('staff@e.com',$1,'staff')", [hashPassword('clave-staff-1')]);
  assert.equal((await call('POST', '/api/auth/login', { email: 'staff@e.com', password: 'mala' })).s, 401);
  const staff = (await call('POST', '/api/auth/login', { email: 'staff@e.com', password: 'clave-staff-1' })).data.token;

  const a = await call('POST', '/api/comercios', { razonSocial: 'Kiosco A', cuit: '20111111112', condicionFiscal: 'monotributo', puntoVenta: 1, emailDueno: 'a@a.com', passwordDueno: 'clave-a-1234' }, staff);
  const b = await call('POST', '/api/comercios', { razonSocial: 'Ferretería B', cuit: '20222222223', condicionFiscal: 'responsable_inscripto', puntoVenta: 2, emailDueno: 'b@b.com', passwordDueno: 'clave-b-1234' }, staff);
  assert(a.ok && b.ok, JSON.stringify([a, b]));
  const ta = (await call('POST', '/api/auth/login', { email: 'a@a.com', password: 'clave-a-1234' })).data.token;
  const tb = (await call('POST', '/api/auth/login', { email: 'b@b.com', password: 'clave-b-1234' })).data.token;

  assert.equal((await call('GET', '/api/comercios', null, ta)).s, 403, 'un comercio no lista comercios');

  const f1 = await call('POST', '/api/facturas', { importe: 1000, items: [{ descripcion: 'Alfajor', cantidad: 2, precioUnitario: 500 }] }, ta);
  assert(f1.ok && f1.data.estado === 'emitida' && f1.data.cbte_tipo === 11 && f1.data.cae, JSON.stringify(f1));
  assert.equal((await call('POST', '/api/facturas', { importe: 100, cbteTipo: 6 }, ta)).s >= 400, true, 'mono no puede B');
  assert.equal((await call('POST', '/api/facturas', { importe: 100, cbteTipo: 11 }, tb)).s >= 400, true, 'RI no puede C');
  const fb = await call('POST', '/api/facturas', { importe: 121, cbteTipo: 6 }, tb);
  assert(fb.ok && fb.data.cbte_tipo === 6 && fb.data.punto_venta === 2, JSON.stringify(fb));
  const err = await call('POST', '/api/facturas', { importe: 666 }, ta);
  assert(err.s === 422 && err.data.estado === 'error');

  // Aislamiento: cada comercio ve solo lo suyo
  const la = (await call('GET', '/api/facturas', null, ta)).data, lb = (await call('GET', '/api/facturas', null, tb)).data;
  assert.equal(la.length, 2); assert.equal(lb.length, 1);
  assert(la.every((f) => f.comercio_id === a.data.id));
  // Un comercio no puede operar como otro mandando el header
  const spoof = (await call('GET', '/api/facturas', null, ta, b.data.id)).data;
  assert(spoof.every((f) => f.comercio_id === a.data.id), 'el header x-comercio-id no debe valer para un comercio');
  // El staff sí puede operar por un comercio
  assert.equal((await call('GET', '/api/facturas', null, staff, b.data.id)).data.length, 1);

  // Lote
  const lote = await call('POST', '/api/lotes', { archivo: 'x.xlsx', facturas: [{ importe: 10 }, { importe: 20 }, { importe: 666 }] }, ta);
  assert.equal(lote.s, 202);
  await new Promise((r) => setTimeout(r, 800));
  const est = (await call('GET', '/api/lotes/' + lote.data.loteId, null, ta)).data;
  assert.deepEqual(est.resumen, { emitida: 2, error: 1 });
  assert.equal((await call('GET', '/api/lotes/' + lote.data.loteId, null, tb)).s, 404, 'otro comercio no ve el lote');

  console.log('TODO OK');
  app.close(); await pool.end();
})().catch((e) => { console.error('FALLÓ:', e.message); process.exit(1); });
