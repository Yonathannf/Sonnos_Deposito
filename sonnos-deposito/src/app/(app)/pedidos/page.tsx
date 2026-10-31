import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, botonSec, boton, card, input } from "@/components/ui";
import { fmtFecha } from "@/lib/util";

const POR_PAGINA = 50;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; desde?: string; hasta?: string; pag?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("pedidos", "ver");
  const sp = await searchParams;
  const pag = Math.max(1, Number(sp.pag) || 1);
  const supabase = await createClient();

  let q = supabase
    .from("pedidos_calc")
    .select("id, nro_pedido, fecha_impreso, dia_a_despachar, estado, bultos, pallets, cumple_plazo, cliente_nombre, cliente_numero, transporte_nombre, operario_nombre", { count: "exact" })
    .order("dia_a_despachar", { ascending: false, nullsFirst: true })
    .order("id", { ascending: false })
    .range((pag - 1) * POR_PAGINA, pag * POR_PAGINA - 1);
  if (sp.estado) q = q.eq("estado", sp.estado);
  if (sp.desde) q = q.gte("dia_a_despachar", sp.desde);
  if (sp.hasta) q = q.lte("dia_a_despachar", sp.hasta);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, " ").trim();
    // busca por número de pedido o por cliente (nombre / número)
    const { data: cs } = await supabase.from("clientes").select("id")
      .or(`nombre.ilike.%${t}%,numero_cliente.eq.${Number(t) || -1}`).limit(200);
    const ids = (cs ?? []).map((c) => c.id);
    q = q.or(`nro_pedido.ilike.%${t}%${ids.length ? `,cliente_id.in.(${ids.join(",")})` : ""}`);
  }
  const { data: pedidos, count } = await q;
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["q", "estado", "desde", "hasta"] as const) if (sp[k]) u.set(k, sp[k]!);
    u.set("pag", String(p));
    return `/pedidos?${u}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo extra={s.niveles.pedidos === "editar" && <Link href="/pedidos/nuevo" className={`${boton} inline-flex items-center`}>+ Nuevo pedido</Link>}>
        Pedidos
      </Titulo>
      <Flash ok={sp.ok} error={sp.error} />

      <form className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-5`}>
        <input name="q" defaultValue={sp.q} placeholder="Nº pedido, cliente…" className={`${input} lg:col-span-2`} />
        <select name="estado" defaultValue={sp.estado ?? ""} className={input}>
          <option value="">Todos los estados</option>
          <option>Impreso</option><option>Armado</option><option>Entregado</option>
        </select>
        <input type="date" name="desde" defaultValue={sp.desde} className={input} aria-label="Despacho desde" />
        <input type="date" name="hasta" defaultValue={sp.hasta} className={input} aria-label="Despacho hasta" />
        <button className={`${boton} sm:col-span-2 lg:col-span-5`}>Filtrar</button>
      </form>

      <p className="text-sm text-slate-500">{total} pedidos</p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Transporte</th>
              <th className="p-3">Despacho</th><th className="p-3">Estado</th><th className="p-3">Plazo</th>
              <th className="p-3">Bultos</th><th className="p-3">Armó</th>
            </tr>
          </thead>
          <tbody>
            {pedidos?.map((p) => {
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-semibold"><Link href={`/pedidos/${p.id}`} className="underline">{p.nro_pedido}</Link></td>
                  <td className="p-3">{p.cliente_nombre}{p.cliente_numero ? <span className="text-slate-400"> · {p.cliente_numero}</span> : null}</td>
                  <td className="p-3">{p.transporte_nombre ?? "—"}</td>
                  <td className="p-3">{fmtFecha(p.dia_a_despachar)}</td>
                  <td className="p-3"><Badge>{p.estado}</Badge></td>
                  <td className="p-3"><Badge>{p.cumple_plazo}</Badge></td>
                  <td className="p-3">{p.bultos ?? "—"}</td>
                  <td className="p-3">{p.operario_nombre ?? "—"}</td>
                </tr>
              );
            })}
            {!pedidos?.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No hay pedidos con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        {pag > 1 ? <Link href={qs(pag - 1)} className={botonSec}>← Anterior</Link> : <span />}
        <span className="text-sm text-slate-500">Página {pag} de {paginas}</span>
        {pag < paginas ? <Link href={qs(pag + 1)} className={botonSec}>Siguiente →</Link> : <span />}
      </div>
    </div>
  );
}
