import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Layers, LogOut, UserCircle, Users } from 'lucide-react';
import { getSesion } from '../lib/api';

/** Celular: el resto de las secciones, con botones grandes. */
export default function MasPage({ onSalir }: { onSalir: () => void }) {
  const s = getSesion();
  const items = [
    ...(s?.rol === 'staff' ? [{ to: '/comercios', label: 'Comercios', icon: Building2 }] : []),
    { to: '/masiva', label: 'Carga masiva desde Excel', icon: Layers },
    ...(s?.rol === 'dueno' ? [{ to: '/usuarios', label: 'Usuarios del comercio', icon: Users }] : []),
    { to: '/cuenta', label: 'Mi cuenta y contraseña', icon: UserCircle },
  ];
  const fila = 'flex items-center gap-4 h-16 px-4 text-lg font-bold';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-950">Más</h1>
      <div className="rounded-2xl bg-white border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className={fila + ' text-brand-900 active:bg-brand-50'}>
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-50 text-brand-600"><i.icon size={22} /></span>
            <span className="flex-1">{i.label}</span>
            <ChevronRight className="text-slate-400" />
          </Link>
        ))}
      </div>
      <button onClick={onSalir} className={fila + ' w-full rounded-2xl bg-white border border-slate-200/80 text-red-600 active:bg-red-50'}>
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-red-50"><LogOut size={22} /></span> Salir
      </button>
      {s?.email && <p className="text-center text-sm text-slate-500">Entraste como {s.email}</p>}
    </div>
  );
}
