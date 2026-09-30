require('dotenv').config();

/**
 * Acepta el PEM tal cual (con saltos de línea reales) o codificado en base64,
 * por si el hosting elegido no admite bien variables de entorno multilínea.
 */
function decodeMaybeBase64Pem(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN')) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    return decoded.includes('BEGIN') ? decoded : trimmed;
  } catch {
    return trimmed;
  }
}

const ENV = (process.env.AFIP_ENV || 'homologacion').toLowerCase();

const WSAA_URL =
  ENV === 'produccion'
    ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
    : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';

const WSFE_URL =
  ENV === 'produccion'
    ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
    : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

module.exports = {
  ENV,
  WSAA_URL,
  WSFE_URL,
  CERT_PEM: decodeMaybeBase64Pem(process.env.AFIP_CERT_PEM),
  KEY_PEM: decodeMaybeBase64Pem(process.env.AFIP_KEY_PEM),
  BACKEND_API_KEY: process.env.BACKEND_API_KEY || '',
  PORT: process.env.PORT || 3000,
};
