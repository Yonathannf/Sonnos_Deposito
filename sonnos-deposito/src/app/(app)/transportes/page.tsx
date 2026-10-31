import Link from "next/link";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Flash, Titulo, boton, botonSec, card, input } from "@/components/ui";
import { actualizarTransporte, crearTransporte } from "./actions";

const POR_PAGINA = 40;

function Campos({ t, off }: { t?: Record<string, string | null>; off?: boolean }) {
  return (
    <>
      <label className="text-sm sm:col-span-2">Nombre<input name="nombre" defaultValue={t?.nombre ?? ""} required disabled={off} className={input} /></label>
      <label className="text-sm">Localidad<input name="localidad" defaultValue={t?.localidad ?? ""} disabled={off} className={input} /></label>
      <label className="text-sm sm:col-span-2">Dirección<input name="direccion" defaultValue={t?.direccion ?? ""} disabled={off} className={input} /></label>
      <label className="text-sm">Observación<input name="observacion" defaultValue={t?.observacion ?? ""} disabled={off} className={input} /></label>
    </>
  );
}

export default async function TransportesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pag?: string; ok?: string; error?: string }>;
}) {
  const s = await requierePanel("transportes", "ver");
  const puedeEditar = s.niveles.transportes === "editar";
  const sp = await searchParams;
  const pag = Math.max(1, Number(sp.pag) || 1);
  const supabase = await createClient();
  let q = supabase.from("transportes").select("*", { count: "exact" }).order("nombre").range((pag - 1) * POR_PAGINA, pag * POR_PAGINA - 1);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`nombre.ilike.%${t}%,localidad.ilike.%${t}%`);
  }
  const { data, count } = await q;
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const href = (p: number) => `/transportes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), pag: String(p) })}`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Titulo>Transportes</Titulo>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Buscar transporte o localidad" className={input} />
        <button className={boton}>Buscar</button>
      </form>
      {puedeEditar && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">+ Nuevo transporte</summary>
          <form action={crearTransporte} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Campos />
            <button className={`${boton} sm:col-span-3`}>Crear transporte</button>
          </form>
        </details>
      )}
      <p className="text-sm text-slate-500">{count ?? 0} transportes</p>
      <div className="space-y-2">
        {data?.map((t) => (
          <details key={t.id} className={card}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{t.nombre}</span>
              <span className="text-sm text-slate-500">{t.localidad ?? "—"}</span>
            </summary>
            <form action={actualizarTransporte} className="mt-3 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={t.id} />
              <Campos t={t} off={!puedeEditar} />
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
