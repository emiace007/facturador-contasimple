import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileText, Layers, LogOut, Package, Receipt } from 'lucide-react';
import clsx from 'clsx';
import { api, getComercioElegido, getSesion, setComercioElegido, setSesion, type Comercio, type Sesion } from './lib/api';
import LoginPage from './pages/LoginPage';
import FacturarPage from './pages/FacturarPage';
import FacturasPage from './pages/FacturasPage';
import ProductosPage from './pages/ProductosPage';
import MasivaPage from './pages/MasivaPage';
import ComerciosPage from './pages/ComerciosPage';

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
  const salir = () => { setSesion(null); setS(null); qc.clear(); };
  const nav = [
    ...(esStaff ? [{ to: '/comercios', label: 'Comercios', icon: Building2 }] : []),
    { to: '/facturar', label: 'Facturar', icon: Receipt },
    { to: '/masiva', label: 'Carga masiva', icon: Layers },
    { to: '/facturas', label: 'Facturas', icon: FileText },
    { to: '/productos', label: 'Productos', icon: Package },
  ];
  return (
    <div className="min-h-full flex flex-col md:flex-row bg-slate-50">
      <aside className="md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200/70 md:min-h-screen shrink-0">
        <div className="px-4 py-3 font-semibold text-brand-700">Facturador</div>
        <nav className="flex md:flex-col gap-1 px-2 pb-2 overflow-x-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap',
                isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50')}>
              <n.icon size={16} /> {n.label}
            </NavLink>
          ))}
          <button onClick={salir} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 md:mt-4">
            <LogOut size={16} /> Salir
          </button>
        </nav>
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
