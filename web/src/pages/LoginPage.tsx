import { useState } from 'react';
import { api, type Sesion } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: (s: Sesion) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setCargando(true);
    try { onLogin({ ...(await api.login(email.trim(), password)), email: email.trim() }); }
    catch (err) { setError((err as Error).message); }
    finally { setCargando(false); }
  }
  return (
    <div className="min-h-full flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 space-y-4">
        <h1 className="text-lg font-semibold text-brand-700">Facturador</h1>
        <p className="text-sm text-slate-500">Ingresá con tu email y contraseña.</p>
        <input type="email" required autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input type="password" required autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={cargando} className="w-full rounded-xl bg-brand-600 text-white py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
