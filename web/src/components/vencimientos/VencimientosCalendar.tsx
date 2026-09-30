import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Vencimiento } from '../../types';
import { getUrgencia, toISODate } from '../../lib/dates';

interface VencimientosCalendarProps {
  vencimientos: Vencimiento[];
  onSelectDay?: (isoDate: string) => void;
  selectedDay?: string | null;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const DOT_COLOR = {
  vencido: 'bg-red-500',
  proximo: 'bg-amber-500',
  ok: 'bg-emerald-500',
} as const;

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // Lunes = 0 ... Domingo = 6
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function VencimientosCalendar({ vencimientos, onSelectDay, selectedDay }: VencimientosCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Vencimiento[]>();
    for (const v of vencimientos) {
      const key = v.fechaVencimiento?.slice(0, 10);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return map;
  }, [vencimientos]);

  const days = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const todayISO = toISODate(new Date());
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISODate(day);
          const inMonth = day.getMonth() === cursor.month;
          const items = byDay.get(iso) ?? [];
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDay;

          const urgencias = new Set(items.map((v) => getUrgencia(v.fechaVencimiento, v.estado)));

          return (
            <button
              key={iso}
              onClick={() => onSelectDay?.(isSelected ? '' : iso)}
              className={clsx(
                'aspect-square rounded-xl border p-1.5 flex flex-col items-start text-left transition-colors',
                inMonth ? 'bg-white' : 'bg-slate-50 text-slate-300',
                isSelected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-100 hover:border-slate-300',
                isToday && !isSelected && 'border-brand-300'
              )}
            >
              <span className={clsx('text-xs font-medium', inMonth ? 'text-slate-600' : 'text-slate-300')}>
                {day.getDate()}
              </span>
              {items.length > 0 && (
                <div className="flex gap-0.5 mt-auto flex-wrap">
                  {[...urgencias].slice(0, 3).map((u) => (
                    <span key={u} className={clsx('h-1.5 w-1.5 rounded-full', DOT_COLOR[u])} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
