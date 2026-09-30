import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { api, type PersonaPadron } from '../lib/api';
import { mismoCuit } from '../lib/clientes';

type EstadoLinea = 'pendiente' | 'creando' | 'ok' | 'error' | 'duplicado';

interface LineaCliente {
  id: string;
  cliente: string;
  cuit: string;
  encargado: string;
  condicionFiscal: string;
  actMensual: string;
  observaciones: string;
  estado: EstadoLinea;
  error?: string;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Condición fiscal (como se usa en la planilla) a partir de los datos del padrón de ARCA. */
function condicionDesdePadron(p: PersonaPadron): string {
  if (p.condicionIvaId === 6) return 'Monotributo';
  if (p.condicionIvaId === 1) return 'Responsable Inscripto';
  if (p.condicionIvaId === 4) return 'Exento';
  return 'Consumidor Final';
}

function observacionesDesdePadron(p: PersonaPadron): string {
  const partes: string[] = [];
  if (p.categoriaMonotributo) partes.push('Categoría ' + p.categoriaMonotributo);
  if (p.actividadPrincipal) partes.push(p.actividadPrincipal);
  const dom = [p.domicilio.direccion, p.domicilio.localidad, p.domicilio.provincia].filter(Boolean).join(', ');
  if (dom) partes.push(dom);
  return partes.join(' · ');
}

function descargarPlantilla() {
  const datos = [
    ['Cliente', 'CUIT', 'Encargado', 'Condición Fiscal', 'Actividad Mensual', 'Observaciones'],
    ['PEREZ JUAN', '20123456789', 'Antonella', 'Monotributo', 'Al día', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes nuevos');
  XLSX.writeFile(wb, 'plantilla-alta-clientes.xlsx');
}

/**
 * Alta masiva de clientes: se sube un Excel con los datos básicos de uno o varios clientes
 * nuevos y se crean todos como filas en la hoja "PerfilClientes" (misma acción que usa el
 * modal "Nuevo cliente" de la página Clientes, `action: create, entity: cliente`, sólo que
 * acá se llama una vez por fila en vez de una vez por formulario).
 *
 * Importante: esto sólo da de alta al cliente en el sistema interno del estudio. Para poder
 * facturarle vía ARCA, el cliente todavía tiene que delegar el servicio de Facturación
 * Electrónica al CUIT del estudio desde su propia Clave Fiscal -- eso no se puede hacer desde
 * acá (ver el instructivo para mandarle).
 */
export default function AltaClientesPage() {
  const queryClient = useQueryClient();
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });
  const clientesExistentes = clientesQuery.data ?? [];

  const [cola, setCola] = useState<LineaCliente[]>([]);
  const [procesando, setProcesando] = useState(false);

  // Alta rápida por CUIT (consulta al padrón de ARCA)
  const [cuitBuscar, setCuitBuscar] = useState('');
  const [encargadoRapido, setEncargadoRapido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [persona, setPersona] = useState<PersonaPadron | null>(null);
  const [errorPadron, setErrorPadron] = useState('');

  async function buscarEnPadron() {
    const cuit = cuitBuscar.replace(/\D/g, '');
    setPersona(null);
    setErrorPadron('');
    if (cuit.length !== 11) {
      setErrorPadron('El CUIT tiene que tener 11 dígitos.');
      return;
    }
    setBuscando(true);
    try {
      setPersona(await api.consultarPadron(cuit));
    } catch (err) {
      setErrorPadron((err as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  function agregarDesdePadron() {
    if (!persona) return;
    const linea: LineaCliente = {
      id: crypto.randomUUID(),
      cliente: persona.denominacion,
      cuit: persona.cuit,
      encargado: encargadoRapido.trim(),
      condicionFiscal: condicionDesdePadron(persona),
      actMensual: '',
      observaciones: observacionesDesdePadron(persona),
      estado: 'pendiente',
    };
    setCola((prev) => marcarDuplicadosEnCola([...prev, linea]));
    setPersona(null);
    setCuitBuscar('');
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [importResumen, setImportResumen] = useState<{ ok: number; duplicados: number; errores: string[] } | null>(
    null
  );

  function marcarDuplicadosEnCola(lineas: LineaCliente[]): LineaCliente[] {
    return lineas.map((l) => {
      if (!l.cuit) return l;
      const yaExiste = clientesExistentes.some((c) => mismoCuit(c.cuit, l.cuit));
      const repetidoEnCola = lineas.filter((x) => x.cuit && mismoCuit(x.cuit, l.cuit));
      if (yaExiste || repetidoEnCola.length > 1) {
        return { ...l, estado: 'duplicado' as const };
      }
      return l;
    });
  }

  async function handleExcelFile(file: File) {
    setImportando(true);
    setImportResumen(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const nuevas: LineaCliente[] = [];
      const errores: string[] = [];

      rows.forEach((row, idx) => {
        const fila = idx + 2; // fila 1 = encabezados
        const norm: Record<string, unknown> = {};
        Object.entries(row).forEach(([k, v]) => {
          norm[normalizeHeader(k)] = v;
        });
        const get = (...keys: string[]) => {
          for (const k of keys) {
            if (norm[k] !== undefined && String(norm[k]).trim() !== '') return String(norm[k]).trim();
          }
          return '';
        };

        const cliente = get('cliente', 'nombre', 'razon social', 'razonsocial', 'nombre / razon social');
        const cuit = get('cuit').replace(/\D/g, '');
        if (!cliente && !cuit) return; // fila vacía, se ignora

        if (!cliente && cuit.length !== 11) {
          errores.push(`Fila ${fila}: falta el nombre / razón social.`);
          return;
        }

        nuevas.push({
          id: crypto.randomUUID(),
          cliente,
          cuit,
          encargado: get('encargado', 'responsable'),
          condicionFiscal: get('condicion fiscal', 'condicionfiscal'),
          actMensual: get('actividad mensual', 'act mensual', 'actmensual'),
          observaciones: get('observaciones', 'notas'),
          estado: 'pendiente',
        });
      });

      // Filas que sólo traen CUIT: se completan con los datos del padrón de ARCA.
      for (const l of nuevas) {
        if (l.cliente) continue;
        try {
          const p = await api.consultarPadron(l.cuit);
          l.cliente = p.denominacion;
          if (!l.condicionFiscal) l.condicionFiscal = condicionDesdePadron(p);
          if (!l.observaciones) l.observaciones = observacionesDesdePadron(p);
        } catch (err) {
          errores.push('CUIT ' + l.cuit + ': no se pudo completar con ARCA (' + (err as Error).message + ').');
        }
      }
      const completas = nuevas.filter((l) => l.cliente);
      nuevas.length = 0;
      nuevas.push(...completas);

      const conDuplicados = marcarDuplicadosEnCola(nuevas);
      const duplicados = conDuplicados.filter((l) => l.estado === 'duplicado').length;

      if (conDuplicados.length > 0) {
        setCola((prev) => marcarDuplicadosEnCola([...prev, ...conDuplicados]));
      }
      setImportResumen({ ok: nuevas.length - duplicados, duplicados, errores });
    } catch (err) {
      setImportResumen({ ok: 0, duplicados: 0, errores: [`No se pudo leer el archivo: ${(err as Error).message}`] });
    } finally {
      setImportando(false);
    }
  }

  function quitarLinea(id: string) {
    setCola((prev) => prev.filter((l) => l.id !== id));
  }

  const pendientes = useMemo(() => cola.filter((l) => l.estado === 'pendiente' || l.estado === 'error'), [cola]);

  async function darDeAltaTodos() {
    setProcesando(true);
    for (const linea of cola) {
      if (linea.estado !== 'pendiente' && linea.estado !== 'error') continue;
      setCola((prev) => prev.map((l) => (l.id === linea.id ? { ...l, estado: 'creando', error: undefined } : l)));
      try {
        await api.createCliente({
          cliente: linea.cliente,
          cuit: linea.cuit,
          encargado: linea.encargado,
          condicionFiscal: linea.condicionFiscal,
          actMensual: linea.actMensual,
          observaciones: linea.observaciones,
        });
        setCola((prev) => prev.map((l) => (l.id === linea.id ? { ...l, estado: 'ok' } : l)));
      } catch (err) {
        setCola((prev) =>
          prev.map((l) => (l.id === linea.id ? { ...l, estado: 'error', error: (err as Error).message } : l))
        );
      }
    }
    setProcesando(false);
    queryClient.invalidateQueries({ queryKey: ['clientes'] });
  }

  const ESTADO_BADGE: Record<EstadoLinea, string> = {
    pendiente: 'bg-slate-100 text-slate-600',
    creando: 'bg-blue-50 text-blue-700',
    ok: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-700',
    duplicado: 'bg-amber-50 text-amber-700',
  };

  const ESTADO_LABEL: Record<EstadoLinea, string> = {
    pendiente: 'pendiente',
    creando: 'creando...',
    ok: 'creado',
    error: 'error',
    duplicado: 'ya existe',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <UserPlus size={20} className="text-brand-600" />
          Alta de clientes
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Cargá clientes nuevos desde un Excel en vez de uno por uno. Se crean directamente en la planilla de
          clientes del estudio.
        </p>
      </div>

      {/* Aviso: esto no reemplaza la delegación en ARCA */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 text-sm text-amber-800 flex gap-2.5">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Esto da de alta al cliente en el sistema del estudio, no en ARCA.</p>
          <p className="text-amber-700">
            Para poder facturarle, el cliente todavía tiene que delegarte el servicio de Facturación Electrónica
            desde su propia Clave Fiscal — eso no se puede hacer por él. Descargá el instructivo de abajo y
            mandáselo.
          </p>
        </div>
      </div>

      {/* Alta rápida por CUIT con el padrón de ARCA */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Search size={16} className="text-brand-600" />
            Alta rápida con el CUIT
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Poné el CUIT y se completan solos el nombre, la condición fiscal, la categoría y el domicilio desde ARCA.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={cuitBuscar}
            onChange={(e) => setCuitBuscar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') buscarEnPadron();
            }}
            placeholder="CUIT (11 dígitos)"
            className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm tabular-nums outline-none focus:border-brand-400"
          />
          <button
            onClick={buscarEnPadron}
            disabled={buscando}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {buscando ? 'Consultando ARCA...' : 'Buscar en ARCA'}
          </button>
        </div>
        {errorPadron && (
          <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{errorPadron}</p>
        )}
        {persona && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <p className="sm:col-span-2 font-semibold text-slate-800">{persona.denominacion}</p>
              <p className="text-slate-600">
                <span className="text-slate-400">CUIT:</span> <span className="tabular-nums">{persona.cuit}</span>
              </p>
              <p className="text-slate-600">
                <span className="text-slate-400">Condición:</span> {persona.condicionIva}
                {persona.categoriaMonotributo && ' · Cat. ' + persona.categoriaMonotributo}
              </p>
              {persona.actividadPrincipal && (
                <p className="sm:col-span-2 text-slate-600">
                  <span className="text-slate-400">Actividad:</span> {persona.actividadPrincipal}
                </p>
              )}
              <p className="sm:col-span-2 text-slate-600">
                <span className="text-slate-400">Domicilio fiscal:</span>{' '}
                {[persona.domicilio.direccion, persona.domicilio.localidad, persona.domicilio.provincia]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
              {persona.estadoClave && persona.estadoClave !== 'ACTIVO' && (
                <p className="sm:col-span-2 text-amber-700 text-xs">Estado de la clave en ARCA: {persona.estadoClave}</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={encargadoRapido}
                onChange={(e) => setEncargadoRapido(e.target.value)}
                placeholder="Encargado (opcional)"
                className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:border-brand-400"
              />
              <button
                onClick={agregarDesdePadron}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                <UserPlus size={14} />
                Agregar a la cola
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Carga masiva desde Excel */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-brand-600" />
              Importar clientes nuevos desde Excel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Columnas: Cliente, CUIT, Encargado, Condición Fiscal, Actividad Mensual, Observaciones. Si una
              fila trae sólo el CUIT, el nombre y la condición se completan desde ARCA.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={descargarPlantilla}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              <Download size={14} />
              Plantilla
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3.5 py-2 text-sm font-medium transition-colors"
            >
              {importando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {importando ? 'Importando...' : 'Importar Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleExcelFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {importResumen && (
          <div
            className={clsx(
              'rounded-xl border px-3 py-2.5 text-xs space-y-1',
              importResumen.errores.length > 0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            )}
          >
            <p className="font-medium">
              {importResumen.ok > 0
                ? `Se agregaron ${importResumen.ok} cliente${importResumen.ok !== 1 ? 's' : ''} a la cola.`
                : 'No se agregó ningún cliente nuevo.'}
              {importResumen.duplicados > 0 &&
                ` ${importResumen.duplicados} ya exist${importResumen.duplicados !== 1 ? 'en' : 'e'} (mismo CUIT) y no se van a duplicar.`}
            </p>
            {importResumen.errores.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5">
                {importResumen.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Instructivo ARCA */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-brand-600 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Instructivo para el cliente: delegar Facturación Electrónica</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los pasos que el cliente tiene que hacer en AFIP/ARCA con su propia Clave Fiscal para autorizarte a
              facturarle.
            </p>
          </div>
        </div>
        <a
          href="/instructivo-delegacion-arca.docx"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 text-sm font-medium transition-colors shrink-0"
        >
          <Download size={14} />
          Descargar instructivo
        </a>
      </div>

      {/* Cola */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Cola ({cola.length})</h2>
        </div>

        {cola.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Todavía no importaste ningún cliente.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {cola.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.cliente}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {l.cuit || 'sin CUIT'} {l.encargado && `· ${l.encargado}`} {l.condicionFiscal && `· ${l.condicionFiscal}`}
                    {l.estado === 'error' && l.error && <span className="text-red-600"> · {l.error}</span>}
                    {l.estado === 'duplicado' && <span className="text-amber-600"> · ya existe un cliente con este CUIT</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1',
                      ESTADO_BADGE[l.estado]
                    )}
                  >
                    {l.estado === 'creando' && <Loader2 size={12} className="animate-spin" />}
                    {l.estado === 'ok' && <CheckCircle2 size={12} />}
                    {l.estado === 'error' && <XCircle size={12} />}
                    {ESTADO_LABEL[l.estado]}
                  </span>
                  {(l.estado === 'pendiente' || l.estado === 'duplicado') && (
                    <button onClick={() => quitarLinea(l.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {cola.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={darDeAltaTodos}
              disabled={pendientes.length === 0 || procesando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              {procesando && <Loader2 size={14} className="animate-spin" />}
              {procesando ? 'Dando de alta...' : `Dar de alta ${pendientes.length} cliente${pendientes.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
