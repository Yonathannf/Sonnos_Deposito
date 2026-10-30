import { notFound } from "next/navigation";
import { requierePanel } from "@/lib/sesion";
import { panelPorCodigo } from "@/lib/permisos";

// Marcador de posición de los módulos que se construyen en las etapas siguientes.
export default async function PanelPendiente({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  const def = panelPorCodigo(panel);
  if (!def || def.implementado) notFound();
  await requierePanel(def.codigo, "ver");
  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <h1 className="text-xl font-bold">{def.nombre}</h1>
      <p className="mt-2 text-slate-500">Este módulo se construye en una etapa próxima.</p>
    </div>
  );
}
