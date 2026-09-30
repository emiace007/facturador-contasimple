import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { displayOrDash } from '../lib/format';
import { TableSkeleton } from '../components/ui/Skeleton';
import type { Sociedad } from '../types';

function esVencido(v: string | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'si' || s === 'sí' || s === 'true' || s === 'vencido';
}

const CAMPOS: { key: keyof Sociedad; label: string }[] = [
  { key: 'periodo', label: 'Período' },
  { key: 'vtoGanancias', label: 'Vto. Ganancias' },
  { key: 'segmento', label: 'Segmento' },
  { key: 'plazoEspera', label: 'Plazo de espera' },
  { key: 'reduccion50', label: 'Reducción 50%' },
  { key: 'ddjjGanancias', label: 'DDJJ Ganancias' },
  { key: 'certificacion', label: 'Certificación' },
  { key: 'pub', label: 'Publicación' },
  { key: 'particSocietaria', label: 'Particip. societaria' },
  { key: 'bsAccPart', label: 'Bs. acc. participación' },
  { key: 'librosIpj', label: 'Libros IPJ' },
];

function TarjetaSociedad({ s }: { s: Sociedad }) {
  const [abierto, setAbierto] = useState(false);
  const vencido = esVencido(s.vencido);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div
          className={clsx(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
            vencido ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
          )}
        >
          <Building2 size={18} />
        </div>

        <div className="min-w-[180px] flex-1">
          <p className="font-medium text-slate-800 truncate">{s.cliente}</p>
          {s.encargado && <p className="text-xs text-slate-400">Encargado: {s.encargado}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {s.cierre && (
            <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">
              Cierre: {s.cierre}
            </span>
          )}
          <span
            className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-medium border',
              vencido
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            )}
          >
            {vencido ? 'Vencido' : 'Al día'}
          </span>
          <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', abierto && 'rotate-180')} />
        </div>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {CAMPOS.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-slate-800 font-medium text-right">{displayOrDash(s[key])}</dd>
              </div>
            ))}
          </dl>
          {s.observaciones && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-sm text-slate-600 leading-relaxed">{s.observaciones}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SociedadesPage() {
  const [busqueda, setBusqueda] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sociedades'],
    queryFn: api.getSociedades,
  });

  const filas = data ?? [];

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return filas;
    return filas.filter((s) => s.cliente?.toLowerCase().includes(term));
  }, [filas, busqueda]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Building2 size={20} className="text-brand-600" />
          Sociedades
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Cierres de ejercicio, vencimientos de Ganancias societarias y trámites de libros IPJ.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de sociedad..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar las sociedades: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">
          No hay resultados para este filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((s, i) => (
            <TarjetaSociedad key={`${s.cliente}-${i}`} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
