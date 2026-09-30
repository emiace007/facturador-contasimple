const express = require('express');
const config = require('./config');
const { solicitarCAE, ultimoAutorizado } = require('./wsfe');
const { consultarPadron } = require('./padron');

const app = express();
app.use(express.json());

// Protección simple por API key compartida (la usa el Apps Script del sistema principal).
// Si no se configuró BACKEND_API_KEY, queda abierto: solo pensado para probar en local.
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (!config.BACKEND_API_KEY) return next();
  if (req.header('x-api-key') !== config.BACKEND_API_KEY) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: config.ENV });
});

/** GET /api/facturas/ultimo?cuit=...&ptoVta=...&cbteTipo=11 */
app.get('/api/facturas/ultimo', async (req, res) => {
  try {
    const { cuit, ptoVta, cbteTipo } = req.query;
    if (!cuit || !ptoVta || !cbteTipo) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: cuit, ptoVta, cbteTipo' });
    }
    const data = await ultimoAutorizado({
      cuitRepresentada: String(cuit),
      ptoVta: Number(ptoVta),
      cbteTipo: Number(cbteTipo),
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * POST /api/facturas
 * body: { cuitRepresentada, ptoVta, cbteTipo?, concepto?, docTipo?, docNro, importe,
 *         fechaServicioDesde?, fechaServicioHasta?, fechaVtoPago? }
 */
app.post('/api/facturas', async (req, res) => {
  try {
    const {
      cuitRepresentada,
      ptoVta,
      cbteTipo,
      concepto,
      docTipo,
      docNro,
      importe,
      alicuotaIva,
      condicionIvaReceptorId,
      fechaServicioDesde,
      fechaServicioHasta,
      fechaVtoPago,
      fechaComprobante,
    } = req.body || {};

    if (!cuitRepresentada || !ptoVta || !importe || !docNro) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan datos obligatorios: cuitRepresentada, ptoVta, docNro, importe.',
      });
    }

    const data = await solicitarCAE({
      cuitRepresentada: String(cuitRepresentada),
      ptoVta: Number(ptoVta),
      cbteTipo: cbteTipo !== undefined ? Number(cbteTipo) : undefined,
      concepto: concepto !== undefined ? Number(concepto) : undefined,
      docTipo: docTipo !== undefined ? Number(docTipo) : undefined,
      docNro: String(docNro),
      importe: Number(importe),
      alicuotaIva: alicuotaIva !== undefined ? Number(alicuotaIva) : undefined,
      condicionIvaReceptorId: condicionIvaReceptorId !== undefined ? Number(condicionIvaReceptorId) : undefined,
      fechaServicioDesde,
      fechaServicioHasta,
      fechaVtoPago,
      fechaComprobante,
    });

    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
});

/** GET /api/padron?cuit=20123456789 -> datos de la constancia de inscripción en ARCA. */
app.get('/api/padron', async (req, res) => {
  try {
    const data = await consultarPadron(String(req.query.cuit || ''));
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
});

app.listen(config.PORT, () => {
  console.log(`AFIP backend (${config.ENV}) escuchando en :${config.PORT}`);
});
