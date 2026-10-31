"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable();
const schema = z.object({
  nro_pedido: z.string().trim().min(1, "Ingresá el número de pedido").max(40),
  cliente_id: z.number().int().positive("Elegí un cliente"),
  fecha_impreso: fecha,
  dia_a_despachar: fecha,
  transporte_id: z.number().int().positive().nullable(),
  cobrar: z.number().min(0, "El monto a cobrar no puede ser negativo").nullable(),
  comentarios: z.string().max(1000).nullable(),
});

function leer(fd: FormData) {
  return schema.safeParse({
    nro_pedido: fd.get("nro_pedido") ?? "",
    cliente_id: n(fd.get("cliente_id")),
    fecha_impreso: s(fd.get("fecha_impreso")),
    dia_a_despachar: s(fd.get("dia_a_despachar")),
    transporte_id: n(fd.get("transporte_id")),
    cobrar: n(fd.get("cobrar")),
    comentarios: s(fd.get("comentarios")),
  });
}
const msgDup = (m: string) => (m.includes("duplicate") || m.includes("unique") ? "Ya existe un pedido con ese número" : m);

export async function crearPedido(fd: FormData) {
  await requierePanel("pedidos", "editar");
  const p = leer(fd);
  const base = `/pedidos/nuevo?cliente=${fd.get("cliente_id") ?? ""}`;
  if (!p.success) volver(base, "error", p.error.issues[0].message);
  if (p.data.dia_a_despachar && p.data.fecha_impreso && p.data.dia_a_despachar < p.data.fecha_impreso)
    volver(base, "error", "El día a despachar no puede ser anterior a la fecha del pedido");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pedidos").insert({ ...p.data, estado: "Impreso" }).select("id").single();
  if (error) volver(base, "error", msgDup(error.message));
  revalidatePath("/pedidos");
  volver(`/pedidos/${data.id}`, "ok", "Pedido cargado");
}

export async function actualizarPedido(fd: FormData) {
  await requierePanel("pedidos", "editar");
  const id = n(fd.get("id"));
  const base = `/pedidos/${id}`;
  const p = leer(fd);
  if (!id) volver("/pedidos", "error", "Pedido inválido");
  if (!p.success) volver(base, "error", p.error.issues[0].message);
  if (p.data.dia_a_despachar && p.data.fecha_impreso && p.data.dia_a_despachar < p.data.fecha_impreso)
    volver(base, "error", "El día a despachar no puede ser anterior a la fecha del pedido");
  const supabase = await createClient();
  const { error } = await supabase.from("pedidos").update(p.data).eq("id", id);
  if (error) volver(base, "error", msgDup(error.message));
  revalidatePath("/pedidos");
  volver(base, "ok", "Pedido actualizado");
}

export async function eliminarPedido(fd: FormData) {
  await requierePanel("pedidos", "editar");
  const id = n(fd.get("id"));
  const supabase = await createClient();
  const { data: ped } = await supabase.from("pedidos").select("estado").eq("id", id).single();
  if (!ped) volver("/pedidos", "error", "Pedido no encontrado");
  if (ped.estado !== "Impreso") volver(`/pedidos/${id}`, "error", "Solo se puede eliminar un pedido que todavía no fue armado");
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) volver(`/pedidos/${id}`, "error", error.message);
  revalidatePath("/pedidos");
  volver("/pedidos", "ok", "Pedido eliminado");
}
