import { useMemo } from 'react';
import { AlertCircle, Clock, Inbox } from 'lucide-react';
import { groupByCliente } from '../../lib/groupByCliente';
import { getUrgencia } from '../../lib/dates';
import type { EstadoVencimiento, Vencimiento } from '../../types';
import { ClienteAccordion } from '../ui/ClienteAccordion';
import { VencimientosTable } from './VencimientosTable';

interface VencimientosGroupedProps {
  vencimientos: Vencimiento[];
  onEstadoChange: (id: string, estado: EstadoVencimiento) => void;
  pendingId?: string;
}

/** Agrupa los vencimientos por cliente (CUIT) para que cada uno tenga su propio panel plegable. */
export function VencimientosGrouped({ vencimientos, onEstadoChange, pendingId }: VencimientosGroupedProps) {
  const grupos = useMemo(
    () => groupByCliente(vencimientos, (v) => v.cliente, (v) => v.cuit),
    [vencimientos]
  );

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
    <div className="space-y-2">
      {grupos.map((g) => {
        const vencidos = g.items.filter((v) => getUrgencia(v.fechaVencimiento, v.estado) === 'vencido').length;
        const proximos = g.items.filter((v) => getUrgencia(v.fechaVencimiento, v.estado) === 'proximo').length;
        const avatarClasses = vencidos > 0 ? 'bg-red-500' : proximos > 0 ? 'bg-amber-500' : 'bg-brand-500';

        return (
          <ClienteAccordion
            key={g.key}
            cliente={g.cliente}
            cuit={g.cuit}
            avatarClasses={avatarClasses}
            defaultOpen={grupos.length === 1}
            resumen={
              <>
                <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">
                  {g.items.length} {g.items.length === 1 ? 'vencimiento' : 'vencimientos'}
                </span>
                {vencidos > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-medium">
                    <AlertCircle size={12} />
                    {vencidos} vencido{vencidos > 1 ? 's' : ''}
                  </span>
                )}
                {vencidos === 0 && proximos > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-medium">
                    <Clock size={12} />
                    {proximos} próximo{proximos > 1 ? 's' : ''}
                  </span>
                )}
              </>
            }
          >
            <div className="p-2">
              <VencimientosTable vencimientos={g.items} onEstadoChange={onEstadoChange} pendingId={pendingId} />
            </div>
          </ClienteAccordion>
        );
      })}
    </div>
  );
}
