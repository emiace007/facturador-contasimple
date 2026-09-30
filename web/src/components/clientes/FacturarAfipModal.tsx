import { useEffect, useState, type FormEvent } from 'react';
import { hoyIso, rangoFechaFactura } from '../../lib/fechaFactura';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { condicionesIvaPara, condicionIvaSugerida } from '../../lib/condicionIva';
import type { Cliente, FacturaAfipResult } from '../../types';

interface FacturarAfipModalProps {
  open: boolean;
  onClose: () => void;
  cliente: Cliente;
  /** Punto de venta sugerido, parseado de la planilla "Fc-Monit." si está cargado. */
  puntoVentaSugerido?: number;
}

const TIPOS_COMPROBANTE = [
  { value: 1, label: 'Factura A' },
  { value: 6, label: 'Factura B' },
  { value: 11, label: 'Factura C' },
];

const CONCEPTOS = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y Servicios' },
];

// Alícuotas de IVA que se usan en el estudio. Aplican a Factura A siempre, y a
// Factura B cuando el receptor es Responsable Inscripto (p.ej. una SAS).
// Factura C nunca discrimina IVA.
const ALICUOTAS_IVA = [
  { value: 21, label: '21%' },
  { value: 10.5, label: '10,5%' },
  { value: 27, label: '27%' },
  { value: 0, label: '0% (exento)' },
];

/**
 * Emite una factura electrónica REAL contra ARCA (WSFE), a través del backend AFIP
 * (Render) proxeado por Apps Script. Esto tiene efecto fiscal real e irreversible:
 * una vez que ARCA aprueba el comprobante y devuelve el CAE, no se puede anular ni
 * deshacer desde acá (para eso existe la Nota de Crédito, que es otro comprobante).
 */
export function FacturarAfipModal({ open, onClose, cliente, puntoVentaSugerido }: FacturarAfipModalProps) {
  const [ptoVta, setPtoVta] = useState(puntoVentaSugerido ? String(puntoVentaSugerido) : '');
  const [cbteTipo, setCbteTipo] = useState(6); // Factura B por default
  const [concepto, setConcepto] = useState(2); // Servicios por default
  const [fecha, setFecha] = useState(hoyIso());
  const [consumidorFinal, setConsumidorFinal] = useState(true);
  const [docTipo, setDocTipo] = useState(80); // CUIT
  const [docNro, setDocNro] = useState('');
  const [importe, setImporte] = useState('');
  const [alicuotaIva, setAlicuotaIva] = useState(21);
  const [condicionIvaReceptorId, setCondicionIvaReceptorId] = useState(() => condicionIvaSugerida(6, true));
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<FacturaAfipResult | null>(null);

  const esFacturaA = cbteTipo === 1;
  const esFacturaB = cbteTipo === 6;
  const [discriminarIvaEnB, setDiscriminarIvaEnB] = useState(false);
  // Factura A siempre discrimina IVA. Factura B lo discrimina sólo si se tildó
  // la opción (caso: receptor Responsable Inscripto, p.ej. una SAS).
  const permiteAlicuota = esFacturaA || esFacturaB; // B: IVA contenido (Ley 27.743)
  const opcionesCondicionIva = condicionesIvaPara(cbteTipo);

  // Cuando cambia el tipo de comprobante o el destinatario, resugerimos la
  // condición frente al IVA (Factura A sólo admite RI/Monotributo).
  useEffect(() => {
    setCondicionIvaReceptorId(condicionIvaSugerida(cbteTipo, consumidorFinal));
  }, [cbteTipo, consumidorFinal]);

  const mutation = useMutation({
    mutationFn: () =>
      api.emitirFacturaAfip({
        cuitRepresentada: cliente.cuit,
        ptoVta: Number(ptoVta),
        cbteTipo,
        concepto,
        docTipo: consumidorFinal ? 99 : docTipo,
        docNro: consumidorFinal ? '0' : docNro,
        importe: Number(importe),
        condicionIvaReceptorId,
        ...(permiteAlicuota ? { alicuotaIva } : {}),
        ...(fecha && fecha !== hoyIso() ? { fechaComprobante: fecha } : {}),
      }),
    onSuccess: (data) => setResultado(data),
  });

  if (!open) return null;

  function handleClose() {
    if (mutation.isPending) return;
    setConfirmando(false);
    setResultado(null);
    mutation.reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ptoVta || !importe) return;
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Facturar — {cliente.cliente}</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {resultado ? (
          <div className="px-5 py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800">Factura autorizada por ARCA</p>
            </div>
            <dl className="space-y-1.5 text-sm bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between">
                <dt className="text-slate-500">Comprobante</dt>
                <dd className="font-medium tabular-nums">
                  {TIPOS_COMPROBANTE.find((t) => t.value === resultado.cbteTipo)?.label ?? resultado.cbteTipo} N°{' '}
                  {String(resultado.numero).padStart(8, '0')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Punto de venta</dt>
                <dd className="font-medium tabular-nums">{resultado.ptoVta}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">CAE</dt>
                <dd className="font-medium tabular-nums">{resultado.cae}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vencimiento CAE</dt>
                <dd className="font-medium tabular-nums">{resultado.caeVencimiento}</dd>
              </div>
            </dl>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-400 tabular-nums">CUIT: {cliente.cuit || 'sin cargar'}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Punto de venta *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={ptoVta}
                  onChange={(e) => setPtoVta(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  placeholder="Ej: 4"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Tipo de comprobante</label>
                <select
                  value={cbteTipo}
                  onChange={(e) => setCbteTipo(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  {TIPOS_COMPROBANTE.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Concepto</label>
              <select
                value={concepto}
                onChange={(e) => setConcepto(Number(e.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              >
                {CONCEPTOS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>


            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Fecha de la factura</label>
              <input
                type="date"
                value={fecha}
                min={rangoFechaFactura(concepto).min}
                max={rangoFechaFactura(concepto).max}
                onChange={(e) => setFecha(e.target.value || hoyIso())}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
              <p className="text-[11px] text-slate-400">
                Hasta {rangoFechaFactura(concepto).margen} días antes o después de hoy, y no anterior a la última factura de ese punto de venta.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">Destinatario</label>
              <div className="flex gap-4 text-sm">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={consumidorFinal}
                    onChange={() => setConsumidorFinal(true)}
                  />
                  Consumidor Final
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={!consumidorFinal}
                    onChange={() => setConsumidorFinal(false)}
                  />
                  CUIT / DNI
                </label>
              </div>
              {!consumidorFinal && (
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <select
                    value={docTipo}
                    onChange={(e) => setDocTipo(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  >
                    <option value={80}>CUIT</option>
                    <option value={96}>DNI</option>
                  </select>
                  <input
                    required={!consumidorFinal}
                    value={docNro}
                    onChange={(e) => setDocNro(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                    placeholder="Número de documento"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Condición frente al IVA del receptor *</label>
              <select
                value={condicionIvaReceptorId}
                onChange={(e) => setCondicionIvaReceptorId(Number(e.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              >
                {opcionesCondicionIva.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Importe total *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="0.00"
              />
            </div>

            {esFacturaB && (
              <p className="text-[11px] text-slate-500">
                Factura B: el importe va con IVA incluido. Elegí la alícuota: en el PDF sale el “IVA Contenido” (Régimen de Transparencia Fiscal, Ley 27.743).
              </p>
            )}
            {permiteAlicuota && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">
                  Alícuota de IVA {esFacturaA ? '(Factura A)' : '(Factura B, IVA incluido)'} *
                </label>
                <select
                  value={alicuotaIva}
                  onChange={(e) => setAlicuotaIva(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  {ALICUOTAS_IVA.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {Number(importe) > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Neto: $
                    {(Number(importe) / (1 + alicuotaIva / 100)).toFixed(2)} + IVA: $
                    {(Number(importe) - Number(importe) / (1 + alicuotaIva / 100)).toFixed(2)} = Total: $
                    {Number(importe).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {mutation.isError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{(mutation.error as Error).message}</span>
              </div>
            )}

            {confirmando && !mutation.isPending && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Esto emite una factura REAL en ARCA con CAE: no se puede anular ni editar después. Revisá los
                  datos y confirmá de nuevo para emitir.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {mutation.isPending
                  ? 'Emitiendo...'
                  : confirmando
                  ? 'Confirmar y emitir'
                  : 'Continuar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
