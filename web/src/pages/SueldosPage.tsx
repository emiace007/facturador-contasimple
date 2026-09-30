import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { displayOrDash } from '../lib/format';
import { TableSkeleton } from '../components/ui/Skeleton';

const ESTADO_CLASSES: Record<string, string> = {
  completado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  terminado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  'en proceso': 'bg-blue-50 text-blue-700 border-blue-200',
};

function estadoClasses(estado: string | undefined): string {
  const key = (estado ?? '').trim().toLowerCase();
  return ESTADO_CLASSES[key] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function SueldosPage() {
  const [busqueda, setBusqueda] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sueldos'],
    queryFn: api.getSueldos,
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
          <Wallet size={20} className="text-brand-600" />
          Sueldos
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Trámites y estado de liquidación de sueldos por cliente.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar los sueldos: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">
          No hay resultados para este filtro.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm divide-y divide-slate-100">
          {filtradas.map((s, i) => (
            <div key={`${s.cliente}-${i}`} className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-[160px]">
                <p className="font-medium text-slate-800">{s.cliente}</p>
                <p className="text-xs text-slate-500">{displayOrDash(s.tramite)}</p>
              </div>
              <div className="flex items-center gap-3">
                {s.observaciones && (
                  <p className="text-xs text-slate-400 max-w-xs truncate">{s.observaciones}</p>
                )}
                <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium border', estadoClasses(s.estado))}>
                  {displayOrDash(s.estado)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
