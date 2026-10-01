import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { api, TIPOS, type Comercio } from '../lib/api';
import { descargarPlantilla, leerExcel, type FilaLeida } from '../lib/excel';
import { formatMoney } from '../lib/format';
import { boton, card, ConComercio } from '../components/Aviso';

export default function MasivaPage() {
  return <ConComercio>{(c) => <Masiva comercio={c} />}</ConComercio>;
}

function Masiva({ comercio }: { comercio: Comercio }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState<FilaLeida[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [lote, setLote] = useState<{ id: string; total: number; resumen: Record<string, number> } | null>(null);
  const total = filas.reduce((a, f) => a + f.datos.importe, 0);

  async function elegir(file: File) {
    setError(''); setLote(null); setConfirmar(false);
    try { const r = await leerExcel(file, comercio); setFilas(r.filas); setErrores(r.errores); setArchivo(file.name); }
    catch (e) { setFilas([]); setErrores([`No se pudo leer el archivo: ${(e as Error).message}`]); }
  }
  async function emitir() {
    setEnviando(true); setError('');
    try {
      const r = await api.crearLote(archivo, filas.map((f) => f.datos));
      setFilas([]); setConfirmar(false);
      setLote({ id: r.loteId, total: r.total, resumen: {} });
    } catch (e) { setError((e as Error).message); }
    finally { setEnviando(false); }
  }
  // Mientras el lote se procesa en el servidor, se consulta el avance.
  useEffect(() => {
    if (!lote) return;
    const hechas = Object.values(lote.resumen).reduce((a, b) => a + b, 0);
    if (hechas >= lote.total && lote.total > 0) { qc.invalidateQueries({ queryKey: ['facturas'] }); return; }
    const t = setTimeout(async () => { try { const l = await api.lote(lote.id); setLote({ id: l.id, total: l.total, resumen: l.resumen }); } catch { /* reintenta */ } }, 1500);
    return () => clearTimeout(t);
  }, [lote, qc]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-extrabold text-brand-950">Carga masiva — {comercio.razon_social}</h1>
      <div className={card + ' space-y-3'}>
        <p className="text-sm text-slate-500">
          Subí un Excel con una fila por factura. Columnas: Punto de venta, Tipo de comprobante, Concepto, Documento, Importe, Alicuota IVA, Condicion IVA,
          Nombre receptor, Descripcion y <b>Fecha</b> (dd/mm/aaaa, opcional: para facturar con fecha anterior; vacía = hoy).
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => descargarPlantilla(comercio)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Download size={14} /> Plantilla</button>
          <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Upload size={14} /> Subir Excel</button>
          <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) elegir(f); e.target.value = ''; }} />
        </div>
      </div>

      {errores.length > 0 && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 space-y-1">
          {errores.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      {filas.length > 0 && (
        <div className={card + ' !p-0'}>
          <div className="px-5 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">{filas.length} facturas listas · {formatMoney(total)}</div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {filas.map((f) => (
              <div key={f.fila} className="px-5 py-2 text-xs text-slate-600 flex justify-between gap-2">
                <span>Fila {f.fila} · {TIPOS[f.datos.cbteTipo!]} · Pto. {f.datos.ptoVta}{f.datos.fechaComprobante && ` · ${f.datos.fechaComprobante.split('-').reverse().join('/')}`}</span>
                <span className="tabular-nums">{formatMoney(f.datos.importe)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {filas.length > 0 && (!confirmar
        ? <button className={boton} onClick={() => setConfirmar(true)}>Emitir {filas.length} facturas</button>
        : <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-700">Se van a emitir <b>{filas.length}</b> facturas reales por <b>{formatMoney(total)}</b>. No se pueden deshacer. ¿Confirmás?</span>
            <button className={boton} disabled={enviando} onClick={emitir}>{enviando ? 'Enviando…' : 'Sí, emitir todas'}</button>
            <button className="text-sm text-slate-500" onClick={() => setConfirmar(false)}>Cancelar</button>
          </div>)}
      {lote && (
        <div className={card}>
          <p className="text-sm text-slate-700">Procesando: {(lote.resumen.emitida ?? 0) + (lote.resumen.error ?? 0)} de {lote.total}
            {' '}· <span className="text-green-700">{lote.resumen.emitida ?? 0} emitidas</span>
            {(lote.resumen.error ?? 0) > 0 && <span className="text-red-600"> · {lote.resumen.error} con error (ver en Facturas)</span>}</p>
          <p className="text-xs text-slate-400 mt-1">Podés seguir usando la app: se emiten una por una en el servidor.</p>
        </div>
      )}
    </div>
  );
}
