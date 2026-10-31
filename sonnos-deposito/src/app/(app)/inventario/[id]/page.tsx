import Link from "next/link";
import { notFound } from "next/navigation";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { ScannerInput } from "@/components/ScannerInput";
import { fmtFecha } from "@/lib/util";
import { agregarItem, borrarItem, cerrarConteo, editarItem, resolverAjuste } from "../actions";

export default async function ConteoPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; ver?: string }> }) {
  const s = await requierePanel("inventario", "ver");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: c } = await supabase.from("conteos_resumen").select("*").eq("id", Number(id)).maybeSingle();
  if (!c) notFound();
  const { data: items } = await supabase.from("conteo_items_calc").select("*").eq("conteo_id", c.id).order("id", { ascending: false });
  const abierto = c.estado === "Abierto";
  const edita = s.niveles.inventario === "editar" && abierto;
  const resuelve = s.niveles.stock === "editar";
  const lista = sp.ver === "dif" ? (items ?? []).filter((i) => i.resultado === "FALTANTE" || i.resultado === "SOBRANTE") : items;
  const colorRes: Record<string, string> = { OK: "OK", "DENTRO DE TOLERANCIA": "OK", FALTANTE: "ALERTA", SOBRANTE: "Bajo" };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo extra={<Link href="/inventario" className={botonSec}>← Conteos</Link>}>{c.nombre}</Titulo>
      <p className="text-sm text-slate-500">{fmtFecha(c.fecha)} · <Badge>{abierto ? "En curso" : "Finalizada"}</Badge></p>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Artículos", c.articulos], ["Aciertos", c.aciertos], ["Precisión", c.precision_pct != null ? `${c.precision_pct}%` : "—"], ["Faltantes", c.faltantes], ["Sobrantes", c.sobrantes]].map(([l, v]) => (
          <div key={String(l)} className={card}><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>

      {edita && (
        <form action={agregarItem} className={`${card} grid gap-3 sm:grid-cols-[1fr_8rem_auto]`}>
          <input type="hidden" name="conteo_id" value={c.id} />
          <div><label className="text-sm">Código del artículo (escaneá o escribí)</label><ScannerInput name="sku" className={input} autoFocus enviarAlEscanear={false} /></div>
          <label className="text-sm">Cantidad contada<input name="contado" inputMode="numeric" required className={input} /></label>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sumar" defaultChecked className="size-5" /> Sumar si ya está</label>
            <button className={boton}>Agregar</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/inventario/${c.id}`} className={botonSec}>Todos</Link>
        <Link href={`/inventario/${c.id}?ver=dif`} className={botonSec}>Solo diferencias</Link>
        {edita && c.articulos > 0 && (
          <form action={cerrarConteo} className="ml-auto"><input type="hidden" name="id" value={c.id} /><button className={boton}>Cerrar conteo</button></form>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Descripción</th><th className="p-3 text-right">Contado</th><th className="p-3 text-right">Sistema</th><th className="p-3 text-right">Dif.</th><th className="p-3">Resultado</th><th className="p-3">Ajuste</th></tr></thead>
          <tbody>
            {lista?.map((i) => (
              <tr key={i.id} className="border-t border-slate-100 align-top">
                <td className="p-3 font-semibold">{i.sku}</td><td className="p-3">{i.descripcion ?? "—"}</td>
                <td className="p-3 text-right">
                  {edita ? (
                    <form action={editarItem} className="flex justify-end gap-1">
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="conteo_id" value={c.id} />
                      <input name="contado" defaultValue={i.contado} inputMode="numeric" aria-label={`Contado ${i.sku}`} className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-right" />
                      <button className="h-10 rounded-lg border border-slate-300 px-2 text-xs hover:bg-slate-100">OK</button>
                    </form>
                  ) : i.contado}
                </td>
                <td className="p-3 text-right">{i.sistema}</td>
                <td className="p-3 text-right font-semibold">{i.dif > 0 ? `+${i.dif}` : i.dif}{i.dif_pct != null && i.dif !== 0 ? <span className="block text-xs font-normal text-slate-500">{i.dif_pct}%</span> : null}</td>
                <td className="p-3"><Badge>{colorRes[i.resultado]}</Badge><span className="ml-1 text-xs text-slate-500">{i.resultado === "DENTRO DE TOLERANCIA" ? "±3%" : i.resultado.toLowerCase()}</span></td>
                <td className="p-3">
                  {i.ajuste === "pendiente" && resuelve ? (
                    <form action={resolverAjuste} className="space-y-1">
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="conteo_id" value={c.id} />
                      <input name="obs" placeholder="Observación" className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs" />
                      <div className="flex gap-1">
                        <button name="estado" value="cargado" className="h-9 rounded-lg bg-slate-900 px-2 text-xs font-medium text-white">Cargado en ERP</button>
                        <button name="estado" value="descartado" className="h-9 rounded-lg border border-slate-300 px-2 text-xs">Descartar</button>
                      </div>
                    </form>
                  ) : i.ajuste ? <span className="text-xs">{i.ajuste}{i.ajuste_obs ? ` · ${i.ajuste_obs}` : ""}</span> : "—"}
                  {edita && (
                    <form action={borrarItem} className="mt-1"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="conteo_id" value={c.id} /><button className="text-xs text-red-700 underline">Quitar</button></form>
                  )}
                </td>
              </tr>
            ))}
            {!lista?.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Sin artículos.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Sistema = MayoGym + Central + Anticipada + Outlet (físico) según el último LISTADO importado. Es acierto si la diferencia está dentro de ±3% del sistema. Al cerrar, las diferencias quedan como ajustes pendientes para cargar en el ERP.</p>
    </div>
  );
}
