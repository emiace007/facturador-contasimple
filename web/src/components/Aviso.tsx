import { useComercio } from '../App';
import type { Comercio } from '../lib/api';

/** Envuelve una pantalla que necesita un comercio elegido (el estudio) o el del usuario. */
export function ConComercio({ children }: { children: (c: Comercio) => React.ReactNode }) {
  const { comercio, cargando } = useComercio();
  if (cargando) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (!comercio) return <p className="text-sm text-slate-500">Elegí un comercio arriba para empezar.</p>;
  return <>{children(comercio)}</>;
}

export const card = 'bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5';
export const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
export const boton = 'rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50';
