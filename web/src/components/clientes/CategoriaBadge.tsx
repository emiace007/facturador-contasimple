import { getCategoriaInfo } from '../../lib/clientes';

interface CategoriaBadgeProps {
  categoria: string;
  size?: 'sm' | 'md';
}

export function CategoriaBadge({ categoria, size = 'sm' }: CategoriaBadgeProps) {
  const info = getCategoriaInfo(categoria);
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${info.badgeClasses} ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {info.label}
    </span>
  );
}
