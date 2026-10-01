import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import { api, type Usuario } from '../lib/api';
import { boton, input } from './Aviso';

const ROL: Record<Usuario['rol'], string> = { dueno: 'Dueño', empleado: 'Empleado' };

/**
 * Usuarios de un comercio.
 * - Estudio: pasa comercioId y puede crear dueños o empleados.
 * - Dueño: sin comercioId (usa el suyo) y solo crea empleados.
 */
export default function UsuariosPanel({ comercioId, esEstudio }: { comercioId?: string; esEstudio: boolean }) {
  const qc = useQueryClient();
  const key = ['usuarios', comercioId ?? 'propio'];
  const q = useQuery({ queryKey: key, queryFn: () => api.usuarios(comercioId) });
  const refrescar = () => qc.invalidateQueries({ queryKey: key });

  const [f, setF] = useState({ email: '', password: '', rol: 'empleado' as Usuario['rol'] });
  const crear = useMutation({
    mutationFn: () => api.crearUsuario({ ...f, email: f.email.trim(), comercioId }),
    onSuccess: () => { setF({ email: '', password: '', rol: 'empleado' }); refrescar(); },
  });
  const estado = useMutation({ mutationFn: (u: Usuario) => api.estadoUsuario(u.id, !u.activo), onSuccess: refrescar });

  const [reset, setReset] = useState<{ id: string; clave: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const clave = useMutation({
    mutationFn: () => api.claveUsuario(reset!.id, reset!.clave),
    onSuccess: () => { setAviso('Contraseña cambiada. Pasásela a la persona para que entre y la cambie.'); setReset(null); },
  });

  const puedeTocar = (u: Usuario) => esEstudio || u.rol === 'empleado';
  const ok = f.email.includes('@') && f.password.length >= 8;
  const error = (crear.error || estado.error || clave.error) as Error | null;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 bg-white">
        {q.isLoading && <li className="px-4 py-3 text-sm text-slate-400">Cargando…</li>}
        {q.data?.map((u) => (
          <li key={u.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className={clsx('text-sm truncate', u.activo ? 'text-slate-800' : 'text-slate-400 line-through')}>{u.email}</p>
              <p className="text-xs text-slate-500">{ROL[u.rol]}{!u.activo && ', desactivado'}</p>
            </div>
            {puedeTocar(u) && (
              <div className="flex items-center gap-3 text-sm">
                <button className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  onClick={() => { setAviso(''); setReset({ id: u.id, clave: '' }); }}>
                  <KeyRound size={14} /> Nueva contraseña
                </button>
                <button className={clsx('hover:underline', u.activo ? 'text-red-600' : 'text-brand-700')}
                  disabled={estado.isPending} onClick={() => estado.mutate(u)}>
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            )}
            {reset?.id === u.id && (
              <div className="basis-full flex flex-wrap items-center gap-2">
                <input className={input + ' sm:max-w-xs'} type="text" autoFocus placeholder="Contraseña nueva (8 o más)"
                  value={reset.clave} onChange={(e) => setReset({ ...reset, clave: e.target.value })} />
                <button className={boton} disabled={reset.clave.length < 8 || clave.isPending} onClick={() => clave.mutate()}>Guardar</button>
                <button className="text-sm text-slate-500 hover:underline" onClick={() => setReset(null)}>Cancelar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {aviso && <p className="text-sm text-brand-700">{aviso}</p>}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
        <label className="text-xs text-slate-500">Email
          <input type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="text-xs text-slate-500">Contraseña inicial (8 o más)
          <input type="text" className={input} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </label>
        {esEstudio && (
          <label className="text-xs text-slate-500">Rol
            <select className={input} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Usuario['rol'] })}>
              <option value="empleado">Empleado</option>
              <option value="dueno">Dueño</option>
            </select>
          </label>
        )}
        <button className={boton + ' inline-flex items-center gap-2 justify-center'} disabled={!ok || crear.isPending} onClick={() => crear.mutate()}>
          <UserPlus size={16} /> Agregar usuario
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
    </div>
  );
}
