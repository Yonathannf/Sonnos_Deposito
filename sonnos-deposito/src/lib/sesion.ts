import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PANELES, alcanza, type Nivel } from "@/lib/permisos";

export type Sesion = {
  id: string;
  email: string;
  nombre: string;
  rolCodigo: string;
  rolNombre: string;
  superusuario: boolean;
  niveles: Record<string, Nivel>;
};

// Una sola carga por request (React cache). El nivel efectivo lo calcula la BD (nivel_panel),
// la misma función que usan las policies RLS, así UI y base nunca se contradicen.
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, activo, superusuario, roles(codigo, nombre)")
    .eq("id", user.id)
    .single();
  if (!perfil || !perfil.activo) return null;

  const rol = perfil.roles as unknown as { codigo: string; nombre: string };
  const niveles: Record<string, Nivel> = {};
  await Promise.all(
    PANELES.map(async (p) => {
      const { data } = await supabase.rpc("nivel_panel", { p_panel: p.codigo });
      niveles[p.codigo] = (data as Nivel) ?? "sin_acceso";
    }),
  );

  return {
    id: user.id,
    email: user.email ?? "",
    nombre: perfil.nombre,
    rolCodigo: rol.codigo,
    rolNombre: rol.nombre,
    superusuario: perfil.superusuario,
    niveles,
  };
});

export async function requiereSesion() {
  const s = await getSesion();
  if (!s) redirect("/login");
  return s;
}

// Para páginas y Server Actions: corta si el usuario no alcanza el nivel pedido.
export async function requierePanel(panel: string, minimo: Nivel = "ver") {
  const s = await requiereSesion();
  if (!alcanza(s.niveles[panel] ?? "sin_acceso", minimo)) redirect("/?sin_permiso=1");
  return s;
}
