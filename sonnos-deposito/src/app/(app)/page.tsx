import Link from "next/link";
import { requiereSesion } from "@/lib/sesion";
import { PANELES } from "@/lib/permisos";

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ sin_permiso?: string }>;
}) {
  const s = await requiereSesion();
  const { sin_permiso } = await searchParams;
  const visibles = PANELES.filter((p) => (s.niveles[p.codigo] ?? "sin_acceso") !== "sin_acceso");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {s.nombre.split(" ")[0]}</h1>
        <p className="text-slate-500">¿Qué querés hacer?</p>
      </div>
      {sin_permiso && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tenés permiso para entrar a esa sección.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((p) => (
          <Link key={p.codigo} href={`/${p.codigo}`}
            className="flex min-h-20 flex-col justify-center rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-slate-900">
            <span className="text-lg font-semibold">{p.nombre}</span>
            <span className="text-xs text-slate-500">
              {s.niveles[p.codigo] === "ver" ? "Solo consulta" : "Consulta y edición"}
              {!p.implementado && " · próximamente"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
