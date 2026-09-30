import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, FileSpreadsheet, Info } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import type { FacturacionRI as FilaRI } from '../../types/comprobantes';
import { ImportarComprobantesModal } from './ImportarComprobantesModal';

function mesCorto(p: string): string {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
}

function Fila({ f }: { f: FilaRI }) {
  const [abierto, setAbierto] = useState(false);
  const valores = f.meses.map((m) => (f.fuente === 'ARCA' ? m.arca : m.sistema));
  const max = Math.max(1, ...valores.map((v) => Math.abs(v)));
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <button onClick={() => setAbierto((v) => !v)} className="w-full flex flex-wrap items-center gap-3 sm:gap-4 p-4 text-left hover:bg-slate-50/60">
        <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 font-semibold text-xs">RI</div>
        <div className="min-w-[160px] flex-1">
          <p className="font-medium text-slate-800 truncate">{f.cliente}</p>
          <p className="text-xs text-slate-400 tabular-nums">{f.cuit}</p>
        </div>
        <div className="hidden sm:flex items-end gap-1 h-10">
          {valores.map((v, i) => (
            <div key={i} title={mesCorto(f.meses[i].mes) + ': ' + formatMoney(v)} className="w-2.5 rounded-t bg-brand-400/80" style={{ height: Math.max(2, (Math.abs(v) / max) * 40) + 'px' }} />
          ))}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Facturado {new Date().getFullYear()}</p>
          <p className="font-semibold text-slate-800 tabular-nums">{formatMoney(f.totalAnio)}</p>
          <p className="text-[11px] text-slate-400">{f.fuente === 'ARCA' ? 'según Mis Comprobantes' : f.fuente === 'Sistema' ? 'solo facturas del sistema' : 'sin datos cargados'}</p>
        </div>
        <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {f.meses.map((m) => (
              <div key={m.mes} className="bg-white rounded-xl border border-slate-200 px-2.5 py-2">
                <p className="text-[11px] text-slate-400 capitalize">{mesCorto(m.mes)}</p>
                <p className="text-sm font-medium text-slate-700 tabular-nums">{formatMoney(f.fuente === 'ARCA' ? m.arca : m.sistema)}</p>
                {f.fuente === 'ARCA' && m.sistema > 0 && <p className="text-[10px] text-slate-400 tabular-nums">sistema {formatMoney(m.sistema)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Facturación del año de los Responsables Inscriptos: solo para control, sin topes ni alertas. */
export function FacturacionRI() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['facturacion-ri'], queryFn: api.getFacturacionRI });
  const [importar, setImportar] = useState(false);
  const filas = data ?? [];
  const total = filas.reduce((s, f) => s + f.totalAnio, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="flex items-start gap-2 text-sm text-slate-500 max-w-2xl">
          <Info size={16} className="shrink-0 mt-0.5 text-brand-600" />
          Control de lo facturado en el año por los Responsables Inscriptos y SAS. No tiene topes ni alertas: sirve para seguir la evolución y
          tener el dato a mano. Se completa con lo importado de Mis Comprobantes y con las facturas emitidas desde el sistema.
        </p>
        <button onClick={() => setImportar(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-medium">
          <FileSpreadsheet size={15} /> Importar Mis Comprobantes
        </button>
      </div>
      {filas.length > 0 && (
        <p className="text-sm text-slate-600">
          {filas.length} cliente{filas.length !== 1 ? 's' : ''} · total facturado en el año <b className="tabular-nums">{formatMoney(total)}</b>
        </p>
      )}
      {isError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">No se pudo cargar: {(error as Error)?.message}</div>}
      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-10">Cargando...</p>
      ) : filas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-10 text-center text-sm text-slate-400">
          No hay clientes Responsables Inscriptos cargados.
        </div>
      ) : (
        <div className="space-y-2">{filas.map((f) => <Fila key={f.cuit} f={f} />)}</div>
      )}
      <ImportarComprobantesModal open={importar} onClose={() => setImportar(false)} />
    </div>
  );
}
