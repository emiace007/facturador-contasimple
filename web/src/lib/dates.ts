/** Utilidades de fecha para el módulo de Vencimientos. */

/** Días de diferencia entre hoy (00:00) y la fecha dada. Negativo = ya pasó. */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export type UrgenciaVencimiento = 'vencido' | 'proximo' | 'ok';

/** Clasifica la urgencia de un vencimiento en base a la fecha y su estado. */
export function getUrgencia(fechaVencimiento: string, estado: string): UrgenciaVencimiento {
  if (estado === 'Presentado') return 'ok';
  const dias = daysUntil(fechaVencimiento);
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'proximo';
  return 'ok';
}

export function formatFechaCorta(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
