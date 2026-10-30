import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { actualizarUsuario, crearUsuario, resetearPassword } from "./actions";

const input = "h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-900";
const boton = "h-11 rounded-lg bg-slate-900 px-5 font-semibold text-white hover:bg-slate-700";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const s = await requierePanel("usuarios", "ver");
  const puedeEditar = s.niveles.usuarios === "editar";
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const [{ data: roles }, { data: perfiles }] = await Promise.all([
    supabase.from("roles").select("id, nombre").order("id"),
    supabase.from("perfiles").select("id, nombre, email, rol_id, activo, superusuario").order("nombre"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Link href="/usuarios/permisos" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100">
          Ver matriz de permisos
        </Link>
      </div>

      {ok && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {puedeEditar && (
        <form action={crearUsuario} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          <h2 className="font-semibold sm:col-span-2 lg:col-span-5">Nuevo usuario</h2>
          <input name="nombre" placeholder="Nombre y apellido" required className={input} />
          <input name="email" type="email" placeholder="Email" required className={input} />
          <input name="password" type="password" placeholder="Contraseña (mín. 8)" minLength={8} required className={input} autoComplete="new-password" />
          <select name="rol_id" required defaultValue="" className={input}>
            <option value="" disabled>Rol…</option>
            {roles?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <button className={boton}>Crear</button>
        </form>
      )}

      <div className="space-y-3">
        {perfiles?.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <form action={actualizarUsuario} className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1fr_auto_auto]">
              <input type="hidden" name="id" value={p.id} />
              <input name="nombre" defaultValue={p.nombre} disabled={!puedeEditar} className={input} aria-label="Nombre" />
              <span className="truncate text-sm text-slate-500">{p.email}{p.superusuario && <b className="ml-2 text-slate-900">superusuario</b>}</span>
              <select name="rol_id" defaultValue={p.rol_id} disabled={!puedeEditar} className={input} aria-label="Rol">
                {roles?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="activo" defaultChecked={p.activo} disabled={!puedeEditar} className="size-5" /> Activo
              </label>
              {puedeEditar && <button className={boton}>Guardar</button>}
            </form>
            {puedeEditar && (
              <form action={resetearPassword} className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="id" value={p.id} />
                <input name="password" type="password" placeholder="Nueva contraseña (mín. 8)" minLength={8} required autoComplete="new-password" className={`${input} max-w-xs`} />
                <button className="h-11 rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100">Restablecer contraseña</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
