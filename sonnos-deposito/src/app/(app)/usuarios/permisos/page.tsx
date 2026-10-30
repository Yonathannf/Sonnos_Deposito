import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NIVELES, NOMBRE_NIVEL, PANELES, type Nivel } from "@/lib/permisos";
import { guardarPermisos } from "./actions";

export default async function PermisosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const s = await requierePanel("usuarios", "ver");
  const puedeEditar = s.niveles.usuarios === "editar";
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const [{ data: roles }, { data: permisos }] = await Promise.all([
    supabase.from("roles").select("id, nombre, es_admin").order("id"),
    supabase.from("permisos_rol").select("rol_id, panel, nivel"),
  ]);
  const mapa = new Map(permisos?.map((p) => [`${p.rol_id}:${p.panel}`, p.nivel as Nivel]));
  const admins = roles?.filter((r) => r.es_admin) ?? [];
  const editables = roles?.filter((r) => !r.es_admin) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Matriz de permisos</h1>
        <Link href="/usuarios" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100">Volver a usuarios</Link>
      </div>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-500">
        {admins.map((a) => a.nombre).join(", ")} y los superusuarios tienen acceso total y no se editan acá.
        Un panel sin acceso no aparece en el menú ni se puede consultar.
      </p>

      <form action={guardarPermisos} className="space-y-4">
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-3">Panel</th>
                {editables.map((r) => <th key={r.id} className="px-4 py-3">{r.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {PANELES.map((p) => (
                <tr key={p.codigo} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{p.nombre}</td>
                  {editables.map((r) => (
                    <td key={r.id} className="px-4 py-2">
                      <select name={`${r.id}:${p.codigo}`} defaultValue={mapa.get(`${r.id}:${p.codigo}`) ?? "sin_acceso"}
                        disabled={!puedeEditar} className="h-10 w-full rounded-lg border border-slate-300 px-2">
                        {NIVELES.map((n) => <option key={n} value={n}>{NOMBRE_NIVEL[n]}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {puedeEditar && <button className="h-12 rounded-lg bg-slate-900 px-6 font-semibold text-white hover:bg-slate-700">Guardar cambios</button>}
      </form>
    </div>
  );
}
