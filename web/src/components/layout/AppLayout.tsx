import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickLinksPanel } from './QuickLinksPanel';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/vencimientos': 'Vencimientos',
  '/tareas': 'Seguimiento de Tareas',
  '/clientes': 'Clientes',
  '/alta-clientes': 'Alta de clientes',
  '/facturacion': 'Facturación Monitoreada',
  '/facturacion-masiva': 'Facturación masiva',
  '/facturas-emitidas': 'Facturas emitidas',
  '/recategorizaciones': 'Recategorizaciones',
  '/sociedades': 'Sociedades',
  '/ganancias': 'Ganancias 2025',
  '/sueldos': 'Sueldos',
  '/honorarios': 'Honorarios del estudio',
  '/balance': 'Ingresos y egresos',
};

export function AppLayout() {
  const { pathname } = useLocation();
  const title = pathname.startsWith('/clientes/') ? 'Ficha de cliente' : TITLES[pathname] ?? 'Estudio Contable';

  const [menuOpen, setMenuOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  // Cerrar los drawers al navegar entre secciones.
  useEffect(() => {
    setMenuOpen(false);
    setLinksOpen(false);
  }, [pathname]);

  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenLinks={() => setLinksOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <QuickLinksPanel open={linksOpen} onClose={() => setLinksOpen(false)} />
    </div>
  );
}
