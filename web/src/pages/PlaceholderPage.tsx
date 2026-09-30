interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Stub para módulos que se implementan en fases siguientes. */
export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
      <h2 className="text-base font-semibold text-slate-700">{title}</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</p>
    </div>
  );
}
