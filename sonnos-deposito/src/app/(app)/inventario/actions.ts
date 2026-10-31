"use server";
import { revalidatePath } from "next/cache";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s, hoy } from "@/lib/util";

const dup = (m: string) => (m.includes("duplicate") ? "Ese artículo ya está en el conteo" : m);

export async function crearConteo(fd: FormData) {
  await requierePanel("inventario", "editar");
  const nombre = s(fd.get("nombre"));
  const fecha = s(fd.get("fecha")) ?? hoy();
  if (!nombre || nombre.length < 3) volver("/inventario", "error", "Ingresá un nombre para el conteo");
  const { data, error } = await (await createClient()).from("conteos")
    .insert({ nombre, fecha, observaciones: s(fd.get("observaciones")) }).select("id").single();
  if (error) volver("/inventario", "error", error.message);
  revalidatePath("/inventario");
  volver(`/inventario/${data.id}`, "ok", "Conteo creado: empezá a cargar artículos");
}

export async function agregarItem(fd: FormData) {
  await requierePanel("inventario", "editar");
  const conteo = n(fd.get("conteo_id"));
  const base = `/inventario/${conteo}`;
  const sku = s(fd.get("sku"));
  const contado = n(fd.get("contado"));
  if (!conteo) volver("/inventario", "error", "Conteo inválido");
  if (!sku) volver(base, "error", "Ingresá o escaneá el código del artículo");
  if (contado === null || !Number.isInteger(contado) || contado < 0) volver(base, "error", "La cantidad contada debe ser un entero mayor o igual a 0");
  const supabase = await createClient();
  const { data: ex } = await supabase.from("conteo_items").select("id, contado").eq("conteo_id", conteo).eq("sku", sku).maybeSingle();
  if (ex) {
    const nuevo = fd.get("sumar") === "on" ? ex.contado + contado : contado;
    const { error } = await supabase.from("conteo_items").update({ contado: nuevo }).eq("id", ex.id);
    if (error) volver(base, "error", error.message);
    revalidatePath(base);
    volver(base, "ok", `${sku}: contado ${nuevo}`);
  }
  const { error } = await supabase.from("conteo_items").insert({ conteo_id: conteo, sku, contado });
  if (error) volver(base, "error", dup(error.message));
  revalidatePath(base);
  volver(base, "ok", `${sku} agregado`);
}

export async function editarItem(fd: FormData) {
  await requierePanel("inventario", "editar");
  const id = n(fd.get("id")); const conteo = n(fd.get("conteo_id")); const contado = n(fd.get("contado"));
  const base = `/inventario/${conteo}`;
  if (contado === null || !Number.isInteger(contado) || contado < 0) volver(base, "error", "Cantidad inválida");
  const { error } = await (await createClient()).from("conteo_items").update({ contado }).eq("id", id);
  if (error) volver(base, "error", error.message);
  revalidatePath(base);
  volver(base, "ok", "Cantidad corregida");
}

export async function borrarItem(fd: FormData) {
  await requierePanel("inventario", "editar");
  const id = n(fd.get("id")); const conteo = n(fd.get("conteo_id"));
  const base = `/inventario/${conteo}`;
  const { error } = await (await createClient()).from("conteo_items").delete().eq("id", id);
  if (error) volver(base, "error", error.message);
  revalidatePath(base);
  volver(base, "ok", "Artículo quitado del conteo");
}

export async function cerrarConteo(fd: FormData) {
  await requierePanel("inventario", "editar");
  const id = n(fd.get("id"));
  const base = `/inventario/${id}`;
  const { data, error } = await (await createClient()).rpc("cerrar_conteo", { p_id: id });
  if (error) volver(base, "error", error.message);
  revalidatePath("/inventario"); revalidatePath(base);
  const r = data as { articulos: number; ajustes_pendientes: number };
  volver(base, "ok", `Conteo cerrado: ${r.articulos} artículos, ${r.ajustes_pendientes} ajustes pendientes`);
}

export async function resolverAjuste(fd: FormData) {
  await requierePanel("stock", "editar");
  const id = n(fd.get("id")); const conteo = n(fd.get("conteo_id"));
  const base = `/inventario/${conteo}`;
  const estado = String(fd.get("estado") ?? "");
  const { error } = await (await createClient()).rpc("resolver_ajuste", { p_item: id, p_estado: estado, p_obs: s(fd.get("obs")) });
  if (error) volver(base, "error", error.message);
  revalidatePath(base);
  volver(base, "ok", estado === "cargado" ? "Ajuste marcado como cargado en el ERP" : "Ajuste descartado");
}
