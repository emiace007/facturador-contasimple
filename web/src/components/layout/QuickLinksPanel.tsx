import { useQuery } from '@tanstack/react-query';
import { Link2, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { DEFAULT_QUICK_LINKS } from '../../data/quickLinks';
import type { QuickLink } from '../../types';

function groupByCategoria(links: QuickLink[]) {
  return links.reduce<Record<string, QuickLink[]>>((acc, link) => {
    (acc[link.categoria] ??= []).push(link);
    return acc;
  }, {});
}

/** Favicon del sitio del link, para mostrar un "logo" sin tener que cargar íconos a mano. */
function faviconUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
}

interface QuickLinksPanelProps {
  /** Controla si el drawer está abierto. Siempre se abre/cierra desde el botón del Header, en cualquier tamaño de pantalla. */
  open?: boolean;
  onClose?: () => void;
}

export function QuickLinksPanel({ open = false, onClose }: QuickLinksPanelProps) {
  const { data, isError } = useQuery({
    queryKey: ['quickLinks'],
    queryFn: api.getQuickLinks,
    // Si todavía no hay backend configurado, usamos la lista por defecto
    // en vez de romper la UI.
    retry: false,
  });

  const links = isError || !data ? DEFAULT_QUICK_LINKS : data;
  const grouped = groupByCategoria(links);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'bg-white border-l border-slate-200 overflow-y-auto w-72 shrink-0',
          'fixed inset-y-0 right-0 z-50 transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="h-16 flex items-center px-5 border-b border-slate-200 shrink-0">
          <Link2 size={16} className="text-brand-600 mr-2" />
          <h2 className="text-sm font-semibold text-slate-700">Accesos Directos</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
            aria-label="Cerrar accesos directos"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {Object.entries(grouped).map(([categoria, items]) => (
            <div key={categoria}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                {categoria}
              </h3>
              <div className="grid grid-cols-4 gap-2.5">
                {items.map((link) => {
                  const favicon = faviconUrl(link.url);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      title={link.label}
                      className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200/70 bg-white p-2.5 aspect-square hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm transition-all"
                    >
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className="h-6 w-6 rounded shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <Link2 size={18} className="text-slate-400 shrink-0" />
                      )}

                      {/* Tooltip con el nombre completo, visible solo al pasar el mouse */}
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-10">
                        {link.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}

          {links.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              No hay accesos directos cargados todavía.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
