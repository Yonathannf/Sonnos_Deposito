import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { actualizarCliente, crearCliente } from "./actions";

const POR_PAGINA = 30;
type Tr = { id: number; nombre: string }[] | null;

function Campos({ c, transportes, deshabilitado }: {
  c?: Record<string, string | number | null>; transportes: Tr; deshabilitado?: boolean;
}) {
  return (
    <>
      <label className="text-sm">Nº cliente<input name="numero_cliente" defaultValue={c?.numero_cliente ?? ""} inputMode="numeric" disabled={deshabilitado} className={input} /></label>
      <label className="text-sm sm:col-span-2">Nombre<input name="nombre" defaultValue={c?.nombre ?? ""} required disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Sede<input name="sede" defaultValue={c?.sede ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Contacto<input name="contacto" defaultValue={c?.contacto ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm sm:col-span-2">Dirección<input name="direccion" defaultValue={c?.direccion ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Localidad<input name="localidad" defaultValue={c?.localidad ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Provincia<input name="provincia" defaultValue={c?.provincia ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Vendedor<input name="vendedor" defaultValue={c?.vendedor ?? ""} disabled={deshabilitado} className={input} /></label>
      <label className="text-sm">Transporte habitual
        <select name="transporte_habitual_id" defaultValue={c?.transporte_habitual_id ?? ""} disabled={deshabilitado} className={input}>
          <option value="">— Ninguno —</option>
          {transportes?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
    </>
  );
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pag?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("clientes", "ver");
  const puedeEditar = s.niveles.clientes === "editar";
  const sp = await searchParams;
  const pag = Math.max(1, Number(sp.pag) || 1);
  const supabase = await createClient();

  let q = supabase.from("clientes").select("*", { count: "exact" }).order("nombre").range((pag - 1) * POR_PAGINA, pag * POR_PAGINA - 1);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`nombre.ilike.%${t}%,localidad.ilike.%${t}%,numero_cliente.eq.${Number(t) || -1}`);
  }
  const [{ data: clientes, count }, { data: transportes }] = await Promise.all([
    q, supabase.from("transportes").select("id, nombre").order("nombre"),
  ]);
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const href = (p: number) => `/clientes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), pag: String(p) })}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Titulo>Clientes</Titulo>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre, localidad o número" className={input} />
        <button className={boton}>Buscar</button>
      </form>

      {puedeEditar && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">+ Nuevo cliente</summary>
          <form action={crearCliente} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Campos transportes={transportes} />
            <button className={`${boton} sm:col-span-3`}>Crear cliente</button>
          </form>
        </details>
      )}

      <p className="text-sm text-slate-500">{count ?? 0} clientes</p>
      <div className="space-y-2">
        {clientes?.map((c) => (
          <details key={c.id} className={card}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{c.nombre}{c.sede ? ` · ${c.sede}` : ""}</span>
              <span className="text-sm text-slate-500">{c.numero_cliente ?? "s/n"} · {c.localidad ?? "—"}, {c.provincia ?? "—"}</span>
            </summary>
            <form action={actualizarCliente} className="mt-3 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={c.id} />
              <Campos c={c} transportes={transportes} deshabilitado={!puedeEditar} />
              {puedeEditar && <button className={`${boton} sm:col-span-3`}>Guardar</button>}
            </form>
          </details>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {pag > 1 ? <Link href={href(pag - 1)} className={botonSec}>← Anterior</Link> : <span />}
        <span className="text-sm text-slate-500">Página {pag} de {paginas}</span>
        {pag < paginas ? <Link href={href(pag + 1)} className={botonSec}>Siguiente →</Link> : <span />}
      </div>
    </div>
  );
}
