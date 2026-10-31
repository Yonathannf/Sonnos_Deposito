import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { todas } from "@/lib/paginar";
import { cambiarEstado, crearTarea, reasignar } from "./actions";

type T = {
  id: number; titulo: string; descripcion: string | null; sector: string | null; prioridad: string; estado: string; operario_id: number | null;
  operario: string | null; fecha_limite: string | null; inicio: string | null; fin: string | null; minutos: number | null; vencida: boolean; a_tiempo: boolean | null;
};
const SECTORES = ["Preparación de pedidos", "Despacho", "Recepción", "Inventario", "Limpieza", "Mantenimiento", "Administración"];
const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export default async function TareasPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; desde?: string; hasta?: string; ok?: string; error?: string }> }) {
  const s = await requierePanel("tareas", "ver");
  const puedeEditar = s.niveles.tareas === "editar";
  const sp = await searchParams;
  const tab = sp.tab === "finalizadas" || sp.tab === "productividad" ? sp.tab : "activas";
  const supabase = await createClient();
  const { data: operarios } = await supabase.from("operarios").select("id, nombre").eq("activo", true).order("nombre");
  const hasta = sp.hasta || hoy(); const desde = sp.desde || sumaFecha(hasta, -30);

  const tabs = [["activas", "Pendientes y en curso"], ["finalizadas", "Finalizadas"], ["productividad", "Productividad"]] as const;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo>Tareas del depósito</Titulo>
      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => <Link key={k} href={`/tareas?tab=${k}`} className={`${botonSec} whitespace-nowrap ${tab === k ? "!bg-slate-900 !text-white" : ""}`}>{l}</Link>)}
      </nav>
      <Flash ok={sp.ok} error={sp.error} />

      {tab === "activas" && (
        <>
          {puedeEditar && (
            <form action={crearTarea} className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
              <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Nueva tarea</h2>
              <input name="titulo" placeholder="¿Qué hay que hacer?" required className={`${input} sm:col-span-2`} />
              <input name="sector" list="sectores-t" placeholder="Sector" className={input} />
              <select name="operario_id" defaultValue="" className={input}><option value="">Sin asignar</option>{operarios?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
              <select name="prioridad" defaultValue="Media" className={input}><option>Alta</option><option>Media</option><option>Baja</option></select>
              <label className="text-sm">Fecha límite<input type="date" name="fecha_limite" className={input} /></label>
              <input name="descripcion" placeholder="Detalle (opcional)" className={`${input} sm:col-span-2`} />
              <button className={`${boton} sm:col-span-2 lg:col-span-4`}>Crear tarea</button>
              <datalist id="sectores-t">{SECTORES.map((x) => <option key={x} value={x} />)}</datalist>
            </form>
          )}
          <Activas puedeEditar={puedeEditar} operarios={operarios ?? []} />
        </>
      )}
      {tab === "finalizadas" && <Finalizadas />}
      {tab === "productividad" && <Productividad desde={desde} hasta={hasta} />}
    </div>
  );
}

async function Activas({ puedeEditar, operarios }: { puedeEditar: boolean; operarios: { id: number; nombre: string }[] }) {
  const { data } = await (await createClient()).from("tareas_calc").select("*").in("estado", ["Pendiente", "En curso"])
    .order("fecha_limite", { ascending: true, nullsFirst: false }).order("id");
  const orden: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
  const tareas = ((data ?? []) as T[]).sort((a, b) => Number(b.vencida) - Number(a.vencida) || orden[a.prioridad] - orden[b.prioridad]);
  return (
    <div className="space-y-2">
      {tareas.map((t) => (
        <div key={t.id} className={`${card} ${t.vencida ? "ring-red-300" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-48 flex-1 font-semibold">{t.titulo}</span>
            <Badge>{t.prioridad === "Alta" ? "URGENTE" : t.prioridad === "Media" ? "NORMAL" : "ESTACIONADO"}</Badge>
            <Badge>{t.estado === "Pendiente" ? "Pendiente" : "En curso"}</Badge>
            <span className="text-sm text-slate-500">{t.operario ?? "Sin asignar"} · {t.sector ?? "—"}</span>
            <span className={`text-sm ${t.vencida ? "font-bold text-red-700" : "text-slate-500"}`}>{t.fecha_limite ? `${t.vencida ? "VENCIDA " : "Límite "}${fmtFecha(t.fecha_limite)}` : ""}</span>
          </div>
          {t.descripcion && <p className="mt-1 text-sm text-slate-600">{t.descripcion}</p>}
          {puedeEditar && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {t.estado === "Pendiente" && <form action={cambiarEstado}><input type="hidden" name="id" value={t.id} /><button name="estado" value="En curso" className={boton}>▶ Iniciar</button></form>}
              <form action={cambiarEstado}><input type="hidden" name="id" value={t.id} /><button name="estado" value="Finalizada" className={t.estado === "En curso" ? boton : botonSec}>✓ Finalizar</button></form>
              <form action={cambiarEstado}><input type="hidden" name="id" value={t.id} /><button name="estado" value="Cancelada" className={botonSec}>Cancelar</button></form>
              <details className="ml-auto">
                <summary className="cursor-pointer text-sm underline">Reasignar</summary>
                <form action={reasignar} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <select name="operario_id" defaultValue={t.operario_id ?? ""} className={`${input} w-44`}><option value="">Sin asignar</option>{operarios.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
                  <select name="prioridad" defaultValue={t.prioridad} className={`${input} w-28`}><option>Alta</option><option>Media</option><option>Baja</option></select>
                  <input type="date" name="fecha_limite" defaultValue={t.fecha_limite ?? ""} className={`${input} w-40`} />
                  <button className={boton}>Guardar</button>
                </form>
              </details>
            </div>
          )}
        </div>
      ))}
      {!tareas.length && <p className={`${card} text-center text-slate-500`}>No hay tareas pendientes. 🎉</p>}
    </div>
  );
}

async function Finalizadas() {
  const { data } = await (await createClient()).from("tareas_calc").select("*").in("estado", ["Finalizada", "Cancelada"]).order("id", { ascending: false }).limit(100);
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Tarea</th><th className="p-3">Operario</th><th className="p-3">Sector</th><th className="p-3">Estado</th><th className="p-3">Minutos</th><th className="p-3">Cumplimiento</th></tr></thead>
        <tbody>
          {((data ?? []) as T[]).map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="p-3 font-medium">{t.titulo}</td><td className="p-3">{t.operario ?? "—"}</td><td className="p-3">{t.sector ?? "—"}</td>
              <td className="p-3"><Badge>{t.estado === "Finalizada" ? "Finalizada" : "NORMAL"}</Badge> <span className="text-xs text-slate-500">{t.estado}</span></td>
              <td className="p-3">{t.minutos ?? "—"}</td>
              <td className="p-3">{t.a_tiempo === null ? "—" : t.a_tiempo ? <Badge>CUMPLE</Badge> : <Badge>NO CUMPLE</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Acc = { n: number; min: number; ok: number; medido: number };
function Tabla({ titulo, filas }: { titulo: string; filas: [string, Acc][] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-100 p-3 font-semibold">{titulo}</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">&nbsp;</th><th className="p-3">Tareas</th><th className="p-3">Min. totales</th><th className="p-3">Min. prom.</th><th className="p-3">A tiempo</th></tr></thead>
        <tbody>
          {filas.map(([k, a]) => (
            <tr key={k} className="border-t border-slate-100"><td className="p-3 font-medium">{k}</td><td className="p-3">{a.n}</td><td className="p-3">{a.min}</td><td className="p-3">{a.n ? Math.round(a.min / a.n) : "—"}</td><td className="p-3">{a.medido ? `${Math.round((a.ok / a.medido) * 100)}%` : "—"}</td></tr>
          ))}
          {!filas.length && <tr><td colSpan={5} className="p-4 text-center text-slate-500">Sin tareas finalizadas en el período.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

async function Productividad({ desde, hasta }: { desde: string; hasta: string }) {
  const supabase = await createClient();
  const data = await todas<{ operario: string | null; sector: string | null; minutos: number | null; a_tiempo: boolean | null }>((a, b) => supabase.from("tareas_calc").select("operario, sector, minutos, a_tiempo, fin").eq("estado", "Finalizada")
    .gte("fin", `${desde}T00:00:00-03:00`).lte("fin", `${hasta}T23:59:59-03:00`).range(a, b));
  const { data: arm } = await supabase.rpc("indicadores_armado", { p_desde: desde, p_hasta: hasta });
    const agrupa = (k: "operario" | "sector") => {
    const m = new Map<string, Acc>();
    for (const t of data) {
      const key = (t[k] as string | null) ?? "(sin dato)";
      const a = m.get(key) ?? { n: 0, min: 0, ok: 0, medido: 0 };
      a.n++; a.min += t.minutos ?? 0;
      if (t.a_tiempo !== null) { a.medido++; if (t.a_tiempo) a.ok++; }
      m.set(key, a);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  };
  const porOp = (arm?.por_operario ?? []) as { operario: string; pedidos: number; bultos: number; minutos: number }[];
  return (
    <>
      <form className={`${card} flex flex-wrap gap-2`}>
        <input type="hidden" name="tab" value="productividad" />
        <input type="date" name="desde" defaultValue={desde} className={`${input} max-w-[11rem]`} />
        <input type="date" name="hasta" defaultValue={hasta} className={`${input} max-w-[11rem]`} />
        <button className={boton}>Ver período</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tabla titulo="Tareas por operario" filas={agrupa("operario")} />
        <Tabla titulo="Tareas por sector" filas={agrupa("sector")} />
      </div>
      {porOp.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <h2 className="border-b border-slate-100 p-3 font-semibold">Armado de pedidos por operario (mismo período)</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Operario</th><th className="p-3">Pedidos</th><th className="p-3">Bultos</th><th className="p-3">Minutos</th></tr></thead>
            <tbody>{porOp.map((o) => <tr key={o.operario} className="border-t border-slate-100"><td className="p-3 font-medium">{o.operario}</td><td className="p-3">{o.pedidos}</td><td className="p-3">{o.bultos}</td><td className="p-3">{o.minutos}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
