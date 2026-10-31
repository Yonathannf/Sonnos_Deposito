"use server";
import { revalidatePath } from "next/cache";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

async function chofer(supabase: Awaited<ReturnType<typeof createClient>>, id: number | null, nuevo: string | null) {
  if (nuevo) {
    const { data: ex } = await supabase.from("choferes").select("id").ilike("nombre", nuevo).maybeSingle();
    if (ex) return ex.id as number;
    const { data, error } = await supabase.from("choferes").insert({ nombre: nuevo }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as number;
  }
  return id;
}

export async function guardarRuta(fd: FormData) {
  await requierePanel("hoja_de_ruta", "editar");
  const fecha = String(fd.get("fecha") ?? "");
  const base = `/hoja_de_ruta?fecha=${fecha}`;
  if (!ES_FECHA.test(fecha)) volver("/hoja_de_ruta", "error", "Fecha inválida");
  const supabase = await createClient();
  let chofer_id: number | null, acompanante_id: number | null;
  try {
    chofer_id = await chofer(supabase, n(fd.get("chofer_id")), s(fd.get("chofer_nuevo")));
    acompanante_id = await chofer(supabase, n(fd.get("acompanante_id")), s(fd.get("acompanante_nuevo")));
  } catch (e) { volver(base, "error", (e as Error).message); }
  const { data: ruta, error } = await supabase.from("rutas")
    .upsert({ fecha, chofer_id, acompanante_id, hora_salida: s(fd.get("hora_salida")), hora_regreso: s(fd.get("hora_regreso")) }, { onConflict: "fecha" })
    .select("id").single();
  if (error) volver(base, "error", error.message);
  // todos los pedidos de ese día quedan asignados a la ruta
  const { error: e2 } = await supabase.from("pedidos").update({ ruta_id: ruta.id }).eq("dia_a_despachar", fecha);
  if (e2) volver(base, "error", e2.message);
  revalidatePath("/hoja_de_ruta");
  volver(base, "ok", "Hoja de ruta guardada");
}

export async function marcarEntregado(fd: FormData) {
  await requierePanel("hoja_de_ruta", "editar");
  const fecha = String(fd.get("fecha") ?? "");
  const base = `/hoja_de_ruta?fecha=${fecha}`;
  const id = n(fd.get("id"));
  const { error } = await (await createClient()).from("pedidos").update({ estado: "Entregado" }).eq("id", id).eq("estado", "Armado");
  if (error) volver(base, "error", error.message);
  revalidatePath("/hoja_de_ruta");
  volver(base, "ok", "Pedido marcado como entregado");
}

export async function entregarTodos(fd: FormData) {
  await requierePanel("hoja_de_ruta", "editar");
  const fecha = String(fd.get("fecha") ?? "");
  const base = `/hoja_de_ruta?fecha=${fecha}`;
  if (!ES_FECHA.test(fecha)) volver("/hoja_de_ruta", "error", "Fecha inválida");
  const { data, error } = await (await createClient()).from("pedidos").update({ estado: "Entregado" })
    .eq("dia_a_despachar", fecha).eq("estado", "Armado").select("id");
  if (error) volver(base, "error", error.message);
  revalidatePath("/hoja_de_ruta");
  volver(base, "ok", `${data?.length ?? 0} pedidos marcados como entregados`);
}
