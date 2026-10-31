import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { DESPACHOS } from "@/lib/constantes";
import { actualizarArmado, guardarOperario, registrarArmado } from "./actions";

type Tot = { pedidos: number; bultos: number; pallets: number; carros: number; minutos: number; min_promedio: number | null; armado_eficiente: number; armado_medido: number; entrega_eficiente: number; entrega_medida: number };
type Fila = { despacho?: string; operario?: string; pedidos: number; bultos: number; minutos: number; min_promedio?: number; eficiente?: number; medido?: number; pallets?: number; carros?: number };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export default async function ArmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; desde?: string; hasta?: string; operario?: string; despacho?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("armado", "ver");
  const puedeEditar = s.niveles.armado === "editar";
  const sp = await searchParams;
  const tab = sp.tab === "indicadores" || sp.tab === "operarios" ? sp.tab : "registro";
  const hasta = sp.hasta || hoy();
  const desde = sp.desde || sumaFecha(hasta, -30);
  const supabase = await createClient();
  const { data: operarios } = await supabase.from("operarios").select("id, nombre, activo").order("nombre");
  const activos = operarios?.filter((o) => o.activo) ?? [];

  const tabs = [["registro", "Registrar y últimos"], ["indicadores", "Indicadores"], ["operarios", "Operarios"]] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo>Armado y productividad</Titulo>
      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/armado?tab=${k}`} className={`${botonSec} whitespace-nowrap ${tab === k ? "!bg-slate-900 !text-white" : ""}`}>{l}</Link>
        ))}
      </nav>
      <Flash ok={sp.ok} error={sp.error} />

      {tab === "registro" && <Registro puedeEditar={puedeEditar} activos={activos} sp={sp} />}
      {tab === "indicadores" && <Indicadores desde={desde} hasta={hasta} />}
      {tab === "operarios" && (
        <div className="space-y-3">
          {puedeEditar && (
            <form action={guardarOperario} className={`${card} flex gap-2`}>
              <input name="nombre" placeholder="Nuevo operario (nombre y apellido)" required className={input} />
              <button className={boton}>Agregar</button>
            </form>
          )}
          {operarios?.map((o) => (
            <form key={o.id} action={guardarOperario} className={`${card} flex flex-wrap items-center gap-3`}>
              <input type="hidden" name="id" value={o.id} />
              <input name="nombre" defaultValue={o.nombre} disabled={!puedeEditar} className={`${input} max-w-sm`} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={o.activo} disabled={!puedeEditar} className="size-5" /> Activo</label>
              {puedeEditar && <button className={boton}>Guardar</button>}
            </form>
          ))}
          <p className="text-sm text-slate-500">Los operarios son una lista del depósito: no necesitan usuario ni contraseña. Un operario inactivo no aparece al registrar armados pero conserva su historial.</p>
        </div>
      )}
    </div>
  );
}

async function Registro({ puedeEditar, activos, sp }: {
  puedeEditar: boolean; activos: { id: number; nombre: string }[];
  sp: { operario?: string; despacho?: string };
}) {
  const supabase = await createClient();
  let q = supabase.from("armados_calc").select("*").order("fecha", { ascending: false }).order("id", { ascending: false }).limit(40);
  if (sp.operario) q = q.eq("operario_id", Number(sp.operario));
  if (sp.despacho) q = q.eq("despacho", sp.despacho);
  const { data: ultimos } = await q;

  return (
    <>
      {puedeEditar && (
        <form action={registrarArmado} className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Registrar armado finalizado</h2>
          <label className="text-sm">Nº de pedido<input name="nro_pedido" className={input} autoFocus /></label>
          <label className="text-sm">Nº de cliente<input name="nro_cliente" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Despacho
            <select name="despacho" required defaultValue="" className={input}>
              <option value="" disabled>Elegí…</option>{DESPACHOS.map((d) => <option key={d}>{d}</option>)}
            </select></label>
          <label className="text-sm">Armó
            <select name="operario_id" required defaultValue="" className={input}>
              <option value="" disabled>Elegí…</option>{activos.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select></label>
          <label className="text-sm">Bultos<input name="bultos" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Pallets<input name="pallets" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Carro<input name="carro" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Tiempo (min)<input name="tiempo_min" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Inicio del armado<input type="date" name="fecha" defaultValue={hoy()} required className={input} /></label>
          <label className="text-sm">Finalización<input type="date" name="fecha_finalizacion" defaultValue={hoy()} className={input} /></label>
          <label className="text-sm">Prioridad
            <select name="prioridad" defaultValue="NORMAL" className={input}><option>NORMAL</option><option>URGENTE</option><option>ESTACIONADO</option></select></label>
          <label className="text-sm">Observaciones<input name="observaciones" className={input} /></label>
          <button className={`${boton} sm:col-span-2 lg:col-span-4`}>Registrar armado</button>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">Si el pedido está cargado en el sistema, pasa solo a estado “Armado” con estos bultos, pallets y operario.</p>
        </form>
      )}

      <form className={`${card} flex flex-wrap gap-2`}>
        <input type="hidden" name="tab" value="registro" />
        <select name="operario" defaultValue={sp.operario ?? ""} className={`${input} max-w-xs`}>
          <option value="">Todos los operarios</option>{activos.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <select name="despacho" defaultValue={sp.despacho ?? ""} className={`${input} max-w-xs`}>
          <option value="">Todos los despachos</option>{DESPACHOS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className={boton}>Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">Fecha</th><th className="p-3">Pedido</th><th className="p-3">Despacho</th><th className="p-3">Armó</th><th className="p-3">Bultos</th>
              <th className="p-3">Min</th><th className="p-3">Armado</th><th className="p-3">Entrega</th><th className="p-3">Prior.</th></tr>
          </thead>
          <tbody>
            {ultimos?.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-3">{fmtFecha(a.fecha)}</td><td className="p-3 font-semibold">{a.nro_pedido ?? "—"}</td><td className="p-3">{a.despacho}</td>
                <td className="p-3">{a.operario ?? "—"}</td><td className="p-3">{a.bultos ?? "—"}</td><td className="p-3">{a.tiempo_min ?? "—"}</td>
                <td className="p-3"><Badge>{a.ef_armado}</Badge></td><td className="p-3"><Badge>{a.ef_entrega}</Badge></td><td className="p-3"><Badge>{a.prioridad}</Badge></td>
              </tr>
            ))}
            {!ultimos?.length && <tr><td colSpan={9} className="p-6 text-center text-slate-500">Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {puedeEditar && ultimos && ultimos.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">Corregir un armado / cargar la fecha de entrega</summary>
          <div className="mt-3 space-y-2">
            {ultimos.slice(0, 15).map((a) => (
              <details key={a.id} className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm">{fmtFecha(a.fecha)} · {a.nro_pedido ?? "s/n"} · {a.despacho}</summary>
                <form action={actualizarArmado} className="mt-3 grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="id" value={a.id} /><input type="hidden" name="prioridad" value={a.prioridad} />
                  <input type="hidden" name="nro_cliente" value={a.nro_cliente ?? ""} />
                  <label className="text-sm">Pedido<input name="nro_pedido" defaultValue={a.nro_pedido ?? ""} className={input} /></label>
                  <label className="text-sm">Despacho<select name="despacho" defaultValue={a.despacho} className={input}>{DESPACHOS.map((d) => <option key={d}>{d}</option>)}</select></label>
                  <label className="text-sm">Armó<select name="operario_id" defaultValue={a.operario_id ?? ""} className={input}>{activos.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}{a.operario_id && !activos.find((o) => o.id === a.operario_id) && <option value={a.operario_id}>{a.operario}</option>}</select></label>
                  <label className="text-sm">Bultos<input name="bultos" defaultValue={a.bultos ?? ""} className={input} /></label>
                  <label className="text-sm">Pallets<input name="pallets" defaultValue={a.pallets ?? ""} className={input} /></label>
                  <label className="text-sm">Carro<input name="carro" defaultValue={a.carro ?? ""} className={input} /></label>
                  <label className="text-sm">Tiempo (min)<input name="tiempo_min" defaultValue={a.tiempo_min ?? ""} className={input} /></label>
                  <label className="text-sm">Inicio<input type="date" name="fecha" defaultValue={a.fecha} required className={input} /></label>
                  <label className="text-sm">Finalización<input type="date" name="fecha_finalizacion" defaultValue={a.fecha_finalizacion ?? ""} className={input} /></label>
                  <label className="text-sm">Entrega<input type="date" name="fecha_entrega" defaultValue={a.fecha_entrega ?? ""} className={input} /></label>
                  <label className="text-sm sm:col-span-2">Observaciones<input name="observaciones" defaultValue={a.observaciones ?? ""} className={input} /></label>
                  <button className={`${boton} sm:col-span-4`}>Guardar corrección</button>
                </form>
              </details>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

async function Indicadores({ desde, hasta }: { desde: string; hasta: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("indicadores_armado", { p_desde: desde, p_hasta: hasta });
  const ind = data as { totales: Tot; por_despacho: Fila[]; por_operario: Fila[]; por_dia: { fecha: string; pedidos: number }[] };
  const t = ind.totales;
  const maxDia = Math.max(1, ...ind.por_dia.map((d) => d.pedidos));
  const tarjetas: [string, string][] = [
    ["Pedidos armados", String(t.pedidos)], ["Bultos", String(t.bultos)], ["Pallets", String(t.pallets)],
    ["Minutos promedio", t.min_promedio ? String(t.min_promedio) : "—"],
    ["Armado eficiente", pct(t.armado_eficiente, t.armado_medido)], ["Entrega eficiente", pct(t.entrega_eficiente, t.entrega_medida)],
  ];
  return (
    <>
      <form className={`${card} flex flex-wrap gap-2`}>
        <input type="hidden" name="tab" value="indicadores" />
        <input type="date" name="desde" defaultValue={desde} className={`${input} max-w-[11rem]`} />
        <input type="date" name="hasta" defaultValue={hasta} className={`${input} max-w-[11rem]`} />
        <button className={boton}>Ver período</button>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tarjetas.map(([l, v]) => (
          <div key={l} className={card}><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Armado eficiente: terminado en menos de 4 días. Entrega eficiente: entregado en menos de 3 días desde la finalización (fórmula corregida respecto del Excel, que siempre daba “eficiente”).</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tabla titulo="Por operario" filas={ind.por_operario} k="operario" extra />
        <Tabla titulo="Por despacho" filas={ind.por_despacho} k="despacho" />
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Pedidos armados por día</h2>
        <div className="flex h-40 items-end gap-1 overflow-x-auto">
          {ind.por_dia.map((d) => (
            <div key={d.fecha} className="flex min-w-3 flex-1 flex-col items-center justify-end" title={`${fmtFecha(d.fecha)}: ${d.pedidos}`}>
              <div className="w-full rounded-t bg-slate-800" style={{ height: `${(d.pedidos / maxDia) * 100}%` }} />
            </div>
          ))}
          {!ind.por_dia.length && <p className="text-sm text-slate-500">Sin datos en el período.</p>}
        </div>
      </div>
    </>
  );
}

function Tabla({ titulo, filas, k, extra }: { titulo: string; filas: Fila[]; k: "operario" | "despacho"; extra?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-100 p-3 font-semibold">{titulo}</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">{k === "operario" ? "Operario" : "Despacho"}</th><th className="p-3">Pedidos</th><th className="p-3">Bultos</th><th className="p-3">Min prom.</th>{extra && <th className="p-3">Eficiente</th>}</tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f[k]} className="border-t border-slate-100">
              <td className="p-3 font-medium">{f[k]}</td><td className="p-3">{f.pedidos}</td><td className="p-3">{f.bultos}</td>
              <td className="p-3">{f.min_promedio ?? (f.pedidos ? Math.round(f.minutos / f.pedidos) : "—")}</td>
              {extra && <td className="p-3">{pct(f.eficiente ?? 0, f.medido ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
