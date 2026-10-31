"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const schema = z.object({
  numero_cliente: z.number().int().positive("Número de cliente inválido").nullable(),
  nombre: z.string().trim().min(2, "Ingresá el nombre del cliente").max(200),
  sede: z.string().nullable(),
  contacto: z.string().nullable(),
  direccion: z.string().nullable(),
  localidad: z.string().nullable(),
  provincia: z.string().nullable(),
  vendedor: z.string().nullable(),
  transporte_habitual_id: z.number().int().positive().nullable(),
});
function leer(fd: FormData) {
  return schema.safeParse({
    numero_cliente: n(fd.get("numero_cliente")), nombre: fd.get("nombre") ?? "", sede: s(fd.get("sede")),
    contacto: s(fd.get("contacto")), direccion: s(fd.get("direccion")), localidad: s(fd.get("localidad")),
    provincia: s(fd.get("provincia")), vendedor: s(fd.get("vendedor")), transporte_habitual_id: n(fd.get("transporte_habitual_id")),
  });
}
const dup = (m: string) => (m.includes("duplicate") || m.includes("unique") ? "Ya existe un cliente con ese nombre/sede" : m);

export async function crearCliente(fd: FormData) {
  await requierePanel("clientes", "editar");
  const p = leer(fd);
  if (!p.success) volver("/clientes", "error", p.error.issues[0].message);
  const texto_original = p.data.sede ? `${p.data.nombre} - ${p.data.sede}` : p.data.nombre;
  const { error } = await (await createClient()).from("clientes").insert({ ...p.data, texto_original });
  if (error) volver("/clientes", "error", dup(error.message));
  revalidatePath("/clientes");
  volver("/clientes", "ok", `Cliente ${p.data.nombre} creado`);
}

export async function actualizarCliente(fd: FormData) {
  await requierePanel("clientes", "editar");
  const id = n(fd.get("id"));
  const p = leer(fd);
  if (!id) volver("/clientes", "error", "Cliente inválido");
  if (!p.success) volver("/clientes", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("clientes").update(p.data).eq("id", id);
  if (error) volver("/clientes", "error", dup(error.message));
  revalidatePath("/clientes");
  volver(`/clientes?q=${encodeURIComponent(p.data.nombre)}`, "ok", "Cliente actualizado");
}
