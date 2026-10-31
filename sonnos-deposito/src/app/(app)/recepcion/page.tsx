import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { crearRecepcion } from "./actions";

export default async function RecepcionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requierePanel("recepcion", "ver");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: recs } = await supabase.from("recepciones").select("*, recepcion_items(count)")
    .order("fecha", { ascending: false }).order("id", { ascending: false }).limit(80);
  const cant = new Map<number, number>((recs ?? []).map((r) => [r.id, (r.recepcion_items as unknown as { count: number }[])?.[0]?.count ?? 0]));
  const proveedores = [...new Set((recs ?? []).map((r) => r.proveedor))].sort();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo>Recepción de mercadería</Titulo>
      <Flash ok={sp.ok} error={sp.error} />
      {s.niveles.recepcion === "editar" && (
        <form action={crearRecepcion} className={`${card} grid gap-3 sm:grid-cols-4`}>
          <h2 className="font-semibold sm:col-span-4">Nueva recepción</h2>
          <input name="proveedor" list="proveedores" placeholder="Proveedor" required className={input} />
          <input name="nro_remito" placeholder="Nº de remito / documento" required className={input} />
          <input type="date" name="fecha" defaultValue={hoy()} className={input} />
          <button className={boton}>Crear</button>
          <datalist id="proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Proveedor</th><th className="p-3">Remito</th><th className="p-3">Artículos</th><th className="p-3">Estado</th><th className="p-3">Diferencias</th></tr></thead>
          <tbody>
            {recs?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-3">{fmtFecha(r.fecha)}</td><td className="p-3 font-semibold"><Link href={`/recepcion/${r.id}`} className="underline">{r.proveedor}</Link></td>
                <td className="p-3">{r.nro_remito}</td><td className="p-3">{cant.get(r.id) ?? 0}</td>
                <td className="p-3"><Badge>{r.estado === "Confirmada" ? "Finalizada" : "Pendiente"}</Badge> <span className="text-xs text-slate-500">{r.estado}</span></td>
                <td className="p-3">{r.estado === "Confirmada" ? (r.con_diferencias ? <Badge>ALERTA</Badge> : <Badge>OK</Badge>) : "—"}</td>
              </tr>
            ))}
            {!recs?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Todavía no hay recepciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
