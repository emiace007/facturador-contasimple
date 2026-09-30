/** Utilidades de formato compartidas por los módulos de Facturación / Sociedades / Ganancias / Sueldos. */

/** Convierte valores que pueden venir como número, string con formato AR o vacíos, a número. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Formatea como moneda ARS, sin decimales para números grandes de facturación. */
export function formatMoney(value: unknown): string {
  const n = toNumber(value);
  if (n === 0) return '$ 0';
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

/** Muestra un valor de celda tal cual, o un placeholder si viene vacío. */
export function displayOrDash(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const s = String(value).trim();
  return s.length > 0 ? s : '—';
}

/** Nombre corto de mes en español a partir de una fecha ISO (encabezado de columna mensual). */
export function formatMesCorto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  return label.replace('.', '');
}
