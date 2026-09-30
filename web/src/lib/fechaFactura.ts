/** Fecha de emisión de facturas: ARCA acepta hasta 5 días antes/después (productos) o 10 (servicios). */
function iso(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function hoyIso(): string {
  return iso(new Date());
}

function sumarDias(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number);
  return iso(new Date(y, m - 1, d + n));
}

export function rangoFechaFactura(concepto: number): { min: string; max: string; margen: number } {
  const margen = Number(concepto) === 1 ? 5 : 10;
  const h = hoyIso();
  return { min: sumarDias(h, -margen), max: sumarDias(h, margen), margen };
}
