"use server";
import { revalidatePath } from "next/cache";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s, hoy } from "@/lib/util";

const dup = (m: string) => (m.includes("duplicate") ? "Ya existe una recepción con ese remito para ese proveedor" : m);

export async function crearRecepcion(fd: FormData) {
  await requierePanel("recepcion", "editar");
  const proveedor = s(fd.get("proveedor")); const nro_remito = s(fd.get("nro_remito"));
  if (!proveedor) volver("/recepcion", "error", "Indicá el proveedor");
  if (!nro_remito) volver("/recepcion", "error", "Indicá el número de remito o documento");
  const { data, error } = await (await createClient()).from("recepciones")
    .insert({ proveedor, nro_remito, fecha: s(fd.get("fecha")) ?? hoy(), observaciones: s(fd.get("observaciones")) }).select("id").single();
  if (error) volver("/recepcion", "error", dup(error.message));
  revalidatePath("/recepcion");
  volver(`/recepcion/${data.id}`, "ok", "Recepción creada: cargá los artículos recibidos");
}

export async function guardarItem(fd: FormData) {
  await requierePanel("recepcion", "editar");
  const rec = n(fd.get("recepcion_id")); const base = `/recepcion/${rec}`;
  const sku = s(fd.get("sku")); const esperado = n(fd.get("esperado")) ?? 0; const recibido = n(fd.get("recibido")); const danado = n(fd.get("danado")) ?? 0;
  if (!rec) volver("/recepcion", "error", "Recepción inválida");
  if (!sku) volver(base, "error", "Ingresá o escaneá el código del artículo");
  for (const [v, l] of [[esperado, "esperada"], [recibido, "recibida"], [danado, "dañada"]] as const)
    if (v === null || !Number.isInteger(v) || v < 0) volver(base, "error", `La cantidad ${l} debe ser un entero mayor o igual a 0`);
  if (danado > (recibido as number)) volver(base, "error", "Las unidades dañadas no pueden superar a las recibidas");
  const { error } = await (await createClient()).from("recepcion_items").upsert(
    { recepcion_id: rec, sku, esperado, recibido, danado, ubicacion: s(fd.get("ubicacion")), observaciones: s(fd.get("observaciones")) },
    { onConflict: "recepcion_id,sku" });
  if (error) volver(base, "error", error.message);
  revalidatePath(base);
  volver(base, "ok", `${sku} cargado`);
}

export async function borrarItem(fd: FormData) {
  await requierePanel("recepcion", "editar");
  const rec = n(fd.get("recepcion_id")); const base = `/recepcion/${rec}`;
  const { error } = await (await createClient()).from("recepcion_items").delete().eq("id", n(fd.get("id")));
  if (error) volver(base, "error", error.message);
  revalidatePath(base);
  volver(base, "ok", "Artículo quitado");
}

export async function confirmar(fd: FormData) {
  await requierePanel("recepcion", "editar");
  const id = n(fd.get("id")); const base = `/recepcion/${id}`;
  const { data, error } = await (await createClient()).rpc("confirmar_recepcion", { p_id: id });
  if (error) volver(base, "error", error.message);
  revalidatePath("/recepcion"); revalidatePath("/stock"); revalidatePath(base);
  const r = data as { articulos: number; unidades: number; con_diferencias: boolean };
  volver(base, "ok", `Recepción confirmada: ${r.unidades} unidades sumadas al stock${r.con_diferencias ? " (con diferencias registradas)" : ""}`);
}

export async function eliminarRecepcion(fd: FormData) {
  await requierePanel("recepcion", "editar");
  const { error } = await (await createClient()).from("recepciones").delete().eq("id", n(fd.get("id"))).eq("estado", "Borrador");
  if (error) volver("/recepcion", "error", error.message);
  revalidatePath("/recepcion");
  volver("/recepcion", "ok", "Borrador eliminado");
}

export async function subirFoto(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  await requierePanel("recepcion", "editar");
  const rec = n(fd.get("recepcion_id")); const file = fd.get("foto");
  if (!rec || !(file instanceof Blob) || file.size === 0) return { ok: false, error: "Foto inválida" };
  if (file.size > 3.5 * 1024 * 1024) return { ok: false, error: "La foto es demasiado grande" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "El archivo no es una imagen" };
  const supabase = await createClient();
  const path = `${rec}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage.from("recepciones").upload(path, file, { contentType: "image/jpeg" });
  if (up.error) return { ok: false, error: up.error.message };
  const { error } = await supabase.from("recepcion_fotos").insert({ recepcion_id: rec, path, nombre: String(fd.get("nombre") ?? "").slice(0, 120) || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/recepcion/${rec}`);
  return { ok: true };
}
