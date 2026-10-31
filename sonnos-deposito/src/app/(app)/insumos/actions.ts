"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const entOpc = (msg: string) => z.number().int().min(0, msg).nullable();
const schema = z.object({
  sku: z.string().nullable(),
  descripcion: z.string().trim().min(2, "Ingresá la descripción del insumo").max(200),
  ubicacion: z.string().nullable(), unidad_medida: z.string().nullable(),
  stock_minimo: entOpc("El mínimo no puede ser negativo"), stock_maximo: entOpc("El máximo no puede ser negativo"),
  tiempo_reposicion_dias: entOpc("Los días de reposición no pueden ser negativos"),
  proveedor: z.string().nullable(), observaciones: z.string().nullable(),
});
function leer(fd: FormData) {
  return schema.safeParse({
    sku: s(fd.get("sku")), descripcion: fd.get("descripcion") ?? "", ubicacion: s(fd.get("ubicacion")), unidad_medida: s(fd.get("unidad_medida")),
    stock_minimo: n(fd.get("stock_minimo")), stock_maximo: n(fd.get("stock_maximo")), tiempo_reposicion_dias: n(fd.get("tiempo_reposicion_dias")),
    proveedor: s(fd.get("proveedor")), observaciones: s(fd.get("observaciones")),
  });
}
const BASE = "/insumos";
const chk = (d: z.infer<typeof schema>) =>
  d.stock_minimo !== null && d.stock_maximo !== null && d.stock_maximo < d.stock_minimo ? "El máximo no puede ser menor que el mínimo" : null;

export async function crearInsumo(fd: FormData) {
  await requierePanel("insumos", "editar");
  const p = leer(fd);
  if (!p.success) volver(BASE, "error", p.error.issues[0].message);
  const e = chk(p.data); if (e) volver(BASE, "error", e);
  const inicial = n(fd.get("stock_inicial")) ?? 0;
  if (!Number.isInteger(inicial) || inicial < 0) volver(BASE, "error", "El stock inicial debe ser un entero mayor o igual a 0");
  const supabase = await createClient();
  const { data, error } = await supabase.from("insumos").insert(p.data).select("id").single();
  if (error) volver(BASE, "error", error.message);
  if (inicial > 0) {
    const r = await supabase.from("insumo_movimientos").insert({ insumo_id: data.id, tipo: "ingreso", cantidad: inicial, observaciones: "Stock inicial" });
    if (r.error) volver(BASE, "error", r.error.message);
  }
  revalidatePath(BASE);
  volver(BASE, "ok", `Insumo “${p.data.descripcion}” creado`);
}

export async function actualizarInsumo(fd: FormData) {
  await requierePanel("insumos", "editar");
  const id = n(fd.get("id")); const p = leer(fd);
  if (!id) volver(BASE, "error", "Insumo inválido");
  if (!p.success) volver(BASE, "error", p.error.issues[0].message);
  const e = chk(p.data); if (e) volver(BASE, "error", e);
  const { error } = await (await createClient()).from("insumos").update({ ...p.data, activo: fd.get("activo") === "on" }).eq("id", id);
  if (error) volver(BASE, "error", error.message);
  revalidatePath(BASE);
  volver(BASE, "ok", "Insumo actualizado");
}

export async function registrarMovimiento(fd: FormData) {
  await requierePanel("insumos", "editar");
  const insumo_id = n(fd.get("insumo_id")); const tipo = String(fd.get("tipo") ?? "");
  const cantidad = n(fd.get("cantidad"));
  if (!insumo_id) volver(BASE, "error", "Insumo inválido");
  if (!["ingreso", "consumo", "ajuste"].includes(tipo)) volver(BASE, "error", "Elegí el tipo de movimiento");
  if (cantidad === null || !Number.isInteger(cantidad) || cantidad === 0) volver(BASE, "error", "La cantidad debe ser un entero distinto de 0");
  if (tipo !== "ajuste" && cantidad < 0) volver(BASE, "error", "La cantidad debe ser positiva");
  const sector = s(fd.get("sector")); const operario_id = n(fd.get("operario_id"));
  if (tipo === "consumo" && !sector && !operario_id) volver(BASE, "error", "Indicá a qué sector u operario se entrega");
  const { error } = await (await createClient()).from("insumo_movimientos")
    .insert({ insumo_id, tipo, cantidad, sector, operario_id, observaciones: s(fd.get("observaciones")) });
  if (error) volver(BASE, "error", error.message.includes("mov_destino_ok") ? "Indicá a qué sector u operario se entrega" : error.message);
  revalidatePath(BASE);
  volver(BASE, "ok", tipo === "consumo" ? "Entrega registrada" : tipo === "ingreso" ? "Ingreso registrado" : "Ajuste registrado");
}

export async function crearSolicitud(fd: FormData) {
  await requierePanel("insumos", "editar");
  const insumo_id = n(fd.get("insumo_id")); const cantidad = n(fd.get("cantidad"));
  const url = `${BASE}?tab=solicitudes`;
  if (!insumo_id) volver(url, "error", "Elegí el insumo");
  if (cantidad === null || !Number.isInteger(cantidad) || cantidad <= 0) volver(url, "error", "La cantidad a pedir debe ser mayor que 0");
  const supabase = await createClient();
  const { data: ins } = await supabase.from("insumos").select("tiempo_reposicion_dias").eq("id", insumo_id).single();
  const est = ins?.tiempo_reposicion_dias != null ? new Date(Date.now() + ins.tiempo_reposicion_dias * 86400000).toISOString().slice(0, 10) : null;
  const { error } = await supabase.from("solicitudes_compra")
    .insert({ insumo_id, cantidad_solicitada: cantidad, fecha_estimada_recepcion: est, observaciones: s(fd.get("observaciones")) });
  if (error) volver(url, "error", error.message);
  revalidatePath(BASE);
  volver(url, "ok", "Solicitud de reposición creada");
}

export async function recibirSolicitud(fd: FormData) {
  await requierePanel("insumos", "editar");
  const url = `${BASE}?tab=solicitudes`;
  const { error } = await (await createClient()).rpc("recibir_solicitud", { p_id: n(fd.get("id")), p_cantidad: n(fd.get("cantidad")) });
  if (error) volver(url, "error", error.message);
  revalidatePath(BASE);
  volver(url, "ok", "Solicitud recibida: el stock del insumo ya se actualizó");
}

export async function cancelarSolicitud(fd: FormData) {
  await requierePanel("insumos", "editar");
  const url = `${BASE}?tab=solicitudes`;
  const { error } = await (await createClient()).from("solicitudes_compra").update({ estado: "Cancelada" }).eq("id", n(fd.get("id"))).eq("estado", "Pendiente");
  if (error) volver(url, "error", error.message);
  revalidatePath(BASE);
  volver(url, "ok", "Solicitud cancelada");
}
