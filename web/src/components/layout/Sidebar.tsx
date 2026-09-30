import { NavLink } from 'react-router-dom';
import {
  Banknote,
  Building2,
  CalendarClock,
  FileText,
  KanbanSquare,
  Landmark,
  LayoutDashboard,
  Layers,
  Receipt,
  RefreshCcw,
  Scale,
  Users,
    UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vencimientos', label: 'Vencimientos', icon: CalendarClock, end: false },
  { to: '/tareas', label: 'Tareas', icon: KanbanSquare, end: false },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/alta-clientes', label: 'Alta de clientes', icon: UserPlus, end: false },
  { to: '/facturacion', label: 'Facturación', icon: Receipt, end: false },
  { to: '/facturacion-masiva', label: 'Facturación masiva', icon: Layers, end: false },
  { to: '/facturas-emitidas', label: 'Facturas emitidas', icon: FileText, end: false },
  { to: '/honorarios', label: 'Honorarios', icon: Banknote, end: false },
  { to: '/balance', label: 'Ingresos y egresos', icon: Scale, end: false },
  { to: '/recategorizaciones', label: 'Recategorizaciones', icon: RefreshCcw, end: false },
  { to: '/sociedades', label: 'Sociedades', icon: Building2, end: false },
  { to: '/ganancias', label: 'Ganancias 2025', icon: Landmark, end: false },
  { to: '/sueldos', label: 'Sueldos', icon: Wallet, end: false },
];

interface SidebarProps {
  /** En mobile, controla si el drawer está abierto. En desktop no tiene efecto (siempre visible). */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Backdrop, solo mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'bg-gradient-to-b from-brand-800 to-brand-950 text-white flex flex-col w-64 shrink-0',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10">
          <img src="/logo-ab.png" alt="AB" className="h-9 w-9 rounded-xl shrink-0 shadow-lg shadow-brand-950/40" />
          <span className="min-w-0 leading-tight">
            <span className="block font-semibold tracking-tight truncate">Antonella Bertero</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-brand-200/80">Estudio contable</span>
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-xl hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-900/30'
                    : 'text-brand-100/80 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 text-xs text-brand-100/50 border-t border-white/10">
          Datos sincronizados con Google Sheets
        </div>
      </aside>
    </>
  );
}
