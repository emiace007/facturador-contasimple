import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, MessageCircle, RefreshCcw, Search, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { displayOrDash } from '../lib/format';
import { TableSkeleton } from '../components/ui/Skeleton';
import type { Recategorizacion } from '../types';

type AccionKey = 'HACER' | 'MENSAJE' | 'NO' | 'OTRO' | 'SIN_DEFINIR';

function accionKey(accion: string | undefined): AccionKey {
  const s = (accion ?? '').trim().toUpperCase();
  if (!s) return 'SIN_DEFINIR';
  if (s.startsWith('HACER')) return 'HACER';
  if (s.startsWith('MENSAJE')) return 'MENSAJE';
  if (s === 'NO') return 'NO';
  return 'OTRO';
}

const ACCION_INFO: Record<AccionKey, { label: string; classes: string; icon: typeof Wrench | null }> = {
  HACER: { label: 'Hacer', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Wrench },
  MENSAJE: { label: 'Mensaje', classes: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', icon: MessageCircle },
  NO: { label: 'No', classes: 'bg-slate-100 text-slate-500 border-slate-200', icon: null },
  OTRO: { label: 'Otro', classes: 'bg-sky-50 text-sky-700 border-sky-200', icon: null },
  SIN_DEFINIR: { label: 'Sin definir', classes: 'bg-slate-50 text-slate-400 border-slate-200 border-dashed', icon: null },
};

const FILTROS: { key: AccionKey | 'Todos'; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'HACER', label: 'Hacer' },
  { key: 'MENSAJE', label: 'Mensaje' },
  { key: 'NO', label: 'No' },
  { key: 'SIN_DEFINIR', label: 'Sin definir' },
];

function FilaRecategorizacion({ r }: { r: Recategorizacion }) {
  const [abierto, setAbierto] = useState(false);
  const key = accionKey(r.accion);
  const info = ACCION_INFO[key];
  const Icon = info.icon;
  const cambiaCategoria = r.catActual && r.catNueva && r.catActual.trim() !== r.catNueva.trim();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="min-w-[180px] flex-1">
          <p className="font-medium text-slate-800 truncate">{r.cliente}</p>
          <p className="text-xs text-slate-400 tabular-nums">{r.cuit || 'Sin CUIT'}</p>
        </div>

        {(r.catActual || r.catNueva) && (
          <div className="flex items-center gap-1.5 text-sm shrink-0">
            <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-1 font-medium">
              {displayOrDash(r.catActual)}
            </span>
            {cambiaCategoria && (
              <>
                <ArrowRight size={14} className="text-slate-400" />
                <span className="rounded-md bg-brand-50 text-brand-700 px-2 py-1 font-medium">{r.catNueva}</span>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', info.classes)}>
            {Icon && <Icon size={12} />}
            {info.label}
          </span>
          <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', abierto && 'rotate-180')} />
        </div>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-slate-500">
            {r.condicionFiscal && (
              <p>
                Condición: <span className="text-slate-700 font-medium">{r.condicionFiscal}</span>
              </p>
            )}
            {r.encargado && (
              <p>
                Encargado: <span className="text-slate-700 font-medium">{r.encargado}</span>
              </p>
            )}
            {r.estado && (
              <p>
                Estado: <span className="text-slate-700 font-medium">{r.estado}</span>
              </p>
            )}
            {r.define && (
              <p>
                Define: <span className="text-slate-700 font-medium">{r.define}</span>
              </p>
            )}
            {r.dfeArca && (
              <p>
                DFE ARCA: <span className="text-slate-700 font-medium">{r.dfeArca}</span>
              </p>
            )}
            {r.honorarios && (
              <p>
                Honorarios: <span className="text-slate-700 font-medium">{r.honorarios}</span>
              </p>
            )}
          </div>
          {(r.observaciones || r.obs2) && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              {r.observaciones && <p className="text-slate-600 leading-relaxed">{r.observaciones}</p>}
              {r.obs2 && <p className="text-slate-600 leading-relaxed">{r.obs2}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecategorizacionesPage() {
  const [busqueda, setBusqueda] = useState('');
  const [accion, setAccion] = useState<AccionKey | 'Todos'>('Todos');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recategorizaciones'],
    queryFn: api.getRecategorizaciones,
  });

  const filas = data ?? [];

  const conteoPorAccion = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filas) {
      const k = accionKey(r.accion);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [filas]);

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return filas.filter((r) => {
      if (accion !== 'Todos' && accionKey(r.accion) !== accion) return false;
      if (term) {
        const match =
          r.cliente?.toLowerCase().includes(term) ||
          String(r.cuit ?? '').includes(term) ||
          r.encargado?.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [filas, busqueda, accion]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <RefreshCcw size={20} className="text-brand-600" />
          Recategorizaciones (R.0726)
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Clientes a evaluar para recategorización de Monotributo: quién necesita trámite, a quién avisarle
          y quién no requiere cambios.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, CUIT o encargado..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAccion(key)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                accion === key
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'
              )}
            >
              {label} ({key === 'Todos' ? filas.length : conteoPorAccion[key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar las recategorizaciones: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">
          No hay resultados para este filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((r, i) => (
            <FilaRecategorizacion key={`${r.cliente}-${r.cuit}-${i}`} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
