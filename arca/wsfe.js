const config = require('./config');
const { login } = require('./wsaa');
const { soapRequest } = require('./soapClient');

/**
 * Cliente de WSFEv1 (Web Service de Facturación Electrónica) de ARCA.
 *
 * `cuitRepresentada` es el CUIT del CLIENTE por el que se factura. El
 * certificado y el token/sign son siempre los del estudio (27-38645382-4);
 * lo que habilita facturar "para" otro CUIT es que ese cliente haya delegado
 * el servicio "wsfe" al CUIT del estudio (ver SETUP_ARCA.md, paso 4). Si no
 * lo delegó, ARCA responde con un error de autorización.
 *
 * Igual que wsaa.js: código no ejecutado todavía en esta sesión por la caída
 * del sandbox. Antes de usarlo con un certificado real, conviene loguear
 * `body` crudo de cada respuesta para ajustar los nombres de tag si ARCA
 * cambió algo en su WSDL.
 */

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function extractAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

function fechaAfip(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// Códigos de alícuota de IVA que usa ARCA (WSFEv1 - tabla FEParamGetTiposIva).
// Sólo se listan las que realmente se usan en el estudio.
const ALICUOTA_IVA_ID = {
  0: 3, // 0%
  10.5: 4, // 10.5%
  21: 5, // 21%
  27: 6, // 27%
};

/**
 * Arma el detalle de IVA discriminado para Factura A (cbteTipo=1), a partir de
 * un importe TOTAL y una alícuota en %. Devuelve { neto, iva, xml } donde xml
 * es el bloque <ar:Iva> listo para insertar en FECAEDetRequest.
 */
function calcularIva(importeTotal, alicuotaPct) {
  const id = ALICUOTA_IVA_ID[alicuotaPct];
  if (!id) {
    throw new Error(
      `Alícuota de IVA no soportada: ${alicuotaPct}%. Válidas: ${Object.keys(ALICUOTA_IVA_ID).join(', ')}%.`
    );
  }
  const neto = Number((importeTotal / (1 + alicuotaPct / 100)).toFixed(2));
  const iva = Number((importeTotal - neto).toFixed(2));
  const xml = `
            <ar:Iva>
              <ar:AlicIva>
                <ar:Id>${id}</ar:Id>
                <ar:BaseImp>${neto.toFixed(2)}</ar:BaseImp>
                <ar:Importe>${iva.toFixed(2)}</ar:Importe>
              </ar:AlicIva>
            </ar:Iva>`;
  return { neto, iva, xml };
}

// Condición frente al IVA del receptor (RG 5616/2024). Se volvió obligatoria
// desde el 01/12/2026; hasta esa fecha ARCA la acepta como dato no excluyente.
// Ver método FEParamGetCondicionIvaReceptor para la tabla oficial completa.
const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1, // Factura A/M/C
  EXENTO: 4, // Factura B/C
  CONSUMIDOR_FINAL: 5, // Factura B/C
  MONOTRIBUTO: 6, // Factura A/M/C
  NO_CATEGORIZADO: 7, // Factura B/C
  PROVEEDOR_EXTERIOR: 8, // Factura B/C
  CLIENTE_EXTERIOR: 9, // Factura B/C
  IVA_LIBERADO_LEY_19640: 10, // Factura B/C
  MONOTRIBUTO_SOCIAL: 13, // Factura A/M/C
  IVA_NO_ALCANZADO: 15, // Factura B/C
  MONOTRIBUTO_TRABAJADOR_PROMOVIDO: 16, // Factura A/M/C
};

/** Normaliza una fecha 'YYYY-MM-DD' o 'YYYYMMDD' a 'YYYYMMDD' (o null si no es válida). */
function normalizarFecha(f) {
  if (!f) return null;
  const s = String(f).replace(/-/g, '');
  return /^\d{8}$/.test(s) ? s : null;
}

function fechaDesdeAfip(s) {
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

function fechaLegible(s) {
  return s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4);
}

/** Fecha (CbteFch) de un comprobante ya autorizado. */
async function fechaComprobanteAutorizado({ cuitRepresentada, ptoVta, cbteTipo, numero }) {
  const { token, sign } = await login('wsfe');
  const envelope = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">' +
    '<soapenv:Header/><soapenv:Body><ar:FECompConsultar><ar:Auth>' +
    '<ar:Token>' + token + '</ar:Token><ar:Sign>' + sign + '</ar:Sign><ar:Cuit>' + cuitRepresentada + '</ar:Cuit>' +
    '</ar:Auth><ar:FeCompConsReq><ar:CbteTipo>' + cbteTipo + '</ar:CbteTipo><ar:CbteNro>' + numero + '</ar:CbteNro>' +
    '<ar:PtoVta>' + ptoVta + '</ar:PtoVta></ar:FeCompConsReq></ar:FECompConsultar></soapenv:Body></soapenv:Envelope>';
  const { status, body } = await soapRequest(config.WSFE_URL, 'http://ar.gov.afip.dif.FEV1/FECompConsultar', envelope);
  if (status !== 200) return null;
  return extractTag(body, 'CbteFch');
}

/** Último número de comprobante autorizado para un punto de venta + tipo de comprobante. */
async function ultimoAutorizado({ cuitRepresentada, ptoVta, cbteTipo }) {
  const { token, sign } = await login('wsfe');

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuitRepresentada}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${ptoVta}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const { status, body } = await soapRequest(
    config.WSFE_URL,
    'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
    envelope
  );
  if (status !== 200) throw new Error(`WSFE respondió HTTP ${status}: ${body}`);

  const cbteNro = extractTag(body, 'CbteNro');
  const errMsg = extractTag(body, 'Msg');
  if (cbteNro === null && errMsg) throw new Error(`WSFE rechazó la consulta: ${errMsg}`);

  return { ultimoNumero: Number(cbteNro || 0) };
}

/**
 * Pide el CAE para UNA factura (numera automáticamente a partir del último
 * comprobante autorizado). Por defecto arma una Factura C (cbteTipo 11) de
 * servicios, el caso más común para honorarios a un cliente monotributista.
 */
async function solicitarCAE({
  cuitRepresentada,
  ptoVta,
  cbteTipo = 11, // 11 = Factura C
  concepto = 2, // 1=Productos, 2=Servicios, 3=Productos y Servicios
  docTipo = 80, // 80=CUIT, 96=DNI, 99=Consumidor Final
  docNro,
  importe,
  alicuotaIva, // Sólo para Factura A (cbteTipo=1): 21, 10.5, 27 o 0.
  condicionIvaReceptorId, // Ver CONDICION_IVA_RECEPTOR. Si no se manda, se infiere abajo.
  fechaServicioDesde,
  fechaServicioHasta,
  fechaVtoPago,
  fechaComprobante, // 'YYYY-MM-DD' o 'YYYYMMDD'. Si no se manda, se usa la fecha de hoy.
}) {
  if (!cuitRepresentada || !ptoVta || !docNro || !importe) {
    throw new Error('Faltan datos obligatorios: cuitRepresentada, ptoVta, docNro, importe.');
  }

  // Si el frontend no mandó explícitamente la condición frente al IVA del
  // receptor, se infiere con una regla simple: Consumidor Final si el
  // documento es 99, Responsable Inscripto si es Factura A (siempre se emite
  // a RI), y Consumidor Final como fallback general. Conviene que el
  // frontend siempre la mande explícita para no depender de esta inferencia.
  const condIvaReceptorId =
    condicionIvaReceptorId ??
    (Number(docTipo) === 99
      ? CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL
      : Number(cbteTipo) === 1
      ? CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO
      : CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL);

  // Factura A discrimina IVA siempre (default 21% si no se especificó otra
  // alícuota). Factura B también lo hace, pero sólo si se pasó una alícuota
  // explícita: pasa cuando el receptor de la B es Responsable Inscripto
  // (p.ej. una SAS), aunque no sea la práctica más común para Factura B a
  // consumidor final/monotributista. Factura C nunca discrimina.
  const esFacturaA = Number(cbteTipo) === 1;
  const esFacturaB = Number(cbteTipo) === 6;
  const ivaDetalle = esFacturaA
    ? calcularIva(Number(importe), alicuotaIva ?? 21)
    : esFacturaB && alicuotaIva !== undefined
    ? calcularIva(Number(importe), alicuotaIva)
    : null;

  const { token, sign } = await login('wsfe');
  const { ultimoNumero } = await ultimoAutorizado({ cuitRepresentada, ptoVta, cbteTipo });
  const numero = ultimoNumero + 1;
  const hoyReal = fechaAfip();
  let hoy = hoyReal;
  if (fechaComprobante) {
    const f = normalizarFecha(fechaComprobante);
    if (!f) throw new Error('Fecha de la factura inválida.');
    // ARCA permite hasta 5 días antes o después para productos y hasta 10 para servicios.
    const margen = Number(concepto) === 1 ? 5 : 10;
    const dias = Math.round((fechaDesdeAfip(f) - fechaDesdeAfip(hoyReal)) / 86400000);
    if (Math.abs(dias) > margen) {
      throw new Error('La fecha de la factura puede estar hasta ' + margen + ' días antes o después de hoy (' + (Number(concepto) === 1 ? 'productos' : 'servicios') + ').');
    }
    // Tampoco puede ser anterior a la última factura del mismo punto de venta y tipo.
    if (ultimoNumero > 0) {
      const fUltima = await fechaComprobanteAutorizado({ cuitRepresentada, ptoVta, cbteTipo, numero: ultimoNumero });
      if (fUltima && f < fUltima) {
        throw new Error('La fecha no puede ser anterior a la última factura de ese punto de venta (' + fechaLegible(fUltima) + ').');
      }
    }
    hoy = f;
  }
  const importeStr = Number(importe).toFixed(2);
  const impNetoStr = (ivaDetalle ? ivaDetalle.neto : Number(importe)).toFixed(2);
  const impIvaStr = (ivaDetalle ? ivaDetalle.iva : 0).toFixed(2);
  const bloqueIva = ivaDetalle ? ivaDetalle.xml : '';

  // Los campos de período de servicio son obligatorios cuando Concepto es
  // Servicios (2) o Productos y Servicios (3).
  const camposServicio =
    concepto === 1
      ? ''
      : `
            <ar:FchServDesde>${fechaServicioDesde || hoy}</ar:FchServDesde>
            <ar:FchServHasta>${fechaServicioHasta || hoy}</ar:FchServHasta>
            <ar:FchVtoPago>${fechaVtoPago && fechaVtoPago >= hoy ? fechaVtoPago : hoy}</ar:FchVtoPago>`;

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuitRepresentada}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${ptoVta}</ar:PtoVta>
          <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${concepto}</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${numero}</ar:CbteDesde>
            <ar:CbteHasta>${numero}</ar:CbteHasta>
            <ar:CbteFch>${hoy}</ar:CbteFch>
            <ar:ImpTotal>${importeStr}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${impNetoStr}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${impIvaStr}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>${camposServicio}${bloqueIva}
            <ar:CondicionIVAReceptorId>${condIvaReceptorId}</ar:CondicionIVAReceptorId>
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const { status, body } = await soapRequest(
    config.WSFE_URL,
    'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
    envelope
  );
  if (status !== 200) throw new Error(`WSFE respondió HTTP ${status}: ${body}`);

  const resultado = extractTag(body, 'Resultado');
  const cae = extractTag(body, 'CAE');
  const caeFchVto = extractTag(body, 'CAEFchVto');
  const observaciones = extractAll(body, 'Msg');

  if (resultado !== 'A' || !cae) {
    throw new Error(
      `ARCA no aprobó el comprobante (Resultado=${resultado || '?'}): ${
        observaciones.join(' | ') || 'sin detalle en la respuesta'
      }`
    );
  }

  return {
    numero,
    ptoVta,
    cbteTipo,
    cae,
    caeVencimiento: caeFchVto,
    resultado,
    fecha: hoy,
  };
}

module.exports = { ultimoAutorizado, solicitarCAE, CONDICION_IVA_RECEPTOR };
