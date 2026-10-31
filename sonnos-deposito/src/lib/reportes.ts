import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todas } from "@/lib/paginar";
import { fmtFecha } from "@/lib/util";

export type Celda = string | number | null;
export type Reporte = { titulo: string; columnas: string[]; filas: Celda[][]; resumen?: string };

export const TIPOS = [
  { id: "pedidos_armados", nombre: "Pedidos preparados", panel: "armado" },
  { id: "pedidos_despachados", nombre: "Pedidos despachados", panel: "pedidos" },
  { id: "pedidos_diferencias", nombre: "Pedidos con errores o diferencias", panel: "pedidos" },
  { id: "tiempo_armado", nombre: "Tiempo promedio de preparación", panel: "armado" },
  { id: "productividad", nombre: "Productividad por operario", panel: "armado" },
  { id: "movimientos_stock", nombre: "Movimientos de inventario", panel: "stock" },
  { id: "diferencias_inventario", nombre: "Diferencias de stock (conteos)", panel: "inventario" },
  { id: "consumo_insumos", nombre: "Consumo de insumos (mayor consumo)", panel: "insumos" },
  { id: "rotacion_productos", nombre: "Productos con mayor rotación", panel: "stock" },
] as const;
export type TipoReporte = (typeof TIPOS)[number]["id"];

type Q = SupabaseClient;
const ini = (d: string) => `${d}T00:00:00-03:00`;
const fin = (d: string) => `${d}T23:59:59-03:00`;
const uno = <T,>(x: T | T[] | null | undefined) => (Array.isArray(x) ? x[0] : x) ?? null;
const sumaFecha = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export async function generarReporte(sb: Q, tipo: TipoReporte, desde: string, hasta: string): Promise<Reporte> {
  const per = `${fmtFecha(desde)} al ${fmtFecha(hasta)}`;
  switch (tipo) {
    case "pedidos_armados": {
      const r = await todas<Record<string, string | number | null>>((a, b) => sb.from("armados_calc")
        .select("fecha, nro_pedido, nro_cliente, despacho, operario, bultos, pallets, tiempo_min, prioridad, ef_armado, ef_entrega")
        .gte("fecha", desde).lte("fecha", hasta).order("fecha").order("id").range(a, b));
      return { titulo: `Pedidos preparados · ${per}`, resumen: `${r.length} pedidos · ${r.reduce((s, x) => s + Number(x.bultos ?? 0), 0)} bultos`,
        columnas: ["Fecha", "Pedido", "Cliente", "Despacho", "Operario", "Bultos", "Pallets", "Minutos", "Prioridad", "Armado", "Entrega"],
        filas: r.map((x) => [fmtFecha(x.fecha as string), x.nro_pedido, x.nro_cliente, x.despacho, x.operario, x.bultos, x.pallets, x.tiempo_min, x.prioridad, x.ef_armado, x.ef_entrega]) };
    }
    case "pedidos_despachados": {
      const r = await todas<Record<string, unknown>>((a, b) => sb.from("pedidos_calc")
        .select("nro_pedido, dia_a_despachar, bultos, pallets, cumple_plazo, cliente_nombre, transporte_nombre, operario_nombre")
        .eq("estado", "Entregado").gte("dia_a_despachar", desde).lte("dia_a_despachar", hasta).order("dia_a_despachar").order("id").range(a, b));
      return { titulo: `Pedidos despachados · ${per}`, resumen: `${r.length} pedidos · ${r.reduce((s, x) => s + Number(x.bultos ?? 0), 0)} bultos`,
        columnas: ["Día de despacho", "Pedido", "Cliente", "Transporte", "Bultos", "Pallets", "Armó", "Plazo"],
        filas: r.map((x) => [fmtFecha(x.dia_a_despachar as string), x.nro_pedido as string, x.cliente_nombre as string | null, x.transporte_nombre as string | null,
          x.bultos as number | null, x.pallets as number | null, x.operario_nombre as string | null, x.cumple_plazo as string | null]) };
    }
    case "pedidos_diferencias": {
      const r = await todas<Record<string, unknown>>((a, b) => sb.from("pedidos_calc")
        .select("nro_pedido, dia_a_despachar, comentarios, cumple_plazo, estado, cliente_nombre, operario_nombre")
        .gte("dia_a_despachar", desde).lte("dia_a_despachar", hasta).order("dia_a_despachar").order("id").range(a, b));
      const f = r.filter((x) => x.comentarios || x.cumple_plazo === "NO CUMPLE");
      return { titulo: `Pedidos con errores, diferencias u observaciones · ${per}`, resumen: `${f.length} de ${r.length} pedidos del período`,
        columnas: ["Día de despacho", "Pedido", "Cliente", "Armó", "Estado", "Motivo / observación"],
        filas: f.map((x) => [fmtFecha(x.dia_a_despachar as string), x.nro_pedido as string, x.cliente_nombre as string | null, x.operario_nombre as string | null, x.estado as string,
          [x.comentarios, x.cumple_plazo === "NO CUMPLE" ? "Fuera de plazo" : null].filter(Boolean).join(" · ")]) };
    }
    case "tiempo_armado": {
      const { data, error } = await sb.rpc("indicadores_armado", { p_desde: desde, p_hasta: hasta });
      if (error) throw new Error(error.message);
      const i = data as { totales: Record<string, number | null>; por_operario: Record<string, number | string>[]; por_despacho: Record<string, number | string>[] };
      const filas: Celda[][] = [["Total", "Todos", i.totales.pedidos, i.totales.bultos, i.totales.min_promedio, i.totales.minutos]];
      for (const o of i.por_operario) filas.push(["Operario", o.operario as string, o.pedidos as number, o.bultos as number, (o.min_promedio as number) ?? null, o.minutos as number]);
      for (const d of i.por_despacho) filas.push(["Despacho", d.despacho as string, d.pedidos as number, d.bultos as number, d.pedidos ? Math.round((d.minutos as number) / (d.pedidos as number) * 10) / 10 : null, d.minutos as number]);
      return { titulo: `Tiempo promedio de preparación · ${per}`, resumen: `Promedio general: ${i.totales.min_promedio ?? "—"} min por pedido`,
        columnas: ["Agrupación", "Detalle", "Pedidos", "Bultos", "Min. promedio", "Min. totales"], filas };
    }
    case "productividad": {
      const { data, error } = await sb.rpc("indicadores_armado", { p_desde: desde, p_hasta: hasta });
      if (error) throw new Error(error.message);
      const arm = (data as { por_operario: { operario: string; pedidos: number; bultos: number; min_promedio: number | null; eficiente: number; medido: number }[] }).por_operario;
      const tareas = await todas<{ operario: string | null; minutos: number | null }>((a, b) => sb.from("tareas_calc").select("operario, minutos")
        .eq("estado", "Finalizada").gte("fin", ini(desde)).lte("fin", fin(hasta)).range(a, b));
      const tm = new Map<string, { n: number; min: number }>();
      for (const t of tareas) { const k = t.operario ?? "(sin asignar)"; const e = tm.get(k) ?? { n: 0, min: 0 }; e.n++; e.min += t.minutos ?? 0; tm.set(k, e); }
      const nombres = new Set([...arm.map((a) => a.operario), ...tm.keys()]);
      const filas = [...nombres].map((n) => { const a = arm.find((x) => x.operario === n); const t = tm.get(n);
        return [n, a?.pedidos ?? 0, a?.bultos ?? 0, a?.min_promedio ?? null, a && a.medido ? `${Math.round((a.eficiente / a.medido) * 100)}%` : null, t?.n ?? 0, t?.min ?? 0] as Celda[]; })
        .sort((x, y) => Number(y[1]) - Number(x[1]));
      return { titulo: `Productividad por operario · ${per}`, columnas: ["Operario", "Pedidos armados", "Bultos", "Min. prom. por pedido", "Armado eficiente", "Tareas finalizadas", "Min. en tareas"], filas };
    }
    case "movimientos_stock": {
      const r = await todas<Record<string, unknown>>((a, b) => sb.from("stock_movimientos").select("fecha, sku, tipo, cantidad, usuario_nombre, observaciones, incorporado_en")
        .gte("fecha", ini(desde)).lte("fecha", fin(hasta)).order("fecha").range(a, b));
      const skus = [...new Set(r.map((x) => x.sku as string))];
      const desc = new Map<string, string>();
      for (let i = 0; i < skus.length; i += 200) {
        const { data } = await sb.from("stock_productos").select("sku, descripcion").in("sku", skus.slice(i, i + 200));
        for (const d of data ?? []) desc.set(d.sku, d.descripcion ?? "");
      }
      return { titulo: `Movimientos de inventario · ${per}`, resumen: `${r.length} movimientos · ${r.reduce((s, x) => s + Number(x.cantidad), 0)} unidades`,
        columnas: ["Fecha", "Tipo", "Código", "Descripción", "Cantidad", "Usuario", "Observaciones", "Estado ERP"],
        filas: r.map((x) => [fmtFecha(x.fecha as string), x.tipo as string, x.sku as string, desc.get(x.sku as string) ?? null, x.cantidad as number, x.usuario_nombre as string, x.observaciones as string, x.incorporado_en ? "Ya figura en el ERP" : "Pendiente de reflejar"]) };
    }
    case "diferencias_inventario": {
      const r = await todas<Record<string, unknown>>((a, b) => sb.from("conteo_items_calc")
        .select("sku, descripcion, contado, sistema, dif, dif_pct, resultado, ajuste, conteo_fecha, conteo_nombre")
        .in("resultado", ["FALTANTE", "SOBRANTE"]).gte("conteo_fecha", desde).lte("conteo_fecha", hasta).order("conteo_fecha").range(a, b));
      const filas = r.map((x) => { return [fmtFecha(x.conteo_fecha as string), x.conteo_nombre as string, x.sku as string, x.descripcion as string, x.contado as number, x.sistema as number, x.dif as number, x.dif_pct as number | null, x.resultado as string, x.ajuste as string | null] as Celda[]; });
      return { titulo: `Diferencias de stock detectadas en conteos · ${per}`, resumen: `${filas.length} artículos fuera de tolerancia (±3%)`,
        columnas: ["Fecha", "Conteo", "Código", "Descripción", "Contado", "Sistema", "Diferencia", "Dif. %", "Resultado", "Ajuste"], filas };
    }
    case "consumo_insumos": {
      const r = await todas<Record<string, unknown>>((a, b) => sb.from("insumo_movimientos").select("cantidad, sector, insumos(descripcion, unidad_medida)")
        .eq("tipo", "consumo").gte("fecha", ini(desde)).lte("fecha", fin(hasta)).range(a, b));
      const m = new Map<string, { u: string | null; total: number; n: number; sec: Map<string, number> }>();
      for (const x of r) { const i = uno(x.insumos as { descripcion: string; unidad_medida: string | null })!; const e = m.get(i.descripcion) ?? { u: i.unidad_medida, total: 0, n: 0, sec: new Map() };
        e.total += x.cantidad as number; e.n++; const sc = (x.sector as string) ?? "(operario)"; e.sec.set(sc, (e.sec.get(sc) ?? 0) + (x.cantidad as number)); m.set(i.descripcion, e); }
      const filas = [...m.entries()].sort((a, b) => b[1].total - a[1].total)
        .map(([n, e]) => [n, e.u, e.total, e.n, [...e.sec.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null] as Celda[]);
      return { titulo: `Consumo de insumos · ${per}`, resumen: `${filas.length} insumos con consumo`, columnas: ["Insumo", "Unidad", "Total consumido", "Entregas", "Sector principal"], filas };
    }
    case "rotacion_productos": {
      const h = await todas<{ sku: string; fecha: string; stk: number }>((a, b) => sb.from("stock_historial").select("sku, fecha, stk")
        .gte("fecha", sumaFecha(desde, -1)).lte("fecha", hasta).order("sku").order("fecha").range(a, b));
      const por = new Map<string, { sal: number; ini: number; fin: number; prev: number | null }>();
      for (const x of h) { const e = por.get(x.sku) ?? { sal: 0, ini: x.stk, fin: x.stk, prev: null };
        if (e.prev !== null && x.stk < e.prev) e.sal += e.prev - x.stk; e.prev = x.stk; e.fin = x.stk; por.set(x.sku, e); }
      const skus = [...por.keys()]; const desc = new Map<string, string>();
      for (let i = 0; i < skus.length; i += 200) { const { data } = await sb.from("stock_productos").select("sku, descripcion").in("sku", skus.slice(i, i + 200)); for (const d of data ?? []) desc.set(d.sku, d.descripcion ?? ""); }
      const filas = [...por.entries()].filter(([, e]) => e.sal > 0).sort((a, b) => b[1].sal - a[1].sal).map(([s, e]) => [s, desc.get(s) ?? null, e.sal, e.ini, e.fin] as Celda[]);
      return { titulo: `Productos con mayor rotación · ${per}`,
        resumen: "Salidas estimadas = bajas de stock entre fotos diarias consecutivas (solo productos en seguimiento). Mejora a medida que se acumulan importaciones diarias.",
        columnas: ["Código", "Descripción", "Unidades salidas (est.)", "Stock inicial", "Stock final"], filas };
    }
  }
}
