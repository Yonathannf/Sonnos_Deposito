"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { subirFoto } from "./actions";

// Achica la foto en el navegador (máx. 1600 px, JPEG) para que suba rápido incluso con datos móviles.
async function achicar(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.8));
}

export function FotoUploader({ recepcionId }: { recepcionId: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState("");
  const [error, setError] = useState(false);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setError(false);
    try {
      for (let i = 0; i < files.length; i++) {
        setEstado(`Subiendo foto ${i + 1} de ${files.length}…`);
        const blob = await achicar(files[i]);
        const fd = new FormData();
        fd.set("recepcion_id", String(recepcionId)); fd.set("foto", blob, "foto.jpg"); fd.set("nombre", files[i].name);
        const r = await subirFoto(fd);
        if (!r.ok) throw new Error(r.error);
      }
      setEstado("Fotos subidas."); router.refresh();
    } catch (e) { setError(true); setEstado((e as Error).message); }
  }

  return (
    <div className="space-y-1">
      <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => { subir(e.target.files); e.target.value = ""; }}
        className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-slate-900 file:px-5 file:font-semibold file:text-white" />
      {estado && <p className={`text-sm ${error ? "text-red-700" : "text-slate-600"}`}>{estado}</p>}
    </div>
  );
}
