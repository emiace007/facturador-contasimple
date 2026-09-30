import { Bell, Link2, Menu, RefreshCw, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAccountModal } from './AdminAccountModal';
import { useResumenCola } from '../../lib/colaFacturacion';

interface HeaderProps {
  title: string;
  alertCount?: number;
  onOpenMenu?: () => void;
  onOpenLinks?: () => void;
}

export function Header({ title, alertCount = 0, onOpenMenu, onOpenLinks }: HeaderProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const cola = useResumenCola();

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  function handleBuscarSubmit(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const term = busqueda.trim();
    navigate(term ? `/clientes?q=${encodeURIComponent(term)}` : '/clientes');
    setBuscarAbierto(false);
  }

  return (
    <header className="relative h-16 shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMenu}
          className="p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-500 lg:hidden shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base md:text-lg font-semibold text-slate-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 w-56 xl:w-64">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={handleBuscarSubmit}
            placeholder="Buscar cliente, CUIT... (Enter)"
            className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
          />
        </div>

        {cola.procesando && (
          <button
            onClick={() => navigate('/facturacion-masiva')}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 px-2.5 py-1 text-xs font-medium"
            title="Facturación masiva en curso"
          >
            <RefreshCw size={12} className="animate-spin" />
            <span className="hidden sm:inline">Facturando…</span> {cola.restantes}
          </button>
        )}

        <button
          onClick={() => setBuscarAbierto(true)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors lg:hidden"
          title="Buscar cliente"
          aria-label="Buscar cliente"
        >
          <Search size={18} />
        </button>

        <button
          onClick={handleRefresh}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Actualizar datos"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>

        <button
          className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Alertas"
        >
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenLinks}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Accesos directos"
        >
          <Link2 size={18} />
        </button>

        <button
          onClick={() => setAccountOpen(true)}
          className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-sm"
          title="Mi cuenta"
        >
          AB
        </button>
      </div>

      {buscarAbierto && (
        <div className="absolute inset-0 z-30 bg-white flex items-center gap-2 px-3 lg:hidden">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="search"
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={handleBuscarSubmit}
            placeholder="Buscar cliente o CUIT y tocá Enter"
            className="flex-1 min-w-0 bg-slate-100 rounded-xl px-3 py-2 text-base outline-none placeholder:text-slate-400"
          />
          <button
            onClick={() => setBuscarAbierto(false)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="Cerrar búsqueda"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <AdminAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </header>
  );
}
