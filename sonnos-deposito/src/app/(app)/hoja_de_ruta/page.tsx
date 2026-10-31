import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { fmtFecha, hoy } from "@/lib/util";
import { entregarTodos, guardarRuta, marcarEntregado } from "./actions";

type Ped = {
  id: number; nro_pedido: string | null; estado: string; bultos: number | null; pallets: number | null; cobrar: number | null;
  clientes: { nombre: string; localidad: string | null } | null; transportes: { nombre: string } | null;
};

export default async function HojaDeRuta({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("hoja_de_ruta", "ver");
  const puedeEditar = s.niveles.hoja_de_ruta === "editar";
  const sp = await searchParams;
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy();
  const supabase = await createClient();

  const [{ data: ruta }, { data: choferes }, { data: pedidos }] = await Promise.all([
    supabase.from("rutas").select("*, chofer:choferes!rutas_chofer_id_fkey(nombre), acompanante:choferes!rutas_acompanante_id_fkey(nombre)").eq("fecha", fecha).maybeSingle(),
    supabase.from("choferes").select("id, nombre").order("nombre"),
    supabase.from("pedidos").select("id, nro_pedido, estado, bultos, pallets, cobrar, clientes(nombre, localidad), transportes(nombre)")
      .eq("dia_a_despachar", fecha).order("id"),
  ]);
  const lista = (pedidos ?? []) as unknown as Ped[];
  const grupos = new Map<string, Ped[]>();
  for (const p of lista) {
    const k = p.transportes?.nombre ?? "Sin transporte definido";
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const tot = lista.reduce((a, p) => ({ bultos: a.bultos + (p.bultos ?? 0), pallets: a.pallets + (p.pallets ?? 0), cobrar: a.cobrar + (p.cobrar ?? 0) }), { bultos: 0, pallets: 0, cobrar: 0 });
  const pendientes = lista.filter((p) => p.estado === "Impreso").length;
  const armados = lista.filter((p) => p.estado === "Armado").length;
  const r = ruta as unknown as { chofer_id: number | null; acompanante_id: number | null; hora_salida: string | null; hora_regreso: string | null; chofer: { nombre: string } | null; acompanante: { nombre: string } | null } | null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo extra={<PrintButton className={`${botonSec} print:hidden`} />}>Hoja de ruta · {fmtFecha(fecha)}</Titulo>
      <div className="print:hidden"><Flash ok={sp.ok} error={sp.error} /></div>

      <form className="flex gap-2 print:hidden">
        <input type="date" name="fecha" defaultValue={fecha} className={input} />
        <button className={boton}>Ver día</button>
      </form>

      <form action={guardarRuta} className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <input type="hidden" name="fecha" value={fecha} />
        <div className="hidden print:block lg:col-span-4">
          <b>Chofer:</b> {r?.chofer?.nombre ?? "—"} · <b>Acompañante:</b> {r?.acompanante?.nombre ?? "—"} · <b>Salida:</b> {r?.hora_salida ?? "—"} · <b>Regreso:</b> {r?.hora_regreso ?? "—"}
        </div>
        <div className="space-y-2 print:hidden">
          <label className="text-sm">Chofer
            <select name="chofer_id" defaultValue={r?.chofer_id ?? ""} disabled={!puedeEditar} className={input}>
              <option value="">—</option>{choferes?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
          {puedeEditar && <input name="chofer_nuevo" placeholder="o cargar uno nuevo" className={input} />}
        </div>
        <div className="space-y-2 print:hidden">
          <label className="text-sm">Acompañante
            <select name="acompanante_id" defaultValue={r?.acompanante_id ?? ""} disabled={!puedeEditar} className={input}>
              <option value="">—</option>{choferes?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
          {puedeEditar && <input name="acompanante_nuevo" placeholder="o cargar uno nuevo" className={input} />}
        </div>
        <label className="text-sm print:hidden">Hora de salida<input type="time" name="hora_salida" defaultValue={r?.hora_salida ?? ""} disabled={!puedeEditar} className={input} /></label>
        <label className="text-sm print:hidden">Hora de regreso<input type="time" name="hora_regreso" defaultValue={r?.hora_regreso ?? ""} disabled={!puedeEditar} className={input} /></label>
        {puedeEditar && <button className={`${boton} sm:col-span-2 lg:col-span-4 print:hidden`}>Guardar hoja de ruta</button>}
      </form>

      <div className={`${card} flex flex-wrap items-center gap-x-6 gap-y-1 text-sm`}>
        <span><b>{lista.length}</b> pedidos</span>
        <span><b>{tot.bultos}</b> bultos</span>
        <span><b>{tot.pallets}</b> pallets</span>
        <span>A cobrar: <b>${tot.cobrar.toLocaleString("es-AR")}</b></span>
        {pendientes > 0 && <span className="font-semibold text-amber-700">⚠ {pendientes} sin armar</span>}
        {puedeEditar && armados > 0 && (
          <form action={entregarTodos} className="ml-auto print:hidden">
            <input type="hidden" name="fecha" value={fecha} />
            <button className={boton}>Marcar {armados} armados como entregados</button>
          </form>
        )}
      </div>

      {[...grupos.entries()].map(([transporte, items]) => (
        <section key={transporte} className="break-inside-avoid overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 font-bold">{transporte} <span className="font-normal text-slate-500">· {items.length} pedidos</span></h2>
          <table className="w-full min-w-[620px] text-left text-sm">
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{p.nro_pedido}</td>
                  <td className="p-3">{p.clientes?.nombre}<span className="text-slate-400"> · {p.clientes?.localidad ?? ""}</span></td>
                  <td className="p-3">{p.bultos ?? "—"} bultos{p.pallets ? ` · ${p.pallets} pall.` : ""}</td>
                  <td className="p-3">{p.cobrar ? `$${p.cobrar.toLocaleString("es-AR")}` : ""}</td>
                  <td className="p-3"><Badge>{p.estado}</Badge></td>
                  <td className="p-3 print:hidden">
                    {puedeEditar && p.estado === "Armado" && (
                      <form action={marcarEntregado}>
                        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="fecha" value={fecha} />
                        <button className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100">Entregado</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {!lista.length && <p className={`${card} text-center text-slate-500`}>No hay pedidos para despachar ese día.</p>}
    </div>
  );
}
