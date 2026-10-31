"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { volver, n, s } from "@/lib/util";

const schema = z.object({
  titulo: z.string().trim().min(3, "Escribí qué hay que hacer (mín. 3 letras)").max(200),
  descripcion: z.string().nullable(), sector: z.string().nullable(),
  prioridad: z.enum(["Alta", "Media", "Baja"]),
  operario_id: z.number().int().positive().nullable(),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha límite inválida").nullable(),
});

export async function crearTarea(fd: FormData) {
  await requierePanel("tareas", "editar");
  const p = schema.safeParse({
    titulo: fd.get("titulo") ?? "", descripcion: s(fd.get("descripcion")), sector: s(fd.get("sector")),
    prioridad: fd.get("prioridad") ?? "Media", operario_id: n(fd.get("operario_id")), fecha_limite: s(fd.get("fecha_limite")),
  });
  if (!p.success) volver("/tareas", "error", p.error.issues[0].message);
  const { error } = await (await createClient()).from("tareas").insert(p.data);
  if (error) volver("/tareas", "error", error.message);
  revalidatePath("/tareas");
  volver("/tareas", "ok", "Tarea creada");
}

export async function cambiarEstado(fd: FormData) {
  await requierePanel("tareas", "editar");
  const estado = String(fd.get("estado") ?? "");
  if (!["En curso", "Finalizada", "Cancelada"].includes(estado)) volver("/tareas", "error", "Estado inválido");
  const { error } = await (await createClient()).from("tareas").update({ estado }).eq("id", n(fd.get("id")));
  if (error) volver("/tareas", "error", error.message);
  revalidatePath("/tareas");
  volver("/tareas", "ok", estado === "En curso" ? "Tarea iniciada: corre el tiempo" : estado === "Finalizada" ? "Tarea finalizada" : "Tarea cancelada");
}

export async function reasignar(fd: FormData) {
  await requierePanel("tareas", "editar");
  const { error } = await (await createClient()).from("tareas")
    .update({ operario_id: n(fd.get("operario_id")), prioridad: String(fd.get("prioridad") ?? "Media"), fecha_limite: s(fd.get("fecha_limite")) })
    .eq("id", n(fd.get("id")));
  if (error) volver("/tareas", "error", error.message);
  revalidatePath("/tareas");
  volver("/tareas", "ok", "Tarea actualizada");
}
