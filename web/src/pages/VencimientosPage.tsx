import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, CalendarDays, Plus, Table2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { getUrgencia } from '../lib/dates';
import type { EstadoVencimiento, Vencimiento } from '../types';
import { VencimientosFilters } from '../components/vencimientos/VencimientosFilters';
import { VencimientosGrouped } from '../components/vencimientos/VencimientosGrouped';
import { VencimientosCalendar } from '../components/vencimientos/VencimientosCalendar';
import { NuevoVencimientoModal } from '../components/vencimientos/NuevoVencimientoModal';
import { DEFAULT_FILTERS, type VencimientosFiltersState } from '../components/vencimientos/types';
import { TableSkeleton } from '../components/ui/Skeleton';
import { GenerarVencimientos } from '../components/vencimientos/GenerarVencimientos';

type Vista = 'tabla' | 'calendario';

export default function VencimientosPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<VencimientosFiltersState>(DEFAULT_FILTERS);
  const [vista, setVista] = useState<Vista>('tabla');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vencimientos'],
    queryFn: api.getVencimientos,
  });

  const updateEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoVencimiento }) =>
      api.updateVencimiento(id, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vencimientos'] }),
  });

  const createVencimiento = useMutation({
    mutationFn: (payload: Omit<Vencimiento, 'id'>) => api.createVencimiento(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vencimientos'] });
      setModalOpen(false);
    },
  });

  const vencimientos = data ?? [];
  const presentados = vencimientos.filter((v) => v.estado === 'Presentado').length;
  const archivar = useMutation({
    mutationFn: api.archivarVencimientosPresentados,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vencimientos'] }),
  });

  const filtrados = useMemo(() => {
    return vencimientos.filter((v) => {
      if (filters.ocultarPresentados && v.estado === 'Presentado') return false;
      if (filters.cuit) {
        const term = filters.cuit.toLowerCase();
        const match = v.cuit?.toLowerCase().includes(term) || v.cliente?.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (filters.tipo !== 'Todos' && v.tipo !== filters.tipo) return false;
      if (filters.estado !== 'Todos' && v.estado !== filters.estado) return false;
      if (filters.desde && v.fechaVencimiento < filters.desde) return false;
      if (filters.hasta && v.fechaVencimiento > filters.hasta) return false;
      if (filters.soloAlertas && getUrgencia(v.fechaVencimiento, v.estado) === 'ok') return false;
      if (selectedDay && v.fechaVencimiento?.slice(0, 10) !== selectedDay) return false;
      return true;
    });
  }, [vencimientos, filters, selectedDay]);

  const alertCount = useMemo(
    () => vencimientos.filter((v) => getUrgencia(v.fechaVencimiento, v.estado) !== 'ok').length,
    [vencimientos]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <AlertTriangle size={14} />
              {alertCount} con alerta
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setVista('tabla')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                vista === 'tabla' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              <Table2 size={15} />
              Tabla
            </button>
            <button
              onClick={() => setVista('calendario')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                vista === 'calendario' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              <CalendarDays size={15} />
              Calendario
            </button>
          </div>

          {presentados > 0 && (
          <button
            onClick={() => {
              if (window.confirm('¿Archivar los ' + presentados + ' vencimientos presentados? Se mueven a la hoja Vencimientos Archivo y dejan de verse en el calendario.')) archivar.mutate();
            }}
            disabled={archivar.isPending}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            title="Archivar presentados"
          >
            <Archive size={15} />
            <span className="hidden sm:inline">Archivar presentados ({presentados})</span>
            <span className="sm:hidden">{presentados}</span>
          </button>
        )}


          <GenerarVencimientos />


          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
          >
            <Plus size={16} />
            Nuevo vencimiento
          </button>
        </div>
      </div>

      <VencimientosFilters value={filters} onChange={setFilters} />

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar los vencimientos: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : vista === 'tabla' ? (
        <VencimientosGrouped
          vencimientos={filtrados}
          pendingId={updateEstado.variables?.id}
          onEstadoChange={(id, estado) => updateEstado.mutate({ id, estado })}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          <VencimientosCalendar vencimientos={filters.ocultarPresentados ? vencimientos.filter((v) => v.estado !== 'Presentado') : vencimientos} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <VencimientosGrouped
            vencimientos={filtrados}
            pendingId={updateEstado.variables?.id}
            onEstadoChange={(id, estado) => updateEstado.mutate({ id, estado })}
          />
        </div>
      )}

      <NuevoVencimientoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        submitting={createVencimiento.isPending}
        onSubmit={(payload) => createVencimiento.mutate(payload)}
      />
    </div>
  );
}
