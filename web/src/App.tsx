import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileText, Layers, LogOut, Package, Receipt, UserCircle, Users } from 'lucide-react';
import clsx from 'clsx';
import { api, getComercioElegido, getSesion, setComercioElegido, setSesion, type Comercio, type Sesion } from './lib/api';
import LoginPage from './pages/LoginPage';
import FacturarPage from './pages/FacturarPage';
import FacturasPage from './pages/FacturasPage';
import ProductosPage from './pages/ProductosPage';
import MasivaPage from './pages/MasivaPage';
import ComerciosPage from './pages/ComerciosPage';
import UsuariosPage from './pages/UsuariosPage';
import CuentaPage from './pages/CuentaPage';

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

export default function App() {
  const [sesion, setS] = useState<Sesion | null>(getSesion());
  const qc = useQueryClient();
  if (!sesion) return <LoginPage onLogin={(s) => { setSesion(s); setS(s); }} />;

  const esStaff = sesion.rol === 'staff';
  const esDueno = sesion.rol === 'dueno';
  const salir = async () => { await api.logout(); setSesion(null); setS(null); qc.clear(); };
  const nav = [
    ...(esStaff ? [{ to: '/comercios', label: 'Comercios', icon: Building2 }] : []),
    { to: '/facturar', label: 'Facturar', icon: Receipt },
    { to: '/masiva', label: 'Carga masiva', icon: Layers },
    { to: '/facturas', label: 'Facturas', icon: FileText },
    { to: '/productos', label: 'Productos', icon: Package },
    ...(esDueno ? [{ to: '/usuarios', label: 'Usuarios', icon: Users }] : []),
    { to: '/cuenta', label: 'Mi cuenta', icon: UserCircle },
  ];
  return (
    <div className="min-h-full flex flex-col md:flex-row bg-slate-50">
      <aside className="md:w-60 bg-brand-600 md:min-h-screen shrink-0 md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-5 pt-5 pb-4">
          <img src="/logo.png" alt="ContaSimple" className="h-7 w-auto" />
        </div>
        <nav className="flex md:flex-col gap-1 px-3 pb-3 overflow-x-auto md:flex-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => clsx('relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-white/15 text-white font-semibold md:before:absolute md:before:left-0 md:before:top-1.5 md:before:bottom-1.5 md:before:w-1 md:before:rounded-full md:before:bg-acento-400'
                  : 'text-brand-100 hover:bg-white/10 hover:text-white')}>
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
          <button onClick={salir} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-brand-100 hover:bg-white/10 hover:text-white md:mt-auto">
            <LogOut size={17} /> Salir
          </button>
        </nav>
        {sesion.email && <p className="hidden md:block px-5 pb-5 text-xs text-brand-200 truncate">{sesion.email}</p>}
      </aside>
      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full">
        {esStaff && <SelectorComercio />}
        <Routes>
          <Route path="/" element={<Navigate to={esStaff ? '/comercios' : '/facturar'} replace />} />
          {esStaff && <Route path="/comercios" element={<ComerciosPage />} />}
          <Route path="/facturar" element={<FacturarPage />} />
          <Route path="/masiva" element={<MasivaPage />} />
          <Route path="/facturas" element={<FacturasPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          {esDueno && <Route path="/usuarios" element={<UsuariosPage />} />}
          <Route path="/cuenta" element={<CuentaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function SelectorComercio() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['comercios'], queryFn: api.comercios });
  const actual = getComercioElegido() ?? '';
  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <span className="text-slate-500">Trabajando por cuenta de:</span>
      <select value={actual} className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white"
        onChange={(e) => { setComercioElegido(e.target.value || null); qc.invalidateQueries(); window.location.reload(); }}>
        <option value="">— elegí un comercio —</option>
        {(q.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
      </select>
    </div>
  );
}
