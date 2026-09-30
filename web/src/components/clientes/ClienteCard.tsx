import { Link } from 'react-router-dom';
import { UserCircle2 } from 'lucide-react';
import type { Cliente } from '../../types';
import { getCategoriaInfo, parseCategorias } from '../../lib/clientes';
import { CategoriaBadge } from './CategoriaBadge';

interface ClienteCardProps {
  cliente: Cliente;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function ClienteCard({ cliente }: ClienteCardProps) {
  const categorias = parseCategorias(cliente.categoriasFiscales);
  const principal = getCategoriaInfo(categorias[0]);

  return (
    <Link
      to={`/clientes/${encodeURIComponent(cliente.id)}`}
      className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col gap-3 hover:shadow-lg hover:shadow-brand-100/60 hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm ${principal.dotClasses}`}
        >
          {iniciales(cliente.cliente) || <UserCircle2 size={20} />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{cliente.cliente}</p>
          <p className="text-xs text-slate-400 tabular-nums">{cliente.cuit || 'Sin CUIT cargado'}</p>
        </div>
      </div>

      {cliente.encargado && (
        <p className="text-xs text-slate-500">
          Encargado: <span className="text-slate-700 font-medium">{cliente.encargado}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categorias.map((c) => (
          <CategoriaBadge key={c} categoria={c} />
        ))}
      </div>
    </Link>
  );
}
