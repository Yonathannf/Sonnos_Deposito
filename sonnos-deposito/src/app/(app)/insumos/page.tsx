import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { todas } from "@/lib/paginar";
import { actualizarInsumo, cancelarSolicitud, crearInsumo, crearSolicitud, recibirSolicitud, registrarMovimiento } from "./actions";

type Ins = {
  id: number; sku: string | null; descripcion: string; ubicacion: string | null; unidad_medida: string | null; stock_minimo: number | null;
  stock_maximo: number | null; stock_actual: number; tiempo_reposicion_dias: number | null; proveedor: string | null; observaciones: string | null;
  activo: boolean; estado: string; cantidad_a_pedir: number | null; solicitudes_pendientes: number;
};
type Op = { id: number; nombre: string }[];
const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const SECTORES = ["Preparación de pedidos", "Despacho", "Recepción", "Inventario", "Limpieza", "Mantenimiento", "Administración"];

function CamposInsumo({ i, off }: { i?: Ins; off?: boolean }) {
  return (
    <>
      <label className="text-sm sm:col-span-2">Descripción<input name="descripcion" defaultValue={i?.descripcion} required disabled={off} className={input} /></label>
      <label className="text-sm">Código / SKU<input name="sku" defaultValue={i?.sku ?? ""} disabled={off} className={input} /></label>
      <label className="text-sm">Unidad<input name="unidad_medida" defaultValue={i?.unidad_medida ?? ""} placeholder="caja, rollo, un…" disabled={off} className={input} /></label>
      <label className="text-sm">Mínimo<input name="stock_minimo" defaultValue={i?.stock_minimo ?? ""} inputMode="numeric" disabled={off} className={input} /></label>
      <label className="text-sm">Máximo<input name="stock_maximo" defaultValue={i?.stock_maximo ?? ""} inputMode="numeric" disabled={off} className={input} /></label>
      <label className="text-sm">Ubicación<input name="ubicacion" defaultValue={i?.ubicacion ?? ""} disabled={off} className={input} /></label>
      <label className="text-sm">Reposición (días)<input name="tiempo_reposicion_dias" defaultValue={i?.tiempo_reposicion_dias ?? ""} inputMode="numeric" disabled={off} className={input} /></label>
      <label className="text-sm">Proveedor<input name="proveedor" defaultValue={i?.proveedor ?? ""} disabled={off} className={input} /></label>
      <label className="text-sm">Observaciones<input name="observaciones" defaultValue={i?.observaciones ?? ""} disabled={off} className={input} /></label>
    </>
  );
}

export default async function InsumosPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; q?: string; estado?: string; dias?: string; ok?: string; error?: string }> }) {
  const s = await requierePanel("insumos", "ver");
  const puedeEditar = s.niveles.insumos === "editar";
  const sp = await searchParams;
  const tab = ["movimientos", "solicitudes", "ranking"].includes(sp.tab ?? "") ? sp.tab! : "lista";
  const supabase = await createClient();
  const { data: operarios } = await supabase.from("operarios").select("id, nombre").eq("activo", true).order("nombre");
  const tabs = [["lista", "Insumos"], ["movimientos", "Movimientos"], ["solicitudes", "Reposición"], ["ranking", "Más usados"]] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo>Insumos</Titulo>
      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => <Link key={k} href={`/insumos?tab=${k}`} className={`${botonSec} whitespace-nowrap ${tab === k ? "!bg-slate-900 !text-white" : ""}`}>{l}</Link>)}
      </nav>
      <Flash ok={sp.ok} error={sp.error} />
      {tab === "lista" && <Lista puedeEditar={puedeEditar} operarios={operarios ?? []} q={sp.q} estado={sp.estado} />}
      {tab === "movimientos" && <Movimientos />}
      {tab === "solicitudes" && <Solicitudes puedeEditar={puedeEditar} />}
      {tab === "ranking" && <Ranking dias={Number(sp.dias) || 30} />}
    </div>
  );
}

async function Lista({ puedeEditar, operarios, q, estado }: { puedeEditar: boolean; operarios: Op; q?: string; estado?: string }) {
  const supabase = await createClient();
  let qq = supabase.from("insumos_calc").select("*").eq("activo", true).order("descripcion");
  if (estado) qq = qq.eq("estado", estado);
  if (q) qq = qq.or(`descripcion.ilike.%${q.replace(/[%,()]/g, " ")}%,sku.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  const { data } = await qq;
  const items = (data ?? []) as Ins[];
  const crit = items.filter((i) => i.estado === "CRITICO").length;
  const alerta = items.filter((i) => i.estado === "ALERTA").length;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className={card}><p className="text-xs text-slate-500">Insumos</p><p className="text-2xl font-bold">{items.length}</p></div>
        <div className={card}><p className="text-xs text-slate-500">Críticos (bajo mínimo)</p><p className={`text-2xl font-bold ${crit ? "text-red-700" : ""}`}>{crit}</p></div>
        <div className={card}><p className="text-xs text-slate-500">En alerta</p><p className="text-2xl font-bold">{alerta}</p></div>
      </div>
      <form className={`${card} flex flex-wrap gap-2`}>
        <input name="q" defaultValue={q} placeholder="Buscar insumo" className={`${input} max-w-xs`} />
        <select name="estado" defaultValue={estado ?? ""} className={`${input} max-w-xs`}>
          <option value="">Todos los estados</option><option value="CRITICO">Crítico</option><option value="ALERTA">Alerta</option><option value="OK">OK</option><option value="SIN MÍNIMO">Sin mínimo</option>
        </select>
        <button className={boton}>Filtrar</button>
      </form>
      {puedeEditar && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">+ Nuevo insumo</summary>
          <form action={crearInsumo} className="mt-3 grid gap-3 sm:grid-cols-4">
            <CamposInsumo />
            <label className="text-sm">Stock inicial<input name="stock_inicial" defaultValue="0" inputMode="numeric" className={input} /></label>
            <button className={`${boton} sm:col-span-4`}>Crear insumo</button>
          </form>
        </details>
      )}
      <div className="space-y-2">
        {items.map((i) => (
          <details key={i.id} className={card}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
              <span className="min-w-48 flex-1 font-semibold">{i.descripcion}</span>
              <span className="text-sm text-slate-500">{i.ubicacion ?? "sin ubicación"}</span>
              <span className="text-lg font-bold">{i.stock_actual}<span className="ml-1 text-xs font-normal text-slate-500">{i.unidad_medida}</span></span>
              <span className="text-xs text-slate-500">mín {i.stock_minimo ?? "—"} · máx {i.stock_maximo ?? "—"}</span>
              <Badge>{i.estado}</Badge>
              {i.solicitudes_pendientes > 0 && <span className="text-xs font-semibold text-blue-700">{i.solicitudes_pendientes} pedido(s) en camino</span>}
            </summary>
            {puedeEditar && (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <form action={registrarMovimiento} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  <input type="hidden" name="insumo_id" value={i.id} />
                  <h3 className="font-semibold sm:col-span-2">Registrar movimiento</h3>
                  <select name="tipo" defaultValue="consumo" className={input}><option value="consumo">Entrega / consumo</option><option value="ingreso">Ingreso</option><option value="ajuste">Ajuste (+/−)</option></select>
                  <input name="cantidad" required inputMode="numeric" placeholder="Cantidad" className={input} />
                  <input name="sector" list="sectores" placeholder="Sector que lo retira" className={input} />
                  <select name="operario_id" defaultValue="" className={input}><option value="">Operario (opcional)</option>{operarios.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
                  <input name="observaciones" placeholder="Observaciones" className={`${input} sm:col-span-2`} />
                  <button className={`${boton} sm:col-span-2`}>Registrar</button>
                </form>
                <form action={crearSolicitud} className="grid gap-2 rounded-lg border border-slate-200 p-3">
                  <input type="hidden" name="insumo_id" value={i.id} />
                  <h3 className="font-semibold">Pedir reposición</h3>
                  <input name="cantidad" required inputMode="numeric" defaultValue={i.cantidad_a_pedir || ""} placeholder="Cantidad a pedir" className={input} />
                  <input name="observaciones" placeholder="Observaciones" className={input} />
                  <button className={boton}>Crear solicitud</button>
                  <p className="text-xs text-slate-500">Proveedor: {i.proveedor ?? "—"} · reposición {i.tiempo_reposicion_dias ?? "—"} días</p>
                </form>
                <form action={actualizarInsumo} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4 lg:col-span-2">
                  <input type="hidden" name="id" value={i.id} />
                  <h3 className="font-semibold sm:col-span-4">Datos del insumo</h3>
                  <CamposInsumo i={i} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={i.activo} className="size-5" /> Activo</label>
                  <button className={`${boton} sm:col-span-4`}>Guardar</button>
                </form>
              </div>
            )}
          </details>
        ))}
        {!items.length && <p className={`${card} text-center text-slate-500`}>No hay insumos cargados.</p>}
      </div>
      <datalist id="sectores">{SECTORES.map((x) => <option key={x} value={x} />)}</datalist>
    </>
  );
}

async function Movimientos() {
  const supabase = await createClient();
  const { data } = await supabase.from("insumo_movimientos").select("id, fecha, tipo, cantidad, stock_resultante, sector, responsable, observaciones, insumos(descripcion), operarios(nombre)")
    .order("id", { ascending: false }).limit(150);
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Insumo</th><th className="p-3">Tipo</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-right">Quedó</th><th className="p-3">Destino</th><th className="p-3">Registró</th><th className="p-3">Obs.</th></tr></thead>
        <tbody>
          {data?.map((m) => (
            <tr key={m.id} className="border-t border-slate-100">
              <td className="p-3 whitespace-nowrap">{new Date(m.fecha).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}</td>
              <td className="p-3">{(m.insumos as unknown as { descripcion: string })?.descripcion}</td>
              <td className="p-3 capitalize">{m.tipo}</td>
              <td className="p-3 text-right font-semibold">{m.tipo === "consumo" ? `−${m.cantidad}` : m.tipo === "ingreso" ? `+${m.cantidad}` : m.cantidad}</td>
              <td className="p-3 text-right">{m.stock_resultante}</td>
              <td className="p-3">{[m.sector, (m.operarios as unknown as { nombre: string } | null)?.nombre].filter(Boolean).join(" · ") || "—"}</td>
              <td className="p-3">{m.responsable}</td><td className="p-3 text-slate-500">{m.observaciones}</td>
            </tr>
          ))}
          {!data?.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Sin movimientos.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

async function Solicitudes({ puedeEditar }: { puedeEditar: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("solicitudes_compra").select("*, insumos(descripcion, unidad_medida, proveedor)").order("id", { ascending: false }).limit(100);
  return (
    <div className="space-y-2">
      {data?.map((x) => {
        const ins = x.insumos as unknown as { descripcion: string; unidad_medida: string | null; proveedor: string | null };
        const demora = x.fecha_recepcion_real && x.fecha_estimada_recepcion ? Math.round((new Date(x.fecha_recepcion_real).getTime() - new Date(x.fecha_estimada_recepcion).getTime()) / 86400000) : null;
        return (
          <div key={x.id} className={`${card} flex flex-wrap items-center gap-x-4 gap-y-2`}>
            <span className="min-w-48 flex-1"><b>{ins.descripcion}</b><br /><span className="text-xs text-slate-500">{ins.proveedor ?? "sin proveedor"} · pedido {fmtFecha(x.fecha_solicitud)} · estimada {fmtFecha(x.fecha_estimada_recepcion)}</span></span>
            <span className="font-bold">{x.cantidad_solicitada} {ins.unidad_medida}</span>
            <Badge>{x.estado === "Recibida" ? "Finalizada" : x.estado === "Cancelada" ? "NORMAL" : "Pendiente"}</Badge>
            <span className="text-xs text-slate-500">{x.estado}{demora != null ? ` · ${demora > 0 ? `${demora} días tarde` : "a tiempo"}` : ""}</span>
            {puedeEditar && x.estado === "Pendiente" && (
              <>
                <form action={recibirSolicitud} className="flex gap-1">
                  <input type="hidden" name="id" value={x.id} />
                  <input name="cantidad" defaultValue={x.cantidad_solicitada} inputMode="numeric" aria-label="Cantidad recibida" className="h-10 w-24 rounded-lg border border-slate-300 px-2" />
                  <button className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white">Recibida</button>
                </form>
                <form action={cancelarSolicitud}><input type="hidden" name="id" value={x.id} /><button className="h-10 rounded-lg border border-slate-300 px-3 text-sm">Cancelar</button></form>
              </>
            )}
          </div>
        );
      })}
      {!data?.length && <p className={`${card} text-center text-slate-500`}>No hay solicitudes de reposición. Se crean desde cada insumo.</p>}
    </div>
  );
}

async function Ranking({ dias }: { dias: number }) {
  const supabase = await createClient();
  const desde = `${sumaFecha(hoy(), -dias)}T00:00:00-03:00`;
  const data = await todas<{ cantidad: number; sector: string | null; insumos: unknown }>((a, b) => supabase.from("insumo_movimientos").select("cantidad, sector, insumos(descripcion, unidad_medida)").eq("tipo", "consumo").gte("fecha", desde).range(a, b));
  const por = new Map<string, { total: number; unidad: string | null; sectores: Map<string, number> }>();
  for (const m of data) {
    const i = m.insumos as unknown as { descripcion: string; unidad_medida: string | null };
    const e = por.get(i.descripcion) ?? { total: 0, unidad: i.unidad_medida, sectores: new Map() };
    e.total += m.cantidad; e.sectores.set(m.sector ?? "—", (e.sectores.get(m.sector ?? "—") ?? 0) + m.cantidad);
    por.set(i.descripcion, e);
  }
  const lista = [...por.entries()].sort((a, b) => b[1].total - a[1].total);
  const max = Math.max(1, ...lista.map(([, v]) => v.total));
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Consumo de los últimos {dias} días</h2>
        {[7, 30, 90, 365].map((d) => <Link key={d} href={`/insumos?tab=ranking&dias=${d}`} className={`${botonSec} !h-9 ${d === dias ? "!bg-slate-900 !text-white" : ""}`}>{d} días</Link>)}
      </div>
      {lista.map(([nombre, v]) => (
        <div key={nombre}>
          <div className="flex justify-between text-sm"><span className="font-medium">{nombre}</span><span>{v.total} {v.unidad}</span></div>
          <div className="h-2.5 rounded bg-slate-100"><div className="h-full rounded bg-slate-800" style={{ width: `${(v.total / max) * 100}%` }} /></div>
          <p className="text-xs text-slate-500">{[...v.sectores.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}: ${c}`).join(" · ")}</p>
        </div>
      ))}
      {!lista.length && <p className="text-sm text-slate-500">Sin consumos en el período.</p>}
    </div>
  );
}
