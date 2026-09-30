import type { QuickLink } from '../types';

/**
 * Accesos por defecto, usados como fallback mientras no hay datos en la
 * hoja "AccesosDirectos" (o si falla la conexión). Una vez conectado el
 * backend, esta lista se reemplaza por api.getQuickLinks().
 */
export const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: 'afip', label: 'AFIP', url: 'https://www.afip.gob.ar/', categoria: 'Organismos' },
  { id: 'arba', label: 'ARBA', url: 'https://www.arba.gov.ar/', categoria: 'Organismos' },
  { id: 'agip', label: 'AGIP', url: 'https://www.agip.gob.ar/', categoria: 'Organismos' },
  {
    id: 'afip-cm',
    label: 'AFIP - Clave Fiscal',
    url: 'https://auth.afip.gob.ar/contribuyente_/login.xhtml',
    categoria: 'Organismos',
  },
  {
    id: 'anses',
    label: 'ANSES',
    url: 'https://www.anses.gob.ar/',
    categoria: 'Organismos',
  },
  {
    id: 'bcra',
    label: 'BCRA',
    url: 'https://www.bcra.gob.ar/',
    categoria: 'Bancos',
  },
  {
    id: 'homebanking',
    label: 'Home Banking (Banco Nación)',
    url: 'https://homebanking.bna.com.ar/',
    categoria: 'Bancos',
  },
  {
    id: 'facturacion',
    label: 'Sistema de Facturación',
    url: '#',
    categoria: 'Facturación',
  },
];
