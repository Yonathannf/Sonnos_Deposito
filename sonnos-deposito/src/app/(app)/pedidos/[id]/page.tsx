import Link from "next/link";
import { notFound } from "next/navigation";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { fmtFecha } from "@/lib/util";
import { actualizarPedido, eliminarPedido } from "../actions";

export default async function PedidoDetalle({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const s = await requierePanel("pedidos", "ver");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: base } = await supabase.from("pedidos")
    .select("*, clientes(id, nombre, numero_cliente, direccion, localidad, provincia, contacto), transportes(nombre), operarios(nombre)")
    .eq("id", Number(id)).maybeSingle();
  if (!base) notFound();
  const { data: calc } = await supabase.from("pedidos_calc").select("cumple_plazo, fecha_estimada_despacho").eq("id", base.id).maybeSingle();
  const p = { ...base, cumple_plazo: calc?.cumple_plazo ?? null, fecha_estimada_despacho: calc?.fecha_estimada_despacho ?? null };
  const puedeEditar = s.niveles.pedidos === "editar";
  const { data: transportes } = puedeEditar ? await supabase.from("transportes").select("id, nombre").order("nombre") : { data: [] };
  const { data: armados } = await supabase.from("armados").select("id, fecha, fecha_finalizacion, tiempo_min, bultos").eq("pedido_id", p.id);
  const cl = p.clientes as { id: number; nombre: string; numero_cliente: number | null; direccion: string | null; localidad: string | null; provincia: string | null; contacto: string | null };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Titulo extra={<Link href="/pedidos" className={botonSec}>← Pedidos</Link>}>
        Pedido {p.nro_pedido} <span className="ml-2 align-middle"><Badge>{p.estado}</Badge></span>
      </Titulo>
      <Flash ok={sp.ok} error={sp.error} />

      <div className={`${card} grid gap-2 text-sm sm:grid-cols-2`}>
        <p><b>Cliente:</b> {cl.nombre} ({cl.numero_cliente ?? "s/n"})</p>
        <p><b>Dirección:</b> {[cl.direccion, cl.localidad, cl.provincia].filter(Boolean).join(", ") || "—"}</p>
        <p><b>Contacto:</b> {cl.contacto ?? "—"}</p>
        <p><b>Armó:</b> {(p.operarios as { nombre: string } | null)?.nombre ?? "—"} · fecha armado {fmtFecha(p.fecha_armado)}</p>
        <p><b>Bultos / pallets / carro:</b> {p.bultos ?? "—"} / {p.pallets ?? "—"} / {p.carro_cajon ?? "—"}</p>
        <p><b>Plazo:</b> <Badge>{p.cumple_plazo}</Badge> <span className="text-slate-500">(estimado {fmtFecha(p.fecha_estimada_despacho)})</span></p>
        {armados?.length ? <p className="sm:col-span-2"><b>Registro de armado:</b> {armados.map((a) => `${fmtFecha(a.fecha)} → ${fmtFecha(a.fecha_finalizacion)} (${a.tiempo_min ?? "?"} min)`).join(" · ")}</p> : null}
      </div>

      <form action={actualizarPedido} className={`${card} grid gap-3 sm:grid-cols-2`}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="cliente_id" value={cl.id} />
        <label className="text-sm">Nº de pedido<input name="nro_pedido" defaultValue={p.nro_pedido ?? ""} disabled={!puedeEditar} required className={input} /></label>
        <label className="text-sm">Fecha del pedido<input type="date" name="fecha_impreso" defaultValue={p.fecha_impreso ?? ""} disabled={!puedeEditar} className={input} /></label>
        <label className="text-sm">Día a despachar<input type="date" name="dia_a_despachar" defaultValue={p.dia_a_despachar ?? ""} disabled={!puedeEditar} className={input} /></label>
        <label className="text-sm">Transporte
          <select name="transporte_id" defaultValue={p.transporte_id ?? ""} disabled={!puedeEditar} className={input}>
            <option value="">— Sin definir —</option>
            {puedeEditar ? transportes?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)
              : p.transporte_id && <option value={p.transporte_id}>{(p.transportes as { nombre: string }).nombre}</option>}
          </select>
        </label>
        <label className="text-sm">A cobrar ($)<input name="cobrar" defaultValue={p.cobrar ?? ""} inputMode="decimal" disabled={!puedeEditar} className={input} /></label>
        <label className="text-sm sm:col-span-2">Comentarios<textarea name="comentarios" rows={2} defaultValue={p.comentarios ?? ""} disabled={!puedeEditar} className={`${input} h-auto py-2`} /></label>
        {puedeEditar && <button className={`${boton} sm:col-span-2`}>Guardar cambios</button>}
      </form>

      {puedeEditar && p.estado === "Impreso" && (
        <form action={eliminarPedido}>
          <input type="hidden" name="id" value={p.id} />
          <button className="h-11 rounded-lg border border-red-300 px-4 font-medium text-red-700 hover:bg-red-50">Eliminar pedido (aún no armado)</button>
        </form>
      )}
    </div>
  );
}
