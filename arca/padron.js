const config = require('./config');
const { login } = require('./wsaa');
const { soapRequest } = require('./soapClient');

/**
 * Consulta al padrón de ARCA: servicio "Constancia de Inscripción" (ws_sr_constancia_inscripcion,
 * operación getPersona_v2). Con un CUIT devuelve nombre/razón social, domicilio fiscal,
 * condición frente al IVA y categoría de Monotributo.
 *
 * Requisito en ARCA: el computador fiscal del estudio tiene que tener asociado el servicio
 * "ws_sr_constancia_inscripcion" (Administrador de Relaciones de Clave Fiscal).
 */
const SERVICE = 'ws_sr_constancia_inscripcion';

const PADRON_URL =
  config.ENV === 'produccion'
    ? 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5'
    : 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5';

// CUIT titular del certificado (quien consulta). Se puede cambiar con AFIP_CUIT_ESTUDIO.
const CUIT_CONSULTANTE = String(process.env.AFIP_CUIT_ESTUDIO || '27386453824').replace(/\D/g, '');

function tagAll(xml, name) {
  const re = new RegExp('<(?:\\w+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + name + '>', 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function tag(xml, name) {
  const all = tagAll(xml || '', name);
  return all.length ? decode(all[0].trim()) : '';
}
function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function consultarPadron(cuit) {
  const idPersona = String(cuit || '').replace(/\D/g, '');
  if (idPersona.length !== 11) throw new Error('CUIT inválido: tiene que tener 11 dígitos.');

  const { token, sign } = await login(SERVICE);

  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">' +
    '<soapenv:Header/><soapenv:Body><a5:getPersona_v2>' +
    '<token>' + token + '</token>' +
    '<sign>' + sign + '</sign>' +
    '<cuitRepresentada>' + CUIT_CONSULTANTE + '</cuitRepresentada>' +
    '<idPersona>' + idPersona + '</idPersona>' +
    '</a5:getPersona_v2></soapenv:Body></soapenv:Envelope>';

  const { status, body } = await soapRequest(PADRON_URL, '', envelope);

  const fault = tag(body, 'faultstring');
  if (fault) throw new Error('ARCA padrón: ' + fault);
  if (status !== 200) throw new Error('ARCA padrón respondió HTTP ' + status);

  const generales = tagAll(body, 'datosGenerales')[0] || '';
  const monotributo = tagAll(body, 'datosMonotributo')[0] || '';
  const regimenGeneral = tagAll(body, 'datosRegimenGeneral')[0] || '';
  const errorConstancia = tagAll(body, 'errorConstancia')[0] || '';

  if (!generales) {
    const errores = tagAll(errorConstancia || body, 'error').map((e) => decode(e.trim()));
    throw new Error(errores.length ? errores.join(' / ') : 'No se encontraron datos para ese CUIT.');
  }

  const domicilio = tagAll(generales, 'domicilioFiscal')[0] || '';
  const impuestosRG = tagAll(regimenGeneral, 'impuesto').map((i) => ({
    id: Number(tag(i, 'idImpuesto')),
    descripcion: tag(i, 'descripcionImpuesto'),
  }));
  const idsRG = impuestosRG.map((i) => i.id);
  const categoriaMono = tagAll(monotributo, 'categoriaMonotributo')[0] || '';

  let condicionIva = 'Consumidor Final';
  let condicionIvaId = 5;
  if (monotributo) {
    condicionIva = 'Responsable Monotributo';
    condicionIvaId = 6;
  } else if (idsRG.includes(30)) {
    condicionIva = 'IVA Responsable Inscripto';
    condicionIvaId = 1;
  } else if (idsRG.includes(32)) {
    condicionIva = 'IVA Sujeto Exento';
    condicionIvaId = 4;
  }

  const apellido = tag(generales, 'apellido');
  const nombre = tag(generales, 'nombre');
  const razonSocial = tag(generales, 'razonSocial');
  const actividades = tagAll(regimenGeneral || monotributo, 'actividad').map((a) => ({
    id: tag(a, 'idActividad'),
    descripcion: tag(a, 'descripcionActividad'),
    orden: Number(tag(a, 'orden')) || 0,
  }));
  actividades.sort((a, b) => a.orden - b.orden);

  return {
    cuit: idPersona,
    tipoPersona: tag(generales, 'tipoPersona'),
    denominacion: razonSocial || [apellido, nombre].filter(Boolean).join(' '),
    apellido,
    nombre,
    razonSocial,
    estadoClave: tag(generales, 'estadoClave'),
    domicilio: {
      direccion: tag(domicilio, 'direccion'),
      localidad: tag(domicilio, 'localidad'),
      codigoPostal: tag(domicilio, 'codPostal'),
      provincia: tag(domicilio, 'descripcionProvincia'),
    },
    condicionIva,
    condicionIvaId,
    categoriaMonotributo: tag(categoriaMono, 'descripcionCategoria'),
    impuestos: impuestosRG,
    actividadPrincipal: actividades.length ? actividades[0].descripcion : '',
    observaciones: tagAll(errorConstancia, 'error').map((e) => decode(e.trim())),
  };
}

module.exports = { consultarPadron };
