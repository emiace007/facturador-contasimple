const LETRAS: Record<number, string> = { 1: 'A', 6: 'B', 11: 'C' };

/** "Factura C 00002-00000001" a partir de tipo, punto de venta y número. */
export function tituloFactura(cbteTipo: number, ptoVta: number, numero: number): string {
  const letra = LETRAS[Number(cbteTipo)] ?? '';
  return `Factura ${letra} ${String(ptoVta).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;
}

/** Las fechas del historial pueden venir como "25/09/2026" o como ISO; las mostramos como dd/mm/aaaa. */
export function formatFechaFactura(v: string | undefined): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleDateString('es-AR');
  return s;
}
