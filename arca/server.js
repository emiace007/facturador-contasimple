const express = require('express');
const config = require('./config');
const { conTx, conTxGlobal } = require('./db');
const { hashPassword, login, requireAuth, soloStaff, conComercio } = require('./auth');
const { emitir } = require('./facturas');
const { rutasUsuarios } = require('./usuarios');
const { generarPdf } = require('./pdf');

const crearApp = ({ emisor } = {}) => {
  const app = express();
  // CORS: solo el sitio del frontend (CORS_ORIGIN, separados por coma). Sin configurar, no se habilita ningún origen.
  const origenes = (process.env.CORS_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const o = req.header('origin');
    if (o && origenes.includes(o)) {
      res.set({ 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-comercio-id', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) }));

  app.get('/health', (_req, res) => res.json({ ok: true, env: config.ENV }));

  // --- Sesión ---
  const intentos = new Map(); // freno simple contra fuerza bruta: 10 intentos / 15 min por IP+email
  app.post('/api/auth/login', wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const k = `${req.ip}|${String(email || '').toLowerCase()}`;
    const ahora = Date.now();
    const lista = (intentos.get(k) || []).filter((t) => ahora - t < 15 * 60 * 1000);
    if (lista.length >= 10) return res.status(429).json({ ok: false, error: 'Demasiados intentos. Probá en unos minutos.' });
    const s = await login(email, password);
    if (!s) {
      intentos.set(k, [...lista, ahora]);
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });
    }
    intentos.delete(k);
    res.json({ ok: true, data: s });
  }));

  // --- Usuarios: cambiar la propia contraseña, salir, y alta/baja de usuarios de cada comercio ---
  rutasUsuarios(app, wrap);

  // --- Comercios (solo el estudio) ---
  app.post('/api/comercios', requireAuth, soloStaff, wrap(async (req, res) => {
    const { razonSocial, cuit, condicionFiscal, puntoVenta, emailDueno, passwordDueno } = req.body || {};
    if (!razonSocial || !/^\d{11}$/.test(String(cuit)) || !['monotributo', 'responsable_inscripto'].includes(condicionFiscal)
        || !emailDueno || String(passwordDueno || '').length < 8) {
      return res.status(400).json({ ok: false, error: 'Datos inválidos (CUIT de 11 dígitos, condición fiscal, email y contraseña de 8+).' });
    }
    const out = await conTxGlobal(async (c) => {
      const co = await c.query(
        'insert into comercios(razon_social, cuit, condicion_fiscal, punto_venta) values ($1,$2,$3,$4) returning id, razon_social, cuit, condicion_fiscal, punto_venta',
        [razonSocial, String(cuit), condicionFiscal, puntoVenta || null]
      );
      await c.query('insert into usuarios(comercio_id, email, password_hash, rol) values ($1,$2,$3,$4)',
        [co.rows[0].id, emailDueno, hashPassword(passwordDueno), 'dueno']);
      await c.query('insert into auditoria(usuario_id, comercio_id, accion) values ($1,$2,$3)', [req.user.id, co.rows[0].id, 'alta_comercio']);
      return co.rows[0];
    });
    res.json({ ok: true, data: out });
  }));

  app.get('/api/comercios', requireAuth, soloStaff, wrap(async (_req, res) => {
    const data = await conTxGlobal(async (c) => (await c.query('select id, razon_social, cuit, condicion_fiscal, punto_venta, domicilio, iibb, inicio_actividades, categoria_monotributo, delegacion_estado, activo from comercios order by razon_social')).rows);
    res.json({ ok: true, data });
  }));

  // Datos del comercio que salen en la factura (solo el estudio).
  app.post('/api/comercios/:id', requireAuth, soloStaff, wrap(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ ok: false, error: 'Id inválido' });
    const b = req.body || {};
    const txt = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, 300));
    if (b.razonSocial !== undefined && !txt(b.razonSocial)) return res.status(400).json({ ok: false, error: 'Falta la razón social.' });
    if (b.inicioActividades && !/^\d{4}-\d{2}-\d{2}$/.test(b.inicioActividades)) return res.status(400).json({ ok: false, error: 'Fecha de inicio inválida.' });
    if (b.puntoVenta != null && b.puntoVenta !== '' && !(Number.isInteger(Number(b.puntoVenta)) && Number(b.puntoVenta) > 0)) return res.status(400).json({ ok: false, error: 'Punto de venta inválido.' });
    const data = await conTxGlobal(async (c) => {
      const { rows } = await c.query(
        `update comercios set
           razon_social = coalesce($2, razon_social),
           domicilio = $3, iibb = $4, inicio_actividades = $5::date, categoria_monotributo = $6,
           punto_venta = coalesce($7, punto_venta)
         where id = $1
         returning id, razon_social, cuit, condicion_fiscal, punto_venta, domicilio, iibb, inicio_actividades, categoria_monotributo, delegacion_estado, activo`,
        [req.params.id, txt(b.razonSocial), txt(b.domicilio), txt(b.iibb), b.inicioActividades || null, txt(b.categoriaMonotributo),
         b.puntoVenta ? Number(b.puntoVenta) : null]);
      if (rows[0]) await c.query('insert into auditoria(usuario_id, comercio_id, accion) values ($1,$2,$3)', [req.user.id, rows[0].id, 'editar_comercio']);
      return rows[0];
    });
    if (!data) return res.status(404).json({ ok: false, error: 'Comercio inexistente' });
    res.json({ ok: true, data });
  }));

  // El comercio con el que se está trabajando (el del dueño, o el que eligió el estudio).
  app.get('/api/comercio', requireAuth, conComercio, wrap(async (req, res) => {
    const data = await conTxGlobal(async (c) => (await c.query(
      'select id, razon_social, cuit, condicion_fiscal, punto_venta, domicilio, iibb, inicio_actividades, categoria_monotributo, delegacion_estado from comercios where id = $1 and activo', [req.comercioId])).rows[0]);
    if (!data) return res.status(404).json({ ok: false, error: 'Comercio inexistente' });
    res.json({ ok: true, data });
  }));

  // --- Productos ---
  app.get('/api/productos', requireAuth, conComercio, wrap(async (req, res) => {
    const data = await conTx(req.comercioId, async (c) => (await c.query('select * from productos where activo order by nombre')).rows);
    res.json({ ok: true, data });
  }));
  app.post('/api/productos', requireAuth, conComercio, wrap(async (req, res) => {
    const { nombre, precio, alicuotaIva = 21, esServicio = false } = req.body || {};
    if (!nombre || !(Number(precio) >= 0)) return res.status(400).json({ ok: false, error: 'Nombre y precio válidos.' });
    const data = await conTx(req.comercioId, async (c) => (await c.query(
      'insert into productos(comercio_id, nombre, precio, alicuota_iva, es_servicio) values ($1,$2,$3,$4,$5) returning *',
      [req.comercioId, nombre, Number(precio), Number(alicuotaIva), !!esServicio])).rows[0]);
    res.json({ ok: true, data });
  }));

  // --- Facturas ---
  app.post('/api/facturas', requireAuth, conComercio, wrap(async (req, res) => {
    const f = await emitir({ comercioId: req.comercioId, usuarioId: req.user.id, datos: req.body || {}, emisor });
    res.status(f.estado === 'emitida' ? 200 : 422).json({ ok: f.estado === 'emitida', data: f, error: f.error });
  }));

  app.get('/api/facturas', requireAuth, conComercio, wrap(async (req, res) => {
    const data = await conTx(req.comercioId, async (c) => (await c.query(
      'select * from facturas order by creado_en desc limit $1', [Math.min(Number(req.query.limit) || 100, 500)])).rows);
    res.json({ ok: true, data });
  }));

  // PDF de una factura emitida, con el QR de ARCA.
  app.get('/api/facturas/:id/pdf', requireAuth, conComercio, wrap(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ ok: false, error: 'Id inválido' });
    const out = await conTx(req.comercioId, async (c) => {
      const f = (await c.query('select * from facturas where id = $1', [req.params.id])).rows[0];
      if (!f) return null;
      const items = (await c.query('select descripcion, cantidad, precio_unitario from factura_items where factura_id = $1', [f.id])).rows;
      return { f, items };
    });
    if (!out) return res.status(404).json({ ok: false, error: 'No existe' });
    const comercio = await conTxGlobal(async (c) => (await c.query('select * from comercios where id = $1', [req.comercioId])).rows[0]);
    const pdf = await generarPdf({ factura: out.f, items: out.items, comercio });
    const nombre = `Factura-${({ 1: 'A', 6: 'B', 11: 'C' })[out.f.cbte_tipo]}-${String(out.f.punto_venta).padStart(5, '0')}-${String(out.f.numero).padStart(8, '0')}.pdf`;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nombre}"` });
    res.send(pdf);
  }));

  // Resumen de ventas para la pantalla de inicio (hoy y mes en curso, hora de Argentina).
  app.get('/api/resumen', requireAuth, conComercio, wrap(async (req, res) => {
    const data = await conTx(req.comercioId, async (c) => (await c.query(
      `with hoy as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date d)
       select
         coalesce(sum(importe_total) filter (where fecha_comprobante = hoy.d), 0)::text as hoy_total,
         count(*) filter (where fecha_comprobante = hoy.d)::int as hoy_cantidad,
         coalesce(sum(importe_total) filter (where date_trunc('month', fecha_comprobante) = date_trunc('month', hoy.d)), 0)::text as mes_total,
         count(*) filter (where date_trunc('month', fecha_comprobante) = date_trunc('month', hoy.d))::int as mes_cantidad
       from hoy left join facturas f on f.estado = 'emitida' and f.fecha_comprobante >= date_trunc('month', hoy.d) - interval '10 days'
       group by hoy.d`)).rows[0]);
    res.json({ ok: true, data });
  }));

  // --- Carga masiva: se crea el lote y se emite una por una en segundo plano ---
  app.post('/api/lotes', requireAuth, conComercio, wrap(async (req, res) => {
    const filas = Array.isArray(req.body && req.body.facturas) ? req.body.facturas : [];
    if (!filas.length || filas.length > 500) return res.status(400).json({ ok: false, error: 'Mandá entre 1 y 500 facturas.' });
    const loteId = await conTx(req.comercioId, async (c) => (await c.query(
      'insert into lotes(comercio_id, archivo, total) values ($1,$2,$3) returning id', [req.comercioId, req.body.archivo || null, filas.length])).rows[0].id);
    const comercioId = req.comercioId, usuarioId = req.user.id;
    (async () => {
      for (const datos of filas) {
        try { await emitir({ comercioId, usuarioId, datos, loteId, emisor }); } catch (e) { console.error('lote', loteId, e.message); }
      }
    })();
    res.status(202).json({ ok: true, data: { loteId, total: filas.length } });
  }));

  app.get('/api/lotes/:id', requireAuth, conComercio, wrap(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ ok: false, error: 'Id inválido' });
    const data = await conTx(req.comercioId, async (c) => {
      const l = (await c.query('select * from lotes where id=$1', [req.params.id])).rows[0];
      if (!l) return null;
      const r = (await c.query('select estado, count(*)::int n from facturas where lote_id=$1 group by estado', [req.params.id])).rows;
      return { ...l, resumen: Object.fromEntries(r.map((x) => [x.estado, x.n])) };
    });
    if (!data) return res.status(404).json({ ok: false, error: 'No existe' });
    res.json({ ok: true, data });
  }));

  // --- Padrón (consulta de constancia de un CUIT) ---
  app.get('/api/padron', requireAuth, wrap(async (req, res) => {
    const { consultarPadron } = require('./padron');
    res.json({ ok: true, data: await consultarPadron(String(req.query.cuit || '')) });
  }));

  return app;
};

module.exports = { crearApp };

if (require.main === module) {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL (conexión a la base con el rol app_user).');
    process.exit(1);
  }
  crearApp().listen(config.PORT, () => console.log(`Backend facturador (${config.ENV}) escuchando en :${config.PORT}`));
}
