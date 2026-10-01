import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, getSesion } from '../lib/api';
import { boton, card, input } from '../components/Aviso';

export default function CuentaPage() {
  const s = getSesion();
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const m = useMutation({
    mutationFn: () => api.cambiarMiClave(f.actual, f.nueva),
    onSuccess: () => setF({ actual: '', nueva: '', repetir: '' }),
  });
  const distintas = f.repetir.length > 0 && f.nueva !== f.repetir;
  const ok = f.actual && f.nueva.length >= 8 && f.nueva === f.repetir;
  return (
    <div className="space-y-4 max-w-md">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Mi cuenta</h1>
        {s?.email && <p className="text-sm text-slate-500">Entraste como {s.email}</p>}
      </div>
      <form className={card + ' space-y-3'} onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(); }}>
        <h2 className="text-sm font-medium text-slate-700">Cambiar contraseña</h2>
        <label className="block text-xs text-slate-500">Contraseña actual
          <input type="password" autoComplete="current-password" className={input} value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} />
        </label>
        <label className="block text-xs text-slate-500">Contraseña nueva (8 o más)
          <input type="password" autoComplete="new-password" className={input} value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} />
        </label>
        <label className="block text-xs text-slate-500">Repetí la contraseña nueva
          <input type="password" autoComplete="new-password" className={input} value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} />
        </label>
        {distintas && <p className="text-sm text-red-600">Las dos contraseñas nuevas no coinciden.</p>}
        {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
        {m.isSuccess && <p className="text-sm text-brand-700">Contraseña cambiada. Si tenías la app abierta en otro dispositivo, ahí vas a tener que volver a entrar.</p>}
        <button className={boton} disabled={!ok || m.isPending}>Cambiar contraseña</button>
      </form>
    </div>
  );
}
