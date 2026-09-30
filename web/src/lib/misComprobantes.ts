import * as XLSX from 'xlsx';

/** Un comprobante emitido, normalizado desde el archivo de "Mis Comprobantes" de ARCA. */
export interface ComprobanteArca {
  fecha: string; // yyyy-MM-dd
  tipo: number;
  tipoNombre: string;
  ptoVta: number;
  numero: number;
  docReceptor: string;
  receptor: string;
  /** Total en pesos (positivo; las notas de crédito se restan en el backend según el tipo). */
  total: number;
}

export interface LecturaMisComprobantes {
  comprobantes: ComprobanteArca[];
  cuitEmisor: string;
  esRecibidos: boolean;
  advertencias: string[];
}

const TIPOS: [RegExp, number][] = [
  [/nota de cr[eé]dito.*mipyme.*\bA\b|fce.*nota de cr[eé]dito.*\bA\b/i, 203],
  [/nota de cr[eé]dito.*mipyme.*\bB\b|fce.*nota de cr[eé]dito.*\bB\b/i, 208],
  [/nota de cr[eé]dito.*mipyme.*\bC\b|fce.*nota de cr[eé]dito.*\bC\b/i, 213],
  [/factura.*mipyme.*\bA\b|fce.*factura.*\bA\b/i, 201],
  [/factura.*mipyme.*\bB\b|fce.*factura.*\bB\b/i, 206],
  [/factura.*mipyme.*\bC\b|fce.*factura.*\bC\b/i, 211],
  [/nota de cr[eé]dito\s*A\b/i, 3],
  [/nota de cr[eé]dito\s*B\b/i, 8],
  [/nota de cr[eé]dito\s*C\b/i, 13],
  [/nota de cr[eé]dito\s*M\b/i, 53],
  [/nota de d[eé]bito\s*A\b/i, 2],
  [/nota de d[eé]bito\s*B\b/i, 7],
  [/nota de d[eé]bito\s*C\b/i, 12],
  [/recibo\s*A\b/i, 4],
  [/recibo\s*B\b/i, 9],
  [/recibo\s*C\b/i, 15],
  [/factura\s*A\b/i, 1],
  [/factura\s*B\b/i, 6],
  [/factura\s*C\b/i, 11],
  [/factura\s*M\b/i, 51],
];

export const NOMBRES_TIPO: Record<number, string> = {
  1: 'Factura A', 2: 'Nota de Débito A', 3: 'Nota de Crédito A', 4: 'Recibo A',
  6: 'Factura B', 7: 'Nota de Débito B', 8: 'Nota de Crédito B', 9: 'Recibo B',
  11: 'Factura C', 12: 'Nota de Débito C', 13: 'Nota de Crédito C', 15: 'Recibo C',
  51: 'Factura M', 53: 'Nota de Crédito M',
  201: 'Factura de Crédito MiPyME A', 203: 'Nota de Crédito MiPyME A',
  206: 'Factura de Crédito MiPyME B', 208: 'Nota de Crédito MiPyME B',
  211: 'Factura de Crédito MiPyME C', 213: 'Nota de Crédito MiPyME C',
};

export function esNotaCredito(tipo: number): boolean {
  return [3, 8, 13, 53, 203, 208, 213].includes(tipo);
}

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

/** Números con formato AR ("1.234,56"), US ("1234.56") o ya numéricos. */
export function aNumero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function aFecha(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
}

function tipoDesde(v: unknown): { tipo: number; nombre: string } {
  const s = String(v ?? '').trim();
  const cod = s.match(/^(\d{1,3})\b/);
  if (cod) {
    const t = Number(cod[1]);
    const resto = s.replace(/^\d{1,3}\s*-?\s*/, '');
    return { tipo: t, nombre: resto || NOMBRES_TIPO[t] || 'Tipo ' + t };
  }
  for (const [re, t] of TIPOS) if (re.test(s)) return { tipo: t, nombre: s };
  return { tipo: /cr[eé]dito/i.test(s) ? 13 : 0, nombre: s };
}

type Col = 'fecha' | 'tipo' | 'pv' | 'nro' | 'docRec' | 'rec' | 'moneda' | 'cambio' | 'total' | 'docEmisor';

const PATRONES: Record<Col, RegExp> = {
  fecha: /^fecha( de emision)?$/,
  tipo: /^tipo( de comprobante)?$/,
  pv: /^punto de venta$/,
  nro: /^numero( desde)?$/,
  docRec: /^nro doc receptor$|^numero documento receptor$|^nro doc$|^nro doc emisor$/,
  rec: /^denominacion receptor$|^denominacion$|^denominacion emisor$/,
  moneda: /^moneda$/,
  cambio: /^tipo( de)? cambio$/,
  total: /^imp total$|^importe total$|^total$/,
  docEmisor: /^nro doc emisor$/,
};

/** Lee el Excel o CSV que exporta "Mis Comprobantes" (Emitidos) de ARCA. */
export async function leerMisComprobantes(file: File): Promise<LecturaMisComprobantes> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  if (/\.csv$|\.txt$/i.test(file.name)) {
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('�')) texto = new TextDecoder('latin1').decode(buf);
    const primera = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ',';
    wb = XLSX.read(texto, { type: 'string', FS: sep, raw: true });
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const advertencias: string[] = [];
  let cuitEmisor = '';
  let esRecibidos = false;
  const texto0 = filas.slice(0, 3).map((f) => f.join(' ')).join(' ');
  const mCuit = texto0.match(/cuit\D{0,5}(\d{2}-?\d{8}-?\d)/i);
  if (mCuit) cuitEmisor = mCuit[1].replace(/\D/g, '');
  if (/recibidos/i.test(texto0)) esRecibidos = true;

  // Fila de encabezados: la primera que tenga "fecha" y algún total.
  let hi = -1;
  let idx: Partial<Record<Col, number>> = {};
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const h = filas[i].map(norm);
    const cand: Partial<Record<Col, number>> = {};
    (Object.keys(PATRONES) as Col[]).forEach((c) => {
      const j = h.findIndex((x) => PATRONES[c].test(x));
      if (j >= 0) cand[c] = j;
    });
    if (cand.fecha !== undefined && cand.total !== undefined) {
      hi = i;
      idx = cand;
      break;
    }
  }
  if (hi < 0) throw new Error('No reconozco el formato. Descargá el archivo desde ARCA > Mis Comprobantes > Emitidos > Exportar (Excel o CSV).');
  if (idx.docEmisor !== undefined) esRecibidos = true;

  const comprobantes: ComprobanteArca[] = [];
  let sinFecha = 0;
  for (const f of filas.slice(hi + 1)) {
    if (!f.some((x) => String(x).trim())) continue;
    const fecha = aFecha(f[idx.fecha!]);
    if (!fecha) {
      sinFecha++;
      continue;
    }
    const { tipo, nombre } = tipoDesde(idx.tipo !== undefined ? f[idx.tipo] : '');
    let total = Math.abs(aNumero(f[idx.total!]));
    const moneda = idx.moneda !== undefined ? String(f[idx.moneda]).trim().toUpperCase() : '';
    const cambio = idx.cambio !== undefined ? aNumero(f[idx.cambio]) : 1;
    if (moneda && !['$', 'PES', 'ARS', 'PESOS'].includes(moneda) && cambio > 0) total = total * cambio;
    comprobantes.push({
      fecha,
      tipo,
      tipoNombre: nombre || NOMBRES_TIPO[tipo] || '',
      ptoVta: idx.pv !== undefined ? aNumero(f[idx.pv]) : 0,
      numero: idx.nro !== undefined ? aNumero(f[idx.nro]) : 0,
      docReceptor: idx.docRec !== undefined ? String(f[idx.docRec]).replace(/\D/g, '') : '',
      receptor: idx.rec !== undefined ? String(f[idx.rec]).trim() : '',
      total: Math.round(total * 100) / 100,
    });
  }
  if (sinFecha) advertencias.push(sinFecha + ' fila(s) sin fecha válida se ignoraron.');
  if (comprobantes.some((c) => c.tipo === 0)) advertencias.push('Hay comprobantes con tipo no reconocido: se toman como facturas.');
  return { comprobantes, cuitEmisor, esRecibidos, advertencias };
}

/** Totales por mes (yyyy-MM), restando notas de crédito. */
export function totalesPorMes(lista: ComprobanteArca[]): { mes: string; total: number; cantidad: number }[] {
  const m = new Map<string, { total: number; cantidad: number }>();
  for (const c of lista) {
    const k = c.fecha.slice(0, 7);
    const v = m.get(k) ?? { total: 0, cantidad: 0 };
    v.total += esNotaCredito(c.tipo) ? -c.total : c.total;
    v.cantidad++;
    m.set(k, v);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, total: Math.round(v.total * 100) / 100, cantidad: v.cantidad }));
}
