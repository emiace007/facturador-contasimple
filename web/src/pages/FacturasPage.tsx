import { useQuery } from '@tanstack/react-query';
import { api, numeroFactura } from '../lib/api';
import { formatMonto } from '../lib/format';
import { card, ConComercio } from '../components/Aviso';

export default function FacturasPage() {
  return <ConComercio>{(c) => <Lista id={c.id} />}</ConComercio>;
}

function Lista({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['facturas', id], queryFn: api.facturas, refetchInterval: 5000 });
  const fs = q.data ?? [];
  const total = fs.filter((f) => f.estado === 'emitida').reduce((a, f) => a + Number(f.importe_total), 0);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Facturas</h1>
      <p className="text-sm text-slate-500">{fs.length} facturas · {formatMonto(total)} emitido</p>
      <div className={card + ' !p-0 divide-y divide-slate-100'}>
        {q.isLoading && <p className="p-5 text-sm text-slate-400">Cargando…</p>}
        {!q.isLoading && fs.length === 0 && <p className="p-5 text-sm text-slate-400">Todavía no hay facturas.</p>}
        {fs.map((f) => (
          <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{numeroFactura(f)}</p>
              <p className="text-xs text-slate-400 tabular-nums">
                {f.fecha_comprobante.slice(0, 10).split('-').reverse().join('/')} · {f.receptor_nombre || (f.doc_tipo === 99 ? 'Consumidor final' : f.doc_nro)}
                {f.cae && ` · CAE ${f.cae}`}
                {f.estado === 'error' && <span className="text-red-600"> · {f.error}</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm tabular-nums">{formatMonto(f.importe_total)}</p>
              <p className={'text-xs ' + (f.estado === 'emitida' ? 'text-green-600' : f.estado === 'error' ? 'text-red-600' : 'text-amber-600')}>{f.estado}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
