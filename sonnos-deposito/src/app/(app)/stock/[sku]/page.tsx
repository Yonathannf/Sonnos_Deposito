import Link from "next/link";
import { notFound } from "next/navigation";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Titulo, botonSec, card } from "@/components/ui";
import { fmtFecha } from "@/lib/util";
import { Flash, boton, input } from "@/components/ui";
import { editarMinimo, editarUbicacion } from "../actions";

const DEPOS: [string, string, string | null][] = [
  ["Local Ramos", "fisico_ramos", "disp_ramos"], ["MayoGym", "fisico_mayogym", "disp_mayogym"], ["Central RM", "fisico_central", "disp_central"],
  ["FULL", "fisico_full", "disp_full"], ["Mármol", "fisico_marmol", "disp_marmol"], ["Outlet", "fisico_outlet", "disp_outlet"],
  ["Discontinuo", "fisico_discontinuo", "disp_discontinuo"], ["Compras", "fisico_compras", "disp_compras"],
  ["Anticipada", "fisico_anticipada", "disp_anticipada"], ["Showroom (C)", "fisico_showroom", null],
];

export default async function StockSku({ params, searchParams }: { params: Promise<{ sku: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const ses = await requierePanel("stock", "ver");
  const sku = decodeURIComponent((await params).sku);
  const sp = await searchParams;
  const puedeEditar = ses.niveles.stock === "editar";
  const supabase = await createClient();
  const [{ data: p }, { data: hist }, { data: movs }] = await Promise.all([
    supabase.from("stock_calc").select("*").eq("sku", sku).maybeSingle(),
    supabase.from("stock_historial").select("fecha, stk").eq("sku", sku).order("fecha", { ascending: false }).limit(60),
    supabase.from("stock_movimientos").select("id, fecha, tipo, cantidad, usuario_nombre, observaciones, incorporado_en").eq("sku", sku).order("id", { ascending: false }).limit(30),
  ]);
  if (!p) notFound();
  const serie = (hist ?? []).slice().reverse();
  const max = Math.max(1, ...serie.map((h) => h.stk), p.minimo ?? 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Titulo extra={<Link href="/stock" className={botonSec}>← Stock</Link>}>{p.sku}</Titulo>
      <div className={card}>
        <p className="text-lg font-semibold">{p.descripcion}</p>
        <p className="text-sm text-slate-500">{[p.categoria, p.subcategoria, p.marca].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span>Stock actual <b className="text-lg">{p.stock_actual}</b>{p.ajuste_local ? <span className="text-blue-700"> (ERP {p.stk} + {p.ajuste_local} recibido)</span> : null}</span><span>Disponible <b>{p.astk}</b></span>
          <span>Mínimo <b>{p.minimo ?? "—"}</b></span><Badge>{p.estado}</Badge>
          <span className="text-slate-500">Actualizado {fmtFecha(p.actualizado_en)}</span>
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      {puedeEditar && (
        <div className={`${card} grid gap-3 sm:grid-cols-2`}>
          <form action={editarMinimo} className="flex items-end gap-2">
            <input type="hidden" name="sku" value={p.sku} /><input type="hidden" name="volver" value={`/stock/${encodeURIComponent(p.sku)}`} />
            <label className="flex-1 text-sm">Stock mínimo<input name="minimo" defaultValue={p.minimo ?? ""} inputMode="numeric" className={input} /></label><button className={boton}>Guardar</button>
          </form>
          <form action={editarUbicacion} className="flex items-end gap-2">
            <input type="hidden" name="sku" value={p.sku} />
            <label className="flex-1 text-sm">Ubicación física<input name="ubicacion" defaultValue={p.ubicacion ?? ""} placeholder="Ej: A-03-2" className={input} /></label><button className={boton}>Guardar</button>
          </form>
        </div>
      )}
      {!puedeEditar && p.ubicacion && <p className="text-sm">Ubicación: <b>{p.ubicacion}</b></p>}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Depósito</th><th className="p-3 text-right">Físico</th><th className="p-3 text-right">Disponible</th></tr></thead>
          <tbody>
            {DEPOS.map(([n, f, d]) => (
              <tr key={n} className="border-t border-slate-100"><td className="p-3">{n}</td>
                <td className="p-3 text-right">{(p as Record<string, number | null>)[f] ?? 0}</td>
                <td className="p-3 text-right">{d ? ((p as Record<string, number | null>)[d] ?? 0) : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={card}>
        <h2 className="mb-3 font-semibold">Evolución del stock (fotos diarias)</h2>
        {serie.length ? (
          <div className="flex h-36 items-end gap-1 overflow-x-auto">
            {serie.map((h) => (
              <div key={h.fecha} title={`${fmtFecha(h.fecha)}: ${h.stk}`} className="flex min-w-3 flex-1 items-end">
                <div className={`w-full rounded-t ${p.minimo != null && h.stk < p.minimo ? "bg-red-500" : "bg-slate-800"}`} style={{ height: `${Math.max(2, (h.stk / max) * 100)}%` }} />
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Se arma con cada importación, solo para productos en seguimiento.</p>}
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <h2 className="border-b border-slate-100 p-3 font-semibold">Historial de movimientos</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {movs?.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="p-3 whitespace-nowrap">{fmtFecha(m.fecha)}</td><td className="p-3 capitalize">{m.tipo}</td>
                <td className="p-3 font-semibold">+{m.cantidad}</td><td className="p-3">{m.usuario_nombre}</td>
                <td className="p-3 text-slate-500">{m.observaciones}</td>
                <td className="p-3 text-xs text-slate-500">{m.incorporado_en ? "ya figura en el ERP" : "pendiente de reflejar en el ERP"}</td>
              </tr>
            ))}
            {!movs?.length && <tr><td className="p-4 text-center text-slate-500">Sin movimientos registrados en el sistema (las recepciones confirmadas aparecen acá).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
