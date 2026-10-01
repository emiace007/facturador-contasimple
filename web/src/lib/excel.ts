import * as XLSX from 'xlsx';
import type { Comercio, DatosFactura } from './api';
import { tiposPermitidos } from './api';
import { CONDICIONES_IVA_RECEPTOR } from './condicionIva';
import { hoyIso, rangoFechaFactura } from './fechaFactura';

const norm = (h: unknown) =>
  String(h ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function descargarPlantilla(c?: Comercio | null) {
  const tipo = c?.condicion_fiscal === 'responsable_inscripto' ? 'B' : 'C';
  const datos = [
    ['Punto de venta', 'Tipo de comprobante', 'Concepto', 'Documento', 'Importe', 'Alicuota IVA', 'Condicion IVA', 'Nombre receptor', 'Descripcion', 'Fecha'],
    [c?.punto_venta ?? 1, tipo, 'Productos', '', 15000, tipo === 'B' ? 21 : '', 'Consumidor Final', '', 'Venta de mostrador', ''],
    [c?.punto_venta ?? 1, tipo, 'Servicios', '20123456786', 30000, tipo === 'B' ? 21 : '', 'Responsable Monotributo', 'CLIENTE EJEMPLO', 'Servicio mensual', '25/09/2026'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(datos), 'Facturas');
  XLSX.writeFile(wb, 'plantilla-facturacion-masiva.xlsx');
}

function tipoDe(raw: unknown, c: Comercio): number | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return tiposPermitidos(c)[0];
  if (s === 'a' || s.includes('factura a')) return 1;
  if (s === 'b' || s.includes('factura b')) return 6;
  if (s === 'c' || s.includes('factura c')) return 11;
  return [1, 6, 11].includes(Number(s)) ? Number(s) : null;
}
function conceptoDe(raw: unknown): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.includes('productos y servicios')) return 3;
  if (s.includes('servicio')) return 2;
  if (s.includes('producto')) return 1;
  return [1, 2, 3].includes(Number(s)) ? Number(s) : 1;
}
function condIvaDe(raw: unknown): number | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  const n = Number(s);
  if (CONDICIONES_IVA_RECEPTOR.some((c) => c.value === n)) return n;
  if (s.includes('inscripto') || s === 'ri') return 1;
  if (s.includes('social')) return 13;
  if (s.includes('monotributo') || s === 'mt') return 6;
  if (s.includes('exento')) return 4;
  if (s.includes('consumidor') || s === 'cf') return 5;
  return undefined;
}
function importeDe(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  let s = String(raw ?? '').trim().replace(/[$\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return Number(s);
}
export function fechaDe(raw: unknown): string | null {
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000).toISOString().slice(0, 10);
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export interface FilaLeida { fila: number; datos: DatosFactura }
export async function leerExcel(file: File, c: Comercio): Promise<{ filas: FilaLeida[]; errores: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const filas: FilaLeida[] = [];
  const errores: string[] = [];
  rows.forEach((row, i) => {
    const fila = i + 2;
    const r: Record<string, unknown> = {};
    Object.entries(row).forEach(([k, v]) => (r[norm(k)] = v));
    const get = (...ks: string[]) => ks.map((k) => r[k]).find((v) => v !== undefined && String(v).trim() !== '') ?? '';
    const importe = importeDe(get('importe', 'importe total', 'monto', 'total'));
    if (!String(get('importe', 'importe total', 'monto', 'total')).trim() && !String(get('documento', 'descripcion')).trim()) return; // fila vacía
    if (!(importe > 0)) return void errores.push(`Fila ${fila}: importe inválido.`);
    const cbteTipo = tipoDe(get('tipo de comprobante', 'tipo', 'comprobante'), c);
    if (cbteTipo === null || !tiposPermitidos(c).includes(cbteTipo))
      return void errores.push(`Fila ${fila}: este comercio solo puede emitir ${tiposPermitidos(c).map((t) => (t === 1 ? 'A' : t === 6 ? 'B' : 'C')).join(' o ')}. Se omitió.`);
    const ptoVta = Number(get('punto de venta', 'pto vta', 'ptovta')) || c.punto_venta || 0;
    if (!ptoVta) return void errores.push(`Fila ${fila}: falta el punto de venta.`);
    const concepto = conceptoDe(get('concepto'));
    const doc = String(get('documento', 'dni', 'cuit', 'nro documento')).replace(/\D/g, '');
    const docTipo = doc ? (doc.length === 11 ? 80 : 96) : 99;
    if (cbteTipo === 1 && docTipo !== 80) return void errores.push(`Fila ${fila}: la Factura A necesita el CUIT del cliente. Se omitió.`);
    let fechaComprobante: string | undefined;
    const fRaw = get('fecha', 'fecha de la factura', 'fecha factura');
    if (String(fRaw).trim()) {
      const f = fechaDe(fRaw);
      const rg = rangoFechaFactura(concepto);
      if (!f) return void errores.push(`Fila ${fila}: fecha "${fRaw}" no se entiende (usá dd/mm/aaaa). Se omitió.`);
      if (f < rg.min || f > rg.max) return void errores.push(`Fila ${fila}: la fecha está fuera de lo que admite ARCA (${rg.margen} días antes o después de hoy). Se omitió.`);
      if (f !== hoyIso()) fechaComprobante = f;
    }
    const aliRaw = String(get('alicuota iva', 'alicuota', 'iva')).replace(',', '.').replace('%', '');
    const ali = aliRaw ? Number(aliRaw) : undefined;
    if (ali !== undefined && ![0, 10.5, 21, 27].includes(ali)) return void errores.push(`Fila ${fila}: alícuota ${aliRaw} inválida (0, 10.5, 21 o 27). Se omitió.`);
    const descripcion = String(get('descripcion', 'detalle')).trim() || 'Venta';
    filas.push({
      fila,
      datos: {
        cbteTipo, ptoVta, concepto, docTipo, docNro: doc || '0', importe,
        ...(cbteTipo !== 11 && ali !== undefined ? { alicuotaIva: ali } : {}),
        condicionIvaReceptorId: condIvaDe(get('condicion iva', 'condicion frente al iva')) ?? (docTipo === 99 ? 5 : cbteTipo === 1 ? 1 : 6),
        receptorNombre: String(get('nombre receptor', 'receptor')).trim() || undefined,
        fechaComprobante,
        items: [{ descripcion, cantidad: 1, precioUnitario: importe }],
      },
    });
  });
  return { filas, errores };
}
