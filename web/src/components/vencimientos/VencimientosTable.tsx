import { Inbox } from 'lucide-react';
import clsx from 'clsx';
import { formatFechaCorta } from '../../lib/dates';
import type { EstadoVencimiento, Vencimiento } from '../../types';
import { AlertaBadge } from './AlertaBadge';
import { EstadoSelect } from './EstadoSelect';

interface VencimientosTableProps {
  vencimientos: Vencimiento[];
  onEstadoChange: (id: string, estado: EstadoVencimiento) => void;
  pendingId?: string;
}

const TIPO_COLORS: Record<string, string> = {
  AFIP: 'bg-indigo-50 text-indigo-700',
  'Ingresos Brutos': 'bg-fuchsia-50 text-fuchsia-700',
  Municipal: 'bg-teal-50 text-teal-700',
  Otro: 'bg-slate-100 text-slate-600',
};

export function VencimientosTable({ vencimientos, onEstadoChange, pendingId }: VencimientosTableProps) {
  if (vencimientos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <Inbox size={32} className="text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No hay vencimientos que coincidan</p>
        <p className="text-sm text-slate-400 mt-1">Probá ajustar los filtros o cargar datos en la hoja Vencimientos.</p>
      </div>
    );
  }

  return (
    <>
      {/* Celular: una tarjeta por vencimiento, sin scroll horizontal */}
      <ul className="md:hidden space-y-2">
        {vencimientos.map((v) => (
          <li key={v.id} className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{v.impuesto}</p>
                <p className="text-xs text-slate-500 truncate">
                  {v.cliente} · <span className="tabular-nums">{v.cuit}</span>
                </p>
              </div>
              <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', TIPO_COLORS[v.tipo] ?? TIPO_COLORS.Otro)}>
                {v.tipo}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700 tabular-nums font-medium">{formatFechaCorta(v.fechaVencimiento)}</span>
                <AlertaBadge fechaVencimiento={v.fechaVencimiento} estado={v.estado} />
              </div>
              <EstadoSelect
                value={v.estado}
                disabled={pendingId === v.id}
                onChange={(estado) => onEstadoChange(v.id, estado)}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet y escritorio: tabla */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 lg:px-4 py-3">Cliente</th>
              <th className="px-3 lg:px-4 py-3 hidden lg:table-cell">CUIT</th>
              <th className="px-3 lg:px-4 py-3">Impuesto</th>
              <th className="px-3 lg:px-4 py-3">Tipo</th>
              <th className="px-3 lg:px-4 py-3">Vencimiento</th>
              <th className="px-3 lg:px-4 py-3">Alerta</th>
              <th className="px-3 lg:px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vencimientos.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-3 lg:px-4 py-3 font-medium text-slate-800">{v.cliente}</td>
                <td className="px-3 lg:px-4 py-3 text-slate-500 tabular-nums hidden lg:table-cell">{v.cuit}</td>
                <td className="px-3 lg:px-4 py-3 text-slate-600">{v.impuesto}</td>
                <td className="px-3 lg:px-4 py-3">
                  <span className={clsx('rounded-md px-2 py-0.5 text-xs font-medium', TIPO_COLORS[v.tipo] ?? TIPO_COLORS.Otro)}>
                    {v.tipo}
                  </span>
                </td>
                <td className="px-3 lg:px-4 py-3 text-slate-600 tabular-nums">{formatFechaCorta(v.fechaVencimiento)}</td>
                <td className="px-3 lg:px-4 py-3">
                  <AlertaBadge fechaVencimiento={v.fechaVencimiento} estado={v.estado} />
                </td>
                <td className="px-3 lg:px-4 py-3">
                  <EstadoSelect
                    value={v.estado}
                    disabled={pendingId === v.id}
                    onChange={(estado) => onEstadoChange(v.id, estado)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
