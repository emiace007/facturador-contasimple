const { conTx, conTxGlobal } = require('./db');
const arca = require('./wsfe');

const COND_RECEPTOR_CF = 5;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una factura por vez por comercio/punto de venta/tipo: si salen dos a la vez ARCA puede rechazar por número repetido.
const colas = new Map();
function enSerie(clave, fn) {
  const prev = colas.get(clave) || Promise.resolve();
  const sig = prev.catch(() => {}).then(fn);
  colas.set(clave, sig);
  sig.finally(() => colas.get(clave) === sig && colas.delete(clave)).catch(() => {});
  return sig;
}

/** Monotributo -> C; RI -> A o B. Se valida acá además del frontend. */
function validarTipo(comercio, cbteTipo) {
  const permitidos = comercio.condicion_fiscal === 'monotributo' ? [11] : [1, 6];
  if (!permitidos.includes(cbteTipo)) {
    throw new Error(
      comercio.condicion_fiscal === 'monotributo'
        ? 'Un monotributista solo puede emitir Factura C.'
        : 'Un Responsable Inscripto solo puede emitir Factura A o B.'
    );
  }
}

function normalizar(d, comercio) {
  const cbteTipo = Number(d.cbteTipo ?? (comercio.condicion_fiscal === 'monotributo' ? 11 : 6));
  validarTipo(comercio, cbteTipo);
  const importe = Number(d.importe);
  if (!(importe > 0)) throw new Error('El importe tiene que ser mayor a 0.');
  const ptoVta = Number(d.ptoVta ?? comercio.punto_venta);
  if (!ptoVta) throw new Error('Falta el punto de venta.');
  const concepto = Number(d.concepto ?? 1);
  if (![1, 2, 3].includes(concepto)) throw new Error('Concepto inválido.');
  const docTipo = Number(d.docTipo ?? 99);
  const docNro = String(d.docNro ?? '0');
  if (cbteTipo === 1 && docTipo !== 80) throw new Error('La Factura A se emite a un CUIT.');
  if (docTipo !== 99 && !/^\d+$/.test(docNro)) throw new Error('Documento inválido.');
  return {
    cbteTipo, importe, ptoVta, concepto, docTipo, docNro,
    condIva: Number(d.condicionIvaReceptorId ?? COND_RECEPTOR_CF),
    alicuotaIva: cbteTipo === 11 ? undefined : Number(d.alicuotaIva ?? 21),
    fecha: d.fechaComprobante || null,
    receptorNombre: d.receptorNombre || null,
    items: Array.isArray(d.items) ? d.items : [],
    compradorId: d.compradorId && uuidRe.test(d.compradorId) ? d.compradorId : null,
  };
}

async function cargarComercio(comercioId) {
  return conTxGlobal(async (c) => {
    const { rows } = await c.query('select * from comercios where id = $1 and activo', [comercioId]);
    if (!rows[0]) throw new Error('Comercio inexistente o inactivo.');
    return rows[0];
  });
}

const aIsoFecha = (s) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s || null);

/** Crea el registro, pide el CAE a ARCA y lo deja emitida o con error. Devuelve la factura. */
async function emitir({ comercioId, usuarioId, datos, loteId = null, emisor = arca.solicitarCAE }) {
  const comercio = await cargarComercio(comercioId);
  const n = normalizar(datos, comercio);
  const hoy = new Date().toISOString().slice(0, 10);

  const id = await conTx(comercioId, async (c) => {
    const { rows } = await c.query(
      `insert into facturas(comercio_id, comprador_id, cbte_tipo, punto_venta, concepto, fecha_comprobante,
         doc_tipo, doc_nro, condicion_iva_receptor_id, receptor_nombre, importe_total, alicuota_iva, lote_id, creado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [comercioId, n.compradorId, n.cbteTipo, n.ptoVta, n.concepto, n.fecha || hoy, n.docTipo, n.docNro,
       n.condIva, n.receptorNombre, n.importe, n.alicuotaIva ?? null, loteId, usuarioId]
    );
    const fid = rows[0].id;
    for (const it of n.items) {
      await c.query(
        'insert into factura_items(factura_id, producto_id, descripcion, cantidad, precio_unitario) values ($1,$2,$3,$4,$5)',
        [fid, it.productoId && uuidRe.test(it.productoId) ? it.productoId : null, String(it.descripcion || 'Item'), Number(it.cantidad || 1), Number(it.precioUnitario || 0)]
      );
    }
    return fid;
  });

  try {
    // La factura se emite por cuenta del comercio: el CUIT representado es el del comercio.
    const r = await enSerie(`${comercioId}:${n.ptoVta}:${n.cbteTipo}`, () =>
      emisor({
        cuitRepresentada: comercio.cuit, ptoVta: n.ptoVta, cbteTipo: n.cbteTipo, concepto: n.concepto,
        docTipo: n.docTipo, docNro: n.docNro, importe: n.importe, alicuotaIva: n.alicuotaIva,
        condicionIvaReceptorId: n.condIva, fechaComprobante: n.fecha || undefined,
      })
    );
    return await conTx(comercioId, async (c) => {
      const { rows } = await c.query(
        `update facturas set estado='emitida', numero=$2, cae=$3, cae_vencimiento=$4, error=null,
           fecha_comprobante = coalesce($5::date, fecha_comprobante)
         where id=$1 returning *`,
        [id, r.numero, r.cae, aIsoFecha(r.caeVencimiento), aIsoFecha(r.fecha)]
      );
      return rows[0];
    });
  } catch (err) {
    return await conTx(comercioId, async (c) => {
      const { rows } = await c.query(`update facturas set estado='error', error=$2 where id=$1 returning *`, [id, String(err.message || err).slice(0, 500)]);
      return rows[0];
    });
  }
}

module.exports = { emitir, validarTipo };
