import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Badge, Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { fmtFecha, hoy } from "@/lib/util";
import { actualizarService, crearService } from "./actions";

type Sv = Record<string, string | number | boolean | null>;
const ESTADOS = ["Pendiente", "En curso", "Hecho", "Cancelada"];

function Campos({ v, off }: { v?: Sv; off?: boolean }) {
  const t = (k: string) => (v?.[k] as string | null) ?? "";
  return (
    <>
      <label className="text-sm">Ingreso<input type="date" name="fecha_ingreso" defaultValue={t("fecha_ingreso") || hoy()} disabled={off} className={input} /></label>
      <label className="text-sm">Estado<select name="estado" defaultValue={t("estado") || "Pendiente"} disabled={off} className={input}>{ESTADOS.map((e) => <option key={e}>{e}</option>)}</select></label>
      <label className="text-sm">Gimnasio / cliente<input name="gimnasio" defaultValue={t("gimnasio")} disabled={off} className={input} /></label>
      <label className="text-sm">Teléfono<input name="telefono" defaultValue={t("telefono")} disabled={off} className={input} /></label>
      <label className="text-sm">Localidad<input name="localidad" defaultValue={t("localidad")} disabled={off} className={input} /></label>
      <label className="text-sm">Provincia<input name="provincia" defaultValue={t("provincia")} disabled={off} className={input} /></label>
      <label className="text-sm">Garantía<select name="garantia" defaultValue={v?.garantia === true ? "si" : v?.garantia === false ? "no" : ""} disabled={off} className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label className="text-sm">Presupuesto ($)<input name="presupuesto" defaultValue={t("presupuesto")} inputMode="decimal" disabled={off} className={input} /></label>
      <label className="text-sm sm:col-span-2">Diagnóstico<input name="diagnostico" defaultValue={t("diagnostico")} disabled={off} className={input} /></label>
      <label className="text-sm sm:col-span-2">Intervención<input name="intervencion" defaultValue={t("intervencion")} disabled={off} className={input} /></label>
      <label className="text-sm sm:col-span-2">Resolución<input name="resolucion" defaultValue={t("resolucion")} disabled={off} className={input} /></label>
      <label className="text-sm">Visita pactada<input type="date" name="visita_pactada" defaultValue={t("visita_pactada")} disabled={off} className={input} /></label>
      <label className="text-sm">Pedido al sector<input type="date" name="fecha_solicitud_sector" defaultValue={t("fecha_solicitud_sector")} disabled={off} className={input} /></label>
      <label className="text-sm">Comunicado al cliente<input type="date" name="fecha_comunicacion_cliente" defaultValue={t("fecha_comunicacion_cliente")} disabled={off} className={input} /></label>
      <label className="text-sm">Último contacto<input type="date" name="ultimo_contacto" defaultValue={t("ultimo_contacto")} disabled={off} className={input} /></label>
      <label className="text-sm">Vendedor<input name="vendedor" defaultValue={t("vendedor")} disabled={off} className={input} /></label>
      <label className="text-sm">Colaboradores<input name="colaboradores" defaultValue={t("colaboradores")} disabled={off} className={input} /></label>
      <label className="text-sm">Formato de entrega<input name="formato_entrega" defaultValue={t("formato_entrega")} disabled={off} className={input} /></label>
      <label className="text-sm sm:col-span-4">Observaciones<input name="observaciones" defaultValue={t("observaciones")} disabled={off} className={input} /></label>
    </>
  );
}

export default async function PostventaPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; q?: string; ok?: string; error?: string }> }) {
  const s = await requierePanel("postventa", "ver");
  const puedeEditar = s.niveles.postventa === "editar";
  const sp = await searchParams;
  const historico = sp.tab === "historico";
  let q = (await createClient()).from("services").select("*").in("estado", historico ? ["Hecho", "Cancelada"] : ["Pendiente", "En curso"])
    .order("visita_pactada", { ascending: true, nullsFirst: false }).order("id", { ascending: false }).limit(200);
  if (sp.q) { const t = sp.q.replace(/[%,()]/g, " "); q = q.or(`gimnasio.ilike.%${t}%,localidad.ilike.%${t}%,diagnostico.ilike.%${t}%`); }
  const { data } = await q;
  const hoyF = hoy();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Titulo>Postventa · Services</Titulo>
      <nav className="flex gap-2">
        <Link href="/postventa" className={`${botonSec} ${!historico ? "!bg-slate-900 !text-white" : ""}`}>Activos</Link>
        <Link href="/postventa?tab=historico" className={`${botonSec} ${historico ? "!bg-slate-900 !text-white" : ""}`}>Histórico</Link>
      </nav>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="flex gap-2"><input type="hidden" name="tab" value={historico ? "historico" : ""} /><input name="q" defaultValue={sp.q} placeholder="Buscar gimnasio, localidad, diagnóstico" className={input} /><button className={boton}>Buscar</button></form>
      {puedeEditar && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">+ Nuevo service</summary>
          <form action={crearService} className="mt-3 grid gap-3 sm:grid-cols-4"><Campos /><button className={`${boton} sm:col-span-4`}>Registrar service</button></form>
        </details>
      )}
      <div className="space-y-2">
        {data?.map((v) => (
          <details key={v.id} className={card}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
              <span className="min-w-48 flex-1 font-semibold">{v.gimnasio ?? "Sin nombre"} <span className="font-normal text-slate-500">· {v.localidad ?? "—"}</span></span>
              <span className="text-sm text-slate-600">{v.diagnostico ?? ""}</span>
              {v.visita_pactada && <span className={`text-sm ${v.estado !== "Hecho" && v.visita_pactada < hoyF ? "font-bold text-red-700" : "text-slate-500"}`}>Visita {fmtFecha(v.visita_pactada)}</span>}
              <Badge>{v.estado === "Hecho" ? "Finalizada" : v.estado === "En curso" ? "En curso" : v.estado === "Cancelada" ? "NORMAL" : "Pendiente"}</Badge>
              <span className="text-xs text-slate-500">{v.estado}{v.garantia ? " · garantía" : ""}</span>
            </summary>
            <form action={actualizarService} className="mt-3 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={v.id} /><input type="hidden" name="cliente_id" value={v.cliente_id ?? ""} />
              <Campos v={v as Sv} off={!puedeEditar} />
              {puedeEditar && <button className={`${boton} sm:col-span-4`}>Guardar</button>}
            </form>
          </details>
        ))}
        {!data?.length && <p className={`${card} text-center text-slate-500`}>No hay services {historico ? "en el histórico" : "activos"}.</p>}
      </div>
    </div>
  );
}
