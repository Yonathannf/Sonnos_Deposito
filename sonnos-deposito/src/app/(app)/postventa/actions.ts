"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s, hoy } from "@/lib/util";

const f = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable();
const schema = z.object({
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de ingreso inválida"),
  estado: z.enum(["Pendiente", "En curso", "Hecho", "Cancelada"]),
  cliente_id: z.number().int().positive().nullable(),
  telefono: z.string().nullable(), gimnasio: z.string().nullable(), localidad: z.string().nullable(), provincia: z.string().nullable(),
  garantia: z.boolean().nullable(),
  diagnostico: z.string().nullable(), intervencion: z.string().nullable(), resolucion: z.string().nullable(), observaciones: z.string().nullable(),
  presupuesto: z.number().min(0, "El presupuesto no puede ser negativo").nullable(),
  fecha_solicitud_sector: f, visita_pactada: f, fecha_comunicacion_cliente: f, ultimo_contacto: f,
  vendedor: z.string().nullable(), colaboradores: z.string().nullable(), formato_entrega: z.string().nullable(),
});
function leer(fd: FormData) {
  const g = fd.get("garantia");
  return schema.safeParse({
    fecha_ingreso: s(fd.get("fecha_ingreso")) ?? hoy(), estado: fd.get("estado") ?? "Pendiente", cliente_id: n(fd.get("cliente_id")),
    telefono: s(fd.get("telefono")), gimnasio: s(fd.get("gimnasio")), localidad: s(fd.get("localidad")), provincia: s(fd.get("provincia")),
    garantia: g === "si" ? true : g === "no" ? false : null,
    diagnostico: s(fd.get("diagnostico")), intervencion: s(fd.get("intervencion")), resolucion: s(fd.get("resolucion")), observaciones: s(fd.get("observaciones")),
    presupuesto: n(fd.get("presupuesto")),
    fecha_solicitud_sector: s(fd.get("fecha_solicitud_sector")), visita_pactada: s(fd.get("visita_pactada")),
    fecha_comunicacion_cliente: s(fd.get("fecha_comunicacion_cliente")), ultimo_contacto: s(fd.get("ultimo_contacto")),
    vendedor: s(fd.get("vendedor")), colaboradores: s(fd.get("colaboradores")), formato_entrega: s(fd.get("formato_entrega")),
  });
}
function reglas(d: z.infer<typeof schema>) {
  if (!d.gimnasio && !d.cliente_id) return "Indicá el cliente o el gimnasio";
  if (d.estado === "Hecho" && !d.resolucion) return "Para marcar el service como hecho cargá la resolución";
  return null;
}

export async function crearService(fd: FormData) {
  await requierePanel("postventa", "editar");
  const p = leer(fd);
  if (!p.success) volver("/postventa", "error", p.error.issues[0].message);
  const e = reglas(p.data); if (e) volver("/postventa", "error", e);
  const { error } = await (await createClient()).from("services").insert(p.data);
  if (error) volver("/postventa", "error", error.message);
  revalidatePath("/postventa");
  volver("/postventa", "ok", "Service registrado");
}

export async function actualizarService(fd: FormData) {
  await requierePanel("postventa", "editar");
  const id = n(fd.get("id")); const p = leer(fd);
  if (!id) volver("/postventa", "error", "Service inválido");
  if (!p.success) volver("/postventa", "error", p.error.issues[0].message);
  const e = reglas(p.data); if (e) volver("/postventa", "error", e);
  const { error } = await (await createClient()).from("services").update(p.data).eq("id", id);
  if (error) volver("/postventa", "error", error.message);
  revalidatePath("/postventa");
  volver("/postventa", "ok", "Service actualizado");
}
