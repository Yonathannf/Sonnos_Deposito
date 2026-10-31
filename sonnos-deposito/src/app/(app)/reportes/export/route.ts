import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { requierePanel } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { TIPOS, generarReporte, type TipoReporte } from "@/lib/reportes";

export async function GET(req: NextRequest) {
  await requierePanel("reportes", "ver");
  const u = req.nextUrl.searchParams;
  const tipo = u.get("tipo") as TipoReporte;
  const desde = u.get("desde") ?? ""; const hasta = u.get("hasta") ?? "";
  const def = TIPOS.find((t) => t.id === tipo);
  if (!def || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const sb = await createClient();
  const r = await generarReporte(sb, tipo, desde, hasta);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sonnos Depósito"; wb.created = new Date();
  const ws = wb.addWorksheet(def.nombre.slice(0, 31));
  ws.addRow([r.titulo]).font = { bold: true, size: 14 };
  if (r.resumen) ws.addRow([r.resumen]).font = { italic: true, color: { argb: "FF555555" } };
  ws.addRow([]);
  const head = ws.addRow(r.columnas);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } }; c.alignment = { vertical: "middle", wrapText: true }; });
  for (const f of r.filas) ws.addRow(f);
  ws.columns.forEach((col, i) => {
    const max = Math.max(r.columnas[i]?.length ?? 8, ...r.filas.slice(0, 300).map((f) => String(f[i] ?? "").length));
    col.width = Math.min(60, Math.max(10, max + 2));
  });
  ws.views = [{ state: "frozen", ySplit: head.number }];
  if (r.filas.length) ws.autoFilter = { from: { row: head.number, column: 1 }, to: { row: head.number + r.filas.length, column: r.columnas.length } };
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tipo}_${desde}_${hasta}.xlsx"`,
    },
  });
}
