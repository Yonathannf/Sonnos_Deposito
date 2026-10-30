import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const fmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "medium",
});

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; q?: string }>;
}) {
  await requierePanel("historial", "ver");
  const { entidad, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("registro_auditoria")
    .select("id, fecha, usuario_nombre, entidad, entidad_id, accion, campo, valor_anterior, valor_nuevo, descripcion")
    .order("fecha", { ascending: false })
    .limit(200);
  if (entidad) query = query.eq("entidad", entidad);
  if (q) query = query.ilike("usuario_nombre", `%${q.replace(/[%,]/g, "")}%`);
  const { data: filas } = await query;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold">Historial de cambios</h1>
      <form className="flex flex-wrap gap-2">
        <input name="entidad" defaultValue={entidad} placeholder="Entidad (ej. perfiles)" className="h-11 rounded-lg border border-slate-300 px-3" />
        <input name="q" defaultValue={q} placeholder="Usuario" className="h-11 rounded-lg border border-slate-300 px-3" />
        <button className="h-11 rounded-lg bg-slate-900 px-5 font-semibold text-white">Filtrar</button>
      </form>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Acción</th><th className="px-3 py-2">Entidad</th><th className="px-3 py-2">Detalle</th></tr>
          </thead>
          <tbody>
            {filas?.map((f) => (
              <tr key={f.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2">{fmt.format(new Date(f.fecha))}</td>
                <td className="px-3 py-2">{f.usuario_nombre ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{f.accion}</td>
                <td className="px-3 py-2">{f.entidad} <span className="text-slate-400">#{f.entidad_id}</span></td>
                <td className="px-3 py-2 break-words">
                  {f.campo ? <>{f.campo}: <s className="text-slate-400">{f.valor_anterior ?? "∅"}</s> → <b>{f.valor_nuevo ?? "∅"}</b></> : f.descripcion}
                </td>
              </tr>
            ))}
            {!filas?.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
