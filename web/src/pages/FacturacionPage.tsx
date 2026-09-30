import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, FileSpreadsheet, Receipt, Search, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatMesCorto, formatMoney, toNumber } from '../lib/format';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ImportarComprobantesModal } from '../components/facturas/ImportarComprobantesModal';
import { FacturacionRI } from '../components/facturas/FacturacionRI';
import type { FacturacionCliente } from '../types';

function esAlerta(aviso: string | undefined): boolean {
  return (aviso ?? '').toLowerCase().includes('alerta');
}

function tieneSugerencia(f: FacturacionCliente): boolean {
  const sugerida = (f.categoriaSugerida ?? '').trim();
  return sugerida.length > 0 && sugerida !== (f.categoria ?? '').trim();
}

function ProgresoTope({ acumulado, tope }: { acumulado?: number; tope?: number }) {
  const a = toNumber(acumulado);
  const t = toNumber(tope);
  if (t <= 0) return null;
  const pct = Math.min(100, Math.round((a / t) * 100));
  const color = pct >= 95 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{formatMoney(a)} facturado</span>
        <span>{pct}% del tope</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-1">Tope de categoría: {formatMoney(t)}</p>
    </div>
  );
}

function FilaFacturacion({ f }: { f: FacturacionCliente }) {
  const [abierto, setAbierto] = useState(false);
  const alerta = esAlerta(f.aviso);
  const sugerencia = tieneSugerencia(f);
  const mesesConDatos = f.meses.filter((m) => toNumber(m.monto) > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div
          className={clsx(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-semibold text-sm',
            alerta ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
          )}
        >
          {f.categoria || '—'}
        </div>

        <div className="min-w-[180px] flex-1">
          <p className="font-medium text-slate-800 truncate">{f.cliente}</p>
          <p className="text-xs text-slate-400 tabular-nums">{f.cuit || 'Sin CUIT'}</p>
        </div>

        <div className="min-w-[220px] flex-1 max-w-sm">
          <ProgresoTope acumulado={f.acumulado} tope={f.topeCategoria} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {alerta && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-medium">
              <AlertTriangle size={12} />
              Alerta
            </span>
          )}
          {sugerencia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-medium">
              <TrendingUp size={12} />
              Sugerido: {f.categoriaSugerida}
            </span>
          )}
          <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', abierto && 'rotate-180')} />
        </div>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-xs text-slate-500">
            {f.encargado && (
              <p>
                Estado: <span className="text-slate-700 font-medium">{f.encargado}</span>
              </p>
            )}
            {f.condicion && (
              <p>
                Condición: <span className="text-slate-700 font-medium">{f.condicion}</span>
              </p>
            )}
            {f.responsable && (
              <p>
                Responsable: <span className="text-slate-700 font-medium">{f.responsable}</span>
              </p>
            )}
            {f.puntoVenta && (
              <p>
                Punto de venta: <span className="text-slate-700 font-medium">{f.puntoVenta}</span>
              </p>
            )}
          </div>

          {mesesConDatos.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Facturación por mes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {mesesConDatos.map((m) => (
                  <div key={m.mes} className="bg-white rounded-xl border border-slate-200 px-2.5 py-2">
                    <p className="text-[11px] text-slate-400">{formatMesCorto(m.mes)}</p>
                    <p className="text-sm font-medium text-slate-700 tabular-nums">{formatMoney(m.monto)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Sin facturación mensual cargada todavía.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FacturacionMonotributo() {
  const [busqueda, setBusqueda] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['facturacion'],
    queryFn: api.getFacturacion,
  });

  const filas = data ?? [];
  const alertasCount = filas.filter((f) => esAlerta(f.aviso)).length;

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (soloAlertas && !esAlerta(f.aviso)) return false;
      if (term) {
        const match = f.cliente?.toLowerCase().includes(term) || String(f.cuit ?? '').includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [filas, busqueda, soloAlertas]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Receipt size={20} className="text-brand-600" />
          Facturación Monitoreada
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Seguimiento mensual de facturación por cliente y alertas de tope de categoría de Monotributo.
        </p>
      </div>

      <div className="flex justify-end -mt-1">
        <button
          onClick={() => setImportarOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-medium transition-colors"
        >
          <FileSpreadsheet size={15} />
          Importar Mis Comprobantes
        </button>
      </div>
      <ImportarComprobantesModal open={importarOpen} onClose={() => setImportarOpen(false)} />

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSoloAlertas(false)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              !soloAlertas
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'
            )}
          >
            Todos ({filas.length})
          </button>
          <button
            onClick={() => setSoloAlertas(true)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              soloAlertas
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-red-300'
            )}
          >
            <AlertTriangle size={12} />
            Con alerta ({alertasCount})
          </button>
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudo cargar la facturación: {(error as Error)?.message}
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
          {filtradas.map((f) => (
            <FilaFacturacion key={`${f.cliente}-${f.cuit}`} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Facturación: monitoreo de Monotributo (con topes) y control de Responsables Inscriptos (sin alertas). */
export default function FacturacionPage() {
  const [vista, setVista] = useState<'mono' | 'ri'>('mono');
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-full sm:w-fit">
        {([
          ['mono', 'Monotributistas'],
          ['ri', 'Responsables Inscriptos'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setVista(k)}
            className={clsx(
              'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              vista === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {vista === 'mono' ? <FacturacionMonotributo /> : <FacturacionRI />}
    </div>
  );
}
