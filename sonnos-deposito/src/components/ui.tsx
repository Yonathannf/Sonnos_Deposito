export const input = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-slate-900";
export const boton = "h-11 rounded-lg bg-slate-900 px-5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50";
export const botonSec = "inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-4 font-medium hover:bg-slate-100";
export const card = "rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  return (
    <>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </>
  );
}

const COLORES: Record<string, string> = {
  Impreso: "bg-amber-100 text-amber-800",
  Armado: "bg-blue-100 text-blue-800",
  Entregado: "bg-green-100 text-green-800",
  CUMPLE: "bg-green-100 text-green-800",
  "NO CUMPLE": "bg-red-100 text-red-800",
  EFICIENTE: "bg-green-100 text-green-800",
  "FUERA DE PLAZO": "bg-red-100 text-red-800",
  URGENTE: "bg-red-100 text-red-800",
  NORMAL: "bg-slate-100 text-slate-700",
  ESTACIONADO: "bg-purple-100 text-purple-800",
  Crítico: "bg-red-100 text-red-800",
  Bajo: "bg-amber-100 text-amber-800",
  OK: "bg-green-100 text-green-800",
  ALERTA: "bg-red-100 text-red-800",
  "SIN MÍNIMO": "bg-slate-100 text-slate-600",
  CRITICO: "bg-red-100 text-red-800",
  Pendiente: "bg-amber-100 text-amber-800",
  "En curso": "bg-blue-100 text-blue-800",
  Finalizada: "bg-green-100 text-green-800",
};
export function Badge({ children }: { children: string | null | undefined }) {
  if (!children) return <span className="text-slate-400">—</span>;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORES[children] ?? "bg-slate-100 text-slate-700"}`}>
      {children}
    </span>
  );
}

export function Titulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {extra}
    </div>
  );
}
