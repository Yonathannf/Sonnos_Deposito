import Link from "next/link";
import { requiereSesion } from "@/lib/sesion";
import { PANELES } from "@/lib/permisos";
import { cerrarSesion } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requiereSesion();
  const visibles = PANELES.filter((p) => (s.niveles[p.codigo] ?? "sin_acceso") !== "sin_acceso");

  const menu = (
    <nav className="flex flex-col gap-1">
      <Link href="/" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-slate-100">Inicio</Link>
      {visibles.map((p) => (
        <Link key={p.codigo} href={p.codigo === "usuarios" ? "/usuarios" : p.implementado ? `/${p.codigo}` : `/${p.codigo}`}
          className="rounded-lg px-3 py-3 text-base hover:bg-slate-100">
          {p.nombre}
          {s.niveles[p.codigo] === "ver" && <span className="ml-2 text-xs text-slate-400">(solo ver)</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:block print:hidden">
        <div className="mb-4 px-3 text-lg font-bold">Sonnos Depósito</div>
        {menu}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 print:hidden">
          <details className="relative md:hidden">
            <summary className="flex h-11 cursor-pointer list-none items-center rounded-lg border border-slate-300 px-4 font-medium">Menú</summary>
            <div className="absolute left-0 top-12 z-20 w-64 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">{menu}</div>
          </details>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-right leading-tight">
              <span className="block font-semibold">{s.nombre}</span>
              <span className="block text-xs text-slate-500">{s.rolNombre}{s.superusuario ? " · superusuario" : ""}</span>
            </span>
            <form action={cerrarSesion}>
              <button className="h-11 rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100">Salir</button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
