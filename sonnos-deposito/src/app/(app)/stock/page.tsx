import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { Importador } from "./Importador";
import { alternarSeguimiento, editarMinimo } from "./actions";

const POR_PAGINA = 50;
const ESTADOS: Record<string, string> = { ALERTA: "ALERTA", OK: "OK", SIN: "SIN MÍNIMO" };

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; estado?: string; todo?: string; pag?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("stock", "ver");
  const puedeEditar = s.niveles.stock === "editar";
  const sp = await searchParams;
  const pag = Math.max(1, Number(sp.pag) || 1);
  const todo = sp.todo === "1";
  const supabase = await createClient();

  let q = supabase.from("stock_calc").select("sku, descripcion, categoria, stk, astk, ajuste_local, stock_actual, ubicacion, minimo, estado, en_seguimiento", { count: "exact" })
    .order("estado", { ascending: true }).order("descripcion").range((pag - 1) * POR_PAGINA, pag * POR_PAGINA - 1);
  if (!todo) q = q.eq("en_seguimiento", true);
  if (sp.cat) q = q.eq("categoria", sp.cat);
  if (sp.estado && ESTADOS[sp.estado]) q = q.eq("estado", ESTADOS[sp.estado]);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`sku.ilike.%${t}%,descripcion.ilike.%${t}%`);
  }
  const [{ data: items, count }, { count: nSeg }, { count: nAlerta }, { count: nSin }, { data: imp }, { data: cats }] = await Promise.all([
    q,
    supabase.from("stock_calc").select("sku", { count: "exact", head: true }).eq("en_seguimiento", true),
    supabase.from("stock_calc").select("sku", { count: "exact", head: true }).eq("en_seguimiento", true).eq("estado", "ALERTA"),
    supabase.from("stock_calc").select("sku", { count: "exact", head: true }).eq("en_seguimiento", true).eq("estado", "SIN MÍNIMO"),
    supabase.from("stock_importaciones").select("fecha, usuario_nombre, archivo, total").order("id", { ascending: false }).limit(1),
    supabase.from("stock_productos").select("categoria").not("categoria", "is", null).eq("en_seguimiento", true).limit(2000),
  ]);
  const categorias = [...new Set((cats ?? []).map((c) => c.categoria as string))].sort();
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const base = new URLSearchParams();
  for (const k of ["q", "cat", "estado", "todo"] as const) if (sp[k]) base.set(k, sp[k]!);
  const href = (p: number) => `/stock?${new URLSearchParams({ ...Object.fromEntries(base), pag: String(p) })}`;
  const actual = `/stock?${base}`;
  const ult = imp?.[0];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo>Stock</Titulo>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={card}><p className="text-xs text-slate-500">En seguimiento</p><p className="text-2xl font-bold">{nSeg ?? 0}</p></div>
        <div className={`${card} ${nAlerta ? "ring-red-300" : ""}`}><p className="text-xs text-slate-500">En alerta (bajo mínimo)</p><p className={`text-2xl font-bold ${nAlerta ? "text-red-700" : ""}`}>{nAlerta ?? 0}</p></div>
        <div className={card}><p className="text-xs text-slate-500">Sin mínimo definido</p><p className="text-2xl font-bold">{nSin ?? 0}</p></div>
        <div className={card}><p className="text-xs text-slate-500">Última importación</p><p className="text-sm font-semibold">{ult ? new Date(ult.fecha).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "Nunca"}</p><p className="text-xs text-slate-500">{ult?.usuario_nombre}</p></div>
      </div>

      {puedeEditar && (
        <details className={card} open={!ult}>
          <summary className="cursor-pointer font-semibold">Importar el LISTADO del ERP</summary>
          <p className="my-2 text-sm text-slate-500">Subí el Excel “LISTADO” (hoja Table). Actualiza las cantidades de todos los productos; los mínimos que cargaste se conservan. La primera vez se activa solo la lista de productos a seguir con sus mínimos.</p>
          <Importador />
        </details>
      )}

      <form className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-5`}>
        <input name="q" defaultValue={sp.q} placeholder="SKU o descripción" className={`${input} lg:col-span-2`} />
        <select name="cat" defaultValue={sp.cat ?? ""} className={input}><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="estado" defaultValue={sp.estado ?? ""} className={input}>
          <option value="">Todos los estados</option><option value="ALERTA">Solo alerta</option><option value="OK">Solo OK</option><option value="SIN">Sin mínimo</option>
        </select>
        <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" name="todo" value="1" defaultChecked={todo} className="size-5" /> Catálogo completo</label>
        <button className={`${boton} sm:col-span-2 lg:col-span-5`}>Filtrar</button>
      </form>

      <p className="text-sm text-slate-500">{count ?? 0} productos</p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">SKU</th><th className="p-3">Descripción</th><th className="p-3">Categoría</th><th className="p-3">Ubic.</th><th className="p-3 text-right">Stock</th><th className="p-3 text-right">Disp.</th><th className="p-3">Mínimo</th><th className="p-3">Estado</th>{puedeEditar && todo && <th className="p-3" />}</tr>
          </thead>
          <tbody>
            {items?.map((p) => (
              <tr key={p.sku} className="border-t border-slate-100">
                <td className="p-3 font-semibold"><Link href={`/stock/${encodeURIComponent(p.sku)}`} className="underline">{p.sku}</Link></td>
                <td className="p-3">{p.descripcion}</td><td className="p-3 text-slate-500">{p.categoria ?? "—"}</td><td className="p-3 text-slate-500">{p.ubicacion ?? "—"}</td>
                <td className="p-3 text-right font-semibold">{p.stock_actual}{p.ajuste_local ? <span className="block text-xs font-normal text-blue-700" title="Recibido y confirmado, todavía no figura en el ERP">+{p.ajuste_local} recibido</span> : null}</td><td className="p-3 text-right">{p.astk}</td>
                <td className="p-3">
                  {puedeEditar ? (
                    <form action={editarMinimo} className="flex gap-1">
                      <input type="hidden" name="sku" value={p.sku} /><input type="hidden" name="volver" value={actual} />
                      <input name="minimo" defaultValue={p.minimo ?? ""} inputMode="numeric" aria-label={`Mínimo de ${p.sku}`} className="h-10 w-20 rounded-lg border border-slate-300 px-2" />
                      <button className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-medium hover:bg-slate-100">OK</button>
                    </form>
                  ) : (p.minimo ?? "—")}
                </td>
                <td className="p-3"><Badge>{p.estado}</Badge></td>
                {puedeEditar && todo && (
                  <td className="p-3">
                    <form action={alternarSeguimiento}>
                      <input type="hidden" name="sku" value={p.sku} /><input type="hidden" name="volver" value={actual} />
                      <input type="hidden" name="seguir" value={p.en_seguimiento ? "0" : "1"} />
                      <button className="h-10 whitespace-nowrap rounded-lg border border-slate-300 px-3 text-xs font-medium hover:bg-slate-100">{p.en_seguimiento ? "Dejar de seguir" : "Seguir"}</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {!items?.length && <tr><td colSpan={9} className="p-6 text-center text-slate-500">{nSeg ? "Sin resultados." : "Todavía no hay stock. Importá el LISTADO del ERP."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        {pag > 1 ? <Link href={href(pag - 1)} className={botonSec}>← Anterior</Link> : <span />}
        <span className="text-sm text-slate-500">Página {pag} de {paginas}</span>
        {pag < paginas ? <Link href={href(pag + 1)} className={botonSec}>Siguiente →</Link> : <span />}
      </div>
    </div>
  );
}
