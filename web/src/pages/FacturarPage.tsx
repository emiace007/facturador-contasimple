import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, numeroFactura, TIPOS, tiposPermitidos, type Comercio, type Factura } from '../lib/api';
import { CONDICIONES_IVA_RECEPTOR, condicionIvaSugerida } from '../lib/condicionIva';
import { hoyIso, rangoFechaFactura } from '../lib/fechaFactura';
import { formatMoney, formatMonto } from '../lib/format';
import { boton, card, ConComercio, input } from '../components/Aviso';
import PdfBoton from '../components/PdfBoton';

export default function FacturarPage() {
  return <ConComercio>{(c) => <Formulario comercio={c} />}</ConComercio>;
}

function Formulario({ comercio }: { comercio: Comercio }) {
  const qc = useQueryClient();
  const tipos = tiposPermitidos(comercio);
  const productos = useQuery({ queryKey: ['productos', comercio.id], queryFn: api.productos });
  const [cbteTipo, setCbteTipo] = useState(tipos[0]);
  const [concepto, setConcepto] = useState(1);
  const [ptoVta, setPtoVta] = useState(String(comercio.punto_venta ?? ''));
  const [importe, setImporte] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cf, setCf] = useState(true);
  const [doc, setDoc] = useState('');
  const [nombre, setNombre] = useState('');
  const [alicuota, setAlicuota] = useState(21);
  const [condIva, setCondIva] = useState(5);
  const [fecha, setFecha] = useState(hoyIso());
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<Factura | null>(null);
  const rango = rangoFechaFactura(concepto);
  const discriminaIva = cbteTipo !== 11;
  const docLimpio = doc.replace(/\D/g, '');
  const valido = Number(importe) > 0 && Number(ptoVta) > 0 && (cbteTipo === 1 ? docLimpio.length === 11 : cf || docLimpio.length >= 7);

  const m = useMutation({
    mutationFn: () => api.facturar({
      cbteTipo, ptoVta: Number(ptoVta), concepto, importe: Number(importe),
      docTipo: cf ? 99 : docLimpio.length === 11 ? 80 : 96, docNro: cf ? '0' : docLimpio,
      condicionIvaReceptorId: condIva, receptorNombre: nombre.trim() || undefined,
      ...(discriminaIva ? { alicuotaIva: alicuota } : {}),
      ...(fecha !== hoyIso() ? { fechaComprobante: fecha } : {}),
      items: [{ descripcion: descripcion.trim() || 'Venta', cantidad: 1, precioUnitario: Number(importe) }],
    }),
    onSuccess: (f) => { setResultado(f); setConfirmar(false); if (f.estado === 'emitida') { setImporte(''); setDescripcion(''); setDoc(''); setNombre(''); } qc.invalidateQueries({ queryKey: ['facturas'] }); },
    onError: () => setConfirmar(false),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Facturar — {comercio.razon_social}</h1>
      {comercio.delegacion_estado !== 'verificada' && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2">
          La delegación del servicio de facturación en ARCA de este comercio todavía no está verificada. Si no la hizo, ARCA va a rechazar las facturas.
        </p>
      )}
      <div className={card + ' grid gap-3 sm:grid-cols-2'}>
        <label className="text-xs text-slate-500">Tipo de comprobante
          <select className={input} value={cbteTipo} onChange={(e) => { const t = Number(e.target.value); setCbteTipo(t); setCondIva(condicionIvaSugerida(t, cf)); }}>
            {tipos.map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Punto de venta
          <input className={input} inputMode="numeric" value={ptoVta} onChange={(e) => setPtoVta(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-xs text-slate-500">Concepto
          <select className={input} value={concepto} onChange={(e) => setConcepto(Number(e.target.value))}>
            <option value={1}>Productos</option><option value={2}>Servicios</option><option value={3}>Productos y servicios</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">Fecha de la factura
          <input type="date" className={input} value={fecha} min={rango.min} max={rango.max} onChange={(e) => setFecha(e.target.value || hoyIso())} />
          <span className="text-[11px] text-slate-400">Hasta {rango.margen} días antes o después de hoy, y no anterior a la última factura.</span>
        </label>
        <label className="text-xs text-slate-500">Importe total
          <input className={input} inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} placeholder="0,00" />
        </label>
        {discriminaIva && (
          <label className="text-xs text-slate-500">Alícuota de IVA
            <select className={input} value={alicuota} onChange={(e) => setAlicuota(Number(e.target.value))}>
              {[21, 10.5, 27, 0].map((a) => <option key={a} value={a}>{a}%</option>)}
            </select>
            <span className="text-[11px] text-slate-400">{cbteTipo === 6 ? 'El importe incluye IVA.' : 'El importe es el total con IVA.'}</span>
          </label>
        )}
        <label className="text-xs text-slate-500 sm:col-span-2">Descripción (opcional)
          <input className={input} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} list="prods" />
          <datalist id="prods">{(productos.data ?? []).map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
        </label>
        <div className="sm:col-span-2 border-t border-slate-100 pt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={cf} disabled={cbteTipo === 1} onChange={(e) => { setCf(e.target.checked); setCondIva(condicionIvaSugerida(cbteTipo, e.target.checked)); }} /> Consumidor final (sin documento)
          </label>
          {!cf && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate-500">CUIT / DNI<input className={input} inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} /></label>
              <label className="text-xs text-slate-500">Nombre o razón social<input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
              <label className="text-xs text-slate-500">Condición frente al IVA
                <select className={input} value={condIva} onChange={(e) => setCondIva(Number(e.target.value))}>
                  {CONDICIONES_IVA_RECEPTOR.filter((x) => cbteTipo !== 1 || x.cmpClase === 'A').map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
      {resultado && (
        <div className={card + (resultado.estado === 'emitida' ? ' border-green-300' : ' border-red-300')}>
          {resultado.estado === 'emitida'
            ? <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-green-700"><b>{numeroFactura(resultado)}</b> emitida · CAE {resultado.cae} · {formatMonto(resultado.importe_total)}</p>
                <PdfBoton id={resultado.id} texto="Ver factura (PDF)" />
              </div>
            : <p className="text-sm text-red-700">No se pudo emitir: {resultado.error}</p>}
        </div>
      )}
      {!confirmar ? (
        <button className={boton} disabled={!valido || m.isPending} onClick={() => setConfirmar(true)}>Emitir factura</button>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-700">Se va a emitir una factura real por <b>{formatMoney(Number(importe))}</b>. ¿Confirmás?</span>
          <button className={boton} disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Emitiendo…' : 'Sí, emitir'}</button>
          <button className="text-sm text-slate-500" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
