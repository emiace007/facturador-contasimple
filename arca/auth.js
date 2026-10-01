const crypto = require('crypto');
const { conTxGlobal } = require('./db');

const SESION_HORAS = 12;

function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pass, salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

function verificarPassword(pass, guardado) {
  const [alg, saltHex, hashHex] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const h = crypto.scryptSync(pass, Buffer.from(saltHex, 'hex'), 64);
  const esperado = Buffer.from(hashHex, 'hex');
  return h.length === esperado.length && crypto.timingSafeEqual(h, esperado);
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function login(email, pass) {
  return conTxGlobal(async (c) => {
    const { rows } = await c.query(
      `select u.id, u.rol, u.comercio_id, u.password_hash, u.activo, co.activo as comercio_activo
         from usuarios u left join comercios co on co.id = u.comercio_id
        where lower(u.email) = lower($1)`,
      [String(email || '')]
    );
    const u = rows[0];
    // Mismo costo y mismo mensaje si el usuario no existe, para no revelar qué emails están registrados.
    const ok = verificarPassword(String(pass || ''), u ? u.password_hash : 'scrypt$00$00');
    if (!u || !ok || !u.activo || (u.comercio_id && !u.comercio_activo)) return null;
    const token = crypto.randomBytes(32).toString('hex');
    await c.query(
      `insert into sesiones(token_hash, usuario_id, vence_en) values ($1,$2, now() + ($3 || ' hours')::interval)`,
      [sha(token), u.id, String(SESION_HORAS)]
    );
    return { token, rol: u.rol, comercioId: u.comercio_id };
  });
}

/** Middleware: exige sesión. El staff puede operar un comercio con el header x-comercio-id. */
async function requireAuth(req, res, next) {
  try {
    const m = /^Bearer (.+)$/.exec(req.header('authorization') || '');
    if (!m) return res.status(401).json({ ok: false, error: 'No autorizado' });
    const user = await conTxGlobal(async (c) => {
      const { rows } = await c.query(
        `select u.id, u.rol, u.comercio_id
           from sesiones s join usuarios u on u.id = s.usuario_id
          where s.token_hash = $1 and s.vence_en > now() and u.activo`,
        [sha(m[1])]
      );
      return rows[0];
    });
    if (!user) return res.status(401).json({ ok: false, error: 'Sesión vencida' });
    req.user = { id: user.id, rol: user.rol, comercioId: user.comercio_id };
    req.tokenHash = sha(m[1]);
    req.comercioId = user.rol === 'staff' ? req.header('x-comercio-id') || null : user.comercio_id;
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

const soloStaff = (req, res, next) =>
  req.user.rol === 'staff' ? next() : res.status(403).json({ ok: false, error: 'Solo el estudio puede hacer esto' });

const conComercio = (req, res, next) =>
  req.comercioId ? next() : res.status(400).json({ ok: false, error: 'Falta elegir el comercio (x-comercio-id)' });

module.exports = { hashPassword, verificarPassword, login, requireAuth, soloStaff, conComercio };
