import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { esNotaCredito, leerMisComprobantes, totalesPorMes, type ComprobanteArca } from '../../lib/misComprobantes';
import type { ResultadoImportacion } from '../../types/comprobantes';

function nombreMes(p: string): string {
  const [y, m] = p.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  return s.replace('.', '');
}

/**
 * Importa el archivo de ARCA > Mis Comprobantes > Emitidos (Excel o CSV) de un cliente.
 * Se leen los comprobantes en el navegador, se muestra una vista previa por mes y el
 * backend los guarda sin duplicar y recalcula el monitoreo (acumulado y categoría).
 */
export function ImportarComprobantesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes, enabled: open });
  const estadoQuery = useQuery({ queryKey: ['estado-importaciones'], queryFn: api.getEstadoImportaciones, enabled: open });
  const inputRef = useRef<HTMLInputElement>(null);
  const [cuit, setCuit] = useState('');
  const [comprobantes, setComprobantes] = useState<ComprobanteArca[]>([]);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [errorLectura, setErrorLectura] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  const clientes = clientesQuery.data ?? [];
  const cliente = clientes.find((c) => String(c.cuit).replace(/\D/g, '') === cuit);
  const estado = (estadoQuery.data ?? []).find((e) => e.cuit === cuit);
  const meses = useMemo(() => totalesPorMes(comprobantes), [comprobantes]);
  const total = meses.reduce((s, m) => s + m.total, 0);
  const maxMes = Math.max(1, ...meses.map((m) => Math.abs(m.total)));
  const notas = comprobantes.filter((c) => esNotaCredito(c.tipo)).length;

  const importar = useMutation({
    mutationFn: () => api.importarComprobantes(cuit, comprobantes),
    onSuccess: (r) => {
      setResultado(r);
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
      queryClient.invalidateQueries({ queryKey: ['estado-importaciones'] });
    },
  });

  async function leer(files: FileList | null) {
    if (!files || !files.length) return;
    setLeyendo(true);
    setErrorLectura('');
    setResultado(null);
    const nuevos: ComprobanteArca[] = [];
    const nuevosAvisos: string[] = [];
    const nombres: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const r = await leerMisComprobantes(f);
        if (r.esRecibidos) nuevosAvisos.push(f.name + ': parece un archivo de comprobantes RECIBIDOS; para el monitoreo se usan los EMITIDOS.');
        if (r.cuitEmisor && !cuit) setCuit(r.cuitEmisor);
        if (r.cuitEmisor && cuit && r.cuitEmisor !== cuit) nuevosAvisos.push(f.name + ': es del CUIT ' + r.cuitEmisor + ', distinto al cliente elegido.');
        r.advertencias.forEach((a) => nuevosAvisos.push(f.name + ': ' + a));
        nuevos.push(...r.comprobantes);
        nombres.push(f.name + ' (' + r.comprobantes.length + ')');
      }
      setComprobantes((prev) => [...prev, ...nuevos]);
      setArchivos((prev) => [...prev, ...nombres]);
      setAvisos((prev) => [...prev, ...nuevosAvisos]);
    } catch (e) {
      setErrorLectura((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  function limpiar() {
    setComprobantes([]);
    setArchivos([]);
    setAvisos([]);
    setErrorLectura('');
    setResultado(null);
    importar.reset();
  }

  function cerrar() {
    limpiar();
    setCuit('');
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4" onClick={cerrar}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <FileSpreadsheet size={16} className="text-brand-600" /> Importar Mis Comprobantes (ARCA)
          </h2>
          <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {resultado ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>
                  Se importaron <b>{resultado.nuevos}</b> comprobantes nuevos
                  {resultado.duplicados > 0 && <> ({resultado.duplicados} ya estaban cargados)</>}.
                  {resultado.monitoreo.filaCreada && ' El cliente se agregó al monitoreo.'}
                </p>
              </div>
              {resultado.monitoreo.esRI ? (
                <p className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  Cliente Responsable Inscripto: se guardó para el control de facturación, sin topes ni categoría. Facturado en los últimos 12 meses:{' '}
                  <b className="tabular-nums">{formatMoney(resultado.monitoreo.acumulado)}</b>.
                </p>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-400">Facturado últimos 12 meses</p>
                  <p className="font-semibold text-slate-800 tabular-nums">{formatMoney(resultado.monitoreo.acumulado)}</p>
                  <p className="text-[11px] text-slate-400">{resultado.monitoreo.ventana}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-400">Categoría actual</p>
                  <p className="font-semibold text-slate-800">{resultado.monitoreo.categoria || '—'}</p>
                  {resultado.monitoreo.topeCategoria > 0 && <p className="text-[11px] text-slate-400">tope {formatMoney(resultado.monitoreo.topeCategoria)}</p>}
                </div>
                <div className={clsx('rounded-xl border p-3', resultado.monitoreo.categoriaSugerida !== resultado.monitoreo.categoria ? 'border-amber-300 bg-amber-50' : 'border-slate-200')}>
                  <p className="text-xs text-slate-400">Le corresponde</p>
                  <p className="font-semibold text-slate-800">{resultado.monitoreo.categoriaSugerida}</p>
                  {resultado.monitoreo.aviso && <p className="text-[11px] text-slate-500">{resultado.monitoreo.aviso}</p>}
                </div>
              </div>
              )}
              <div className="flex justify-end gap-2">
                <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => { limpiar(); setCuit(''); }}>
                  Importar otro cliente
                </button>
                <button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium" onClick={cerrar}>
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <>
              <ol className="text-xs text-slate-500 list-decimal list-inside space-y-0.5">
                <li>En ARCA entrá a <b>Mis Comprobantes</b> del cliente → <b>Emitidos</b>.</li>
                <li>Elegí el período (hasta 12 meses por consulta) y tocá <b>Exportar</b> (Excel o CSV).</li>
                <li>Subí acá uno o varios archivos. Si repetís comprobantes, no se duplican.</li>
              </ol>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Cliente</span>
                <select
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm outline-none focus:border-brand-400"
                >
                  <option value="">{clientesQuery.isLoading ? 'Cargando...' : 'Elegí el cliente (o se detecta del archivo)'}</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={String(c.cuit).replace(/\D/g, '')}>
                      {c.cliente} · {c.cuit}
                    </option>
                  ))}
                  {cuit && !cliente && <option value={cuit}>CUIT {cuit} (no está en clientes)</option>}
                </select>
                {estado && (
                  <span className="text-[11px] text-slate-400">
                    Ya tiene {estado.comprobantes} comprobantes importados · último del {estado.ultimoComprobante}
                  </span>
                )}
              </label>

              <button
                onClick={() => inputRef.current?.click()}
                disabled={leyendo}
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 px-4 py-6 text-sm text-slate-500 flex flex-col items-center gap-1.5 transition-colors"
              >
                {leyendo ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} className="text-brand-600" />}
                {leyendo ? 'Leyendo...' : archivos.length ? 'Agregar otro archivo' : 'Elegir archivo de Mis Comprobantes'}
                <span className="text-[11px] text-slate-400">.xlsx, .xls o .csv</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  leer(e.target.files);
                  e.target.value = '';
                }}
              />

              {errorLectura && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{errorLectura}</p>}
              {avisos.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs space-y-0.5">
                  {avisos.map((a, i) => (
                    <p key={i} className="flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{a}</p>
                  ))}
                </div>
              )}

              {comprobantes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                    <p className="text-slate-600">
                      <b>{comprobantes.length}</b> comprobantes{notas > 0 && <> ({notas} notas de crédito)</>} · total <b className="tabular-nums">{formatMoney(total)}</b>
                    </p>
                    <button onClick={limpiar} className="text-xs text-slate-400 hover:text-red-600">Quitar archivos</button>
                  </div>
                  <p className="text-[11px] text-slate-400">{archivos.join(' · ')}</p>
                  <div className="space-y-1.5">
                    {meses.map((m) => (
                      <div key={m.mes} className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-slate-500 capitalize">{nombreMes(m.mes)}</span>
                        <div className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                          <div className={clsx('h-full rounded', m.total < 0 ? 'bg-red-400' : 'bg-brand-500')} style={{ width: Math.max(2, (Math.abs(m.total) / maxMes) * 100) + '%' }} />
                        </div>
                        <span className="w-28 text-right tabular-nums text-slate-700">{formatMoney(m.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importar.error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{(importar.error as Error).message}</p>}

              <div className="flex justify-end gap-2">
                <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={cerrar}>
                  Cancelar
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
                  disabled={!cuit || !comprobantes.length || importar.isPending}
                  onClick={() => importar.mutate()}
                >
                  {importar.isPending && <Loader2 size={14} className="animate-spin" />}
                  Importar {comprobantes.length > 0 && comprobantes.length}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
