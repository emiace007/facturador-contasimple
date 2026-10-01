import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileText, Home, Layers, LogOut, Menu, Package, Plus, UserCircle, Users } from 'lucide-react';
import clsx from 'clsx';
import { api, nombreComercio, getComercioElegido, getSesion, setComercioElegido, setSesion, type Comercio, type Sesion } from './lib/api';
import LoginPage from './pages/LoginPage';
import InicioPage from './pages/InicioPage';
import FacturarPage from './pages/FacturarPage';
import FacturasPage from './pages/FacturasPage';
import ProductosPage from './pages/ProductosPage';
import MasivaPage from './pages/MasivaPage';
import ComerciosPage from './pages/ComerciosPage';
import UsuariosPage from './pages/UsuariosPage';
import CuentaPage from './pages/CuentaPage';
import MasPage from './pages/MasPage';

/** Comercio con el que se está trabajando: el del dueño, o el que eligió el estudio. */
export function useComercio(): { comercio: Comercio | null; cargando: boolean } {
  const s = getSesion();
  const q = useQuery({
    queryKey: ['comercio-actual', s?.comercioId ?? getComercioElegido()],
    queryFn: async () => {
      const id = s?.rol === 'staff' ? getComercioElegido() : s?.comercioId;
      if (!id) return null;
      if (s?.rol === 'staff') return (await api.comercios()).find((c) => c.id === id) ?? null;
      return (await api.miComercio()) ?? null;
    },
    enabled: !!s,
  });
  return { comercio: q.data ?? null, cargando: q.isLoading };
}

interface ItemNav { to: string; label: string; icon: typeof Home }

export default function App() {
  const [sesion, setS] = useState<Sesion | null>(getSesion());
  const qc = useQueryClient();
  if (!sesion) return <LoginPage onLogin={(s) => { setSesion(s); setS(s); }} />;

  const esStaff = sesion.rol === 'staff';
  const esDueno = sesion.rol === 'dueno';
  const salir = async () => { await api.logout(); setSesion(null); setS(null); qc.clear(); };

  const lateral: ItemNav[] = [
    ...(esStaff ? [{ to: '/comercios', label: 'Comercios', icon: Building2 }] : []),
    { to: '/inicio', label: 'Inicio', icon: Home },
    { to: '/facturar', label: 'Facturar', icon: Plus },
    { to: '/facturas', label: 'Facturas', icon: FileText },
    { to: '/productos', label: 'Productos', icon: Package },
    { to: '/masiva', label: 'Carga masiva', icon: Layers },
    ...(esDueno ? [{ to: '/usuarios', label: 'Usuarios', icon: Users }] : []),
    { to: '/cuenta', label: 'Mi cuenta', icon: UserCircle },
  ];

  return (
    <div className="min-h-full bg-[#eef1f7] md:flex">
      {/* Escritorio: menú lateral */}
      <aside className="hidden md:flex md:w-64 shrink-0 bg-brand-600 md:sticky md:top-0 md:h-screen flex-col">
        <div className="px-6 pt-6 pb-5"><img src="/logo.png" alt="ContaSimple" className="h-8 w-auto" /></div>
        <nav className="flex flex-col gap-1 px-3 flex-1">
          {lateral.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => clsx('relative flex items-center gap-3 px-3.5 h-12 rounded-xl text-[15px] transition-colors',
                isActive
                  ? 'bg-white/15 text-white font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-acento-400'
                  : 'text-brand-100 hover:bg-white/10 hover:text-white')}>
              <n.icon size={20} /> {n.label}
            </NavLink>
          ))}
          <button onClick={salir} className="mt-auto mb-2 flex items-center gap-3 px-3.5 h-12 rounded-xl text-[15px] text-brand-100 hover:bg-white/10 hover:text-white">
            <LogOut size={20} /> Salir
          </button>
        </nav>
        {sesion.email && <p className="px-6 pb-5 text-xs text-brand-200 truncate">{sesion.email}</p>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <BarraSuperior esStaff={esStaff} />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10">
          <Routes>
            <Route path="/" element={<Navigate to={esStaff ? '/comercios' : '/inicio'} replace />} />
            {esStaff && <Route path="/comercios" element={<ComerciosPage />} />}
            <Route path="/inicio" element={<InicioPage />} />
            <Route path="/facturar" element={<FacturarPage />} />
            <Route path="/facturas" element={<FacturasPage />} />
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/masiva" element={<MasivaPage />} />
            {esDueno && <Route path="/usuarios" element={<UsuariosPage />} />}
            <Route path="/cuenta" element={<CuentaPage />} />
            <Route path="/mas" element={<MasPage onSalir={salir} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BarraInferior esStaff={esStaff} />
      </div>
    </div>
  );
}

/** Celular: logo y comercio arriba. En escritorio solo aparece el selector del estudio. */
function BarraSuperior({ esStaff }: { esStaff: boolean }) {
  const { comercio } = useComercio();
  return (
    <header className="sticky top-0 z-20 bg-brand-600 md:bg-transparent md:static pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 h-14 md:h-auto md:px-8 md:pt-6">
        <img src="/logo.png" alt="ContaSimple" className="h-6 w-auto md:hidden" />
        <div className="ml-auto md:ml-0 min-w-0 flex items-center gap-2">
          {esStaff ? <SelectorComercio /> : comercio && (
            <span className="truncate text-sm font-semibold text-white md:hidden">{nombreComercio(comercio)}</span>
          )}
        </div>
      </div>
    </header>
  );
}

function SelectorComercio() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['comercios'], queryFn: api.comercios });
  const actual = getComercioElegido() ?? '';
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="hidden md:inline text-sm text-slate-500">Trabajando para</span>
      <select value={actual} aria-label="Comercio"
        className="min-w-0 max-w-[60vw] md:max-w-xs h-10 rounded-xl border border-white/30 md:border-slate-300 bg-white/10 md:bg-white px-3 text-sm font-semibold text-white md:text-slate-800 [&>option]:text-slate-900"
        onChange={(e) => { setComercioElegido(e.target.value || null); qc.invalidateQueries(); window.location.reload(); }}>
        <option value="">Elegí un comercio</option>
        {(q.data ?? []).map((c) => <option key={c.id} value={c.id}>{nombreComercio(c)}</option>)}
      </select>
    </label>
  );
}

/** Celular: cuatro botones grandes abajo, con Facturar destacado en el medio. */
function BarraInferior({ esStaff }: { esStaff: boolean }) {
  const loc = useLocation();
  const items: ItemNav[] = [
    esStaff ? { to: '/comercios', label: 'Comercios', icon: Building2 } : { to: '/inicio', label: 'Inicio', icon: Home },
    { to: '/facturas', label: 'Facturas', icon: FileText },
    { to: '/productos', label: 'Productos', icon: Package },
    { to: '/mas', label: 'Más', icon: Menu },
  ];
  const tab = (n: ItemNav) => (
    <NavLink key={n.to} to={n.to}
      className={({ isActive }) => clsx('flex flex-1 flex-col items-center justify-center gap-1 h-16 text-xs font-semibold',
        isActive ? 'text-brand-700' : 'text-slate-500')}>
      {({ isActive }) => (<><n.icon size={24} strokeWidth={isActive ? 2.4 : 1.9} />{n.label}</>)}
    </NavLink>
  );
  const enFacturar = loc.pathname === '/facturar';
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]" aria-label="Menú">
      <div className="flex items-end max-w-lg mx-auto">
        {tab(items[0])}
        {tab(items[1])}
        <NavLink to="/facturar" aria-label="Nueva factura" className="flex flex-1 flex-col items-center -mt-6 pb-1.5">
          <span className={clsx('grid place-items-center h-16 w-16 rounded-full border-4 border-white shadow-[0_4px_12px_rgba(27,48,95,.25)]',
            enFacturar ? 'bg-brand-600 text-white' : 'bg-acento-400 text-brand-950')}>
            <Plus size={32} strokeWidth={2.6} />
          </span>
          <span className={clsx('text-xs font-bold mt-0.5', enFacturar ? 'text-brand-700' : 'text-slate-700')}>Facturar</span>
        </NavLink>
        {tab(items[2])}
        {tab(items[3])}
      </div>
    </nav>
  );
}
