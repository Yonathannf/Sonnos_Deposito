"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NIVELES, PANELES, type Nivel } from "@/lib/permisos";

export async function guardarPermisos(formData: FormData) {
  await requierePanel("usuarios", "editar");
  const supabase = await createClient();

  const [{ data: roles }, { data: actuales }] = await Promise.all([
    supabase.from("roles").select("id").eq("es_admin", false),
    supabase.from("permisos_rol").select("rol_id, panel, nivel"),
  ]);
  const hoy = new Map(actuales?.map((p) => [`${p.rol_id}:${p.panel}`, p.nivel as Nivel]));

  const cambios: { rol_id: number; panel: string; nivel: Nivel }[] = [];
  for (const r of roles ?? []) {
    for (const p of PANELES) {
      const clave = `${r.id}:${p.codigo}`;
      const nuevo = String(formData.get(clave) ?? "") as Nivel;
      if (!NIVELES.includes(nuevo)) continue;
      const previo = hoy.get(clave) ?? "sin_acceso"; // ausente = sin acceso
      if (nuevo !== previo) cambios.push({ rol_id: r.id, panel: p.codigo, nivel: nuevo });
    }
  }
  if (cambios.length) {
    const { error } = await supabase.from("permisos_rol").upsert(cambios, { onConflict: "rol_id,panel" });
    if (error) redirect(`/usuarios/permisos?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/usuarios/permisos");
  redirect(`/usuarios/permisos?ok=${encodeURIComponent(`${cambios.length} cambio(s) guardado(s)`)}`);
}
