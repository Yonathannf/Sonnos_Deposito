import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { crearConteo } from "./actions";

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requierePanel("inventario", "ver");
  const sp = await searchParams;
  const { data: conteos } = await (await createClient()).from("conteos_resumen").select("*").order("fecha", { ascending: false }).order("id", { ascending: false }).limit(60);
  const cerrados = (conteos ?? []).filter((c) => c.estado === "Cerrado");
  const art = cerrados.reduce((a, c) => a + c.articulos, 0);
  const aci = cerrados.reduce((a, c) => a + c.aciertos, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo>Inventario físico</Titulo>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid grid-cols-3 gap-3">
        <div className={card}><p className="text-xs text-slate-500">Artículos controlados</p><p className="text-2xl font-bold">{art}</p></div>
        <div className={card}><p className="text-xs text-slate-500">Aciertos (±3%)</p><p className="text-2xl font-bold">{aci}</p></div>
        <div className={card}><p className="text-xs text-slate-500">Precisión acumulada</p><p className="text-2xl font-bold">{art ? `${Math.round((aci / art) * 1000) / 10}%` : "—"}</p></div>
      </div>

      {s.niveles.inventario === "editar" && (
        <form action={crearConteo} className={`${card} grid gap-3 sm:grid-cols-[1fr_auto_auto]`}>
          <input name="nombre" placeholder="Nombre del conteo (ej. Control góndola A)" required className={input} />
          <input type="date" name="fecha" defaultValue={hoy()} className={input} />
          <button className={boton}>Nuevo conteo</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Conteo</th><th className="p-3">Estado</th><th className="p-3">Artículos</th><th className="p-3">Precisión</th><th className="p-3">Ajustes pend.</th></tr></thead>
          <tbody>
            {conteos?.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="p-3">{fmtFecha(c.fecha)}</td>
                <td className="p-3 font-semibold"><Link href={`/inventario/${c.id}`} className="underline">{c.nombre}</Link></td>
                <td className="p-3"><Badge>{c.estado === "Abierto" ? "En curso" : "Finalizada"}</Badge></td>
                <td className="p-3">{c.articulos}</td>
                <td className="p-3">{c.precision_pct != null ? `${c.precision_pct}%` : "—"}</td>
                <td className="p-3">{c.ajustes_pendientes || "—"}</td>
              </tr>
            ))}
            {!conteos?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Todavía no hay conteos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
