"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { importarLote, finalizarImportacion } from "./actions";

const entero = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : null;
};
const texto = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const skuDe = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? String(v) : texto(v));

// Posiciones del LISTADO del ERP (igual que en el sistema anterior)
function aFila(r: unknown[]) {
  return {
    sku: skuDe(r[0]) as string, descripcion: texto(r[1]),
    fisico_ramos: entero(r[4]), disp_ramos: entero(r[5]), fisico_mayogym: entero(r[6]), disp_mayogym: entero(r[7]),
    fisico_central: entero(r[8]), disp_central: entero(r[9]), fisico_full: entero(r[10]), disp_full: entero(r[11]),
    fisico_marmol: entero(r[12]), disp_marmol: entero(r[13]), fisico_outlet: entero(r[14]), disp_outlet: entero(r[15]),
    fisico_discontinuo: entero(r[16]), disp_discontinuo: entero(r[17]), fisico_compras: entero(r[18]), disp_compras: entero(r[19]),
    fisico_anticipada: entero(r[20]), disp_anticipada: entero(r[21]), fisico_showroom: entero(r[22]),
    categoria: texto(r[23]), subcategoria: texto(r[24]), marca: texto(r[25]),
  };
}

export function Importador() {
  const router = useRouter();
  const [estado, setEstado] = useState<{ tipo: "idle" | "work" | "ok" | "error"; msg: string; pct?: number }>({ tipo: "idle", msg: "" });

  async function procesar(file: File) {
    try {
      setEstado({ tipo: "work", msg: "Leyendo el archivo…", pct: 0 });
      const { readSheet } = await import("read-excel-file/browser");
      const filas = (await readSheet(file)) as unknown[][];
      if (filas.length < 2 || String(filas[0][0] ?? "").trim().toLowerCase() !== "item_code")
        throw new Error("El archivo no parece el LISTADO del ERP (la primera columna debería ser item_code).");
      const unicas = new Map<string, ReturnType<typeof aFila>>();
      for (const r of filas.slice(1)) {
        const f = aFila(r);
        if (f.sku) unicas.set(f.sku, f);
      }
      const todas = [...unicas.values()];
      const LOTE = 400;
      for (let i = 0; i < todas.length; i += LOTE) {
        const res = await importarLote(todas.slice(i, i + LOTE));
        if (!res.ok) throw new Error(res.error);
        setEstado({ tipo: "work", msg: `Importando… ${Math.min(i + LOTE, todas.length)} de ${todas.length}`, pct: Math.min(100, Math.round(((i + LOTE) / todas.length) * 100)) });
      }
      const fin = await finalizarImportacion(file.name, todas.length);
      if (!fin.ok) throw new Error(fin.error);
      setEstado({ tipo: "ok", msg: `Listo: ${todas.length} productos actualizados. Productos en alerta: ${fin.alertas}.` });
      router.refresh();
    } catch (e) {
      setEstado({ tipo: "error", msg: (e as Error).message });
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept=".xlsx" disabled={estado.tipo === "work"}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) procesar(f); e.target.value = ""; }}
        className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-slate-900 file:px-5 file:font-semibold file:text-white" />
      {estado.tipo === "work" && (
        <div>
          <p className="text-sm">{estado.msg}</p>
          <div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-slate-900" style={{ width: `${estado.pct ?? 0}%` }} /></div>
        </div>
      )}
      {estado.tipo === "ok" && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{estado.msg}</p>}
      {estado.tipo === "error" && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{estado.msg}</p>}
    </div>
  );
}
