import { useComercio } from '../App';
import type { Comercio } from '../lib/api';
import { Link } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

/** Envuelve una pantalla que necesita un comercio elegido (el estudio) o el del usuario. */
export function ConComercio({ children }: { children: (c: Comercio) => React.ReactNode }) {
  const { comercio, cargando } = useComercio();
  const s = useSesion();
  if (cargando) return <p className="text-base text-slate-400 py-10 text-center">Cargando…</p>;
  if (!comercio) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-base text-slate-600">Elegí un comercio para empezar.</p>
        {s?.rol === 'staff' && <Link to="/comercios" className={botonSecundario + ' inline-flex'}>Ir a Comercios</Link>}
      </div>
    );
  }
  return <>{children(comercio)}</>;
}

export const card = 'bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5';
export const input = 'mt-1 w-full h-12 rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400';
export const label = 'block text-sm font-semibold text-slate-700';
export const boton = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-brand-600 px-5 text-base font-bold text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-40';
export const botonSecundario = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-brand-200 bg-white px-5 text-base font-bold text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-40';
export const botonGrande = 'flex w-full items-center justify-center gap-2.5 h-16 rounded-2xl bg-acento-400 px-6 text-lg font-extrabold text-brand-950 shadow-[0_3px_0_#c98f0a] active:translate-y-[2px] active:shadow-[0_1px_0_#c98f0a] disabled:opacity-40 disabled:shadow-none disabled:translate-y-0';
