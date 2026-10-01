// Usuarios de los comercios.
// - El estudio (staff) gestiona los usuarios de cualquier comercio (dueños y empleados).
// - El dueño gestiona solo los empleados de SU comercio.
// - El empleado no gestiona usuarios.
// - Cualquiera puede cambiar su propia contraseña.
// Las contraseñas se guardan hasheadas y nunca se devuelven.
const { conTxGlobal } = require('./db');
const { hashPassword, verificarPassword, requireAuth } = require('./auth');

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (status, message) => Object.assign(new Error(message), { status });
const validarClave = (p) => { if (String(p || '').length < 8) throw err(400, 'La contraseña tiene que tener al menos 8 caracteres.'); };

/** Comercio sobre el que se gestionan usuarios: el del dueño, o el que indica el estudio. */
function comercioObjetivo(req, desde) {
  if (req.user.rol === 'dueno') return req.user.comercioId;
  if (req.user.rol === 'staff') {
    const id = desde || req.comercioId;
    if (!id || !UUID.test(id)) throw err(400, 'Falta indicar el comercio.');
    return id;
  }
  throw err(403, 'No tenés permiso para gestionar usuarios.');
}

/** ¿Puede quien pide tocar a este usuario? */
function puedeGestionar(req, u) {
  if (!u || u.rol === 'staff') return false;
  if (req.user.rol === 'staff') return true;
  return req.user.rol === 'dueno' && u.comercio_id === req.user.comercioId && u.rol === 'empleado';
}

async function usuarioGestionable(c, req, id) {
  if (!UUID.test(String(id))) throw err(400, 'Id inválido');
  const u = (await c.query('select id, comercio_id, rol from usuarios where id = $1', [id])).rows[0];
  if (!puedeGestionar(req, u)) throw err(404, 'Usuario inexistente');
  return u;
}

const auditar = (c, req, comercioId, accion, detalle) =>
  c.query('insert into auditoria(usuario_id, comercio_id, accion, detalle) values ($1,$2,$3,$4)', [req.user.id, comercioId, accion, detalle || null]);

function rutasUsuarios(app, wrap) {
  // Cambiar la propia contraseña (cualquier usuario). Cierra las demás sesiones abiertas.
  app.post('/api/auth/password', requireAuth, wrap(async (req, res) => {
    const { actual, nueva } = req.body || {};
    validarClave(nueva);
    await conTxGlobal(async (c) => {
      const u = (await c.query('select password_hash, comercio_id from usuarios where id = $1', [req.user.id])).rows[0];
      if (!u || !verificarPassword(String(actual || ''), u.password_hash)) throw err(400, 'La contraseña actual no es correcta.');
      await c.query('update usuarios set password_hash = $1 where id = $2', [hashPassword(nueva), req.user.id]);
      await c.query('delete from sesiones where usuario_id = $1 and token_hash <> $2', [req.user.id, req.tokenHash]);
      await auditar(c, req, u.comercio_id, 'cambio_clave_propia');
    });
    res.json({ ok: true });
  }));

  // Salir: borra la sesión actual.
  app.post('/api/auth/logout', requireAuth, wrap(async (req, res) => {
    await conTxGlobal((c) => c.query('delete from sesiones where token_hash = $1', [req.tokenHash]));
    res.json({ ok: true });
  }));

  // Listar usuarios de un comercio.
  app.get('/api/usuarios', requireAuth, wrap(async (req, res) => {
    const comercioId = comercioObjetivo(req, req.query.comercioId);
    const data = await conTxGlobal(async (c) => (await c.query(
      `select id, email, rol, activo, creado_en from usuarios
        where comercio_id = $1
        order by case rol when 'dueno' then 0 else 1 end, email`, [comercioId])).rows);
    res.json({ ok: true, data });
  }));

  // Crear un usuario en un comercio. El estudio elige dueño o empleado; el dueño solo crea empleados.
  app.post('/api/usuarios', requireAuth, wrap(async (req, res) => {
    const { email, password, rol = 'empleado', comercioId: cid } = req.body || {};
    const comercioId = comercioObjetivo(req, cid);
    if (!['dueno', 'empleado'].includes(rol)) throw err(400, 'Rol inválido.');
    if (req.user.rol !== 'staff' && rol !== 'empleado') throw err(403, 'Solo el estudio puede crear dueños.');
    if (!EMAIL.test(String(email || '').trim())) throw err(400, 'Email inválido.');
    validarClave(password);
    const data = await conTxGlobal(async (c) => {
      const co = (await c.query('select id from comercios where id = $1', [comercioId])).rows[0];
      if (!co) throw err(404, 'Comercio inexistente');
      try {
        const u = (await c.query(
          'insert into usuarios(comercio_id, email, password_hash, rol) values ($1,$2,$3,$4) returning id, email, rol, activo, creado_en',
          [comercioId, String(email).trim().toLowerCase(), hashPassword(password), rol])).rows[0];
        await auditar(c, req, comercioId, 'alta_usuario', { usuario: u.id, rol });
        return u;
      } catch (e) {
        if (e.code === '23505') throw err(409, 'Ya existe un usuario con ese email.');
        throw e;
      }
    });
    res.json({ ok: true, data });
  }));

  // Activar / desactivar. Al desactivar se cierran sus sesiones.
  app.post('/api/usuarios/:id/estado', requireAuth, wrap(async (req, res) => {
    const activo = !!(req.body && req.body.activo);
    await conTxGlobal(async (c) => {
      const u = await usuarioGestionable(c, req, req.params.id);
      await c.query('update usuarios set activo = $1 where id = $2', [activo, u.id]);
      if (!activo) await c.query('delete from sesiones where usuario_id = $1', [u.id]);
      await auditar(c, req, u.comercio_id, activo ? 'activar_usuario' : 'desactivar_usuario', { usuario: u.id });
    });
    res.json({ ok: true });
  }));

  // Poner una contraseña nueva a otro usuario (olvido). Cierra sus sesiones.
  app.post('/api/usuarios/:id/password', requireAuth, wrap(async (req, res) => {
    const { password } = req.body || {};
    validarClave(password);
    await conTxGlobal(async (c) => {
      const u = await usuarioGestionable(c, req, req.params.id);
      await c.query('update usuarios set password_hash = $1 where id = $2', [hashPassword(password), u.id]);
      await c.query('delete from sesiones where usuario_id = $1', [u.id]);
      await auditar(c, req, u.comercio_id, 'reset_clave_usuario', { usuario: u.id });
    });
    res.json({ ok: true });
  }));
}

module.exports = { rutasUsuarios };
