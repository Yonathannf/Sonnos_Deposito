import Link from "next/link";
import { notFound } from "next/navigation";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { ScannerInput } from "@/components/ScannerInput";
import { fmtFecha } from "@/lib/util";
import { FotoUploader } from "../FotoUploader";
import { borrarItem, confirmar, eliminarRecepcion, guardarItem } from "../actions";

export default async function RecepcionDetalle({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requierePanel("recepcion", "ver");
  const { id } = await params; const sp = await searchParams;
  const supabase = await createClient();
  const { data: r } = await supabase.from("recepciones").select("*").eq("id", Number(id)).maybeSingle();
  if (!r) notFound();
  const [{ data: items }, { data: fotos }] = await Promise.all([
    supabase.from("recepcion_items").select("*").eq("recepcion_id", r.id).order("id"),
    supabase.from("recepcion_fotos").select("id, path, nombre").eq("recepcion_id", r.id).order("id"),
  ]);
  const firmadas = fotos?.length ? (await supabase.storage.from("recepciones").createSignedUrls(fotos.map((f) => f.path), 3600)).data ?? [] : [];
  const borrador = r.estado === "Borrador";
  const edita = borrador && s.niveles.recepcion === "editar";
  const puedeFoto = s.niveles.recepcion === "editar";
  const tot = (items ?? []).reduce((a, i) => ({ esp: a.esp + i.esperado, rec: a.rec + i.recibido, dan: a.dan + i.danado }), { esp: 0, rec: 0, dan: 0 });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo extra={<Link href="/recepcion" className={botonSec}>← Recepciones</Link>}>{r.proveedor} · {r.nro_remito}</Titulo>
      <p className="text-sm text-slate-500">{fmtFecha(r.fecha)} · <Badge>{borrador ? "Pendiente" : "Finalizada"}</Badge> {borrador ? "Borrador (aún no suma al stock)" : `Confirmada${r.con_diferencias ? " con diferencias" : ""}`}</p>
      <Flash ok={sp.ok} error={sp.error} />

      {edita && (
        <form action={guardarItem} className={`${card} grid gap-3 sm:grid-cols-6`}>
          <input type="hidden" name="recepcion_id" value={r.id} />
          <div className="sm:col-span-6"><label className="text-sm">Código del artículo (escaneá o escribí)</label><ScannerInput name="sku" className={input} autoFocus /></div>
          <label className="text-sm">Esperado<input name="esperado" defaultValue="0" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Recibido<input name="recibido" required inputMode="numeric" className={input} /></label>
          <label className="text-sm">Dañado<input name="danado" defaultValue="0" inputMode="numeric" className={input} /></label>
          <label className="text-sm">Ubicación<input name="ubicacion" placeholder="Ej: A-03-2" className={input} /></label>
          <label className="text-sm sm:col-span-2">Observaciones<input name="observaciones" placeholder="Obligatorio si hay diferencia o daño" className={input} /></label>
          <button className={`${boton} sm:col-span-6`}>Agregar / actualizar artículo</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Código</th><th className="p-3">Descripción</th><th className="p-3 text-right">Esperado</th><th className="p-3 text-right">Recibido</th><th className="p-3 text-right">Dañado</th><th className="p-3">Ubicación</th><th className="p-3">Observaciones</th>{edita && <th className="p-3" />}</tr></thead>
          <tbody>
            {items?.map((i) => {
              const dif = i.recibido !== i.esperado || i.danado > 0;
              return (
                <tr key={i.id} className={`border-t border-slate-100 ${dif ? "bg-amber-50" : ""}`}>
                  <td className="p-3 font-semibold">{i.sku}</td><td className="p-3">{i.descripcion}</td>
                  <td className="p-3 text-right">{i.esperado}</td><td className="p-3 text-right font-semibold">{i.recibido}</td><td className="p-3 text-right">{i.danado || "—"}</td>
                  <td className="p-3">{i.ubicacion ?? "—"}</td><td className="p-3">{i.observaciones ?? ""}</td>
                  {edita && <td className="p-3"><form action={borrarItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="recepcion_id" value={r.id} /><button className="text-xs text-red-700 underline">Quitar</button></form></td>}
                </tr>
              );
            })}
            {items?.length ? <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold"><td className="p-3" colSpan={2}>Totales</td><td className="p-3 text-right">{tot.esp}</td><td className="p-3 text-right">{tot.rec}</td><td className="p-3 text-right">{tot.dan}</td><td colSpan={edita ? 3 : 2} /></tr>
              : <tr><td colSpan={8} className="p-6 text-center text-slate-500">Sin artículos cargados.</td></tr>}
          </tbody>
        </table>
      </div>

      {edita && (items?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3">
          <form action={confirmar}><input type="hidden" name="id" value={r.id} /><button className={boton}>Confirmar recepción y sumar al stock</button></form>
          <form action={eliminarRecepcion}><input type="hidden" name="id" value={r.id} /><button className="h-11 rounded-lg border border-red-300 px-4 font-medium text-red-700 hover:bg-red-50">Eliminar borrador</button></form>
        </div>
      )}

      <div className={`${card} space-y-3`}>
        <h2 className="font-semibold">Fotos y documentación</h2>
        {puedeFoto && <FotoUploader recepcionId={r.id} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {firmadas.map((f, idx) => f.signedUrl && (
            <a key={idx} href={f.signedUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.signedUrl} alt={fotos?.[idx]?.nombre ?? "Foto"} className="aspect-square w-full rounded-lg object-cover" />
            </a>
          ))}
          {!fotos?.length && <p className="col-span-full text-sm text-slate-500">Sin fotos.</p>}
        </div>
      </div>
    </div>
  );
}
