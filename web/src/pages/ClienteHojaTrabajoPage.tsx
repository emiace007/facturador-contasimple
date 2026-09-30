import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { getCategoriaInfo, mismoCuit, parseCategorias } from '../lib/clientes';
import { formatFechaCorta } from '../lib/dates';
import { formatMoney } from '../lib/format';

/**
 * Vista "hoja de trabajo" imprimible por cliente: junta en una sola página lo que hace
 * falta para trabajar la carpeta de un cliente (datos generales, vencimientos, tareas y
 * facturación). Se renderiza fuera del AppLayout (sin sidebar/header) para que quede
 * limpia al imprimir o exportar a PDF.
 */
export default function ClienteHojaTrabajoPage() {
  const { id } = useParams<{ id: string }>();

  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });
  const vencimientosQuery = useQuery({ queryKey: ['vencimientos'], queryFn: api.getVencimientos });
  const tareasQuery = useQuery({ queryKey: ['tareas'], queryFn: api.getTareas });
  const facturacionQuery = useQuery({ queryKey: ['facturacion'], queryFn: api.getFacturacion, retry: false });

  const cliente = useMemo(
    () => (clientesQuery.data ?? []).find((c) => c.id === id),
    [clientesQuery.data, id]
  );

  const vencimientosCliente = useMemo(() => {
    if (!cliente) return [];
    return (vencimientosQuery.data ?? []).filter((v) => mismoCuit(v.cuit, cliente.cuit));
  }, [vencimientosQuery.data, cliente]);

  const tareasCliente = useMemo(() => {
    if (!cliente) return [];
    const nombre = cliente.cliente?.trim().toLowerCase();
    if (!nombre) return [];
    return (tareasQuery.data ?? []).filter((t) => t.cliente?.trim().toLowerCase() === nombre);
  }, [tareasQuery.data, cliente]);

  const facturacionCliente = useMemo(() => {
    if (!cliente) return undefined;
    return (facturacionQuery.data ?? []).find(
      (f) => mismoCuit(f.cuit, cliente.cuit) || f.cliente?.trim().toLowerCase() === cliente.cliente?.trim().toLowerCase()
    );
  }, [facturacionQuery.data, cliente]);

  const cargando = clientesQuery.isLoading;

  if (cargando) {
    return <div className="p-8 text-center text-sm text-slate-400">Cargando hoja de trabajo...</div>;
  }

  if (!cliente) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-medium text-slate-600">No encontramos este cliente.</p>
        <Link to="/clientes" className="text-sm text-brand-600 hover:underline">
          Volver a Clientes
        </Link>
      </div>
    );
  }

  const categorias = parseCategorias(cliente.categoriasFiscales);
  const impuestosUnicos = Array.from(new Set(categorias.flatMap((c) => getCategoriaInfo(c).impuestos)));
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de acciones: no se imprime */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link
          to={`/clientes/${encodeURIComponent(cliente.id)}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-600"
        >
          <ArrowLeft size={15} />
          Volver a la ficha
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
        >
          <Printer size={16} />
          Imprimir / Exportar PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white print:shadow-none shadow-sm my-6 print:my-0 p-8 print:p-0 space-y-6 text-slate-800">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Estudio Contable Bertero</p>
            <h1 className="text-xl font-semibold mt-1">Hoja de trabajo — {cliente.cliente}</h1>
            <p className="text-sm text-slate-400 tabular-nums mt-0.5">{cliente.cuit || 'Sin CUIT cargado'}</p>
          </div>
          <p className="text-xs text-slate-400 whitespace-nowrap">Generado el {hoy}</p>
        </div>

        {/* Datos generales */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Datos generales</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex justify-between gap-3 col-span-1">
              <dt className="text-slate-500">Encargado</dt>
              <dd className="font-medium">{cliente.encargado || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 col-span-1">
              <dt className="text-slate-500">Estado</dt>
              <dd className="font-medium">{cliente.activo ? 'Activo' : 'Dado de baja'}</dd>
            </div>
            <div className="flex justify-between gap-3 col-span-2">
              <dt className="text-slate-500">Condición fiscal</dt>
              <dd className="font-medium text-right">{cliente.condicionFiscal || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 col-span-2">
              <dt className="text-slate-500">Categorías</dt>
              <dd className="font-medium text-right">{categorias.join(', ')}</dd>
            </div>
          </dl>
          {impuestosUnicos.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-medium text-slate-600">Impuestos que le corresponden: </span>
              {impuestosUnicos.join(', ')}
            </p>
          )}
          {cliente.observaciones && (
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-medium text-slate-600">Observaciones: </span>
              {cliente.observaciones}
            </p>
          )}
        </section>

        {/* Facturación */}
        {facturacionCliente && (
          <section className="break-inside-avoid">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Facturación / Monotributo</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Categoría actual</dt>
                <dd className="font-medium">{facturacionCliente.categoria || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Tope de categoría</dt>
                <dd className="font-medium">{formatMoney(facturacionCliente.topeCategoria)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Acumulado</dt>
                <dd className="font-medium">{formatMoney(facturacionCliente.acumulado)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Aviso</dt>
                <dd className="font-medium">{facturacionCliente.aviso || '—'}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Vencimientos */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Vencimientos ({vencimientosCliente.length})
          </h2>
          {vencimientosCliente.length === 0 ? (
            <p className="text-sm text-slate-400">Sin vencimientos cargados.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-2">Impuesto</th>
                  <th className="py-1.5 pr-2">Tipo</th>
                  <th className="py-1.5 pr-2">Vencimiento</th>
                  <th className="py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vencimientosCliente.map((v) => (
                  <tr key={v.id}>
                    <td className="py-1.5 pr-2">{v.impuesto}</td>
                    <td className="py-1.5 pr-2">{v.tipo}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{formatFechaCorta(v.fechaVencimiento)}</td>
                    <td className="py-1.5">{v.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Tareas */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Tareas ({tareasCliente.length})</h2>
          {tareasCliente.length === 0 ? (
            <p className="text-sm text-slate-400">Sin tareas cargadas.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-2">Obligación</th>
                  <th className="py-1.5 pr-2">Categoría</th>
                  <th className="py-1.5 pr-2">Responsable</th>
                  <th className="py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tareasCliente.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 pr-2">{t.obligacion}</td>
                    <td className="py-1.5 pr-2">{t.categoria}</td>
                    <td className="py-1.5 pr-2">{t.responsable || '—'}</td>
                    <td className="py-1.5">{t.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
