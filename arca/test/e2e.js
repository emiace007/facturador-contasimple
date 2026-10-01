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

  const mi = await call('GET', '/api/comercio', null, ta, b.data.id);
  assert.equal(mi.data.id, a.data.id, 'el dueño solo ve su comercio');
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

  // Usuarios de los comercios
  const login = async (email, password) => (await call('POST', '/api/auth/login', { email, password }));
  assert.equal((await call('GET', '/api/usuarios', null, ta)).data.length, 1, 'el dueño ve los usuarios de su comercio');
  assert.equal((await call('POST', '/api/usuarios', { email: 'x@a.com', password: 'clave-x-1234', rol: 'dueno' }, ta)).s, 403, 'el dueño no crea dueños');
  const emp = await call('POST', '/api/usuarios', { email: 'emp@a.com', password: 'clave-emp-123' }, ta);
  assert(emp.ok && emp.data.rol === 'empleado' && !('password_hash' in emp.data), JSON.stringify(emp));
  assert.equal((await call('POST', '/api/usuarios', { email: 'EMP@a.com', password: 'clave-emp-123' }, ta)).s, 409, 'email repetido');
  // El dueño crea siempre en SU comercio aunque mande otro comercioId
  const empB = await call('POST', '/api/usuarios', { email: 'otro@a.com', password: 'clave-otro-12', comercioId: b.data.id }, ta);
  assert(empB.ok);
  const te = (await login('otro@a.com', 'clave-otro-12')).data;
  assert.equal(te.comercioId, a.data.id, 'el usuario quedó en el comercio del dueño');
  assert.equal((await call('GET', '/api/usuarios', null, tb)).data.length, 1, 'B no ve los usuarios de A');
  // B no puede tocar usuarios de A
  assert.equal((await call('POST', `/api/usuarios/${emp.data.id}/estado`, { activo: false }, tb)).s, 404);
  assert.equal((await call('POST', `/api/usuarios/${emp.data.id}/password`, { password: 'hackeada-123' }, tb)).s, 404);
  // El empleado no gestiona usuarios
  assert.equal((await call('GET', '/api/usuarios', null, te.token)).s, 403);
  assert.equal((await call('POST', '/api/usuarios', { email: 'y@a.com', password: 'clave-y-1234' }, te.token)).s, 403);
  // El empleado factura solo para su comercio
  const fe = await call('POST', '/api/facturas', { importe: 50 }, te.token);
  assert(fe.ok && fe.data.comercio_id === a.data.id);
  // Desactivar corta la sesión y el login
  const te2 = (await login('emp@a.com', 'clave-emp-123')).data.token;
  assert((await call('POST', `/api/usuarios/${emp.data.id}/estado`, { activo: false }, ta)).ok);
  assert.equal((await call('GET', '/api/facturas', null, te2)).s, 401, 'sesión cortada');
  assert.equal((await login('emp@a.com', 'clave-emp-123')).s, 401, 'no entra desactivado');
  assert((await call('POST', `/api/usuarios/${emp.data.id}/estado`, { activo: true }, ta)).ok);
  // Reset de clave por el dueño
  assert((await call('POST', `/api/usuarios/${emp.data.id}/password`, { password: 'nueva-clave-99' }, ta)).ok);
  assert.equal((await login('emp@a.com', 'clave-emp-123')).s, 401);
  assert((await login('emp@a.com', 'nueva-clave-99')).ok);
  // El dueño no puede tocar al staff ni a sí mismo como si fuera empleado
  const yoA = (await call('GET', '/api/usuarios', null, ta)).data.find((u) => u.rol === 'dueno');
  assert.equal((await call('POST', `/api/usuarios/${yoA.id}/estado`, { activo: false }, ta)).s, 404);
  // El estudio gestiona usuarios de cualquier comercio
  assert.equal((await call('GET', `/api/usuarios?comercioId=${b.data.id}`, null, staff)).data.length, 1);
  const d2 = await call('POST', '/api/usuarios', { email: 'socio@b.com', password: 'clave-socio-1', rol: 'dueno', comercioId: b.data.id }, staff);
  assert(d2.ok && d2.data.rol === 'dueno');
  assert((await call('POST', `/api/usuarios/${yoA.id}/password`, { password: 'reset-por-estudio' }, staff)).ok);
  assert.equal((await call('GET', '/api/facturas', null, ta)).s, 401, 'reset cierra sesiones del dueño');
  const ta2 = (await login('a@a.com', 'reset-por-estudio')).data.token;
  // Cambiar la propia contraseña
  assert.equal((await call('POST', '/api/auth/password', { actual: 'mala', nueva: 'otra-clave-123' }, ta2)).s, 400);
  assert.equal((await call('POST', '/api/auth/password', { actual: 'reset-por-estudio', nueva: 'corta' }, ta2)).s, 400);
  assert((await call('POST', '/api/auth/password', { actual: 'reset-por-estudio', nueva: 'mi-clave-nueva-1' }, ta2)).ok);
  assert.equal((await call('GET', '/api/facturas', null, ta2)).s, 200, 'la sesión actual sigue');
  assert((await login('a@a.com', 'mi-clave-nueva-1')).ok);
  // Salir
  assert((await call('POST', '/api/auth/logout', null, ta2)).ok);
  assert.equal((await call('GET', '/api/facturas', null, ta2)).s, 401);

  console.log('TODO OK');
  app.close(); await pool.end();
})().catch((e) => { console.error('FALLÓ:', e.message); process.exit(1); });
