import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { hoy } from "@/lib/util";
import { crearPedido } from "../actions";

export default async function NuevoPedido({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cliente?: string; ok?: string; error?: string }>;
}) {
  await requierePanel("pedidos", "editar");
  const sp = await searchParams;
  const supabase = await createClient();

  const cliente = sp.cliente
    ? (await supabase.from("clientes").select("id, nombre, numero_cliente, localidad, provincia, transporte_habitual_id").eq("id", Number(sp.cliente)).maybeSingle()).data
    : null;

  let resultados: { id: number; nombre: string; numero_cliente: number | null; localidad: string | null }[] = [];
  if (!cliente && sp.q) {
    const t = sp.q.replace(/[%,()]/g, " ").trim();
    const { data } = await supabase.from("clientes").select("id, nombre, numero_cliente, localidad")
      .or(`nombre.ilike.%${t}%,numero_cliente.eq.${Number(t) || -1}`).order("nombre").limit(30);
    resultados = data ?? [];
  }
  const { data: transportes } = cliente
    ? await supabase.from("transportes").select("id, nombre").order("nombre")
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Titulo extra={<Link href="/pedidos" className={botonSec}>← Pedidos</Link>}>Nuevo pedido</Titulo>
      <Flash ok={sp.ok} error={sp.error} />

      {!cliente && (
        <div className={`${card} space-y-3`}>
          <h2 className="font-semibold">1. Buscá el cliente</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={sp.q} placeholder="Nombre o número de cliente" autoFocus className={input} />
            <button className={boton}>Buscar</button>
          </form>
          <ul className="divide-y divide-slate-100">
            {resultados.map((c) => (
              <li key={c.id}>
                <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="flex min-h-12 items-center justify-between gap-3 px-1 py-2 hover:bg-slate-50">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-sm text-slate-500">{c.numero_cliente ?? "s/n"} · {c.localidad ?? ""}</span>
                </Link>
              </li>
            ))}
            {sp.q && !resultados.length && <li className="py-3 text-sm text-slate-500">Sin resultados. Podés crearlo en Clientes.</li>}
          </ul>
        </div>
      )}

      {cliente && (
        <form action={crearPedido} className={`${card} grid gap-3 sm:grid-cols-2`}>
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-500">Cliente</p>
            <p className="text-lg font-semibold">{cliente.nombre} <span className="text-slate-400">· {cliente.numero_cliente ?? "s/n"} · {cliente.localidad}</span></p>
            <Link href="/pedidos/nuevo" className="text-sm underline">Cambiar cliente</Link>
          </div>
          <label className="text-sm">Nº de pedido<input name="nro_pedido" required className={input} autoFocus /></label>
          <label className="text-sm">Fecha del pedido<input type="date" name="fecha_impreso" defaultValue={hoy()} className={input} /></label>
          <label className="text-sm">Día a despachar<input type="date" name="dia_a_despachar" className={input} /></label>
          <label className="text-sm">Transporte
            <select name="transporte_id" defaultValue={cliente.transporte_habitual_id ?? ""} className={input}>
              <option value="">— Sin definir —</option>
              {transportes?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">A cobrar ($)<input name="cobrar" inputMode="decimal" className={input} /></label>
          <label className="text-sm sm:col-span-2">Comentarios<textarea name="comentarios" rows={2} className={`${input} h-auto py-2`} /></label>
          <button className={`${boton} sm:col-span-2`}>Cargar pedido</button>
        </form>
      )}
    </div>
  );
}
