"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const schema = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre del transporte").max(150),
  direccion: z.string().nullable(), localidad: z.string().nullable(), observacion: z.string().nullable(),
});
const leer = (fd: FormData) => schema.safeParse({
  nombre: fd.get("nombre") ?? "", direccion: s(fd.get("direccion")), localidad: s(fd.get("localidad")), observacion: s(fd.get("observacion")),
});
const dup = (m: string) => (m.includes("duplicate") || m.includes("unique") ? "Ya existe un transporte con ese nombre" : m);

export async function crearTransporte(fd: FormData) {
  await requierePanel("transportes", "editar");
  const p = leer(fd);
  if (!p.success) volver("/transportes", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("transportes").insert(p.data);
  if (error) volver("/transportes", "error", dup(error.message));
  revalidatePath("/transportes");
  volver("/transportes", "ok", "Transporte creado");
}
export async function actualizarTransporte(fd: FormData) {
  await requierePanel("transportes", "editar");
  const id = n(fd.get("id"));
  const p = leer(fd);
  if (!id) volver("/transportes", "error", "Transporte inválido");
  if (!p.success) volver("/transportes", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("transportes").update(p.data).eq("id", id);
  if (error) volver("/transportes", "error", dup(error.message));
  revalidatePath("/transportes");
  volver(`/transportes?q=${encodeURIComponent(p.data.nombre)}`, "ok", "Transporte actualizado");
}
