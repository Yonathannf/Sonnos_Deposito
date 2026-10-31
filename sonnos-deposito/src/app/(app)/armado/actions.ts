"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const f = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const schema = z.object({
  fecha: f,
  nro_cliente: z.string().nullable(),
  nro_pedido: z.string().nullable(),
  prioridad: z.enum(["NORMAL", "URGENTE", "ESTACIONADO"]),
  despacho: z.string().trim().min(1, "Elegí el despacho"),
  operario_id: z.number().int().positive("Elegí quién armó"),
  bultos: z.number().int().min(0, "Bultos inválidos").nullable(),
  pallets: z.number().int().min(0, "Pallets inválidos").nullable(),
  carro: z.number().int().min(0, "Carro inválido").nullable(),
  tiempo_min: z.number().int().min(0, "El tiempo no puede ser negativo").max(1440, "El tiempo parece demasiado alto").nullable(),
  fecha_finalizacion: f.nullable(),
  fecha_entrega: f.nullable(),
  observaciones: z.string().max(500).nullable(),
});
function leer(fd: FormData) {
  return schema.safeParse({
    fecha: fd.get("fecha"), nro_cliente: s(fd.get("nro_cliente")), nro_pedido: s(fd.get("nro_pedido")),
    prioridad: fd.get("prioridad") ?? "NORMAL", despacho: fd.get("despacho") ?? "", operario_id: n(fd.get("operario_id")),
    bultos: n(fd.get("bultos")), pallets: n(fd.get("pallets")), carro: n(fd.get("carro")), tiempo_min: n(fd.get("tiempo_min")),
    fecha_finalizacion: s(fd.get("fecha_finalizacion")), fecha_entrega: s(fd.get("fecha_entrega")), observaciones: s(fd.get("observaciones")),
  });
}
function fechasOk(d: z.infer<typeof schema>) {
  if (d.fecha_finalizacion && d.fecha_finalizacion < d.fecha) return "La finalización no puede ser anterior al inicio del armado";
  if (d.fecha_entrega && !d.fecha_finalizacion) return "Para cargar la entrega primero cargá la finalización";
  if (d.fecha_entrega && d.fecha_finalizacion && d.fecha_entrega < d.fecha_finalizacion) return "La entrega no puede ser anterior a la finalización";
  return null;
}

export async function registrarArmado(fd: FormData) {
  await requierePanel("armado", "editar");
  const p = leer(fd);
  if (!p.success) volver("/armado", "error", p.error.issues[0].message);
  const e = fechasOk(p.data);
  if (e) volver("/armado", "error", e);
  const supabase = await createClient();
  if (p.data.nro_pedido) {
    const { count } = await supabase.from("armados").select("id", { count: "exact", head: true }).eq("nro_pedido", p.data.nro_pedido);
    if (count) volver("/armado", "error", `El pedido ${p.data.nro_pedido} ya tiene un armado registrado`);
  }
  const { data, error } = await supabase.from("armados").insert({ ...p.data, estado: "FINALIZADO" }).select("pedido_id").single();
  if (error) volver("/armado", "error", error.message);
  revalidatePath("/armado"); revalidatePath("/pedidos");
  volver("/armado", "ok", p.data.nro_pedido && !data.pedido_id
    ? "Armado registrado (el pedido no está cargado en el sistema, quedó sin vincular)"
    : "Armado registrado");
}

export async function actualizarArmado(fd: FormData) {
  await requierePanel("armado", "editar");
  const id = n(fd.get("id"));
  const p = leer(fd);
  if (!id) volver("/armado", "error", "Armado inválido");
  if (!p.success) volver("/armado", "error", p.error.issues[0].message);
  const e = fechasOk(p.data);
  if (e) volver("/armado", "error", e);
  const { error } = await (await createClient()).from("armados").update(p.data).eq("id", id);
  if (error) volver("/armado", "error", error.message);
  revalidatePath("/armado");
  volver("/armado", "ok", "Armado corregido");
}

export async function guardarOperario(fd: FormData) {
  await requierePanel("armado", "editar");
  const id = n(fd.get("id"));
  const nombre = s(fd.get("nombre"));
  if (!nombre || nombre.length < 2) volver("/armado?tab=operarios", "error", "Ingresá el nombre");
  const supabase = await createClient();
  const r = id
    ? await supabase.from("operarios").update({ nombre, activo: fd.get("activo") === "on" }).eq("id", id)
    : await supabase.from("operarios").insert({ nombre });
  if (r.error) volver("/armado?tab=operarios", "error", r.error.message.includes("duplicate") ? "Ya existe un operario con ese nombre" : r.error.message);
  revalidatePath("/armado");
  volver("/armado?tab=operarios", "ok", id ? "Operario actualizado" : "Operario agregado");
}
