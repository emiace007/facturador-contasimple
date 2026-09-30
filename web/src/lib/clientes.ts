import { Ban, Briefcase, Building2, HeartHandshake, HelpCircle, Landmark, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Metadata de cada categoría fiscal calculada por el backend (ver `computeCategoriasFiscales_`
 * en apps-script/Code.gs) a partir del texto libre de "Condición Fiscal" cargado en la hoja
 * Claves del estudio. Un cliente puede tener más de una categoría a la vez (ej. alguien que
 * está en relación de dependencia y además es monotributista).
 */
export interface CategoriaInfo {
  label: string;
  badgeClasses: string;
  dotClasses: string;
  icon: LucideIcon;
  /** Explicación en lenguaje simple, pensada para alguien que no maneja términos contables. */
  descripcion: string;
  /** Impuestos / obligaciones habituales asociadas a esta categoría. */
  impuestos: string[];
}

export const CATEGORIA_INFO: Record<string, CategoriaInfo> = {
  Monotributista: {
    label: 'Monotributista',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-emerald-500',
    icon: Briefcase,
    descripcion: 'Paga una cuota fija mensual (el Monotributo) que reemplaza a IVA y Ganancias.',
    impuestos: ['Monotributo (cuota mensual)'],
  },
  'Responsable Inscripto': {
    label: 'Responsable Inscripto',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClasses: 'bg-blue-500',
    icon: Building2,
    descripcion: 'Tributa IVA y Ganancias por su actividad, y presenta declaraciones juradas periódicas.',
    impuestos: ['IVA', 'Ganancias', 'Ingresos Brutos (según jurisdicción)'],
  },
  Autónomo: {
    label: 'Autónomo',
    badgeClasses: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClasses: 'bg-violet-500',
    icon: User,
    descripcion: 'Aporta como trabajador independiente (régimen de autónomos) y suele tributar Ganancias.',
    impuestos: ['Aportes Autónomos', 'Ganancias'],
  },
  'Relación de Dependencia': {
    label: 'Relación de Dependencia',
    badgeClasses: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClasses: 'bg-sky-500',
    icon: Landmark,
    descripcion: 'Es empleado en relación de dependencia: el empleador le retiene los aportes en el recibo de sueldo.',
    impuestos: ['Ganancias 4ta categoría (si corresponde)'],
  },
  Jubilado: {
    label: 'Jubilado',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClasses: 'bg-amber-500',
    icon: HeartHandshake,
    descripcion: 'Percibe una jubilación. En general no tiene obligaciones impositivas habituales.',
    impuestos: [],
  },
  'Baja / Inactivo': {
    label: 'Baja / Inactivo',
    badgeClasses: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClasses: 'bg-slate-400',
    icon: Ban,
    descripcion: 'Cliente dado de baja o inactivo en el estudio.',
    impuestos: [],
  },
  Otro: {
    label: 'Otro',
    badgeClasses: 'bg-slate-50 text-slate-600 border-slate-200',
    dotClasses: 'bg-slate-400',
    icon: HelpCircle,
    descripcion: 'Situación particular que no encuadra en las categorías habituales.',
    impuestos: [],
  },
  'Sin definir': {
    label: 'Sin definir',
    badgeClasses: 'bg-slate-50 text-slate-400 border-slate-200 border-dashed',
    dotClasses: 'bg-slate-300',
    icon: HelpCircle,
    descripcion: 'Todavía no se cargó la condición fiscal de este cliente en la planilla.',
    impuestos: [],
  },
};

export function parseCategorias(categoriasFiscales: string | undefined | null): string[] {
  if (!categoriasFiscales) return ['Sin definir'];
  const parsed = categoriasFiscales
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ['Sin definir'];
}

export function getCategoriaInfo(categoria: string): CategoriaInfo {
  return CATEGORIA_INFO[categoria] ?? CATEGORIA_INFO.Otro;
}

/** Categorías usadas como chips de filtro en la lista de clientes (orden pensado para uso frecuente). */
export const CATEGORIA_FILTROS = [
  'Monotributista',
  'Responsable Inscripto',
  'Autónomo',
  'Relación de Dependencia',
  'Jubilado',
  'Otro',
  'Baja / Inactivo',
] as const;

/** Normaliza un CUIT tolerando que venga como número, string con guiones, o vacío. */
export function normalizeCuit(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** Compara CUITs tolerando que uno venga como número y otro como string, con o sin guiones. */
export function mismoCuit(a: unknown, b: unknown): boolean {
  const na = normalizeCuit(a);
  const nb = normalizeCuit(b);
  return na.length > 0 && na === nb;
}

/**
 * Extrae el número de punto de venta desde el texto libre de la planilla "Fc-Monit."
 * (ej. "00004-Av. Del Libertador Gral San Martin 920 - Alta Gracia, Córdoba" -> 4).
 * Devuelve undefined si no encuentra nada parseable.
 */
export function parsePuntoVenta(v: string | undefined | null): number | undefined {
  if (!v) return undefined;
  const match = String(v).trim().match(/^0*(\d+)/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
