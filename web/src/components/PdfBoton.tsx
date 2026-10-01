import { useState } from 'react';
import { FileDown, Share2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';

/** Botones de una factura emitida: ver el PDF y compartirlo (WhatsApp, mail…). */
export function AccionesPdf({ id, nombre, grande = false }: { id: string; nombre: string; grande?: boolean }) {
  const [ocupado, setOcupado] = useState<'' | 'ver' | 'compartir'>('');
  const [error, setError] = useState('');
  const correr = async (q: 'ver' | 'compartir') => {
    setError(''); setOcupado(q);
    try { q === 'ver' ? await api.abrirPdf(id) : await api.compartirPdf(id, nombre); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupado(''); }
  };
  const base = grande
    ? 'flex-1 inline-flex items-center justify-center gap-2 h-14 rounded-2xl text-base font-bold disabled:opacity-50'
    : 'inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-bold disabled:opacity-50';
  return (
    <div className={clsx(grande ? 'space-y-2' : 'flex flex-col items-end gap-1')}>
      <div className={clsx('flex gap-2', grande && 'w-full')}>
        <button className={clsx(base, 'bg-brand-50 text-brand-700 hover:bg-brand-100')} disabled={!!ocupado} onClick={() => correr('ver')}>
          <FileDown size={grande ? 22 : 18} /> {ocupado === 'ver' ? 'Abriendo…' : grande ? 'Ver PDF' : 'PDF'}
        </button>
        <button className={clsx(base, 'bg-[#e3f5ec] text-[#14724d] hover:bg-[#d2efe1]')} disabled={!!ocupado} onClick={() => correr('compartir')}>
          <Share2 size={grande ? 22 : 18} /> {ocupado === 'compartir' ? 'Preparando…' : 'Compartir'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default AccionesPdf;
