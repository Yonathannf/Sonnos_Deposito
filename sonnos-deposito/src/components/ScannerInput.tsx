"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Campo de código con lectura por cámara (códigos de barras y QR) cuando el navegador lo permite.
// Los lectores de mano/USB funcionan igual: escriben el código y envían Enter.
export function ScannerInput({
  name, placeholder, className, defaultValue, autoFocus, enviarAlEscanear,
}: { name: string; placeholder?: string; className?: string; defaultValue?: string; autoFocus?: boolean; enviarAlEscanear?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const soporta = useSyncExternalStore(
    () => () => {},
    () => "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!abierto) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let vivo = true;
    (async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const det = new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!vivo || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        timer = setInterval(async () => {
          if (!video.current) return;
          try {
            const r = await det.detect(video.current);
            if (r.length && ref.current) {
              ref.current.value = r[0].rawValue;
              setAbierto(false);
              if (enviarAlEscanear) ref.current.form?.requestSubmit();
            }
          } catch { /* frame sin código */ }
        }, 300);
      } catch {
        setMsg("No se pudo abrir la cámara. Revisá el permiso del navegador.");
        setAbierto(false);
      }
    })();
    return () => { vivo = false; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [abierto, enviarAlEscanear]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={ref} name={name} defaultValue={defaultValue} placeholder={placeholder} autoFocus={autoFocus}
          autoComplete="off" inputMode="text" className={className} />
        {soporta && (
          <button type="button" onClick={() => { setMsg(""); setAbierto((a) => !a); }}
            className="h-11 shrink-0 rounded-lg border border-slate-300 bg-white px-4 font-medium hover:bg-slate-100">
            {abierto ? "Cerrar" : "📷 Escanear"}
          </button>
        )}
      </div>
      {abierto && <video ref={video} playsInline muted className="max-h-64 w-full rounded-lg bg-black object-cover" />}
      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
