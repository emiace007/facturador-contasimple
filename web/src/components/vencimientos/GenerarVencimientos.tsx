import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, Loader2, X } from 'lucide-react';
import { api } from '../../lib/api';

/**
 * Genera solo los vencimientos de cada cliente según su condición y la terminación de CUIT:
 * Monotributo (día 20), recategorización (5/2 y 5/8), IVA (RI) e IIBB Córdoba régimen general.
 * No duplica los que ya están cargados.
 */
export function GenerarVencimientos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [meses, setMeses] = useState(3);
  const generar = useMutation({
    // El backend cuenta desde el mes actual: +1 para cubrir "los próximos N meses".
    mutationFn: () => api.generarVencimientos(meses + 1),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vencimientos'] }),
  });
  const r = generar.data;

  function cerrar() {
    setOpen(false);
    generar.reset();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-brand-200 bg-white hover:bg-brand-50 text-brand-700 text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
      >
        <CalendarPlus size={16} />
        <span className="hidden sm:inline">Generar automáticos</span>
        <span className="sm:hidden">Generar</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4" onClick={cerrar}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Generar vencimientos automáticos</h2>
              <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {r ? (
                <>
                  <p className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2.5">
                    <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
                    Se generaron <b className="mx-1">{r.generados}</b> vencimientos para {r.clientes} clientes.
                    {r.generados === 0 && ' Ya estaban todos cargados.'}
                  </p>
                  {r.avisos.length > 0 && (
                    <ul className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs space-y-0.5 list-disc list-inside">
                      {r.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                  {r.detalle.length > 0 && (
                    <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto text-xs">
                      {r.detalle.map((d, i) => (
                        <li key={i} className="py-1.5 flex justify-between gap-3">
                          <span className="text-slate-700 truncate">{d.cliente} · {d.impuesto}</span>
                          <span className="text-slate-500 tabular-nums shrink-0">{d.fecha.split('-').reverse().join('/')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex justify-end">
                    <button onClick={cerrar} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 font-medium">Listo</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-slate-600">Arma el calendario de cada cliente según su condición fiscal y la terminación de su CUIT:</p>
                  <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                    <li><b>Monotributo:</b> cuota del día 20 (o hábil siguiente) y recategorización del 5 de febrero y 5 de agosto.</li>
                    <li><b>Responsables Inscriptos / SAS:</b> DDJJ de IVA del 18 al 25, según terminación de CUIT.</li>
                    <li><b>IIBB Córdoba (régimen general):</b> anticipo del día 16 (CUIT 0-4) o el hábil siguiente (5-9). Si el cliente es monotributista, IIBB va en la cuota unificada.</li>
                  </ul>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">Período</span>
                    <select value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm outline-none focus:border-brand-400">
                      <option value={1}>Este mes y el próximo</option>
                      <option value={3}>Próximos 3 meses</option>
                      <option value={6}>Próximos 6 meses</option>
                    </select>
                  </label>
                  <p className="text-xs text-slate-400">No se duplican los que ya existen. Las fechas siguen el calendario 2026 de ARCA y Rentas Córdoba; revisalas si se publica algún cambio.</p>
                  {generar.error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{(generar.error as Error).message}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={cerrar} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button onClick={() => generar.mutate()} disabled={generar.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 font-medium">
                      {generar.isPending && <Loader2 size={14} className="animate-spin" />}
                      Generar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
