"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const crearSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol_id: z.coerce.number().int().positive("Elegí un rol"),
});

function volver(tipo: "ok" | "error", msg: string): never {
  redirect(`/usuarios?${tipo}=${encodeURIComponent(msg)}`);
}

export async function crearUsuario(formData: FormData) {
  await requierePanel("usuarios", "editar");
  const parsed = crearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) volver("error", parsed.error.issues[0].message);
  const { nombre, email, password, rol_id } = parsed.data;

  const admin = createAdminClient();
  const { data: creado, error: e1 } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (e1 || !creado.user) volver("error", e1?.message ?? "No se pudo crear el usuario");

  // El perfil se inserta con la sesión del usuario que opera (RLS + trigger de auditoría).
  const supabase = await createClient();
  const { error: e2 } = await supabase
    .from("perfiles")
    .insert({ id: creado.user.id, nombre, email, rol_id });
  if (e2) {
    await admin.auth.admin.deleteUser(creado.user.id); // rollback
    volver("error", e2.message);
  }
  revalidatePath("/usuarios");
  volver("ok", `Usuario ${nombre} creado`);
}

const editarSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().trim().min(2),
  rol_id: z.coerce.number().int().positive(),
});

export async function actualizarUsuario(formData: FormData) {
  const yo = await requierePanel("usuarios", "editar");
  const parsed = editarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) volver("error", "Datos inválidos");
  const activo = formData.get("activo") === "on";
  if (parsed.data.id === yo.id && !activo) volver("error", "No podés desactivar tu propio usuario");

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({ nombre: parsed.data.nombre, rol_id: parsed.data.rol_id, activo })
    .eq("id", parsed.data.id);
  if (error) volver("error", error.message);
  revalidatePath("/usuarios");
  volver("ok", "Usuario actualizado");
}

export async function resetearPassword(formData: FormData) {
  await requierePanel("usuarios", "editar");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres")
    .safeParse(formData.get("password"));
  if (!id.success) volver("error", "Usuario inválido");
  if (!password.success) volver("error", password.error.issues[0].message);

  // Verifica por RLS que el operador puede ver/editar ese perfil (y el trigger protege superusuarios).
  const supabase = await createClient();
  const { data: perfil } = await supabase.from("perfiles").select("id, superusuario").eq("id", id.data).single();
  if (!perfil) volver("error", "Usuario no encontrado");
  const { data: yo } = await supabase.rpc("es_superusuario");
  if (perfil.superusuario && !yo) volver("error", "Solo un superusuario puede cambiar esa contraseña");

  const { error } = await createAdminClient().auth.admin.updateUserById(id.data, { password: password.data });
  if (error) volver("error", error.message);
  await supabase.rpc("registrar_auditoria", {
    p_entidad: "perfiles", p_entidad_id: id.data, p_accion: "otro", p_descripcion: "Contraseña restablecida",
  });
  volver("ok", "Contraseña actualizada");
}
