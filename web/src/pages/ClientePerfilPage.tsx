import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileText,
  Info,
  KanbanSquare,
  KeyRound,
  Landmark,
  Printer,
  Receipt,
  StickyNote,
  UserCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { getCategoriaInfo, mismoCuit, parseCategorias, parsePuntoVenta } from '../lib/clientes';
import { formatFechaCorta } from '../lib/dates';
import { CategoriaBadge } from '../components/clientes/CategoriaBadge';
import { FacturarAfipModal } from '../components/clientes/FacturarAfipModal';
import { GenerarAccesoModal } from '../components/clientes/GenerarAccesoModal';
import { VencimientosTable } from '../components/vencimientos/VencimientosTable';
import type { EstadoVencimiento } from '../types';

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** ARCA (ex-AFIP): acceso federal, es el mismo para todos los clientes. */
const ARCA_URL = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml';

const ESTADO_TAREA_CLASSES: Record<string, string> = {
  'Por Hacer': 'bg-slate-100 text-slate-600',
  'En Proceso': 'bg-blue-50 text-blue-700',
  Revisión: 'bg-amber-50 text-amber-700',
  Completado: 'bg-emerald-50 text-emerald-700',
};

export default function ClientePerfilPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [facturarOpen, setFacturarOpen] = useState(false);
  const [accesoOpen, setAccesoOpen] = useState(false);

  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });
  const vencimientosQuery = useQuery({ queryKey: ['vencimientos'], queryFn: api.getVencimientos });
  const tareasQuery = useQuery({ queryKey: ['tareas'], queryFn: api.getTareas });
  const quickLinksQuery = useQuery({ queryKey: ['accesos'], queryFn: api.getQuickLinks, retry: false });
  const facturacionQuery = useQuery({ queryKey: ['facturacion'], queryFn: api.getFacturacion, retry: false });

  const updateEstado = useMutation({
    mutationFn: ({ vid, estado }: { vid: string; estado: EstadoVencimiento }) =>
      api.updateVencimiento(vid, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vencimientos'] }),
  });

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

  if (clientesQuery.isLoading) {
    return <div className="text-sm text-slate-400 py-12 text-center">Cargando ficha del cliente...</div>;
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={15} />
          Volver a Clientes
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center">
          <p className="text-sm font-medium text-slate-600">No encontramos este cliente.</p>
          <p className="text-sm text-slate-400 mt-1">Puede que el enlace esté desactualizado.</p>
        </div>
      </div>
    );
  }

  const categorias = parseCategorias(cliente.categoriasFiscales);
  const principal = getCategoriaInfo(categorias[0]);
  const impuestosUnicos = Array.from(new Set(categorias.flatMap((c) => getCategoriaInfo(c).impuestos)));

  const accesosMunicipales = (quickLinksQuery.data ?? []).filter((l) =>
    l.categoria?.toLowerCase().includes('municip')
  );

  const facturacionCliente = (facturacionQuery.data ?? []).find(
    (f) => mismoCuit(f.cuit, cliente.cuit) || f.cliente?.trim().toLowerCase() === cliente.cliente?.trim().toLowerCase()
  );
  const puntoVentaSugerido = parsePuntoVenta(facturacionCliente?.puntoVenta);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={15} />
          Volver a Clientes
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFacturarOpen(true)}
            disabled={!cliente.cuit}
            title={!cliente.cuit ? 'Este cliente no tiene CUIT cargado' : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none text-white px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Receipt size={15} />
            Facturar
          </button>
          <Link
            to={`/clientes/${encodeURIComponent(cliente.id)}/hoja-trabajo`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 px-3 py-1.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700 transition-colors"
          >
            <Printer size={15} />
            Hoja de trabajo
          </Link>
          <button
            onClick={() => setAccesoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 px-3 py-1.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700 transition-colors"
          >
            <KeyRound size={15} />
            Generar acceso
          </button>
        </div>
      </div>

      <FacturarAfipModal
        open={facturarOpen}
        onClose={() => setFacturarOpen(false)}
        cliente={cliente}
        puntoVentaSugerido={puntoVentaSugerido}
      />
      <GenerarAccesoModal open={accesoOpen} onClose={() => setAccesoOpen(false)} cliente={cliente} />

      {/* Encabezado */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`h-16 w-16 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-xl ${principal.dotClasses}`}
          >
            {iniciales(cliente.cliente) || <UserCircle2 size={28} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-slate-800 truncate">{cliente.cliente}</h1>
            <p className="text-sm text-slate-400 tabular-nums">{cliente.cuit || 'Sin CUIT cargado'}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {categorias.map((c) => (
                <CategoriaBadge key={c} categoria={c} size="md" />
              ))}
            </div>
          </div>
        </div>

        {/* Accesos rápidos: ARCA (ex-AFIP) + municipalidades cargadas en Accesos Directos */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Accesos rápidos</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={ARCA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 px-3 py-1.5 text-sm font-medium hover:bg-brand-100 transition-colors"
            >
              <Landmark size={15} />
              ARCA (ex AFIP)
              <ExternalLink size={12} className="text-brand-400" />
            </a>

            {accesosMunicipales.length > 0 ? (
              accesosMunicipales.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 px-3 py-1.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700 transition-colors"
                >
                  <Building2 size={15} />
                  {link.label}
                  <ExternalLink size={12} className="text-slate-400" />
                </a>
              ))
            ) : (
              <span className="inline-flex items-center text-xs text-slate-400 px-1 py-1.5">
                Sin accesos a municipalidad cargados (agregalos en la hoja "AccesosDirectos" con
                categoría "Municipal").
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Datos generales */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Info size={16} className="text-brand-600" />
            Datos generales
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Encargado</dt>
              <dd className="text-slate-800 font-medium text-right">{cliente.encargado || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Condición fiscal (texto original)</dt>
              <dd className="text-slate-800 font-medium text-right">{cliente.condicionFiscal || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Actividad mensual</dt>
              <dd className="text-slate-800 font-medium text-right">{cliente.actMensual || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Estado</dt>
              <dd className="text-right">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    cliente.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {cliente.activo ? 'Activo' : 'Dado de baja'}
                </span>
              </dd>
            </div>
          </dl>

          {cliente.observaciones && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                <StickyNote size={12} />
                Observaciones
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">{cliente.observaciones}</p>
            </div>
          )}
        </div>

        {/* Impuestos que le corresponden */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Briefcase size={16} className="text-brand-600" />
            Impuestos que le corresponden
          </h2>

          <div className="space-y-4">
            {categorias.map((cat) => {
              const info = getCategoriaInfo(cat);
              const Icon = info.icon;
              return (
                <div key={cat} className="flex gap-3">
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${info.badgeClasses.replace('border-', 'border ')}`}
                  >
                    <Icon size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{info.label}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{info.descripcion}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {impuestosUnicos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
              {impuestosUnicos.map((imp) => (
                <span key={imp} className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs text-slate-600">
                  {imp}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vencimientos del cliente */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <CalendarClock size={16} className="text-brand-600" />
          Vencimientos de este cliente
          <span className="text-xs font-normal text-slate-400">({vencimientosCliente.length})</span>
        </h2>
        {vencimientosQuery.isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 text-center text-sm text-slate-400">
            Cargando...
          </div>
        ) : vencimientosCliente.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
            <FileText size={22} className="text-slate-300" />
            No hay vencimientos cargados para este cliente todavía.
          </div>
        ) : (
          <VencimientosTable
            vencimientos={vencimientosCliente}
            pendingId={updateEstado.variables?.vid}
            onEstadoChange={(vid, estado) => updateEstado.mutate({ vid, estado })}
          />
        )}
      </div>

      {/* Tareas del cliente */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <KanbanSquare size={16} className="text-brand-600" />
          Tareas de este cliente
          <span className="text-xs font-normal text-slate-400">({tareasCliente.length})</span>
        </h2>
        {tareasQuery.isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 text-center text-sm text-slate-400">
            Cargando...
          </div>
        ) : tareasCliente.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
            <ClipboardList size={22} className="text-slate-300" />
            No hay tareas cargadas para este cliente todavía.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm divide-y divide-slate-100">
            {tareasCliente.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.obligacion}</p>
                  <p className="text-xs text-slate-400">
                    {t.categoria} · {t.responsable || 'Sin asignar'}
                    {t.fechaLimite ? ` · vence ${formatFechaCorta(t.fechaLimite)}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    ESTADO_TAREA_CLASSES[t.estado] ?? ESTADO_TAREA_CLASSES['Por Hacer']
                  }`}
                >
                  {t.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
