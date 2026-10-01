import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, numeroFactura, TIPOS, type Factura } from '../lib/api';
import { formatMonto } from '../lib/format';
import { hoyIso } from '../lib/fechaFactura';
import { boton, ConComercio } from '../components/Aviso';
import AccionesPdf from '../components/PdfBoton';

export default function FacturasPage() {
  return <ConComercio>{(c) => <Lista id={c.id} />}</ConComercio>;
}

function tituloDia(iso: string): string {
  const hoy = hoyIso();
  const [y, m, d] = hoy.split('-').map(Number);
  const ayer = new Date(y, m - 1, d - 1);
  const ayerIso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
  if (iso === hoy) return 'Hoy';
  if (iso === ayerIso) return 'Ayer';
  const f = new Date(iso + 'T12:00:00');
  const txt = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

const receptor = (f: Factura) => f.receptor_nombre || (f.doc_tipo === 99 ? 'Consumidor final' : `${f.doc_tipo === 80 ? 'CUIT' : 'DNI'} ${f.doc_nro}`);

/** Una factura en la lista: tarjeta grande, con PDF y Compartir si está emitida. */
export function FilaFactura({ f }: { f: Factura }) {
  const titulo = numeroFactura(f);
  const tipo = TIPOS[f.cbte_tipo] ?? 'Factura';
  const nro = f.numero ? `N.º ${String(f.punto_venta).padStart(5, '0')}-${String(f.numero).padStart(8, '0')}` : 'Sin número';
  return (
    <article className="rounded-2xl bg-white border border-slate-200/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-brand-950">{receptor(f)}</p>
          <p className="text-sm text-slate-500">{tipo}</p>
          <p className="text-sm text-slate-500 tabular-nums">{nro}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold tabular-nums text-brand-950">{formatMonto(f.importe_total)}</p>
          <span className={clsx('inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold',
            f.estado === 'emitida' ? 'bg-[#e3f5ec] text-[#14724d]' : f.estado === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
            {f.estado === 'emitida' ? 'Emitida' : f.estado === 'error' ? 'Con error' : 'Enviando…'}
          </span>
        </div>
      </div>
      {f.estado === 'error' && (
        <>
          <p className="mt-2 text-sm text-red-700 break-words">{f.error}</p>
          <BorrarFactura id={f.id} />
        </>
      )}
      {f.estado === 'emitida' && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-400 tabular-nums">CAE {f.cae}</p>
          <AccionesPdf id={f.id} nombre={titulo} />
        </div>
      )}
    </article>
  );
}

/** Borra una factura que ARCA no aceptó (no tiene validez, así que no hace falta nota de crédito). */
function BorrarFactura({ id }: { id: string }) {
  const qc = useQueryClient();
  const [seguro, setSeguro] = useState(false);
  const m = useMutation({
    mutationFn: () => api.borrarFactura(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facturas'] }); qc.invalidateQueries({ queryKey: ['resumen'] }); },
  });
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      {m.error && <p className="text-sm text-red-600 w-full text-right">{(m.error as Error).message}</p>}
      {!seguro ? (
        <button onClick={() => setSeguro(true)} className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-red-50 text-red-700 text-sm font-bold active:bg-red-100">
          <Trash2 size={18} /> Borrar
        </button>
      ) : (
        <>
          <span className="text-sm text-slate-600">¿Borrar esta factura con error?</span>
          <button onClick={() => setSeguro(false)} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">No</button>
          <button onClick={() => m.mutate()} disabled={m.isPending} className="h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50">
            {m.isPending ? 'Borrando…' : 'Sí, borrar'}
          </button>
        </>
      )}
    </div>
  );
}

function Lista({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['facturas', id], queryFn: api.facturas, refetchInterval: 5000 });
  const fs = q.data ?? [];
  const grupos: { dia: string; items: Factura[]; total: number }[] = [];
  for (const f of fs) {
    const dia = f.fecha_comprobante.slice(0, 10);
    let g = grupos.find((x) => x.dia === dia);
    if (!g) { g = { dia, items: [], total: 0 }; grupos.push(g); }
    g.items.push(f);
    if (f.estado === 'emitida') g.total += Number(f.importe_total);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-extrabold text-brand-950">Facturas</h1>
        <Link to="/facturar" className={boton + ' hidden md:inline-flex'}><Plus size={20} /> Nueva factura</Link>
      </div>
      {q.isLoading && <p className="text-base text-slate-400">Cargando…</p>}
      {!q.isLoading && fs.length === 0 && (
        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-8 text-center space-y-4">
          <p className="text-base text-slate-600">Todavía no hay facturas.</p>
          <Link to="/facturar" className={boton}><Plus size={20} /> Hacer la primera</Link>
        </div>
      )}
      {grupos.map((g) => (
        <section key={g.dia} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-base font-extrabold text-brand-900">{tituloDia(g.dia)}</h2>
            <span className="text-sm font-semibold text-slate-500 tabular-nums">{formatMonto(g.total)}</span>
          </div>
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {g.items.map((f) => <FilaFactura key={f.id} f={f} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
