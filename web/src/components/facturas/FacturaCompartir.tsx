import { useState } from 'react';
import { Download, Loader2, MessageCircle } from 'lucide-react';
import type { FacturaPdfArchivo } from '../../types';

interface FacturaCompartirProps {
  /** Link público al PDF en Drive (si el backend ya lo generó). */
  url?: string;
  /** Texto que acompaña al link en WhatsApp, p.ej. "Factura C 00002-00000001". */
  titulo: string;
  /** Trae el PDF (base64 + link) del backend, para descargar o compartir el archivo. */
  cargarPdf: () => Promise<FacturaPdfArchivo>;
  compacto?: boolean;
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const ES_CELULAR = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

/**
 * Botones para mandar una factura emitida:
 * - "Enviar por WhatsApp": abre WhatsApp con un mensaje que trae el link al PDF (Drive).
 * - "Descargar / compartir PDF": en el celular abre el menú de compartir con el archivo
 *   (se puede elegir WhatsApp); en la compu lo descarga para adjuntarlo a mano.
 */
export function FacturaCompartir({ url, titulo, cargarPdf, compacto }: FacturaCompartirProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirWhatsApp(link: string) {
    const texto = `${titulo}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }

  async function handleWhatsApp() {
    setError(null);
    if (url) {
      abrirWhatsApp(url);
      return;
    }
    setCargando(true);
    try {
      const pdf = await cargarPdf();
      abrirWhatsApp(pdf.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function handlePdf() {
    setError(null);
    setCargando(true);
    try {
      const pdf = await cargarPdf();
      const blob = base64ToBlob(pdf.base64, 'application/pdf');
      const file = new File([blob], pdf.fileName, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (ES_CELULAR && nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: pdf.fileName });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = pdf.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10000);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  const tam = compacto ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const icono = compacto ? 13 : 15;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={cargando}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium transition-colors ${tam}`}
        >
          <MessageCircle size={icono} />
          Enviar por WhatsApp
        </button>
        <button
          type="button"
          onClick={handlePdf}
          disabled={cargando}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium disabled:opacity-60 transition-colors ${tam}`}
        >
          {cargando ? <Loader2 size={icono} className="animate-spin" /> : <Download size={icono} />}
          {ES_CELULAR ? 'Compartir PDF' : 'Descargar PDF'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
