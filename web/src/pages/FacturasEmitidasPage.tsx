import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { formatFechaFactura, tituloFactura } from '../lib/facturas';
import { FacturaCompartir } from '../components/facturas/FacturaCompartir';
import { ClienteAccordion } from '../components/ui/ClienteAccordion';
import { TableSkeleton } from '../components/ui/Skeleton';
import type { FacturaEmitida } from '../types';
import type { ComprobanteGuardado } from '../types/comprobantes';

const NC = [3, 8, 13, 53, 203, 208, 213];

type Item =
  | { tipo: 'sistema'; key: string; fechaIso: string; importe: number; f: FacturaEmitida }
  | { tipo: 'arca'; key: string; fechaIso: string; importe: number; c: ComprobanteGuardado };

interface Grupo {
  cuit: string;
  cliente: string;
  items: Item[];
  total: number;
  sistema: number;
  arca: number;
}

/** 'dd/MM/yyyy' o 'yyyy-MM-dd' → 'yyyy-MM-dd'. */
function aIso(fecha: string): string {
  const s = String(fecha || '').replace(/^'/, '');
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s.slice(0, 10);
}

function claveCbte(cuit: string, tipo: number, pv: number, nro: number): string {
  return String(cuit).replace(/\D/g, '') + '|' + Number(tipo) + '|' + Number(pv) + '|' + Number(nro);
}

/**
 * Facturas emitidas por cliente: las hechas desde el sistema (con PDF y WhatsApp) más las
 * importadas de Mis Comprobantes de ARCA que no salieron del sistema, sin duplicar.
 */
export default function FacturasEmitidasPage() {
  const [busqueda, setBusqueda] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [origen, setOrigen] = useState<'todas' | 'sistema' | 'arca'>('todas');

  const sistemaQuery = useQuery({ queryKey: ['facturas-emitidas'], queryFn: () => api.getFacturasEmitidas(), retry: false });
  const arcaQuery = useQuery({ queryKey: ['comprobantes-arca'], queryFn: api.getComprobantesArca, retry: false });
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });

  const { grupos, anios } = useMemo(() => {
    const nombres = new Map<string, string>();
    (clientesQuery.data ?? []).forEach((c) => nombres.set(String(c.cuit).replace(/\D/g, ''), c.cliente));

    const items: { cuit: string; nombre: string; item: Item }[] = [];
    const delSistema = new Set<string>();
    for (const f of sistemaQuery.data ?? []) {
      const cuit = String(f.cuitEmisor ?? '').replace(/\D/g, '');
      delSistema.add(claveCbte(cuit, f.cbteTipo, f.ptoVta, f.numero));
      items.push({
        cuit,
        nombre: String(f.emisor || ''),
        item: { tipo: 'sistema', key: 's' + f.id, fechaIso: aIso(String(f.fecha)), importe: Number(f.importe) || 0, f },
      });
    }
    for (const c of arcaQuery.data ?? []) {
      if (delSistema.has(claveCbte(c.cuit, c.tipo, c.ptoVta, c.numero))) continue;
      items.push({ cuit: c.cuit, nombre: c.cliente, item: { tipo: 'arca', key: 'a' + c.clave, fechaIso: c.fecha, importe: Number(c.total) || 0, c } });
    }

    const anios = [...new Set(items.map((i) => i.item.fechaIso.slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort().reverse();
    const term = busqueda.trim().toLowerCase();
    const mapa = new Map<string, Grupo>();
    for (const { cuit, nombre, item } of items) {
      if (anio !== 'todos' && item.fechaIso.slice(0, 4) !== anio) continue;
      if (origen !== 'todas' && item.tipo !== origen) continue;
      const cliente = nombres.get(cuit) || nombre || cuit || 'Sin cliente';
      const receptor = item.tipo === 'sistema' ? String(item.f.receptor ?? '') : item.c.receptor;
      if (term && !cliente.toLowerCase().includes(term) && !cuit.includes(term) && !receptor.toLowerCase().includes(term)) continue;
      const g = mapa.get(cuit || cliente) ?? { cuit, cliente, items: [], total: 0, sistema: 0, arca: 0 };
      g.items.push(item);
      g.total += item.importe;
      if (item.tipo === 'sistema') g.sistema++;
      else g.arca++;
      mapa.set(cuit || cliente, g);
    }
    const grupos = [...mapa.values()]
      .map((g) => ({ ...g, items: g.items.sort((a, b) => b.fechaIso.localeCompare(a.fechaIso)) }))
      .sort((a, b) => a.cliente.localeCompare(b.cliente));
    return { grupos, anios };
  }, [sistemaQuery.data, arcaQuery.data, clientesQuery.data, busqueda, anio, origen]);

  const cantidad = grupos.reduce((s, g) => s + g.items.length, 0);
  const total = grupos.reduce((s, g) => s + g.total, 0);
  const cargando = sistemaQuery.isLoading || arcaQuery.isLoading;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FileText size={20} className="text-brand-600" />
          Facturas emitidas
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Todo lo facturado por cada cliente: lo emitido desde el sistema y lo importado de Mis Comprobantes de ARCA, sin duplicar.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, CUIT o receptor..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={anio} onChange={(e) => setAnio(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm bg-white">
            {[...new Set([String(new Date().getFullYear()), ...anios])].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="todos">Todos los años</option>
          </select>
          <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
            {([
              ['todas', 'Todas'],
              ['sistema', 'Del sistema'],
              ['arca', 'Importadas de ARCA'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setOrigen(k)}
                className={clsx('px-2.5 py-1 rounded-lg font-medium', origen === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}
              >
                {label}
              </button>
            ))}
          </div>
          {!cargando && cantidad > 0 && (
            <p className="text-xs text-slate-500 ml-auto">
              {cantidad} comprobante{cantidad !== 1 ? 's' : ''} de {grupos.length} cliente{grupos.length !== 1 ? 's' : ''} · total{' '}
              <b className="tabular-nums">{formatMoney(total)}</b>
            </p>
          )}
        </div>
      </div>

      {sistemaQuery.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudo cargar el historial: {(sistemaQuery.error as Error)?.message}
        </div>
      )}

      {cargando ? (
        <TableSkeleton rows={6} cols={4} />
      ) : grupos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">
          No hay facturas para este filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((g) => (
            <ClienteAccordion
              key={g.cuit || g.cliente}
              cliente={g.cliente}
              cuit={g.cuit}
              defaultOpen={grupos.length === 1 || busqueda.trim().length > 0}
              resumen={
                <>
                  <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">
                    {g.items.length} comprobante{g.items.length !== 1 ? 's' : ''}
                    {g.arca > 0 && g.sistema > 0 && ' (' + g.sistema + ' sistema · ' + g.arca + ' ARCA)'}
                  </span>
                  <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 text-xs font-medium tabular-nums">
                    {formatMoney(g.total)}
                  </span>
                </>
              }
            >
              <div className="divide-y divide-slate-100">
                {g.items.slice(0, 300).map((it) =>
                  it.tipo === 'sistema' ? (
                    <div key={it.key} className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {tituloFactura(it.f.cbteTipo, it.f.ptoVta, it.f.numero)}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {it.f.origen === 'portal' ? 'emitida por el cliente' : 'emitida desde el sistema'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {formatFechaFactura(it.f.fecha)} · {formatMoney(it.importe)} · {it.f.receptor || 'Consumidor Final'} · CAE {String(it.f.cae)}
                        </p>
                      </div>
                      <FacturaCompartir
                        compacto
                        url={it.f.pdfUrl || undefined}
                        titulo={tituloFactura(it.f.cbteTipo, it.f.ptoVta, it.f.numero) + ' - ' + g.cliente}
                        cargarPdf={() => api.getFacturaPdf(it.f.id)}
                      />
                    </div>
                  ) : (
                    <div key={it.key} className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {it.c.tipoNombre || 'Comprobante ' + it.c.tipo} {String(it.c.ptoVta).padStart(5, '0')}-{String(it.c.numero).padStart(8, '0')}
                          <span className="ml-2 rounded-md bg-sky-50 text-sky-700 px-1.5 py-0.5 text-[10px] font-medium">importada de ARCA</span>
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {it.fechaIso.split('-').reverse().join('/')} ·{' '}
                          <span className={clsx(NC.includes(it.c.tipo) && 'text-red-600')}>{formatMoney(it.importe)}</span> · {it.c.receptor || 'Consumidor Final'}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
              {g.items.length > 300 && (
                <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
                  Se muestran los 300 más recientes de {g.items.length}. Usá el buscador o el filtro de año para ver otros.
                </p>
              )}
            </ClienteAccordion>
          ))}
        </div>
      )}
    </div>
  );
}
