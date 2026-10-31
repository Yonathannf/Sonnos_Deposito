import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Titulo, boton, botonSec, card, input } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { TIPOS, generarReporte, type TipoReporte } from "@/lib/reportes";
import { hoy } from "@/lib/util";

const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; desde?: string; hasta?: string }> }) {
  await requierePanel("reportes", "ver");
  const sp = await searchParams;
  const h = hoy();
  const dow = (new Date(h + "T12:00:00Z").getUTCDay() + 6) % 7;
  const presets: [string, string, string][] = [
    ["Hoy", h, h], ["Esta semana", sumaFecha(h, -dow), h], ["Este mes", `${h.slice(0, 8)}01`, h], ["Últimos 30 días", sumaFecha(h, -29), h],
  ];
  const tipo = (TIPOS.find((t) => t.id === sp.tipo)?.id ?? "pedidos_armados") as TipoReporte;
  const ok = (x?: string) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  const desde = ok(sp.desde) ?? sumaFecha(h, -29); const hasta = ok(sp.hasta) ?? h;
  let rep, err: string | null = null;
  try { rep = await generarReporte(await createClient(), tipo, desde, hasta); } catch (e) { err = (e as Error).message; }
  const qs = (t: string, d: string, ha: string) => `tipo=${t}&desde=${d}&hasta=${ha}`;
  const MAX = 500;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo extra={<PrintButton className={`${botonSec} print:hidden`} />}>Reportes</Titulo>
      <div className="print:hidden space-y-3">
        <form className={`${card} grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]`}>
          <select name="tipo" defaultValue={tipo} className={input}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
          <input type="date" name="desde" defaultValue={desde} className={input} aria-label="Desde" />
          <input type="date" name="hasta" defaultValue={hasta} className={input} aria-label="Hasta" />
          <button className={boton}>Ver reporte</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {presets.map(([l, d, ha]) => <Link key={l} href={`/reportes?${qs(tipo, d, ha)}`} className={botonSec}>{l}</Link>)}
          <a href={`/reportes/export?${qs(tipo, desde, hasta)}`} className={`${botonSec} ml-auto !bg-green-700 !text-white hover:!bg-green-800`}>⬇ Descargar Excel</a>
        </div>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No se pudo generar el reporte: {err}</p>}
      {rep && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">{rep.titulo}</h2>
          {rep.resumen && <p className="text-sm text-slate-600">{rep.resumen}</p>}
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{rep.columnas.map((c) => <th key={c} className="p-2.5">{c}</th>)}</tr></thead>
              <tbody>
                {rep.filas.slice(0, MAX).map((f, i) => (
                  <tr key={i} className="border-t border-slate-100">{f.map((c, j) => <td key={j} className="p-2.5">{c ?? "—"}</td>)}</tr>
                ))}
                {!rep.filas.length && <tr><td colSpan={rep.columnas.length} className="p-6 text-center text-slate-500">Sin datos en el período.</td></tr>}
              </tbody>
            </table>
          </div>
          {rep.filas.length > MAX && <p className="text-sm text-slate-500">Se muestran las primeras {MAX} filas de {rep.filas.length}. El Excel incluye todas.</p>}
          <p className="hidden text-xs text-slate-500 print:block">Sonnos Depósito · generado el {new Date().toLocaleDateString("es-AR")}</p>
        </section>
      )}
      <p className="text-xs text-slate-500 print:hidden">Para PDF: tocá “Imprimir” y elegí “Guardar como PDF”.</p>
    </div>
  );
}
