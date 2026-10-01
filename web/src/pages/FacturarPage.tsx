import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, Delete, Minus, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { api, numeroFactura, TIPOS, tiposPermitidos, type Comercio, type Factura, type Producto } from '../lib/api';
import { CONDICIONES_IVA_RECEPTOR, condicionIvaSugerida } from '../lib/condicionIva';
import { hoyIso, rangoFechaFactura } from '../lib/fechaFactura';
import { botonGrande, botonSecundario, ConComercio, input, label } from '../components/Aviso';
import AccionesPdf from '../components/PdfBoton';

export default function FacturarPage() {
  return <ConComercio>{(c) => <Caja comercio={c} />}</ConComercio>;
}

interface Linea { productoId?: string; descripcion: string; cantidad: number; precio: number }

const pesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aNumero = (s: string) => Number(s.replace(',', '.')) || 0;
/** "1500,5" → "$ 1.500,5" mientras se escribe (sin forzar decimales). */
function mostrarTecleado(s: string): string {
  if (!s) return '$ 0';
  const [ent, dec] = s.split(',');
  const e = Number(ent || '0').toLocaleString('es-AR');
  return '$ ' + e + (dec !== undefined ? ',' + dec : '');
}

function Caja({ comercio }: { comercio: Comercio }) {
  const qc = useQueryClient();
  const tipos = tiposPermitidos(comercio);
  const productos = useQuery({ queryKey: ['productos', comercio.id], queryFn: api.productos });

  const [tecleado, setTecleado] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const [cf, setCf] = useState(true);
  const [doc, setDoc] = useState('');
  const [nombre, setNombre] = useState('');
  const [cbteTipo, setCbteTipo] = useState(tipos[0]);
  const [condIva, setCondIva] = useState(condicionIvaSugerida(tipos[0], true));
  const [concepto, setConcepto] = useState(1);
  const [ptoVta, setPtoVta] = useState(String(comercio.punto_venta ?? ''));
  const [alicuota, setAlicuota] = useState(21);
  const [fecha, setFecha] = useState(hoyIso());
  const [opciones, setOpciones] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<Factura | null>(null);

  const libre = aNumero(tecleado);
  const total = useMemo(() => lineas.reduce((a, l) => a + l.cantidad * l.precio, 0) + libre, [lineas, libre]);
  const docLimpio = doc.replace(/\D/g, '');
  const esA = cbteTipo === 1;
  const docOk = esA ? docLimpio.length === 11 : cf || docLimpio.length >= 7;
  const valido = total > 0 && Number(ptoVta) > 0 && docOk;
  const rango = rangoFechaFactura(concepto);

  const tecla = (k: string) => setTecleado((t) => {
    if (k === 'borrar') return t.slice(0, -1);
    if (k === ',') return t.includes(',') ? t : (t || '0') + ',';
    if (t.includes(',') && t.split(',')[1].length >= 2) return t;
    if (t === '0') return k;
    if (t.replace(',', '').length >= 10) return t;
    return t + k;
  });

  // En la compu también se puede tipear el importe con el teclado.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (confirmar || resultado || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === ',' || e.key === '.') tecla(',');
      else if (e.key === 'Backspace') tecla('borrar');
      else if (e.key === 'Enter' && valido) setConfirmar(true);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const sumarProducto = (p: Producto) => setLineas((ls) => {
    const i = ls.findIndex((l) => l.productoId === p.id);
    if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l));
    return [...ls, { productoId: p.id, descripcion: p.nombre, cantidad: 1, precio: Number(p.precio) }];
  });
  const cambiarCantidad = (i: number, d: number) =>
    setLineas((ls) => ls.flatMap((l, j) => (j !== i ? [l] : l.cantidad + d <= 0 ? [] : [{ ...l, cantidad: l.cantidad + d }])));

  const m = useMutation({
    mutationFn: () => api.facturar({
      cbteTipo, ptoVta: Number(ptoVta), concepto, importe: Math.round(total * 100) / 100,
      docTipo: cf && !esA ? 99 : docLimpio.length === 11 ? 80 : 96, docNro: cf && !esA ? '0' : docLimpio,
      condicionIvaReceptorId: condIva, receptorNombre: nombre.trim() || undefined,
      ...(cbteTipo !== 11 ? { alicuotaIva: alicuota } : {}),
      ...(fecha !== hoyIso() ? { fechaComprobante: fecha } : {}),
      items: [
        ...lineas.map((l) => ({ productoId: l.productoId, descripcion: l.descripcion, cantidad: l.cantidad, precioUnitario: l.precio })),
        ...(libre > 0 ? [{ descripcion: descripcion.trim() || 'Venta', cantidad: 1, precioUnitario: libre }] : []),
      ],
    }),
    onSuccess: (f) => {
      setResultado(f); setConfirmar(false);
      qc.invalidateQueries({ queryKey: ['facturas'] }); qc.invalidateQueries({ queryKey: ['resumen'] });
    },
    onError: () => setConfirmar(false),
  });

  const nueva = () => {
    setResultado(null); setTecleado(''); setLineas([]); setDescripcion(''); setDoc(''); setNombre(''); m.reset();
    if (!esA) { setCf(true); setCondIva(condicionIvaSugerida(cbteTipo, true)); }
  };

  if (resultado) return <Resultado f={resultado} onNueva={nueva} onReintentar={() => setResultado(null)} />;

  const prods = productos.data ?? [];

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:gap-6 md:items-start">
      <div className="space-y-4">
        {/* Visor del importe */}
        <section className="rounded-3xl bg-brand-600 text-white px-5 pt-3 pb-4 md:pt-4 md:pb-5" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base text-brand-100">{TIPOS[cbteTipo]}</span>
            {(tecleado || lineas.length > 0) && (
              <button onClick={() => { setTecleado(''); setLineas([]); }} className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-white/15 text-sm font-bold">
                <X size={16} /> Borrar todo
              </button>
            )}
          </div>
          <p className="mt-1 text-[2.6rem] leading-none md:text-6xl font-extrabold tabular-nums tracking-tight break-all">
            {lineas.length ? pesos(total) : mostrarTecleado(tecleado)}
          </p>
          {lineas.length > 0 && libre > 0 && <p className="mt-2 text-sm text-brand-100">Incluye {mostrarTecleado(tecleado)} cargado a mano</p>}
        </section>

        {/* Productos para tocar */}
        {prods.length > 0 && (
          <section aria-label="Productos">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
              {prods.map((p) => (
                <button key={p.id} onClick={() => sumarProducto(p)}
                  className="shrink-0 min-w-[8.5rem] text-left rounded-2xl bg-white border-2 border-slate-200 px-4 py-3 active:border-brand-500 active:bg-brand-50 hover:border-brand-300">
                  <span className="block text-base font-bold text-brand-950 leading-tight">{p.nombre}</span>
                  <span className="block mt-1 text-sm font-semibold text-slate-500 tabular-nums">{pesos(Number(p.precio))}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Ticket */}
        {lineas.length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200/80 divide-y divide-slate-100" aria-label="Detalle">
            {lineas.map((l, i) => (
              <div key={l.productoId ?? i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-brand-950 truncate">{l.descripcion}</p>
                  <p className="text-sm text-slate-500 tabular-nums">{pesos(l.precio * l.cantidad)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button aria-label="Uno menos" onClick={() => cambiarCantidad(i, -1)} className="grid place-items-center h-11 w-11 rounded-xl bg-slate-100 text-brand-800 active:bg-slate-200"><Minus size={20} /></button>
                  <span className="w-8 text-center text-lg font-extrabold tabular-nums">{l.cantidad}</span>
                  <button aria-label="Uno más" onClick={() => cambiarCantidad(i, 1)} className="grid place-items-center h-11 w-11 rounded-xl bg-brand-50 text-brand-700 active:bg-brand-100"><Plus size={20} /></button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Teclado en celular */}
        <div className="md:hidden"><Teclado onTecla={tecla} /></div>

        {/* Cliente */}
        <section className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3" aria-label="Cliente">
          <h2 className="text-base font-extrabold text-brand-950">¿A quién le facturás?</h2>
          {!esA && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {[{ v: true, t: 'Consumidor final' }, { v: false, t: 'Con DNI o CUIT' }].map((o) => (
                <button key={String(o.v)} role="radio" aria-checked={cf === o.v}
                  onClick={() => { setCf(o.v); setCondIva(condicionIvaSugerida(cbteTipo, o.v)); }}
                  className={clsx('h-14 rounded-xl border-2 text-base font-bold',
                    cf === o.v ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-brand-900')}>
                  {o.t}
                </button>
              ))}
            </div>
          )}
          {(!cf || esA) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>{esA ? 'CUIT del cliente' : 'DNI o CUIT'}
                <input className={input} inputMode="numeric" autoComplete="off" value={doc} onChange={(e) => setDoc(e.target.value)} />
              </label>
              <label className={label}>Nombre o razón social
                <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className={label + ' sm:col-span-2'}>Condición frente al IVA
                <select className={input} value={condIva} onChange={(e) => setCondIva(Number(e.target.value))}>
                  {CONDICIONES_IVA_RECEPTOR.filter((x) => !esA || x.cmpClase === 'A').map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </section>

        {/* Más opciones */}
        <section className="rounded-2xl bg-white border border-slate-200/80">
          <button onClick={() => setOpciones(!opciones)} aria-expanded={opciones}
            className="w-full flex items-center justify-between h-14 px-4 text-base font-bold text-brand-900">
            Más opciones <ChevronDown className={clsx('transition-transform', opciones && 'rotate-180')} />
          </button>
          {opciones && (
            <div className="grid gap-3 sm:grid-cols-2 px-4 pb-4">
              {tipos.length > 1 && (
                <label className={label}>Tipo de factura
                  <select className={input} value={cbteTipo} onChange={(e) => { const t = Number(e.target.value); setCbteTipo(t); setCondIva(condicionIvaSugerida(t, cf)); }}>
                    {tipos.map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
                  </select>
                </label>
              )}
              <label className={label}>Detalle de lo cargado a mano
                <input className={input} placeholder="Venta" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </label>
              <label className={label}>Concepto
                <select className={input} value={concepto} onChange={(e) => setConcepto(Number(e.target.value))}>
                  <option value={1}>Productos</option><option value={2}>Servicios</option><option value={3}>Productos y servicios</option>
                </select>
              </label>
              <label className={label}>Fecha de la factura
                <input type="date" className={input} value={fecha} min={rango.min} max={rango.max} onChange={(e) => setFecha(e.target.value || hoyIso())} />
              </label>
              <label className={label}>Punto de venta
                <input className={input} inputMode="numeric" value={ptoVta} onChange={(e) => setPtoVta(e.target.value.replace(/\D/g, ''))} />
              </label>
              {cbteTipo !== 11 && (
                <label className={label}>IVA
                  <select className={input} value={alicuota} onChange={(e) => setAlicuota(Number(e.target.value))}>
                    {[21, 10.5, 27, 0].map((a) => <option key={a} value={a}>{String(a).replace('.', ',')}% (incluido en el precio)</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Escritorio: teclado y botón a la derecha */}
      <aside className="hidden md:block md:sticky md:top-6 space-y-3">
        <Teclado onTecla={tecla} />
        <BotonEmitir total={total} valido={valido} onClick={() => setConfirmar(true)} />
        <Ayuda total={total} docOk={docOk} ptoVta={ptoVta} />
        {m.error && <p className="text-base text-red-600">{(m.error as Error).message}</p>}
      </aside>

      {/* Celular: botón fijo arriba de la barra de menú */}
      <div className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3 pt-2 bg-gradient-to-t from-[#eef1f7] via-[#eef1f7] to-transparent">
        {m.error && <p className="mb-2 text-sm text-red-600">{(m.error as Error).message}</p>}
        <BotonEmitir total={total} valido={valido} onClick={() => setConfirmar(true)} />
      </div>
      <div className="md:hidden h-20" aria-hidden />

      {confirmar && (
        <Confirmacion
          tipo={TIPOS[cbteTipo]} total={total}
          cliente={cf && !esA ? 'Consumidor final' : `${nombre.trim() || (docLimpio.length === 11 ? 'CUIT' : 'DNI')} ${docLimpio}`}
          emitiendo={m.isPending} onSi={() => m.mutate()} onNo={() => setConfirmar(false)} />
      )}
    </div>
  );
}

function Teclado({ onTecla }: { onTecla: (k: string) => void }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'borrar'];
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Teclado numérico">
      {teclas.map((k) => (
        <button key={k} onClick={() => onTecla(k)} aria-label={k === 'borrar' ? 'Borrar' : k}
          className={clsx('h-[3.6rem] md:h-16 rounded-2xl text-2xl font-extrabold tabular-nums select-none border-b-4 active:border-b active:translate-y-[3px]',
            k === 'borrar' ? 'bg-slate-200 border-slate-300 text-slate-700 grid place-items-center' : 'bg-white border-slate-200 text-brand-950')}>
          {k === 'borrar' ? <Delete size={26} /> : k}
        </button>
      ))}
    </div>
  );
}

function BotonEmitir({ total, valido, onClick }: { total: number; valido: boolean; onClick: () => void }) {
  return (
    <button className={botonGrande} disabled={!valido} onClick={onClick}>
      {total > 0 ? <>Facturar {pesos(total)}</> : 'Cargá el importe'}
    </button>
  );
}

function Ayuda({ total, docOk, ptoVta }: { total: number; docOk: boolean; ptoVta: string }) {
  const falta = total <= 0 ? 'Tocá un producto o escribí el importe.' : !docOk ? 'Completá el documento del cliente.' : !Number(ptoVta) ? 'Falta el punto de venta (en Más opciones).' : '';
  return falta ? <p className="text-sm text-slate-500 text-center">{falta}</p> : null;
}

function Confirmacion({ tipo, total, cliente, emitiendo, onSi, onNo }: {
  tipo: string; total: number; cliente: string; emitiendo: boolean; onSi: () => void; onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-brand-950/50 p-0 md:p-6" role="dialog" aria-modal="true" aria-labelledby="conf-titulo">
      <div className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5">
        <h2 id="conf-titulo" className="text-xl font-extrabold text-brand-950">¿Emitimos la factura?</h2>
        <dl className="space-y-2 text-base">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Tipo</dt><dd className="font-bold">{tipo}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Cliente</dt><dd className="font-bold text-right">{cliente}</dd></div>
          <div className="flex justify-between gap-3 items-baseline pt-2 border-t border-slate-100"><dt className="text-slate-500">Total</dt><dd className="text-3xl font-extrabold tabular-nums text-brand-950">{pesos(total)}</dd></div>
        </dl>
        <div className="space-y-2">
          <button className={botonGrande} disabled={emitiendo} onClick={onSi} autoFocus>{emitiendo ? 'Emitiendo…' : 'Sí, emitir'}</button>
          <button className={botonSecundario + ' w-full h-14'} disabled={emitiendo} onClick={onNo}>Volver</button>
        </div>
      </div>
    </div>
  );
}

function Resultado({ f, onNueva, onReintentar }: { f: Factura; onNueva: () => void; onReintentar: () => void }) {
  if (f.estado !== 'emitida') {
    return (
      <div className="max-w-md mx-auto space-y-5 py-4">
        <div className="rounded-3xl bg-white border-2 border-red-200 p-6 space-y-3">
          <h1 className="text-2xl font-extrabold text-red-700">ARCA no aceptó la factura</h1>
          <p className="text-base text-slate-700">{f.error}</p>
        </div>
        <button className={botonGrande} onClick={onReintentar}>Revisar y probar de nuevo</button>
      </div>
    );
  }
  const titulo = numeroFactura(f);
  return (
    <div className="max-w-md mx-auto space-y-5 py-4">
      <div className="rounded-3xl bg-white border border-slate-200/80 p-6 text-center space-y-2">
        <CheckCircle2 size={64} className="mx-auto text-[#1f9d6b]" strokeWidth={2.2} />
        <h1 className="text-2xl font-extrabold text-brand-950">Factura emitida</h1>
        <p className="text-4xl font-extrabold tabular-nums text-brand-950">{pesos(Number(f.importe_total))}</p>
        <p className="text-base font-semibold text-slate-600">{titulo}</p>
        <p className="text-sm text-slate-400 tabular-nums">CAE {f.cae}</p>
      </div>
      <AccionesPdf id={f.id} nombre={titulo} grande />
      <button className={botonGrande} onClick={onNueva}><Plus size={26} strokeWidth={2.8} /> Nueva factura</button>
    </div>
  );
}
