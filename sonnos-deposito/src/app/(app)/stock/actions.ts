"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n } from "@/lib/util";

const ent = z.number().int().nullable();
const fila = z.object({
  sku: z.string().min(1).max(60),
  descripcion: z.string().max(400).nullable(),
  categoria: z.string().max(120).nullable(), subcategoria: z.string().max(120).nullable(), marca: z.string().max(120).nullable(),
  fisico_ramos: ent, disp_ramos: ent, fisico_mayogym: ent, disp_mayogym: ent, fisico_central: ent, disp_central: ent,
  fisico_full: ent, disp_full: ent, fisico_marmol: ent, disp_marmol: ent, fisico_outlet: ent, disp_outlet: ent,
  fisico_discontinuo: ent, disp_discontinuo: ent, fisico_compras: ent, disp_compras: ent,
  fisico_anticipada: ent, disp_anticipada: ent, fisico_showroom: ent,
});

// El navegador lee el Excel y manda lotes. NO se envían minimo ni en_seguimiento: así se conservan.
export async function importarLote(filas: unknown): Promise<{ ok: boolean; error?: string; n?: number }> {
  await requierePanel("stock", "editar");
  const p = z.array(fila).min(1).max(1000).safeParse(filas);
  if (!p.success) return { ok: false, error: "Lote inválido: " + p.error.issues[0].message };
  const ahora = new Date().toISOString();
  const { error } = await (await createClient())
    .from("stock_productos")
    .upsert(p.data.map((f) => ({ ...f, actualizado_en: ahora })), { onConflict: "sku" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, n: p.data.length };
}

export async function finalizarImportacion(archivo: string, total: number) {
  await requierePanel("stock", "editar");
  const { data, error } = await (await createClient()).rpc("stock_finalizar_importacion", { p_archivo: archivo.slice(0, 200), p_total: total });
  revalidatePath("/stock"); revalidatePath("/");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, alertas: (data as { alertas: number }).alertas };
}

export async function editarMinimo(fd: FormData) {
  await requierePanel("stock", "editar");
  const sku = String(fd.get("sku") ?? "");
  const volverA = String(fd.get("volver") ?? "/stock");
  const raw = String(fd.get("minimo") ?? "").trim();
  const minimo = raw === "" ? null : n(raw);
  if (raw !== "" && (minimo === null || minimo < 0 || !Number.isInteger(minimo))) volver(volverA, "error", "El mínimo debe ser un número entero mayor o igual a 0");
  const { error } = await (await createClient()).from("stock_productos").update({ minimo }).eq("sku", sku);
  if (error) volver(volverA, "error", error.message);
  revalidatePath("/stock");
  volver(volverA, "ok", `Mínimo de ${sku} actualizado`);
}

export async function alternarSeguimiento(fd: FormData) {
  await requierePanel("stock", "editar");
  const sku = String(fd.get("sku") ?? "");
  const volverA = String(fd.get("volver") ?? "/stock");
  const seguir = fd.get("seguir") === "1";
  const { error } = await (await createClient()).from("stock_productos").update({ en_seguimiento: seguir }).eq("sku", sku);
  if (error) volver(volverA, "error", error.message);
  revalidatePath("/stock");
  volver(volverA, "ok", seguir ? `${sku} ahora se sigue` : `${sku} dejó de seguirse`);
}

export async function editarUbicacion(fd: FormData) {
  await requierePanel("stock", "editar");
  const sku = String(fd.get("sku") ?? "");
  const volverA = `/stock/${encodeURIComponent(sku)}`;
  const ubicacion = String(fd.get("ubicacion") ?? "").trim() || null;
  const { error } = await (await createClient()).from("stock_productos").update({ ubicacion }).eq("sku", sku);
  if (error) volver(volverA, "error", error.message);
  revalidatePath("/stock");
  volver(volverA, "ok", "Ubicación actualizada");
}
