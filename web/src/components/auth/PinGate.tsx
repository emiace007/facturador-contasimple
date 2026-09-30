import { useState, type FormEvent, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

const STORAGE_KEY = 'estudio-contable:unlocked';
const REQUIRED_PIN = import.meta.env.VITE_APP_PIN as string | undefined;

function isUnlocked(): boolean {
  if (!REQUIRED_PIN) return true; // sin PIN configurado, acceso libre
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

interface PinGateProps {
  children: ReactNode;
}

/**
 * Gate de acceso simple por PIN compartido, pensado para un equipo chico que
 * usa un dispositivo común. No reemplaza una autenticación real por usuario:
 * es una traba liviana para que la app no quede abierta a cualquiera que
 * entre a la URL. Se activa solo si se configura VITE_APP_PIN en el .env.
 */
export function PinGate({ children }: PinGateProps) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin === REQUIRED_PIN) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setUnlocked(true);
    } else {
      setError(true);
      setPin('');
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200/70 shadow-lg shadow-slate-200/60 p-8 w-full max-w-sm text-center"
      >
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-brand-200">
          <Lock size={22} />
        </div>
        <h1 className="text-base font-semibold text-slate-800 mb-1">Estudio Contable Bertero</h1>
        <p className="text-sm text-slate-500 mb-5">Ingresá el PIN del equipo para continuar</p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          className="w-full text-center tracking-[0.5em] text-lg rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-400"
          placeholder="••••"
        />

        {error && <p className="text-sm text-red-600 mt-2">PIN incorrecto, probá de nuevo.</p>}

        <button
          type="submit"
          className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
