/** Lectura de extractos bancarios (PDF) a partir del texto posicionado de cada página. */

export interface ItemTexto {
  str: string;
  x: number; // izquierda
  y: number; // arriba (0 = arriba de la página)
  w: number;
  pagina: number;
}

export interface Linea {
  pagina: number;
  y: number;
  items: ItemTexto[];
  texto: string;
}

export interface MovimientoBanco {
  fecha: string; // yyyy-MM-dd
  descripcion: string;
  referencia: string;
  importe: number; // con signo: negativo = salida
  saldo?: number;
}

export interface Extracto {
  banco: string;
  titular: string;
  cuit: string;
  periodo: string;
  movimientos: MovimientoBanco[];
  advertencias: string[];
}

export function aNumeroAr(s: string): number | null {
  const t = String(s).replace(/[$\s]/g, '').replace(/[−–]/g, '-');
  if (!/^-?\d{1,3}(\.\d{3})*,\d{2}-?$|^-?\d+,\d{2}-?$/.test(t)) return null;
  const neg = t.startsWith('-') || t.endsWith('-');
  const n = parseFloat(t.replace(/-/g, '').replace(/\./g, '').replace(',', '.'));
  return neg ? -n : n;
}

/** Agrupa los textos en renglones por página y altura. */
export function armarLineas(items: ItemTexto[], tolerancia = 2.5): Linea[] {
  const porPagina = new Map<number, ItemTexto[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const arr = porPagina.get(it.pagina) ?? [];
    arr.push(it);
    porPagina.set(it.pagina, arr);
  }
  const lineas: Linea[] = [];
  for (const [pagina, arr] of [...porPagina.entries()].sort((a, b) => a[0] - b[0])) {
    arr.sort((a, b) => a.y - b.y || a.x - b.x);
    let actual: Linea | null = null;
    for (const it of arr) {
      if (!actual || Math.abs(it.y - actual.y) > tolerancia) {
        actual = { pagina, y: it.y, items: [], texto: '' };
        lineas.push(actual);
      }
      actual.items.push(it);
    }
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x);
    l.texto = l.items.map((i) => i.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lineas;
}


// ---------------------------------------------------------------- Mercado Pago
function leerMercadoPago(lineas: Linea[]): Extracto {
  const texto = lineas.map((l) => l.texto).join('\n');
  const cuit = (texto.match(/CUIT\/?\s*CUIL:\s*(\d{11})/) || [])[1] || '';
  const titular = (lineas.find((l) => /RESUMEN DE CUENTA/.test(l.texto)) && lineas[lineas.findIndex((l) => /RESUMEN DE CUENTA/.test(l.texto)) + 1]?.texto) || '';
  const periodo = (texto.match(/Periodo:\s*([^\n]+)/) || [])[1] || '';
  // Sólo la sección de pesos (después vienen tenencias en dólares / inversiones).
  const fin = lineas.findIndex((l) => /RESUMEN DE TENENCIAS/.test(l.texto));
  const ls = fin > 0 ? lineas.slice(0, fin) : lineas;

  type Mov = MovimientoBanco & { idx: number; extras: { idx: number; texto: string }[] };
  const movs: Mov[] = [];
  const reMov = /^(\d{2})-(\d{2})-(\d{4})\s+(.*?)\s*(\d{9,})\s+\$\s*(-?[\d.]+,\d{2})\s+\$\s*(-?[\d.]+,\d{2})$/;
  ls.forEach((l, idx) => {
    const m = l.texto.match(reMov);
    if (m) {
      movs.push({ idx, fecha: m[3] + '-' + m[2] + '-' + m[1], descripcion: m[4].trim(), referencia: m[5], importe: aNumeroAr(m[6]) ?? 0, saldo: aNumeroAr(m[7]) ?? undefined, extras: [] });
    }
  });
  // Texto suelto (descripción partida en renglones arriba/abajo): al movimiento más cercano en la misma página.
  const ignorar = /^(Fecha|ID de la|operación|Descripción|Valor|Saldo|DETALLE|RESUMEN|Entradas|Salidas|Saldo inicial|Mercado Libre|consulta en|Periodo|CVU|\d+\/\d+$|Fecha de generación)/i;
  ls.forEach((l, idx) => {
    if (reMov.test(l.texto) || ignorar.test(l.texto) || /\$/.test(l.texto)) return;
    let mejor: Mov | null = null;
    let dist = Infinity;
    for (const mv of movs) {
      const ml = ls[mv.idx];
      if (ml.pagina !== l.pagina) continue;
      const d = Math.abs(ml.y - l.y);
      if (d < dist) { dist = d; mejor = mv; }
    }
    if (mejor && dist < 30) mejor.extras.push({ idx, texto: l.texto });
  });
  const movimientos = movs.map((mv) => {
    const antes = mv.extras.filter((e) => e.idx < mv.idx).map((e) => e.texto);
    const despues = mv.extras.filter((e) => e.idx > mv.idx).map((e) => e.texto);
    const descripcion = [...antes, mv.descripcion, ...despues].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return { fecha: mv.fecha, descripcion, referencia: mv.referencia, importe: mv.importe, saldo: mv.saldo };
  });
  return { banco: 'Mercado Pago', titular, cuit, periodo, movimientos, advertencias: [] };
}

// ---------------------------------------------------------------- Bancos con columnas Débito / Crédito / Saldo
function leerBancoColumnas(lineas: Linea[], banco: string): Extracto {
  const advertencias: string[] = [];
  const texto = lineas.map((l) => l.texto).join('\n');
  const periodo = (texto.match(/del:?\s*(\d{2}\/\d{2}\/\d{4})\s*al:?\s*(\d{2}\/\d{2}\/\d{4})/i) || []).slice(1).join(' al ');
  const movimientos: MovimientoBanco[] = [];
  let colDeb = 0, colCred = 0, colSaldo = 0;
  let ultimo: MovimientoBanco | null = null;
  const reFecha = /^(\d{2})\/(\d{2})\/(\d{2,4})$/;
  for (const l of lineas) {
    const up = l.texto.toUpperCase();
    // Fin del detalle (lo que sigue suele ser un anexo: compras con débito, débitos automáticos, etc.)
    if (/^SALDO AL\b/.test(up.trim())) break;
    if (/DEBITO/.test(up) && /CREDITO/.test(up) && /SALDO/.test(up)) {
      const der = (re: RegExp) => { const it = l.items.find((i) => re.test(i.str.toUpperCase())); return it ? it.x + it.w : 0; };
      colDeb = der(/D[EÉ]BITO/); colCred = der(/CR[EÉ]DITO/); colSaldo = der(/SALDO/);
      ultimo = null;
      continue;
    }
    if (!colDeb) continue;
    const primero = l.items[0]?.str.trim() || '';
    const mf = primero.match(reFecha);
    if (mf) {
      const anio = mf[3].length === 2 ? '20' + mf[3] : mf[3];
      const montos = l.items.filter((i) => aNumeroAr(i.str) !== null);
      const textos = l.items.slice(1).filter((i) => aNumeroAr(i.str) === null).map((i) => i.str.trim());
      let referencia = '';
      if (textos.length && /^\d{2,8}$/.test(textos[0])) referencia = textos.shift() as string;
      let importe = 0;
      let saldo: number | undefined;
      for (const mt of montos) {
        const der = mt.x + mt.w;
        const v = aNumeroAr(mt.str) as number;
        const dd = Math.abs(der - colDeb), dc = Math.abs(der - colCred), ds = Math.abs(der - colSaldo);
        if (ds < dd && ds < dc) saldo = v;
        else if (dd < dc) importe = -Math.abs(v);
        else importe = Math.abs(v);
      }
      if (!importe) { ultimo = null; continue; }
      ultimo = { fecha: anio + '-' + mf[2] + '-' + mf[1], descripcion: textos.join(' ').replace(/\s+/g, ' ').trim(), referencia, importe, saldo };
      movimientos.push(ultimo);
    } else if (ultimo && l.items[0] && l.items[0].x > (l.items[0] ? 20 : 0) && !/SALDO|TOTAL|PAGINA|HOJA/i.test(up) && l.texto.length < 90) {
      // renglón de detalle debajo del movimiento
      if (!aNumeroAr(l.items[l.items.length - 1].str)) ultimo.descripcion += ' · ' + l.texto;
    }
  }
  if (!movimientos.length) advertencias.push('No se encontraron movimientos con columnas Débito / Crédito.');
  return { banco, titular: '', cuit: '', periodo, movimientos, advertencias };
}

export function leerExtractoDesdeLineas(lineas: Linea[]): Extracto {
  const texto = lineas.slice(0, 60).map((l) => l.texto).join('\n');
  if (/Mercado (Pago|Libre)|CVU:/i.test(texto) && /DETALLE DE MOVIMIENTOS/i.test(lineas.map((l) => l.texto).join('\n'))) return leerMercadoPago(lineas);
  let banco = 'Banco';
  if (/30[-−]?57142135[-−]?2|Bancor|Banco de la Provincia de C[oó]rdoba/i.test(texto)) banco = 'Banco de Córdoba';
  else if (/Galicia/i.test(texto)) banco = 'Banco Galicia';
  else if (/Naci[oó]n/i.test(texto)) banco = 'Banco Nación';
  else if (/Santander/i.test(texto)) banco = 'Banco Santander';
  else if (/Macro/i.test(texto)) banco = 'Banco Macro';
  return leerBancoColumnas(lineas, banco);
}

// ---------------------------------------------------------------- Carga desde archivo (navegador)

/** Lee un PDF de extracto (Mercado Pago o banco) con pdf.js. */
export async function leerExtractoPdf(file: File): Promise<Extracto> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.js?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items: ItemTexto[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      items.push({ str: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width, pagina: p });
    }
  }
  return leerExtractoDesdeLineas(armarLineas(items));
}

function normCol(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fechaCelda(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return '';
}

function numCelda(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return 0;
  const ar = aNumeroAr(s);
  if (ar !== null) return ar;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Lee un reporte de movimientos en Excel/CSV (Mercado Pago u homebanking). */
export async function leerExtractoPlanilla(file: File): Promise<Extracto> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.csv$|\.txt$/i.test(file.name)) {
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('�')) texto = new TextDecoder('latin1').decode(buf);
    const primera = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ',';
    wb = XLSX.read(texto, { type: 'string', FS: sep, raw: true });
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  const filas: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
  const pat = {
    fecha: /^(fecha|date|release date|fecha de liberacion|fecha de origen|fecha operacion|fecha de operacion)$/,
    desc: /^(descripcion|detalle|concepto|tipo de operacion|transaction type|description|movimiento)$/,
    ref: /^(id|referencia|reference id|source id|numero de operacion|id de operacion|comprobante|nro comprobante)$/,
    importe: /^(valor|importe|monto|transaction net amount|net amount|monto neto|importe neto)$/,
    debito: /^(debito|debitos|egreso|egresos|salida)$/,
    credito: /^(credito|creditos|ingreso|ingresos|entrada)$/,
  };
  let hi = -1;
  let idx: Record<string, number> = {};
  for (let i = 0; i < Math.min(filas.length, 20); i++) {
    const h = filas[i].map(normCol);
    const c: Record<string, number> = {};
    (Object.keys(pat) as (keyof typeof pat)[]).forEach((k) => {
      const j = h.findIndex((x) => pat[k].test(x));
      if (j >= 0) c[k] = j;
    });
    if (c.fecha !== undefined && (c.importe !== undefined || c.debito !== undefined)) {
      hi = i;
      idx = c;
      break;
    }
  }
  if (hi < 0) throw new Error('No reconozco las columnas del archivo. Necesito al menos Fecha e Importe (o Débito/Crédito).');
  const movimientos: MovimientoBanco[] = [];
  for (const f of filas.slice(hi + 1)) {
    const fecha = fechaCelda(f[idx.fecha]);
    if (!fecha) continue;
    let importe = idx.importe !== undefined ? numCelda(f[idx.importe]) : 0;
    if (idx.importe === undefined) importe = numCelda(f[idx.credito]) - Math.abs(numCelda(f[idx.debito]));
    if (!importe) continue;
    movimientos.push({
      fecha,
      descripcion: idx.desc !== undefined ? String(f[idx.desc]).trim() : '',
      referencia: idx.ref !== undefined ? String(f[idx.ref]).trim() : '',
      importe,
    });
  }
  return { banco: /mercado|mp/i.test(file.name) ? 'Mercado Pago' : 'Banco', titular: '', cuit: '', periodo: '', movimientos, advertencias: [] };
}

export async function leerExtracto(file: File): Promise<Extracto> {
  return /\.pdf$/i.test(file.name) ? leerExtractoPdf(file) : leerExtractoPlanilla(file);
}

// ---------------------------------------------------------------- Clasificación de gastos

export const CATEGORIAS_EGRESO = [
  'Proveedores y compras',
  'Transferencias a terceros',
  'Servicios',
  'Impuestos y retenciones',
  'Comisiones y gastos bancarios',
  'Sueldos',
  'Retiros de efectivo',
  'Entre cuentas propias',
  'Otros gastos',
] as const;

/** Categorías que por defecto NO se cuentan como gasto (movimientos de dinero propio). */
export const CATEGORIAS_NO_GASTO = ['Retiros de efectivo', 'Entre cuentas propias'];

function tokens(s: string): string[] {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 2);
}

/** Sugiere categoría para una salida de dinero según su descripción. */
export function clasificarMovimiento(descripcion: string, titular = ''): { categoria: string; esGasto: boolean } {
  const d = descripcion.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const tit = tokens(titular);
  const propio = tit.length >= 2 && tokens(descripcion).filter((t) => tit.includes(t)).length >= 2;
  let categoria = 'Otros gastos';
  if (/mismo titular|comp\. ?saldos|cuentas propias/.test(d) || (propio && /transfer|debin|transf/.test(d))) categoria = 'Entre cuentas propias';
  else if (/retiro|cajero|extraccion/.test(d)) categoria = 'Retiros de efectivo';
  else if (/sircreb|retencion|percepcion|impuesto|ley 25\.?413|imp\.? ?deb|imp\.? ?cred|\barca\b|\bafip\b|rentas|iibb|i\.v\.a|\biva\b|monotributo/.test(d)) categoria = 'Impuestos y retenciones';
  else if (/comision|comis\.|mantenimiento|cargo|banelco|red link|resumen|chequera/.test(d)) categoria = 'Comisiones y gastos bancarios';
  else if (/sueldo|haberes|aguinaldo/.test(d)) categoria = 'Sueldos';
  else if (/pago de servicio|debito automatico|epec|telecom|personal|claro|movistar|netflix|spotify|ecogas|aguas|internet|poliza|seguro|cable|directv|flow/.test(d)) categoria = 'Servicios';
  else if (/pago con qr|compra|mercado libre|\bpago\b/.test(d)) categoria = 'Proveedores y compras';
  else if (/transfer|debin|transf/.test(d)) categoria = 'Transferencias a terceros';
  return { categoria, esGasto: !CATEGORIAS_NO_GASTO.includes(categoria) };
}

/** Clave estable para no duplicar un movimiento si se sube dos veces el mismo extracto. */
export function claveMovimiento(cuit: string, origen: string, m: MovimientoBanco, ocurrencia: number): string {
  return [cuit, origen, m.fecha, m.referencia || '-', m.importe.toFixed(2), m.referencia ? 0 : ocurrencia].join('|');
}
