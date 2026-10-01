// PDF de la factura (formato ARCA) con el código QR obligatorio (RG 4892).
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const config = require('./config');

const LETRA = { 1: 'A', 6: 'B', 11: 'C' };
const COND_IVA = {
  1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo',
  7: 'Sujeto No Categorizado', 8: 'Proveedor del Exterior', 9: 'Cliente del Exterior', 10: 'IVA Liberado – Ley N° 19.640',
  13: 'Monotributista Social', 15: 'IVA No Alcanzado', 16: 'Monotributo Trabajador Independiente Promovido',
};
const DOC = { 80: 'CUIT', 86: 'CUIL', 87: 'CDI', 96: 'DNI', 99: 'Consumidor Final' };
const CONCEPTO = { 1: 'Productos', 2: 'Servicios', 3: 'Productos y servicios' };

const pad = (n, l) => String(n ?? '').padStart(l, '0');
const fechaAr = (d) => {
  if (!d) return '';
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return s.split('-').reverse().join('/');
};
const fechaIso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));
const plata = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cant = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
const cuitFmt = (c) => (c && /^\d{11}$/.test(c) ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c || '');

/** URL del QR según la especificación de ARCA. */
function urlQR(f, comercio) {
  const datos = {
    ver: 1,
    fecha: fechaIso(f.fecha_comprobante),
    cuit: Number(comercio.cuit),
    ptoVta: Number(f.punto_venta),
    tipoCmp: Number(f.cbte_tipo),
    nroCmp: Number(f.numero),
    importe: Number(f.importe_total),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(f.doc_tipo),
    nroDocRec: Number(f.doc_nro || 0),
    tipoCodAut: 'E',
    codAut: Number(f.cae),
  };
  return 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(datos)).toString('base64');
}

async function generarPdf({ factura: f, items, comercio }) {
  if (f.estado !== 'emitida') throw Object.assign(new Error('La factura no está emitida.'), { status: 400 });
  const qr = await QRCode.toBuffer(urlQR(f, comercio), { margin: 0, width: 300, errorCorrectionLevel: 'M' });

  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `Factura ${LETRA[f.cbte_tipo]} ${pad(f.punto_venta, 5)}-${pad(f.numero, 8)}` } });
  const partes = [];
  doc.on('data', (b) => partes.push(b));
  const fin = new Promise((ok) => doc.on('end', () => ok(Buffer.concat(partes))));

  const W = doc.page.width, M = 36, ancho = W - M * 2;
  const gris = '#475569', linea = '#cbd5e1';
  const letra = LETRA[f.cbte_tipo] || '?';
  const discrimina = f.cbte_tipo === 1;

  // Marca de agua en homologación
  if (config.ENV !== 'produccion') {
    doc.save().rotate(-35, { origin: [W / 2, 420] }).fontSize(46).fillColor('#ef4444').opacity(0.12)
      .text('SIN VALIDEZ FISCAL', 0, 380, { width: W, align: 'center' })
      .fontSize(22).text('Comprobante de prueba (homologación)', 0, 440, { width: W, align: 'center' })
      .restore().opacity(1);
  }

  // ---- Encabezado ----
  const top = M, altoEnc = 130;
  doc.lineWidth(0.8).strokeColor(linea).rect(M, top, ancho, altoEnc).stroke();
  doc.moveTo(W / 2, top + 46).lineTo(W / 2, top + altoEnc).stroke();
  // Recuadro de la letra
  const lx = W / 2 - 23;
  doc.rect(lx, top, 46, 46).fillAndStroke('#ffffff', linea);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(26).text(letra, lx, top + 6, { width: 46, align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor(gris).text(`COD. ${pad(f.cbte_tipo, 3)}`, lx, top + 36, { width: 46, align: 'center' });

  // Emisor (izquierda)
  const izq = M + 12, anchoIzq = W / 2 - M - 40;
  const fantasia = comercio.nombre_fantasia && comercio.nombre_fantasia.trim();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(fantasia ? 15 : 14).text(fantasia || comercio.razon_social, izq, top + 12, { width: anchoIzq });
  if (fantasia) doc.font('Helvetica').fontSize(9).fillColor(gris).text(comercio.razon_social, izq, doc.y + 1, { width: anchoIzq });
  doc.font('Helvetica').fontSize(8.5).fillColor(gris);
  let y = Math.max(doc.y + 8, top + 58);
  const fila = (k, v, x, w) => {
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(k + ' ', x, y, { continued: true, width: w })
      .font('Helvetica').fillColor(gris).text(v || '—');
    y = doc.y + 3;
  };
  fila('Domicilio comercial:', comercio.domicilio, izq, anchoIzq);
  fila('Condición frente al IVA:', comercio.condicion_fiscal === 'monotributo' ? 'Responsable Monotributo' : 'IVA Responsable Inscripto', izq, anchoIzq);

  // Comprobante (derecha)
  const der = W / 2 + 34, anchoDer = W / 2 - M - 44;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text('FACTURA', der, top + 12, { width: anchoDer });
  doc.fontSize(8.5);
  y = top + 36;
  fila('Punto de venta:', `${pad(f.punto_venta, 5)}    Comp. Nro: ${pad(f.numero, 8)}`, der, anchoDer);
  fila('Fecha de emisión:', fechaAr(f.fecha_comprobante), der, anchoDer);
  fila('CUIT:', cuitFmt(comercio.cuit), der, anchoDer);
  fila('Ingresos Brutos:', comercio.iibb || cuitFmt(comercio.cuit), der, anchoDer);
  fila('Inicio de actividades:', fechaAr(comercio.inicio_actividades), der, anchoDer);

  // ---- Receptor ----
  y = top + altoEnc + 10;
  const altoRec = 52;
  doc.rect(M, y, ancho, altoRec).stroke();
  const yRec = y + 9;
  y = yRec;
  doc.fontSize(8.5);
  const docTxt = f.doc_tipo === 99 ? 'Consumidor Final' : `${DOC[f.doc_tipo] || 'Doc.'} ${f.doc_tipo === 80 ? cuitFmt(f.doc_nro) : f.doc_nro}`;
  fila('Receptor:', f.receptor_nombre || (f.doc_tipo === 99 ? 'Consumidor Final' : ''), izq, anchoIzq);
  fila('Condición frente al IVA:', COND_IVA[f.condicion_iva_receptor_id] || '', izq, anchoIzq);
  y = yRec;
  fila('Documento:', docTxt, der, anchoDer);
  fila('Condición de venta:', 'Contado', der, anchoDer);
  fila('Concepto:', CONCEPTO[f.concepto] || '', der, anchoDer);

  // ---- Detalle ----
  y = top + altoEnc + 10 + altoRec + 14;
  const cols = discrimina
    ? [['Descripción', 225, 'left'], ['Cantidad', 60, 'right'], ['Precio unit.', 100, 'right'], ['Subtotal', 122, 'right']]
    : [['Descripción', 255, 'left'], ['Cantidad', 60, 'right'], ['Precio unit.', 92, 'right'], ['Subtotal', 100, 'right']];
  doc.rect(M, y, ancho, 18).fill('#e2e8f0');
  let x = M + 8;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
  cols.forEach(([t, w, a]) => { doc.text(t, x, y + 5, { width: w - 8, align: a }); x += w; });
  y += 24;

  const alic = Number(f.alicuota_iva || 21);
  const factor = discrimina ? 1 + alic / 100 : 1; // en la A los precios se muestran sin IVA
  const lista = items.length ? items : [{ descripcion: 'Importe', cantidad: 1, precio_unitario: f.importe_total }];
  doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a');
  for (const it of lista) {
    const pu = Number(it.precio_unitario) / factor;
    const sub = pu * Number(it.cantidad);
    x = M + 8;
    const vals = [it.descripcion, cant(it.cantidad), plata(pu), plata(sub)];
    const altoFila = doc.heightOfString(String(vals[0]), { width: cols[0][1] - 8 });
    vals.forEach((v, i) => { doc.text(String(v), x, y, { width: cols[i][1] - 8, align: cols[i][2] }); x += cols[i][1]; });
    y += Math.max(altoFila, 11) + 6;
    doc.moveTo(M, y - 3).lineTo(M + ancho, y - 3).strokeColor('#f1f5f9').stroke();
    if (y > 640) { doc.addPage(); y = M; }
  }

  // ---- Totales ----
  y = Math.max(y + 10, 560);
  const tx = M + ancho - 230;
  doc.strokeColor(linea).rect(tx, y, 230, discrimina ? 70 : 34).stroke();
  let ty = y + 8;
  const total = Number(f.importe_total);
  const totalFila = (k, v, fuerte) => {
    doc.font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 11 : 9).fillColor('#0f172a')
      .text(k, tx + 10, ty, { width: 120 }).text(v, tx + 110, ty, { width: 110, align: 'right' });
    ty += fuerte ? 18 : 15;
  };
  if (discrimina) {
    const neto = total / factor;
    totalFila('Importe neto gravado:', plata(neto));
    totalFila(`IVA ${String(alic).replace('.', ',')}%:`, plata(total - neto));
  }
  totalFila('Importe total:', plata(total), true);

  if (f.cbte_tipo === 6) {
    const neto = total / (1 + alic / 100);
    doc.font('Helvetica').fontSize(7.5).fillColor(gris)
      .text(`Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) — IVA contenido: ${plata(total - neto)}`, M, y + 8, { width: ancho - 250 });
  }

  // ---- Pie: QR + CAE ----
  const py = 690;
  doc.moveTo(M, py - 10).lineTo(M + ancho, py - 10).strokeColor(linea).stroke();
  doc.image(qr, M, py, { width: 88, height: 88 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('ARCA', M + 100, py + 4);
  doc.font('Helvetica-Bold').fontSize(9).text('Comprobante autorizado', M + 100, py + 20);
  doc.font('Helvetica').fontSize(7).fillColor(gris)
    .text('Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación.', M + 100, py + 34, { width: 230 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
    .text(`CAE N°: ${f.cae}`, M + ancho - 200, py + 18, { width: 200, align: 'right' })
    .text(`Vencimiento CAE: ${fechaAr(f.cae_vencimiento)}`, M + ancho - 200, py + 34, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text('Emitido con ContaSimple', M, py + 80, { width: ancho, align: 'right', lineBreak: false });

  doc.end();
  return fin;
}

module.exports = { generarPdf, urlQR };
