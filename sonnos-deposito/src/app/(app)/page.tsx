import Link from "next/link";
import { requiereSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { PANELES } from "@/lib/permisos";
import { Badge, card } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";

const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const ve = (s: Sesion, p: string) => (s.niveles[p] ?? "sin_acceso") !== "sin_acceso";

function Kpi({ titulo, valor, href, tono, nota }: { titulo: string; valor: number | string; href?: string; tono?: "rojo" | "ambar" | "verde"; nota?: string }) {
  const color = tono === "rojo" ? "text-red-700" : tono === "ambar" ? "text-amber-700" : tono === "verde" ? "text-green-700" : "";
  const c = (
    <div className={`${card} h-full ${tono === "rojo" ? "ring-red-300" : ""}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-3xl font-bold ${color}`}>{valor}</p>
      {nota && <p className="text-xs text-slate-500">{nota}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-80">{c}</Link> : c;
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ sin_permiso?: string }> }) {
  const s = await requiereSesion();
  const { sin_permiso } = await searchParams;
  const supabase = await createClient();
  const f0 = hoy(); const lunes = sumaFecha(f0, -((new Date(f0 + "T12:00:00Z").getUTCDay() + 6) % 7));
  const cnt = async (tabla: string, fn: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count } = await fn(supabase.from(tabla).select("*", { count: "exact", head: true }));
    return count ?? 0;
  };

  const widgets = ve(s, "dashboard");
  const [paArmar, armadosSinEntregar, hoyPend, atrasados, despSemana] = widgets && ve(s, "pedidos") ? await Promise.all([
    cnt("pedidos", (q) => q.eq("estado", "Impreso")),
    cnt("pedidos", (q) => q.eq("estado", "Armado")),
    cnt("pedidos", (q) => q.eq("dia_a_despachar", f0).neq("estado", "Entregado")),
    cnt("pedidos", (q) => q.lt("dia_a_despachar", f0).neq("estado", "Entregado")),
    cnt("pedidos", (q) => q.gte("dia_a_despachar", lunes).lte("dia_a_despachar", f0).eq("estado", "Entregado")),
  ]) : [0, 0, 0, 0, 0];

  const stockAlerta = widgets && ve(s, "stock")
    ? ((await supabase.from("stock_calc").select("sku, descripcion, stock_actual, minimo").eq("en_seguimiento", true).eq("estado", "ALERTA").limit(500)).data ?? [])
        .sort((a, b) => (a.stock_actual - a.minimo) / (a.minimo || 1) - (b.stock_actual - b.minimo) / (b.minimo || 1))
    : [];
  const insumos = widgets && ve(s, "insumos")
    ? ((await supabase.from("insumos_calc").select("id, descripcion, stock_actual, stock_minimo, unidad_medida, estado").eq("activo", true).in("estado", ["CRITICO", "ALERTA"]).limit(200)).data ?? [])
    : [];
  const tareas = widgets && ve(s, "tareas")
    ? ((await supabase.from("tareas_calc").select("id, vencida, estado").in("estado", ["Pendiente", "En curso"]).limit(500)).data ?? [])
    : [];
  const ultConteo = widgets && ve(s, "inventario")
    ? (await supabase.from("conteos_resumen").select("id, nombre, fecha, precision_pct, ajustes_pendientes").eq("estado", "Cerrado").order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1)).data?.[0]
    : null;
  const ajustesPend = widgets && ve(s, "inventario") ? await cnt("conteo_items", (q) => q.eq("ajuste", "pendiente")) : 0;
  const recBorrador = widgets && ve(s, "recepcion") ? await cnt("recepciones", (q) => q.eq("estado", "Borrador")) : 0;
  const svVencidos = widgets && ve(s, "postventa") ? await cnt("services", (q) => q.in("estado", ["Pendiente", "En curso"]).lt("visita_pactada", f0)) : 0;
  const ind = widgets && ve(s, "armado")
    ? ((await supabase.rpc("indicadores_armado", { p_desde: sumaFecha(f0, -13), p_hasta: f0 })).data as
        { totales: { pedidos: number; bultos: number; min_promedio: number | null }; por_dia: { fecha: string; pedidos: number; bultos: number }[]; por_operario: { operario: string; pedidos: number; bultos: number }[] } | null)
    : null;
  const armHoy = ind?.por_dia.find((d) => d.fecha === f0);
  const maxDia = Math.max(1, ...(ind?.por_dia.map((d) => d.pedidos) ?? [1]));
  const tVenc = tareas.filter((t) => t.vencida).length;
  const alertas: string[] = [];
  if (atrasados) alertas.push(`${atrasados} pedido(s) con día de despacho vencido sin entregar`);
  if (stockAlerta.length) alertas.push(`${stockAlerta.length} producto(s) bajo el stock mínimo`);
  const crit = insumos.filter((i) => i.estado === "CRITICO");
  if (crit.length) alertas.push(`${crit.length} insumo(s) en estado crítico`);
  if (tVenc) alertas.push(`${tVenc} tarea(s) vencida(s)`);
  if (ajustesPend) alertas.push(`${ajustesPend} ajuste(s) de inventario pendientes`);
  if (svVencidos) alertas.push(`${svVencidos} service(s) con visita vencida`);

  const visibles = PANELES.filter((p) => ve(s, p.codigo) && p.codigo !== "dashboard");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {s.nombre.split(" ")[0]}</h1>
        <p className="text-slate-500">{new Date(f0 + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p>
      </div>
      {sin_permiso && <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">No tenés permiso para entrar a esa sección.</p>}

      {alertas.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Requiere atención</p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-800">{alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      {widgets && ve(s, "pedidos") && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Pedidos</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi titulo="Pendientes de armar" valor={paArmar} href="/pedidos?estado=Impreso" tono={paArmar ? "ambar" : undefined} />
            <Kpi titulo="Armados, sin entregar" valor={armadosSinEntregar} href="/pedidos?estado=Armado" />
            <Kpi titulo="A despachar hoy" valor={hoyPend} href={`/hoja_de_ruta?fecha=${f0}`} tono={hoyPend ? "ambar" : "verde"} />
            <Kpi titulo="Atrasados" valor={atrasados} href="/pedidos" tono={atrasados ? "rojo" : "verde"} nota="día vencido, no entregados" />
            <Kpi titulo="Despachados esta semana" valor={despSemana} tono="verde" />
          </div>
        </section>
      )}

      {ind && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className={`${card} lg:col-span-2`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Productividad del depósito · últimos 14 días</h2>
              <p className="text-sm text-slate-500">Hoy: <b>{armHoy?.pedidos ?? 0}</b> pedidos · <b>{armHoy?.bultos ?? 0}</b> bultos</p>
            </div>
            <div className="flex h-36 items-end gap-1">
              {ind.por_dia.map((d) => (
                <div key={d.fecha} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${fmtFecha(d.fecha)}: ${d.pedidos} pedidos, ${d.bultos} bultos`}>
                  <span className="text-[10px] text-slate-500">{d.pedidos}</span>
                  <div className={`w-full rounded-t ${d.fecha === f0 ? "bg-blue-600" : "bg-slate-800"}`} style={{ height: `${Math.max(3, (d.pedidos / maxDia) * 100)}%` }} />
                </div>
              ))}
              {!ind.por_dia.length && <p className="text-sm text-slate-500">Sin armados registrados en el período.</p>}
            </div>
            <p className="mt-2 text-xs text-slate-500">Promedio de armado: {ind.totales.min_promedio ?? "—"} min por pedido.</p>
          </div>
          <div className={card}>
            <h2 className="mb-2 font-semibold">Por operario (14 días)</h2>
            <ul className="space-y-1 text-sm">
              {ind.por_operario.slice(0, 6).map((o) => <li key={o.operario} className="flex justify-between"><span>{o.operario}</span><b>{o.pedidos}</b></li>)}
              {!ind.por_operario.length && <li className="text-slate-500">Sin datos.</li>}
            </ul>
          </div>
        </section>
      )}

      {widgets && (
        <section className="grid gap-4 lg:grid-cols-2">
          {ve(s, "stock") && (
            <div className={card}>
              <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Productos con stock crítico</h2><Link href="/stock?estado=ALERTA" className="text-sm underline">Ver todos ({stockAlerta.length})</Link></div>
              <ul className="space-y-1 text-sm">
                {stockAlerta.slice(0, 6).map((p) => (
                  <li key={p.sku} className="flex items-center justify-between gap-2"><Link href={`/stock/${encodeURIComponent(p.sku)}`} className="truncate underline">{p.descripcion}</Link><span className="shrink-0 font-semibold text-red-700">{p.stock_actual} / {p.minimo}</span></li>
                ))}
                {!stockAlerta.length && <li className="text-slate-500">Todo por encima del mínimo ✔</li>}
              </ul>
            </div>
          )}
          {ve(s, "insumos") && (
            <div className={card}>
              <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Insumos próximos a agotarse</h2><Link href="/insumos?estado=CRITICO" className="text-sm underline">Ver insumos</Link></div>
              <ul className="space-y-1 text-sm">
                {insumos.sort((a, b) => (a.estado === "CRITICO" ? 0 : 1) - (b.estado === "CRITICO" ? 0 : 1)).slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2"><span className="truncate">{i.descripcion}</span><span className="flex shrink-0 items-center gap-2"><b>{i.stock_actual}</b><span className="text-xs text-slate-500">mín {i.stock_minimo}</span><Badge>{i.estado}</Badge></span></li>
                ))}
                {!insumos.length && <li className="text-slate-500">Sin alertas de reposición ✔</li>}
              </ul>
            </div>
          )}
        </section>
      )}

      {widgets && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ve(s, "tareas") && <Kpi titulo="Tareas pendientes" valor={tareas.length} href="/tareas" tono={tVenc ? "rojo" : undefined} nota={tVenc ? `${tVenc} vencida(s)` : "ninguna vencida"} />}
          {ve(s, "inventario") && <Kpi titulo="Precisión del último conteo" valor={ultConteo?.precision_pct != null ? `${ultConteo.precision_pct}%` : "—"} href="/inventario" nota={ultConteo ? `${ultConteo.nombre} · ${fmtFecha(ultConteo.fecha)}` : "sin conteos"} />}
          {ve(s, "inventario") && <Kpi titulo="Diferencias de inventario por ajustar" valor={ajustesPend} href="/inventario" tono={ajustesPend ? "ambar" : "verde"} />}
          {ve(s, "recepcion") && <Kpi titulo="Recepciones sin confirmar" valor={recBorrador} href="/recepcion" tono={recBorrador ? "ambar" : undefined} />}
          {ve(s, "postventa") && <Kpi titulo="Services con visita vencida" valor={svVencidos} href="/postventa" tono={svVencidos ? "rojo" : "verde"} />}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ir a</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((p) => (
            <Link key={p.codigo} href={`/${p.codigo}`} className="flex min-h-16 flex-col justify-center rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-slate-900">
              <span className="font-semibold">{p.nombre}</span>
              <span className="text-xs text-slate-500">{s.niveles[p.codigo] === "ver" ? "Solo consulta" : "Consulta y edición"}{!p.implementado && " · próximamente"}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
