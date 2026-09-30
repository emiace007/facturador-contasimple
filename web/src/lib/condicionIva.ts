/**
 * Condición frente al IVA del receptor (RG 5616/2024). ARCA lo mantiene como
 * dato no excluyente hasta el 30/11/2026 inclusive; a partir del 01/12/2026
 * rechaza los comprobantes que no lo incluyan. Ver método WSFEv1
 * `FEParamGetCondicionIvaReceptor` para la tabla oficial completa.
 *
 * `cmpClase` indica en qué tipo de comprobante es válido cada id: "A" cubre
 * Factura A/M/C (siempre le corresponden sujetos inscriptos o monotributistas),
 * "B" cubre Factura B/C (consumidor final, exento, etc.).
 */
export interface CondicionIvaReceptor {
  value: number;
  label: string;
  cmpClase: 'A' | 'B';
}

export const CONDICIONES_IVA_RECEPTOR: CondicionIvaReceptor[] = [
  { value: 1, label: 'IVA Responsable Inscripto', cmpClase: 'A' },
  { value: 6, label: 'Responsable Monotributo', cmpClase: 'A' },
  { value: 13, label: 'Monotributista Social', cmpClase: 'A' },
  { value: 16, label: 'Monotributo Trabajador Independiente Promovido', cmpClase: 'A' },
  { value: 4, label: 'IVA Sujeto Exento', cmpClase: 'B' },
  { value: 5, label: 'Consumidor Final', cmpClase: 'B' },
  { value: 7, label: 'Sujeto No Categorizado', cmpClase: 'B' },
  { value: 8, label: 'Proveedor del Exterior', cmpClase: 'B' },
  { value: 9, label: 'Cliente del Exterior', cmpClase: 'B' },
  { value: 10, label: 'IVA Liberado – Ley N° 19.640', cmpClase: 'B' },
  { value: 15, label: 'IVA No Alcanzado', cmpClase: 'B' },
];

/** Factura A (cbteTipo=1) sólo admite receptores inscriptos/monotributistas (clase "A"). */
export function condicionesIvaPara(cbteTipo: number): CondicionIvaReceptor[] {
  if (cbteTipo === 1) return CONDICIONES_IVA_RECEPTOR.filter((c) => c.cmpClase === 'A');
  return CONDICIONES_IVA_RECEPTOR;
}

/** Sugerencia inicial razonable según tipo de comprobante y si el destinatario es Consumidor Final. */
export function condicionIvaSugerida(cbteTipo: number, consumidorFinal: boolean): number {
  if (cbteTipo === 1) return 1; // Factura A siempre a Responsable Inscripto
  if (consumidorFinal) return 5; // Consumidor Final
  return 6; // fallback más común: Responsable Monotributo
}
