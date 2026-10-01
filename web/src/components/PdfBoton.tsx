import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { api } from '../lib/api';

/** Botón que abre el PDF de una factura emitida. */
export default function PdfBoton({ id, texto = 'PDF' }: { id: string; texto?: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="inline-flex flex-col items-end">
      <button
        className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline disabled:opacity-50"
        disabled={cargando}
        onClick={async () => {
          setError(''); setCargando(true);
          try { await api.abrirPdf(id); } catch (e) { setError((e as Error).message); } finally { setCargando(false); }
        }}>
        <FileDown size={15} /> {cargando ? 'Abriendo…' : texto}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
