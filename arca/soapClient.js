const https = require('https');
const { URL } = require('url');

/**
 * POST SOAP genérico contra un endpoint de ARCA (WSAA o WSFEv1).
 * Devuelve { status, body } sin parsear: cada cliente (wsaa.js / wsfe.js)
 * sabe qué etiquetas buscar en su propia respuesta.
 */
function soapRequest(url, soapAction, bodyXml) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, port, protocol } = new URL(url);
    const payload = Buffer.from(bodyXml, 'utf8');

    const options = {
      hostname,
      path: pathname,
      ciphers: 'DEFAULT@SECLEVEL=1',
      port: port || (protocol === 'https:' ? 443 : 80),
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': payload.length,
        SOAPAction: soapAction,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { soapRequest };
