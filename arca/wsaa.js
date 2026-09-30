const forge = require('node-forge');
const config = require('./config');
const { soapRequest } = require('./soapClient');

/**
 * Login contra WSAA (Web Service de Autenticación y Autorización) de ARCA.
 *
 * Flujo:
 *  1. Armar un "Login Ticket Request" (XML con un id único y una ventana de
 *     tiempo válida).
 *  2. Firmarlo como CMS/PKCS#7 (SignedData, no detached) con el certificado y
 *     la clave privada ÚNICOS del estudio.
 *  3. Mandarlo por SOAP a WSAA; ARCA devuelve un token + sign válidos por
 *     ~12hs, que sirven para cualquier cliente que haya delegado el servicio
 *     al CUIT del estudio (el CUIT representado se indica después, en cada
 *     llamada a WSFE, no acá).
 *
 * NOTA para quien retome este código: no se pudo ejecutar ni probar en esta
 * sesión (el sandbox de ejecución estaba caído por un problema de entorno).
 * La estructura sigue la documentación oficial y las implementaciones de
 * referencia más usadas, pero conviene loguear la respuesta cruda de WSAA la
 * primera vez que se pruebe con un certificado real, por si el formato de
 * fecha o el digestAlgorithm necesitan un ajuste fino.
 */

// Cache en memoria por servicio ("wsfe"), válido mientras el proceso esté vivo.
const cache = new Map();

function buildLoginTicketRequest(service) {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

function signCms(xml) {
  if (!config.CERT_PEM || !config.KEY_PEM) {
    throw new Error(
      'Falta AFIP_CERT_PEM o AFIP_KEY_PEM en las variables de entorno (ver .env.example y SETUP_ARCA.md).'
    );
  }

  const cert = forge.pki.certificateFromPem(config.CERT_PEM);
  const key = forge.pki.privateKeyFromPem(config.KEY_PEM);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function login(service = 'wsfe') {
  const cached = cache.get(service);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const ltr = buildLoginTicketRequest(service);
  const cms = signCms(ltr);

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.afip.gov.ar/">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const { status, body } = await soapRequest(config.WSAA_URL, '', envelope);

  if (status !== 200) {
    throw new Error(`WSAA respondió HTTP ${status}: ${body}`);
  }

  // La respuesta viene con el XML interno "escapado" (&lt;token&gt;...).
  const tokenMatch = body.match(/&lt;token&gt;([\s\S]*?)&lt;\/token&gt;/);
  const signMatch = body.match(/&lt;sign&gt;([\s\S]*?)&lt;\/sign&gt;/);
  const expMatch = body.match(/&lt;expirationTime&gt;([\s\S]*?)&lt;\/expirationTime&gt;/);
  const faultMatch = body.match(/<faultstring>([\s\S]*?)<\/faultstring>/);

  if (!tokenMatch || !signMatch) {
    throw new Error(
      `No se pudo obtener token/sign de WSAA. ${faultMatch ? 'Detalle: ' + faultMatch[1] : 'Respuesta cruda: ' + body}`
    );
  }

  const result = {
    token: tokenMatch[1],
    sign: signMatch[1],
    // Restamos 1 minuto de margen a la expiración real que informó ARCA.
    expiresAt: expMatch ? new Date(expMatch[1]).getTime() - 60_000 : Date.now() + 11 * 60 * 60 * 1000,
  };

  cache.set(service, result);
  return result;
}

module.exports = { login };
