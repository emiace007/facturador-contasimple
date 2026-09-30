import type { AbonoHonorario, ConfigHonorarios } from '../types/honorarios';
import { formatMoney } from './format';

export const MEDIOS_PAGO: { value: 'transferencia' | 'mercadopago' | 'efectivo'; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'efectivo', label: 'Efectivo' },
];

export function periodoActual(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function hoyIso(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function nombrePeriodo(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) return periodo;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fechaCorta(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? d + '/' + m + '/' + y : iso;
}

/** Teléfono argentino a formato wa.me (549 + característica + número, sin 0 ni 15). */
export function telefonoWhatsapp(tel: string): string {
  let t = String(tel || '').replace(/\D/g, '');
  if (!t) return '';
  if (t.startsWith('549')) return t;
  if (t.startsWith('54')) t = t.slice(2);
  if (t.startsWith('0')) t = t.slice(1);
  t = t.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  return '549' + t;
}

/** Mensaje de recordatorio de pago para WhatsApp. */
export function mensajeRecordatorio(a: Pick<AbonoHonorario, 'cliente' | 'saldo' | 'diaVencimiento'>, cfg: ConfigHonorarios): string {
  const nombre = (a.cliente || '').split(' ').slice(-1)[0] || a.cliente;
  const lineas = [
    'Hola ' + capitalizar(nombre) + ', ¿cómo estás? Te escribimos del Estudio Contable Bertero.',
    '',
    'Te recordamos que el saldo de honorarios pendiente es de ' + formatMoney(a.saldo) + '.',
  ];
  const pago: string[] = [];
  if (cfg.alias) pago.push('• Alias: ' + cfg.alias);
  if (cfg.cbu) pago.push('• CBU: ' + cfg.cbu);
  if (cfg.titular && (cfg.alias || cfg.cbu)) pago.push('• Titular: ' + cfg.titular);
  if (cfg.mpLink) pago.push('• Mercado Pago: ' + cfg.mpLink);
  if (pago.length) lineas.push('', 'Podés abonarlo por:', ...pago);
  lineas.push('', 'Cuando lo abones, mandanos el comprobante por acá. ¡Gracias!');
  return lineas.join('\n');
}

export function linkWhatsapp(telefono: string, mensaje: string): string {
  const num = telefonoWhatsapp(telefono);
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(mensaje);
}

function capitalizar(s: string): string {
  const t = s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
