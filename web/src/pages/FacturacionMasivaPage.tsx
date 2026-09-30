import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { mismoCuit, normalizeCuit, parseCategorias, parsePuntoVenta } from '../lib/clientes';
import { CONDICIONES_IVA_RECEPTOR, condicionesIvaPara, condicionIvaSugerida } from '../lib/condicionIva';
import { hoyIso, rangoFechaFactura } from '../lib/fechaFactura';
import { setColaGlobal, setProcesandoGlobal, useColaFacturacion } from '../lib/colaFacturacion';
import { formatMoney } from '../lib/format';
import type { Cliente, FacturaAfipResult } from '../types';
import { FacturaCompartir } from '../components/facturas/FacturaCompartir';
import { tituloFactura } from '../lib/facturas';

const TIPOS_COMPROBANTE = [
  { value: 1, label: 'Factura A' },
  { value: 6, label: 'Factura B' },
  { value: 11, label: 'Factura C' },
];

/**
 * Tipos de comprobante habilitados según la condición fiscal del cliente: un
 * Monotributista sólo puede emitir Factura C, y un Responsable Inscripto
 * (incluidas las SAS, que tributan como RI) sólo puede emitir Factura A o B.
 * Si la categoría no está cargada o no matchea ninguna de las dos, no
 * restringimos para no bloquear casos que el estudio todavía no categorizó.
 */
function tiposPermitidosPara(categoriasFiscales: string | undefined): number[] {
  const categorias = parseCategorias(categoriasFiscales);
  const esResponsableInscripto = categorias.includes('Responsable Inscripto');
  const esMonotributista = categorias.includes('Monotributista');
  if (esResponsableInscripto && esMonotributista) return [1, 6, 11];
  if (esResponsableInscripto) return [1, 6];
  if (esMonotributista) return [11];
  return [1, 6, 11];
}

/** Texto de ayuda para explicar por qué se restringió el tipo de comprobante. */
function ayudaTiposComprobante(categoriasFiscales: string | undefined): string | null {
  const categorias = parseCategorias(categoriasFiscales);
  const esRI = categorias.includes('Responsable Inscripto');
  const esMono = categorias.includes('Monotributista');
  if (esMono && !esRI) return 'Cliente Monotributista: sólo puede emitir Factura C.';
  if (esRI && !esMono) return 'Cliente Responsable Inscripto (o SAS): sólo puede emitir Factura A o B.';
  return null;
}

const CONCEPTOS = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y Servicios' },
];

// Alícuotas de IVA que se usan en el estudio. Factura A siempre discrimina IVA;
// Factura B lo discrimina sólo cuando el receptor es Responsable Inscripto
// (p.ej. una SAS). Factura C nunca discrimina.
const ALICUOTAS_IVA = [
  { value: 21, label: '21%' },
  { value: 10.5, label: '10,5%' },
  { value: 27, label: '27%' },
  { value: 0, label: '0% (exento)' },
];

type EstadoLinea = 'pendiente' | 'emitiendo' | 'ok' | 'error';

interface LineaFactura {
  id: string;
  clienteId: string;
  clienteNombre: string;
  cuit: string;
  ptoVta: number;
  cbteTipo: number;
  concepto: number;
  consumidorFinal: boolean;
  docTipo: number;
  docNro: string;
  importe: number;
  /** Sólo se manda si Factura A, o Factura B con receptor RI/SAS. */
  alicuotaIva?: number;
  /** Condición frente al IVA del receptor (RG 5616/2024). Ver lib/condicionIva.ts. */
  condicionIvaReceptorId: number;
  /** Sólo para el PDF: nombre del receptor y descripción del ítem. */
  receptorNombre?: string;
  descripcion?: string;
  /** Fecha de la factura (yyyy-MM-dd) si no es hoy. */
  fechaComprobante?: string;
  estado: EstadoLinea;
  resultado?: FacturaAfipResult;
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

function parseTipoComprobante(raw: unknown): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 6;
  if (s === 'a' || s.includes('factura a')) return 1;
  if (s === 'b' || s.includes('factura b')) return 6;
  if (s === 'c' || s.includes('factura c')) return 11;
  const n = Number(s);
  if ([1, 6, 11].includes(n)) return n;
  return 6;
}

function parseConcepto(raw: unknown): number {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 2;
  if (s.includes('productos y servicios')) return 3;
  if (s.includes('servicios')) return 2;
  if (s.includes('productos')) return 1;
  const n = Number(s);
  if ([1, 2, 3].includes(n)) return n;
  return 2;
}

function parseDestinatario(
  destRaw: unknown,
  docRaw: unknown
): { consumidorFinal: boolean; docTipo: number; docNro: string } {
  const docDigits = normalizeCuit(docRaw);
  if (docDigits) {
    return { consumidorFinal: false, docTipo: docDigits.length === 11 ? 80 : 96, docNro: docDigits };
  }
  const destDigits = normalizeCuit(destRaw);
  if (destDigits && destDigits.length >= 7) {
    return { consumidorFinal: false, docTipo: destDigits.length === 11 ? 80 : 96, docNro: destDigits };
  }
  return { consumidorFinal: true, docTipo: 99, docNro: '0' };
}

function parseAlicuotaIva(raw: unknown): number | undefined {
  const s = String(raw ?? '').trim().replace(',', '.').replace('%', '');
  if (!s) return undefined;
  const n = Number(s);
  if ([0, 10.5, 21, 27].includes(n)) return n;
  return undefined;
}

/**
 * Condición frente al IVA del receptor desde una celda de Excel: acepta el id
 * numérico directo o texto libre parecido a la descripción oficial (p.ej.
 * "Monotributo", "Responsable Inscripto", "Consumidor Final", "Exento").
 * Devuelve undefined si no matchea nada, para que el llamador decida el default.
 */
function parseCondicionIva(raw: unknown): number | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  const n = Number(s);
  if (CONDICIONES_IVA_RECEPTOR.some((c) => c.value === n)) return n;
  if (s.includes('inscripto') || s === 'ri') return 1;
  if (s.includes('monotributo social')) return 13;
  if (s.includes('promovido')) return 16;
  if (s.includes('monotributo') || s === 'mt') return 6;
  if (s.includes('exento')) return 4;
  if (s.includes('consumidor final') || s === 'cf') return 5;
  if (s.includes('no categorizado')) return 7;
  if (s.includes('exterior') && s.includes('proveedor')) return 8;
  if (s.includes('exterior')) return 9;
  if (s.includes('liberado')) return 10;
  if (s.includes('no alcanzado')) return 15;
  return undefined;
}

function parseImporte(raw: unknown): number {
  if (raw === '' || raw == null) return NaN;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return Number(s);
}

function buscarCliente(clientes: Cliente[], cuitRaw: unknown, nombreRaw: unknown): Cliente | undefined {
  const cuitNorm = normalizeCuit(cuitRaw);
  if (cuitNorm) {
    const porCuit = clientes.find((c) => mismoCuit(c.cuit, cuitNorm));
    if (porCuit) return porCuit;
  }
  const nombreNorm = String(nombreRaw ?? '').trim().toLowerCase();
  if (nombreNorm) {
    return clientes.find((c) => c.cliente?.trim().toLowerCase() === nombreNorm);
  }
  return undefined;
}

/** Lee la fecha de una celda de Excel: número de serie, dd/mm/aaaa o aaaa-mm-dd. Devuelve yyyy-MM-dd o null si no se entiende. */
function parseFechaCelda(raw: unknown): string | null {
  if (raw instanceof Date) return isoLocal(raw);
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function isoLocal(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function descargarPlantilla() {
  const datos = [
    [
      'Cliente',
      'CUIT',
      'Punto de venta',
      'Tipo de comprobante',
      'Concepto',
      'Destinatario',
      'Documento',
      'Importe',
      'Alicuota IVA',
      'Condicion IVA',
      'Nombre receptor',
      'Descripcion',
      'Fecha',
    ],
    ['BELTRAMINO KAREN', '27434107097', 1, 'B', 'Servicios', 'CF', '', 15000, '', 'Consumidor Final', '', 'Honorarios profesionales', ''],
    ['EJEMPLO SAS', '30712345678', 1, 'B', 'Servicios', 'RI', '30712345678', 15000, 21, 'Responsable Inscripto', 'EJEMPLO SAS', 'Servicios de consultoría', '25/09/2026'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, 'plantilla-facturacion-masiva.xlsx');
}

/**
 * Facturación masiva: arma una cola de facturas (de uno o varios clientes) y las emite
 * todas en secuencia contra ARCA (vía el backend AFIP). Van una por una -- no en paralelo --
 * porque si dos facturas del mismo cliente/punto de venta/tipo salen al mismo tiempo, ambas
 * pueden pedir "el próximo número" a la vez y chocar. Un error en una línea no frena a las
 * demás: quedan marcadas para reintentar.
 */
export default function FacturacionMasivaPage() {
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });
  const facturacionQuery = useQuery({ queryKey: ['facturacion'], queryFn: api.getFacturacion, retry: false });

  const [clienteId, setClienteId] = useState('');
  const [cbteTipo, setCbteTipo] = useState(6);
  const [concepto, setConcepto] = useState(2);
  const [fecha, setFecha] = useState(hoyIso());
  const [consumidorFinal, setConsumidorFinal] = useState(true);
  const [docTipo, setDocTipo] = useState(80);
  const [docNro, setDocNro] = useState('');
  const [importe, setImporte] = useState('');
  const [ptoVtaManual, setPtoVtaManual] = useState('');
  const [alicuotaIva, setAlicuotaIva] = useState(21);
  const [discriminarIvaEnB, setDiscriminarIvaEnB] = useState(false);
  const [condicionIvaReceptorId, setCondicionIvaReceptorId] = useState(() => condicionIvaSugerida(6, true));
  const [receptorNombre, setReceptorNombre] = useState('');
  const [padronInfo, setPadronInfo] = useState<{ estado: 'buscando' | 'ok' | 'error'; texto: string } | null>(null);

  /** Con un CUIT de 11 dígitos, completa nombre y condición frente al IVA del receptor desde ARCA. */
  async function completarReceptorDesdeArca(nro: string) {
    const cuit = nro.replace(/\D/g, '');
    if (docTipo !== 80 || cuit.length !== 11) return;
    setPadronInfo({ estado: 'buscando', texto: 'Consultando ARCA...' });
    try {
      const p = await api.consultarPadron(cuit);
      setReceptorNombre(p.denominacion);
      if ([1, 4, 5, 6].includes(p.condicionIvaId)) setCondicionIvaReceptorId(p.condicionIvaId);
      setPadronInfo({
        estado: 'ok',
        texto: p.denominacion + ' · ' + p.condicionIva + (p.categoriaMonotributo ? ' (Cat. ' + p.categoriaMonotributo + ')' : ''),
      });
    } catch (err) {
      setPadronInfo({ estado: 'error', texto: 'No se pudo consultar ARCA: ' + (err as Error).message });
    }
  }
  const [descripcion, setDescripcion] = useState('');
  const queryClient = useQueryClient();

  const esFacturaA = cbteTipo === 1;
  const esFacturaB = cbteTipo === 6;
  // Factura A siempre discrimina IVA. Factura B lo discrimina sólo si se tildó
  // la opción (caso: receptor Responsable Inscripto, p.ej. una SAS).
  const permiteAlicuota = esFacturaA || esFacturaB; // B: IVA contenido (Ley 27.743)
  const opcionesCondicionIva = condicionesIvaPara(cbteTipo);

  useEffect(() => {
    setCondicionIvaReceptorId(condicionIvaSugerida(cbteTipo, consumidorFinal));
  }, [cbteTipo, consumidorFinal]);

  // La cola vive fuera de la página: si cambiás de sección sigue emitiendo en segundo plano.
  const { cola, procesando } = useColaFacturacion<LineaFactura>();
  const setCola = setColaGlobal<LineaFactura>;
  const setProcesando = setProcesandoGlobal;
  const [confirmando, setConfirmando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [importResumen, setImportResumen] = useState<{ ok: number; errores: string[] } | null>(null);

  const clientes = useMemo(
    () => (clientesQuery.data ?? []).filter((c) => c.activo).sort((a, b) => a.cliente.localeCompare(b.cliente)),
    [clientesQuery.data]
  );

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  // Tipos de comprobante habilitados para el cliente elegido, según si es
  // Monotributista (sólo C) o Responsable Inscripto / SAS (sólo A o B).
  const tiposPermitidos = useMemo(
    () => tiposPermitidosPara(clienteSeleccionado?.categoriasFiscales),
    [clienteSeleccionado]
  );
  const ayudaTipoComprobante = ayudaTiposComprobante(clienteSeleccionado?.categoriasFiscales);

  // Si el cliente elegido cambia y el tipo de comprobante actual ya no está
  // permitido para su condición fiscal, lo corregimos automáticamente.
  useEffect(() => {
    if (!tiposPermitidos.includes(cbteTipo)) {
      setCbteTipo(tiposPermitidos.includes(6) ? 6 : tiposPermitidos[0]);
    }
  }, [tiposPermitidos]); // eslint-disable-line react-hooks/exhaustive-deps

  const ptoVentaSugerido = useMemo(() => {
    if (!clienteSeleccionado) return undefined;
    const fc = (facturacionQuery.data ?? []).find(
      (f) =>
        mismoCuit(f.cuit, clienteSeleccionado.cuit) ||
        f.cliente?.trim().toLowerCase() === clienteSeleccionado.cliente?.trim().toLowerCase()
    );
    return parsePuntoVenta(fc?.puntoVenta);
  }, [facturacionQuery.data, clienteSeleccionado]);

  const ptoVtaEfectivo = ptoVtaManual || (ptoVentaSugerido ? String(ptoVentaSugerido) : '');

  function agregarLinea() {
    if (!clienteSeleccionado || !ptoVtaEfectivo || !importe) return;
    const nueva: LineaFactura = {
      id: crypto.randomUUID(),
      clienteId: clienteSeleccionado.id,
      clienteNombre: clienteSeleccionado.cliente,
      cuit: clienteSeleccionado.cuit,
      ptoVta: Number(ptoVtaEfectivo),
      cbteTipo,
      concepto,
      consumidorFinal,
      docTipo,
      docNro,
      importe: Number(importe),
      condicionIvaReceptorId,
      ...(permiteAlicuota ? { alicuotaIva } : {}),
      receptorNombre: receptorNombre.trim() || undefined,
      descripcion: descripcion.trim() || undefined,
      fechaComprobante: fecha && fecha !== hoyIso() ? fecha : undefined,
      estado: 'pendiente',
    };
    setCola((prev) => [...prev, nueva]);
    setImporte('');
    setDocNro('');
    setReceptorNombre('');
    setPadronInfo(null);
  }

  function quitarLinea(id: string) {
    setCola((prev) => prev.filter((l) => l.id !== id));
  }

  function sugerirPtoVenta(cliente: Cliente): number | undefined {
    const fc = (facturacionQuery.data ?? []).find(
      (f) => mismoCuit(f.cuit, cliente.cuit) || f.cliente?.trim().toLowerCase() === cliente.cliente?.trim().toLowerCase()
    );
    return parsePuntoVenta(fc?.puntoVenta);
  }

  async function handleExcelFile(file: File) {
    setImportando(true);
    setImportResumen(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const nuevas: LineaFactura[] = [];
      const errores: string[] = [];

      rows.forEach((row, idx) => {
        const fila = idx + 2; // fila 1 = encabezados
        const norm: Record<string, unknown> = {};
        Object.entries(row).forEach(([k, v]) => {
          norm[normalizeHeader(k)] = v;
        });
        const get = (...keys: string[]) => {
          for (const k of keys) {
            if (norm[k] !== undefined && String(norm[k]).trim() !== '') return norm[k];
          }
          return '';
        };

        const nombreRaw = get('cliente', 'nombre', 'razon social', 'razonsocial');
        const cuitRaw = get('cuit', 'cuit cliente', 'cuitcliente');
        if (!String(nombreRaw).trim() && !String(cuitRaw).trim()) return; // fila vacía, se ignora

        const cliente = buscarCliente(clientes, cuitRaw, nombreRaw);
        if (!cliente) {
          errores.push(`Fila ${fila}: no se encontró el cliente "${nombreRaw || cuitRaw}".`);
          return;
        }

        const ptoVtaRaw = get('punto de venta', 'puntodeventa', 'pto vta', 'ptovta', 'punto venta');
        const ptoVta = parsePuntoVenta(String(ptoVtaRaw)) ?? sugerirPtoVenta(cliente);
        if (!ptoVta) {
          errores.push(`Fila ${fila}: falta el punto de venta para ${cliente.cliente} (no se pudo sugerir uno automáticamente).`);
          return;
        }

        const importeVal = parseImporte(get('importe', 'importe total', 'monto', 'total'));
        if (!importeVal || Number.isNaN(importeVal) || importeVal <= 0) {
          errores.push(`Fila ${fila}: importe inválido para ${cliente.cliente}.`);
          return;
        }

        const cbteTipoVal = parseTipoComprobante(get('tipo de comprobante', 'tipocomprobante', 'comprobante', 'tipo'));

        // Validamos el tipo de comprobante contra la condición fiscal del cliente:
        // un Monotributista sólo puede facturar C, y un RI/SAS sólo A o B.
        const tiposPermitidosCliente = tiposPermitidosPara(cliente.categoriasFiscales);
        if (!tiposPermitidosCliente.includes(cbteTipoVal)) {
          const tipoLabel = TIPOS_COMPROBANTE.find((t) => t.value === cbteTipoVal)?.label ?? String(cbteTipoVal);
          const categoriasCliente = parseCategorias(cliente.categoriasFiscales).join(', ');
          errores.push(
            `Fila ${fila}: ${cliente.cliente} es ${categoriasCliente} y no puede emitir ${tipoLabel}. Se omitió esta fila.`
          );
          return;
        }

        const conceptoVal = parseConcepto(get('concepto'));
        const destRaw = get('destinatario', 'consumidor final', 'cf');
        const docRaw = get('documento', 'nro documento', 'numero de documento', 'dni', 'cuit destinatario', 'docnro');
        const { consumidorFinal, docTipo, docNro } = parseDestinatario(destRaw, docRaw);

        const alicuotaRaw = get('alicuota iva', 'alicuotaiva', 'alicuota', 'iva');
        const alicuotaVal = parseAlicuotaIva(alicuotaRaw);
        if (alicuotaRaw && alicuotaVal === undefined) {
          errores.push(
            `Fila ${fila}: alícuota de IVA "${alicuotaRaw}" inválida para ${cliente.cliente} (usá 0, 10.5, 21 o 27). Se cargó sin discriminar IVA.`
          );
        }
        // Factura A discrimina IVA y Factura B informa el IVA contenido (Ley 27.743): default 21%.
        const alicuotaIvaVal = cbteTipoVal === 1 || cbteTipoVal === 6 ? alicuotaVal ?? 21 : undefined;

        const condicionIvaRaw = get('condicion iva', 'condicion frente al iva', 'condicioniva', 'condicion iva receptor');
        const condicionIvaVal = parseCondicionIva(condicionIvaRaw);
        if (condicionIvaRaw && condicionIvaVal === undefined) {
          errores.push(
            `Fila ${fila}: condición de IVA "${condicionIvaRaw}" no reconocida para ${cliente.cliente}. Se usó un valor sugerido por defecto.`
          );
        }

        const receptorNombreVal = String(get('nombre receptor', 'receptor', 'nombre del receptor', 'razon social receptor')).trim();
        const descripcionVal = String(get('descripcion', 'detalle')).trim();

        // Fecha opcional: si está vacía se factura con la fecha elegida en pantalla (hoy por defecto).
        const fechaRaw = norm['fecha'] ?? norm['fecha de la factura'] ?? norm['fecha factura'] ?? norm['fecha comprobante'] ?? '';
        let fechaVal: string | undefined;
        if (String(fechaRaw).trim() !== '') {
          const f = parseFechaCelda(fechaRaw);
          const rango = rangoFechaFactura(conceptoVal);
          if (!f) {
            errores.push(`Fila ${fila}: fecha "${fechaRaw}" no se entiende para ${cliente.cliente} (usá dd/mm/aaaa). Se omitió esta fila.`);
            return;
          }
          if (f < rango.min || f > rango.max) {
            errores.push(
              `Fila ${fila}: la fecha ${formatFechaCorta(f)} de ${cliente.cliente} está fuera de lo que admite ARCA (hasta ${rango.margen} días antes o después de hoy). Se omitió esta fila.`
            );
            return;
          }
          if (f !== hoyIso()) fechaVal = f;
        } else if (fecha && fecha !== hoyIso()) {
          fechaVal = fecha;
        }

        nuevas.push({
          id: crypto.randomUUID(),
          clienteId: cliente.id,
          clienteNombre: cliente.cliente,
          cuit: cliente.cuit,
          ptoVta,
          cbteTipo: cbteTipoVal,
          concepto: conceptoVal,
          consumidorFinal,
          docTipo,
          docNro,
          importe: importeVal,
          condicionIvaReceptorId: condicionIvaVal ?? condicionIvaSugerida(cbteTipoVal, consumidorFinal),
          receptorNombre: receptorNombreVal || undefined,
          descripcion: descripcionVal || undefined,
          fechaComprobante: fechaVal,
          ...(alicuotaIvaVal !== undefined ? { alicuotaIva: alicuotaIvaVal } : {}),
          estado: 'pendiente',
        });
      });

      if (nuevas.length > 0) {
        setCola((prev) => [...prev, ...nuevas]);
      }
      setImportResumen({ ok: nuevas.length, errores });
    } catch (err) {
      setImportResumen({ ok: 0, errores: [`No se pudo leer el archivo: ${(err as Error).message}`] });
    } finally {
      setImportando(false);
    }
  }

  const pendientes = cola.filter((l) => l.estado === 'pendiente' || l.estado === 'error');
  const totalPendiente = pendientes.reduce((acc, l) => acc + l.importe, 0);

  async function facturarTodas() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setProcesando(true);
    if (procesando) return;
    for (const linea of cola) {
      if (linea.estado !== 'pendiente' && linea.estado !== 'error') continue;
      setCola((prev) => prev.map((l) => (l.id === linea.id ? { ...l, estado: 'emitiendo', error: undefined } : l)));
      try {
        const resultado = await api.emitirFacturaAfip({
          cuitRepresentada: linea.cuit,
          ptoVta: linea.ptoVta,
          cbteTipo: linea.cbteTipo,
          concepto: linea.concepto,
          docTipo: linea.consumidorFinal ? 99 : linea.docTipo,
          docNro: linea.consumidorFinal ? '0' : linea.docNro,
          importe: linea.importe,
          condicionIvaReceptorId: linea.condicionIvaReceptorId,
          ...(linea.alicuotaIva !== undefined ? { alicuotaIva: linea.alicuotaIva } : {}),
          ...(linea.fechaComprobante ? { fechaComprobante: linea.fechaComprobante } : {}),
        }, { receptorNombre: linea.receptorNombre, descripcion: linea.descripcion });
        setCola((prev) => prev.map((l) => (l.id === linea.id ? { ...l, estado: 'ok', resultado } : l)));
      } catch (err) {
        setCola((prev) =>
          prev.map((l) => (l.id === linea.id ? { ...l, estado: 'error', error: (err as Error).message } : l))
        );
      }
    }
    setProcesando(false);
    setConfirmando(false);
    queryClient.invalidateQueries({ queryKey: ['facturas-emitidas'] });
    queryClient.invalidateQueries({ queryKey: ['facturacion-ri'] });
  }

  const ESTADO_BADGE: Record<EstadoLinea, string> = {
    pendiente: 'bg-slate-100 text-slate-600',
    emitiendo: 'bg-blue-50 text-blue-700',
    ok: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Layers size={20} className="text-brand-600" />
          Facturación masiva
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Armá una cola con facturas de uno o varios clientes y emitilas todas juntas contra ARCA.
        </p>
      </div>

      {/* Carga masiva desde Excel */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-brand-600" />
              Importar varias facturas desde Excel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Columnas: Cliente (o CUIT), Punto de venta, Tipo de comprobante, Concepto, Destinatario, Documento,
              Importe, Condición IVA (opcional; si falta, se sugiere una según el tipo de comprobante). Si falta el
              punto de venta, se intenta sugerir automáticamente. Opcionales para el PDF: Nombre receptor y Descripcion. Fecha (dd/mm/aaaa): para facturar con fecha anterior; si la dejás vacía se usa la fecha elegida abajo (hoy). Los Monotributistas sólo pueden facturar C, y los
              Responsables Inscriptos / SAS sólo A o B: si una fila no respeta esto, se omite y se avisa.
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
              importResumen.errores.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            )}
          >
            <p className="font-medium">
              {importResumen.ok > 0
                ? `Se agregaron ${importResumen.ok} factura${importResumen.ok !== 1 ? 's' : ''} a la cola.`
                : 'No se agregó ninguna factura.'}
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

      {/* Formulario para agregar una línea */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Agregar a la cola</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1 md:col-span-1">
            <label className="text-xs font-medium text-slate-500">Cliente *</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            >
              <option value="">Elegir cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cliente} {c.cuit ? `(${c.cuit})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Punto de venta *</label>
            <input
              type="number"
              min={1}
              value={ptoVtaEfectivo}
              onChange={(e) => setPtoVtaManual(e.target.value)}
              placeholder={ptoVentaSugerido ? String(ptoVentaSugerido) : 'Ej: 4'}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
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
            {ayudaTipoComprobante && (
              <p className="text-[11px] text-amber-600 mt-0.5">{ayudaTipoComprobante}</p>
            )}
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
            <div className="flex gap-4 text-sm pt-1.5">
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" checked={consumidorFinal} onChange={() => setConsumidorFinal(true)} />
                Consumidor Final
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" checked={!consumidorFinal} onChange={() => setConsumidorFinal(false)} />
                CUIT / DNI
              </label>
            </div>
          </div>

          {!consumidorFinal && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Tipo de documento</label>
                <select
                  value={docTipo}
                  onChange={(e) => setDocTipo(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  <option value={80}>CUIT</option>
                  <option value={96}>DNI</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Número de documento</label>
                <input
                  value={docNro}
                  inputMode="numeric"
                  onChange={(e) => {
                    setDocNro(e.target.value);
                    setPadronInfo(null);
                  }}
                  onBlur={(e) => completarReceptorDesdeArca(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
                {padronInfo && (
                  <p
                    className={clsx(
                      'text-xs',
                      padronInfo.estado === 'ok' && 'text-emerald-700',
                      padronInfo.estado === 'error' && 'text-red-600',
                      padronInfo.estado === 'buscando' && 'text-slate-500'
                    )}
                  >
                    {padronInfo.texto}
                  </p>
                )}
                {!padronInfo && docTipo === 80 && (
                  <p className="text-xs text-slate-400">Con el CUIT se completan nombre y condición desde ARCA.</p>
                )}
              </div>
            </>
          )}

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
            <label className="text-xs font-medium text-slate-500">Importe *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0.00"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Nombre del receptor (opcional, para el PDF)</label>
            <input
              value={receptorNombre}
              onChange={(e) => setReceptorNombre(e.target.value)}
              placeholder={consumidorFinal ? 'Consumidor Final' : 'Apellido y nombre / Razón social'}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Descripción (opcional, para el PDF)</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Honorarios profesionales"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
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
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={agregarLinea}
            disabled={!clienteSeleccionado || !ptoVtaEfectivo || !importe}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none text-white px-3.5 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Agregar a la cola
          </button>
        </div>
      </div>

      {/* Cola */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">
            Cola ({cola.length}) {pendientes.length > 0 && `· ${formatMoney(totalPendiente)} a emitir`}
          </h2>
          {!procesando && cola.some((l) => l.estado === 'ok') && (
            <button
              onClick={() => setCola((prev) => prev.filter((l) => l.estado !== 'ok'))}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Quitar las ya emitidas
            </button>
          )}
        </div>

        {cola.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Todavía no agregaste ninguna factura a la cola.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {cola.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.clienteNombre}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {TIPOS_COMPROBANTE.find((t) => t.value === l.cbteTipo)?.label} · Pto. Vta {l.ptoVta} ·{' '}
                    {formatMoney(l.importe)}
                    {l.fechaComprobante && ` · Fecha ${formatFechaCorta(l.fechaComprobante)}`}
                    {l.alicuotaIva !== undefined && ` · IVA ${l.alicuotaIva}%`}
                    {` · ${CONDICIONES_IVA_RECEPTOR.find((c) => c.value === l.condicionIvaReceptorId)?.label ?? l.condicionIvaReceptorId}`}
                    {l.estado === 'ok' && l.resultado && ` · CAE ${l.resultado.cae}`}
                    {l.estado === 'error' && l.error && (
                      <span className="text-red-600"> · {l.error}</span>
                    )}
                  </p>
                  {l.estado === 'ok' && l.resultado && (
                    <div className="mt-2">
                      {l.resultado.pdf && !l.resultado.pdf.error ? (
                        <FacturaCompartir
                          compacto
                          url={l.resultado.pdf.url}
                          titulo={`${tituloFactura(l.resultado.cbteTipo, l.resultado.ptoVta, l.resultado.numero)} - ${l.clienteNombre}`}
                          cargarPdf={() => api.getFacturaPdf(l.resultado!.pdf!.id)}
                        />
                      ) : (
                        <p className="text-xs text-amber-600">
                          La factura se emitió, pero no se pudo generar el PDF
                          {l.resultado.pdf?.error ? `: ${l.resultado.pdf.error}` : ''}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1', ESTADO_BADGE[l.estado])}>
                    {l.estado === 'emitiendo' && <Loader2 size={12} className="animate-spin" />}
                    {l.estado === 'ok' && <CheckCircle2 size={12} />}
                    {l.estado === 'error' && <XCircle size={12} />}
                    {l.estado}
                  </span>
                  {l.estado === 'pendiente' && (
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
          <div className="px-5 py-4 border-t border-slate-200 space-y-3">
            {confirmando && !procesando && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Vas a emitir {pendientes.length} factura{pendientes.length !== 1 ? 's' : ''} REALES en ARCA por un
                  total de {formatMoney(totalPendiente)}. No se pueden anular ni editar después. Confirmá de nuevo
                  para emitir.
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={facturarTodas}
                disabled={pendientes.length === 0 || procesando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:pointer-events-none text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                {procesando && <Loader2 size={14} className="animate-spin" />}
                {procesando
                  ? 'Emitiendo...'
                  : confirmando
                  ? `Confirmar y emitir ${pendientes.length}`
                  : `Facturar todas (${pendientes.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
