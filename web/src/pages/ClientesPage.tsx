import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { CATEGORIA_FILTROS, parseCategorias } from '../lib/clientes';
import { ClienteCard } from '../components/clientes/ClienteCard';
import { ClientesGridSkeleton } from '../components/ui/Skeleton';
import { NuevoClienteModal } from '../components/clientes/NuevoClienteModal';

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '');
  const [categoria, setCategoria] = useState<string>('Todos');
  const [mostrarBajas, setMostrarBajas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const createCliente = useMutation({
    mutationFn: api.createCliente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setModalOpen(false);
    },
  });

  // Si llegamos desde el buscador del Header con ?q=..., sincronizamos el campo de búsqueda.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setBusqueda(q);
  }, [searchParams]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clientes'],
    queryFn: api.getClientes,
  });

  const clientes = data ?? [];

  const conteoPorCategoria = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clientes) {
      for (const cat of parseCategorias(c.categoriasFiscales)) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return counts;
  }, [clientes]);

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return clientes.filter((c) => {
      const categorias = parseCategorias(c.categoriasFiscales);
      if (!mostrarBajas && categorias.includes('Baja / Inactivo') && categorias.length === 1) return false;
      if (categoria !== 'Todos' && !categorias.includes(categoria)) return false;
      if (term) {
        const match =
          c.cliente?.toLowerCase().includes(term) ||
          String(c.cuit ?? '').includes(term) ||
          c.encargado?.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [clientes, busqueda, categoria, mostrarBajas]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-brand-600" />
            Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Perfil por cliente: quién es monotributista, responsable inscripto y qué le corresponde a cada uno.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, CUIT o encargado..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategoria('Todos')}
            className={clsx(
              'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              categoria === 'Todos'
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'
            )}
          >
            Todos ({clientes.length})
          </button>
          {CATEGORIA_FILTROS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                categoria === cat
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'
              )}
            >
              {cat} ({conteoPorCategoria[cat] ?? 0})
            </button>
          ))}

          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarBajas}
              onChange={(e) => setMostrarBajas(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            />
            Mostrar dados de baja
          </label>
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar los clientes: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <ClientesGridSkeleton />
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <Users size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">No hay clientes que coincidan</p>
          <p className="text-sm text-slate-400 mt-1">Probá ajustar la búsqueda o el filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((c) => (
            <ClienteCard key={c.id} cliente={c} />
          ))}
        </div>
      )}

      <NuevoClienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        submitting={createCliente.isPending}
        onSubmit={(payload) => createCliente.mutate(payload)}
      />
    </div>
  );
}
