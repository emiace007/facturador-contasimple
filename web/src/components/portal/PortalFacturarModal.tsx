import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { condicionesIvaPara, condicionIvaSugerida } from '../../lib/condicionIva';
import type { FacturaAfipResult, PortalSession } from '../../types';
import { FacturaCompartir } from '../facturas/FacturaCompartir';
import { tituloFactura } from '../../lib/facturas';
import { hoyIso, rangoFechaFactura } from '../../lib/fechaFactura';

interface PortalFacturarModalProps {
  open: boolean;
  onClose: () => void;
  session: PortalSession;
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
const ALICUOTAS_IVA = [
  { value: 21, label: '21%' },
  { value: 10.5, label: '10,5%' },
  { value: 27, label: '27%' },
  { value: 0, label: '0% (exento)' },
];

/**
 * Versión del modal de facturación para el Portal de Cliente: emite contra
 * ARCA igual que FacturarAfipModal (uso interno del estudio), pero sin pedir
 * el CUIT representado — el backend siempre lo toma del token de la sesión
 * (ver `clienteFacturar` en Code.gs), así un cliente logueado no puede
 * facturar a nombre de otro aunque manipule el pedido.
 */
export function PortalFacturarModal({ open, onClose, session }: PortalFacturarModalProps) {
  const [ptoVta, setPtoVta] = useState('');
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
  const [receptorNombre, setReceptorNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const queryClient = useQueryClient();

  // Condición fiscal del cliente: Monotributo sólo puede emitir Factura C,
  // Responsable Inscripto / SAS sólo A o B. El backend también lo valida.
  const perfilQuery = useQuery({
    queryKey: ['portal-perfil', session.token],
    queryFn: () => api.getPerfilPortal(session.token),
    enabled: open,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const tiposPermitidos = perfilQuery.data?.tiposPermitidos ?? [1, 6, 11];
  const tiposPermitidosKey = tiposPermitidos.join(',');
  const esSoloC = tiposPermitidosKey === '11';
  const esSoloAB = tiposPermitidosKey === '1,6';

  useEffect(() => {
    const permitidos = tiposPermitidosKey.split(',').map(Number);
    if (!permitidos.includes(cbteTipo)) {
      setCbteTipo(permitidos.includes(6) ? 6 : permitidos[0]);
    }
  }, [tiposPermitidosKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const esFacturaA = cbteTipo === 1;
  const esFacturaB = cbteTipo === 6;
  const [discriminarIvaEnB, setDiscriminarIvaEnB] = useState(false);
  const permiteAlicuota = esFacturaA || esFacturaB; // B: IVA contenido (Ley 27.743)
  const opcionesCondicionIva = condicionesIvaPara(cbteTipo);

  useEffect(() => {
    setCondicionIvaReceptorId(condicionIvaSugerida(cbteTipo, consumidorFinal));
  }, [cbteTipo, consumidorFinal]);

  const mutation = useMutation({
    mutationFn: () =>
      api.facturarPortal(session.token, {
        ptoVta: Number(ptoVta),
        cbteTipo,
        concepto,
        docTipo: consumidorFinal ? 99 : docTipo,
        docNro: consumidorFinal ? '0' : docNro,
        importe: Number(importe),
        condicionIvaReceptorId,
        ...(permiteAlicuota ? { alicuotaIva } : {}),
        ...(fecha && fecha !== hoyIso() ? { fechaComprobante: fecha } : {}),
      }, {
        receptorNombre: receptorNombre.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
      }),
    onSuccess: (data) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ['portal-facturas-emitidas'] });
    },
  });

  if (!open) return null;

  function handleClose() {
    if (mutation.isPending) return;
    setConfirmando(false);
    setResultado(null);
    setReceptorNombre('');
    setDescripcion('');
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
          <h2 className="text-sm font-semibold text-slate-800">Facturar — {session.cliente}</h2>
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
            {resultado.pdf && !resultado.pdf.error ? (
              <FacturaCompartir
                url={resultado.pdf.url}
                titulo={`${tituloFactura(resultado.cbteTipo, resultado.ptoVta, resultado.numero)} - ${session.cliente}`}
                cargarPdf={() => api.getMiFacturaPdf(session.token, resultado.pdf!.id)}
              />
            ) : (
              <p className="text-xs text-amber-600">La factura se emitió, pero no se pudo generar el PDF. Lo vas a poder bajar desde tu historial más tarde.</p>
            )}
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
            <p className="text-xs text-slate-400 tabular-nums">CUIT: {session.cuit}</p>

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
                  {TIPOS_COMPROBANTE.filter((t) => tiposPermitidos.includes(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              {(esSoloC || esSoloAB) && (
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {esSoloC ? 'Sos Monotributista: sólo podés emitir Factura C.' : 'Sos Responsable Inscripto / SAS: podés emitir Factura A o B.'}
                </p>
              )}
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
                Hasta {rangoFechaFactura(concepto).margen} días antes o después de hoy, y no anterior a tu última factura de ese punto de venta.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">Destinatario</label>
              <div className="flex gap-4 text-sm">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={consumidorFinal} onChange={() => setConsumidorFinal(true)} />
                  Consumidor Final
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={!consumidorFinal} onChange={() => setConsumidorFinal(false)} />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Nombre del receptor (opcional)</label>
                <input
                  value={receptorNombre}
                  onChange={(e) => setReceptorNombre(e.target.value)}
                  placeholder={consumidorFinal ? 'Consumidor Final' : 'Nombre / Razón social'}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Descripción (opcional)</label>
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Honorarios"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
              </div>
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
                {mutation.isPending ? 'Emitiendo...' : confirmando ? 'Confirmar y emitir' : 'Continuar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
