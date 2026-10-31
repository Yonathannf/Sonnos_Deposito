import { redirect } from "next/navigation";

// Mensajes tipo "flash": la acción redirige a la misma pantalla con ?ok= o ?error=.
export function volver(ruta: string, tipo: "ok" | "error", msg: string): never {
  const sep = ruta.includes("?") ? "&" : "?";
  redirect(`${ruta}${sep}${tipo}=${encodeURIComponent(msg)}`);
}

export function hoy() {
  // fecha local de Argentina (el servidor corre en UTC)
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function fmtFecha(f?: string | null) {
  if (!f) return "—";
  const [y, m, d] = f.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function n(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
export function s(v: FormDataEntryValue | null): string | null {
  const t = v === null ? "" : String(v).trim();
  return t === "" ? null : t;
}
