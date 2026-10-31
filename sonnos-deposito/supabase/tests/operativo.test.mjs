// Pruebas de consistencia de los módulos operativos sobre Postgres embebido (PGlite).
// Carga TODAS las migraciones en orden y simula usuarios reales con RLS.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../migrations/", import.meta.url);
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
  grant usage on schema auth to authenticated, anon; grant usage on schema public to anon, authenticated;
`);
for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(f, dir), "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  revoke insert, update, delete, truncate on public.registro_auditoria from anon, authenticated;
  revoke delete on public.perfiles from anon, authenticated;`);

let fallos = 0;
const ok = (c, m) => { console.log(c ? "OK   " : "FALLA", m); if (!c) fallos++; };
async function mk(email, nombre, rol, su = false) {
  const { rows: [u] } = await db.query("insert into auth.users(email) values ($1) returning id", [email]);
  await db.query(`insert into perfiles(id,nombre,email,rol_id,superusuario) values ($1,$2,$3,(select id from roles where codigo=$4),$5)`, [u.id, nombre, email, rol, su]);
  return u.id;
}
const jefe = await mk("jon@x", "Jonathan", "jefe_deposito", true);
const vend = await mk("v@x", "Vendedor", "vendedor");
const oper = await mk("o@x", "Operario", "operario_deposito");
async function como(uid, fn) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.sub',$1,false)", [uid]);
  try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.sub','',false)"); }
}
const q = (uid, sql, p) => como(uid, async () => (await db.query(sql, p)).rows);
const falla = async (fn) => { try { await fn(); return false; } catch { return true; } };

// ---- Datos base cargados por el jefe
await q(jefe, "insert into transportes(nombre) values ('Expreso Norte'),('Cruz del Sur')");
await q(jefe, "insert into operarios(nombre) values ('Walter'),('Axel')");
await q(jefe, "insert into clientes(nombre, texto_original, numero_cliente) values ('Cliente Uno','Cliente Uno',1)");

// ---- Vendedor: carga pedidos, no toca armado
const [p1] = await q(vend, "insert into pedidos(nro_pedido,cliente_id,fecha_impreso,dia_a_despachar,transporte_id) values ('A-1',1,current_date,current_date+1,1) returning id, estado");
ok(p1.estado === "Impreso", "pedido nuevo nace 'Impreso'");
ok(await falla(() => q(vend, "insert into pedidos(nro_pedido,cliente_id) values ('A-1',1)")), "nº de pedido duplicado rechazado");
ok(await falla(() => q(vend, "insert into pedidos(nro_pedido,cliente_id,estado) values ('A-9',1,'Inventado')")), "estado inválido rechazado");
ok(await falla(() => q(vend, "insert into pedidos(nro_pedido,cliente_id,bultos) values ('A-8',1,-3)")), "bultos negativos rechazados");
ok(await falla(() => q(vend, "insert into armados(fecha,despacho) values (current_date,'ZONA')")), "vendedor NO puede registrar armados");
ok((await q(vend, "select count(*) c from armados"))[0].c == 0, "vendedor no ve armados");
ok(await falla(() => q(vend, "update pedidos set estado='Entregado' where id=$1", [p1.id])) , "vendedor no puede entregar (ni ver hoja de ruta editable)")
  || (await q(vend, "select estado from pedidos where id=$1", [p1.id]))[0].estado === "Impreso";
ok((await q(vend, "update clientes set localidad='Mar del Plata' where id=1 returning 1")).length === 1, "vendedor edita clientes");
ok((await q(vend, "insert into transportes(nombre) values ('Nuevo') returning 1")).length === 1, "vendedor crea transportes");
ok((await q(vend, "select count(*) c from pedidos_calc"))[0].c == 1, "vendedor ve el estado de pedidos");
ok((await q(vend, "select count(*) c from rutas"))[0].c == 0 && await falla(() => q(vend, "insert into rutas(fecha) values (current_date)")), "vendedor ve hoja de ruta pero no la modifica");

// ---- Operario: registra el armado => el pedido se actualiza solo
ok(await falla(() => q(oper, "update pedidos set estado='Armado' where id=$1", [p1.id])) || (await q(oper, "select estado from pedidos where id=$1", [p1.id]))[0].estado === "Impreso", "operario no edita pedidos directo");
await q(oper, `insert into armados(fecha,nro_pedido,despacho,operario_id,bultos,pallets,carro,tiempo_min,fecha_finalizacion)
               values (current_date,'A-1','ZONA',1,12,1,2,35,current_date)`);
const [ped] = await q(jefe, "select estado,bultos,pallets,carro_cajon,operario_id from pedidos where id=$1", [p1.id]);
ok(ped.estado === "Armado" && ped.bultos == 12 && ped.pallets == 1 && ped.carro_cajon === "2" && ped.operario_id == 1, "armado => pedido 'Armado' con bultos, pallets, carro y operario: " + JSON.stringify(ped));
ok((await q(jefe, "select pedido_id from armados"))[0].pedido_id == p1.id, "armado queda vinculado al pedido por número");
await q(oper, "delete from armados");
ok((await q(jefe, "select count(*) c from armados"))[0].c == 1, "armados no se pueden borrar (RLS sin policy de DELETE)");
ok(await falla(() => q(oper, "insert into armados(fecha,despacho,prioridad) values (current_date,'ZONA','XX')")), "prioridad inválida rechazada");

// ---- Entrega: solo pedidos armados
const [p2] = await q(jefe, "insert into pedidos(nro_pedido,cliente_id,dia_a_despachar) values ('A-2',1,current_date+1) returning id");
ok(await falla(() => q(jefe, "update pedidos set estado='Entregado' where id=$1", [p2.id])), "no se puede entregar un pedido sin armar");
await q(jefe, "update pedidos set estado='Entregado' where id=$1", [p1.id]);
ok((await q(jefe, "select estado from pedidos where id=$1", [p1.id]))[0].estado === "Entregado", "pedido armado se puede entregar");

// ---- Indicadores y eficiencia
const ind = (await q(jefe, "select indicadores_armado(current_date-30,current_date+30) i"))[0].i;
ok(ind.totales.pedidos == 1 && ind.totales.bultos == 12 && ind.por_operario[0].operario === "Walter", "indicadores de armado calculan totales y por operario");
await q(jefe, "insert into armados(fecha,despacho,fecha_finalizacion,fecha_entrega) values ('2026-01-01','ZONA','2026-01-02','2026-01-08'),('2026-01-01','ZONA','2026-01-06','2026-01-07')");
const ef = await q(jefe, "select ef_armado, ef_entrega from armados_calc where fecha='2026-01-01' order by fecha_finalizacion");
ok(ef[0].ef_armado === "EFICIENTE" && ef[0].ef_entrega === "FUERA DE PLAZO", "entrega tardía (6 días) => FUERA DE PLAZO (fórmula corregida)");
ok(ef[1].ef_armado === "FUERA DE PLAZO" && ef[1].ef_entrega === "EFICIENTE", "armado de 5 días => FUERA DE PLAZO");

// ---- Stock: importación, mínimos, alertas, foto diaria
ok(await falla(() => q(vend, "select * from stock_productos")) || (await q(vend, "select count(*) c from stock_productos"))[0].c == 0, "vendedor no ve stock");
await q(oper, "insert into stock_productos(sku,descripcion,fisico_central,fisico_mayogym,fisico_outlet,fisico_anticipada,fisico_ramos) values ('197029','Prod A',5,2,1,1,10),('ZZZ','Otro',3,0,0,0,0)").then(() => ok(false, "operario (solo ver stock) NO debería poder importar"), () => ok(true, "operario (solo ver stock) no puede importar"));
await q(jefe, "insert into stock_productos(sku,descripcion,fisico_central,fisico_mayogym,fisico_outlet,fisico_anticipada,fisico_ramos) values ('197029','Prod A',5,2,1,1,10),('ZZZ','Otro',3,0,0,0,0)");
const [sa] = await q(jefe, "select stk, stk_control from stock_productos where sku='197029'");
ok(sa.stk == 19 && sa.stk_control == 9, `totales calculados por el sistema (stk=${sa.stk}, control=${sa.stk_control})`);
const fin = (await q(jefe, "select stock_finalizar_importacion('t.xlsx',2) r"))[0].r;
const [seg] = await q(jefe, "select en_seguimiento, minimo, estado from stock_calc where sku='197029'");
ok(seg.en_seguimiento && seg.minimo == 6 && seg.estado === "OK", "primera importación activa la lista de seguimiento con mínimos de fábrica");
await q(jefe, "update stock_productos set minimo=30 where sku='197029'");
ok((await q(jefe, "select estado from stock_calc where sku='197029'"))[0].estado === "ALERTA", "stock bajo el mínimo => ALERTA");
await q(jefe, "insert into stock_productos(sku,descripcion,fisico_central) values ('197029','Prod A',50) on conflict (sku) do update set fisico_central=excluded.fisico_central");
const [sb] = await q(jefe, "select minimo, en_seguimiento, stk from stock_productos where sku='197029'");
ok(sb.minimo == 30 && sb.en_seguimiento, "reimportar conserva mínimo y seguimiento");
await q(jefe, "select stock_finalizar_importacion('t2.xlsx',2)");
ok((await q(jefe, "select count(*) c from stock_historial where sku='197029'"))[0].c == 1, "foto diaria del stock (una por día y producto)");
ok((await q(jefe, "select count(*) c from registro_auditoria where entidad='stock_productos' and campo='minimo'"))[0].c >= 1, "cambio de mínimo auditado");

// ---- Inventario físico
ok(await falla(() => q(vend, "insert into conteos(nombre) values ('x')")), "vendedor no accede a inventario");
await q(jefe, "insert into stock_productos(sku,descripcion,fisico_central) values ('INV1','Art 1',100),('INV2','Art 2',100),('INV3','Art 3',100),('INV4','Art 4',0)");
const [cn] = await q(oper, "insert into conteos(nombre) values ('Control A') returning id");
const cuenta = (sku, n) => q(oper, "insert into conteo_items(conteo_id,sku,contado) values ($1,$2,$3)", [cn.id, sku, n]);
await cuenta("INV1", 100); await cuenta("INV2", 98); await cuenta("INV3", 90); await cuenta("INV4", 1);
ok(await falla(() => cuenta("NOEXISTE", 1)), "código inexistente en el stock => rechazado");
ok(await falla(() => cuenta("INV1", 5)), "artículo repetido en el mismo conteo => rechazado");
ok(await falla(() => q(oper, "insert into conteo_items(conteo_id,sku,contado) values ($1,'INV1',-1)", [cn.id])), "cantidad negativa rechazada");
const r = Object.fromEntries((await q(oper, "select sku, dif, resultado from conteo_items_calc where conteo_id=$1", [cn.id])).map(x => [x.sku, x]));
ok(r.INV1.resultado === "OK" && r.INV2.resultado === "DENTRO DE TOLERANCIA" && r.INV3.resultado === "FALTANTE" && r.INV4.resultado === "SOBRANTE", "regla ±3%: OK / dentro / faltante / sobrante (sistema 0 y contado 1 = sobrante)");
const [res] = await q(oper, "select articulos, aciertos, precision_pct from conteos_resumen where id=$1", [cn.id]);
ok(res.articulos == 4 && res.aciertos == 2 && res.precision_pct == 50, "precisión = aciertos / artículos");
ok(await falla(() => q(oper, "update conteo_items set sistema=999 where conteo_id=$1", [cn.id])), "no se puede alterar la foto del sistema ni los ajustes");
ok(await falla(() => q(oper, "update conteo_items set ajuste='cargado' where conteo_id=$1", [cn.id])), "ajuste solo por función");
const cierre = (await q(oper, "select cerrar_conteo($1) r", [cn.id]))[0].r;
ok(cierre.ajustes_pendientes == 2, "al cerrar quedan 2 ajustes pendientes (faltante + sobrante): ");
ok(await falla(() => cuenta("INV1", 1)), "conteo cerrado: no admite artículos nuevos");
ok(await falla(() => q(oper, "update conteo_items set contado=1 where conteo_id=$1", [cn.id])), "conteo cerrado: no se modifica");
ok(await falla(() => q(oper, "delete from conteo_items where conteo_id=$1", [cn.id])), "conteo cerrado: no se borra");
const [pend] = await q(jefe, "select id from conteo_items where conteo_id=$1 and ajuste='pendiente' limit 1", [cn.id]);
ok(await falla(() => q(oper, "select resolver_ajuste($1,'cargado','x')", [pend.id])), "operario (stock solo ver) no resuelve ajustes");
await q(jefe, "select resolver_ajuste($1,'cargado','Cargado en ERP')", [pend.id]);
ok((await q(jefe, "select ajuste, ajuste_obs from conteo_items where id=$1", [pend.id]))[0].ajuste === "cargado", "jefe resuelve el ajuste");
ok((await q(jefe, "select count(*) c from conteos_resumen where id=$1 and ajustes_pendientes=1", [cn.id]))[0].c == 1, "resumen refleja ajustes restantes");

// ---- Insumos: el stock solo cambia por movimientos
const [ins] = await q(oper, "insert into insumos(descripcion,unidad_medida,stock_minimo,stock_maximo) values ('Film stretch','rollo',10,50) returning id");
ok(await falla(() => q(oper, "insert into insumos(descripcion,stock_actual) values ('Trampa',5)")), "no se puede crear un insumo con stock directo");
await q(oper, "insert into insumo_movimientos(insumo_id,tipo,cantidad,observaciones) values ($1,'ingreso',30,'Stock inicial')", [ins.id]);
ok((await q(oper, "select stock_actual from insumos where id=$1", [ins.id]))[0].stock_actual == 30, "ingreso suma al stock");
ok(await falla(() => q(oper, "update insumos set stock_actual=999 where id=$1", [ins.id])), "stock de insumo no se edita a mano");
ok(await falla(() => q(oper, "insert into insumo_movimientos(insumo_id,tipo,cantidad) values ($1,'consumo',5)", [ins.id])), "consumo sin sector/operario rechazado");
await q(oper, "insert into insumo_movimientos(insumo_id,tipo,cantidad,sector,operario_id) values ($1,'consumo',25,'Despacho',1)", [ins.id]);
const [mv] = await q(oper, "select stock_resultante, responsable from insumo_movimientos order by id desc limit 1");
ok(mv.stock_resultante == 5 && mv.responsable === "Operario", "consumo descuenta y registra responsable: " + JSON.stringify(mv));
ok(await falla(() => q(oper, "insert into insumo_movimientos(insumo_id,tipo,cantidad,sector) values ($1,'consumo',6,'X')", [ins.id])), "no se puede consumir más de lo que hay");
ok((await q(oper, "select estado, cantidad_a_pedir from insumos_calc where id=$1", [ins.id]))[0].estado === "CRITICO", "bajo el mínimo => CRITICO");
ok(await falla(() => q(oper, "update insumo_movimientos set cantidad=1")) || (await q(oper, "select count(*) c from insumo_movimientos where cantidad=1"))[0].c == 0, "movimientos inmutables");
await q(oper, "delete from insumo_movimientos");
ok((await q(oper, "select count(*) c from insumo_movimientos"))[0].c == 2, "movimientos no se borran");
const [sol] = await q(oper, "insert into solicitudes_compra(insumo_id,cantidad_solicitada) values ($1,40) returning id", [ins.id]);
await q(oper, "select recibir_solicitud($1,40)", [sol.id]);
ok((await q(oper, "select stock_actual from insumos where id=$1", [ins.id]))[0].stock_actual == 45 && (await q(oper, "select estado from solicitudes_compra where id=$1", [sol.id]))[0].estado === "Recibida", "recibir solicitud => ingreso automático + solicitud Recibida");
ok(await falla(() => q(oper, "select recibir_solicitud($1,40)", [sol.id])), "no se recibe dos veces la misma solicitud");
ok(await falla(() => q(vend, "select * from insumos")) || (await q(vend, "select count(*) c from insumos"))[0].c == 0, "vendedor no ve insumos");

// ---- Recepción: confirma => stock + ubicación; luego inmutable
const [rc] = await q(oper, "insert into recepciones(proveedor,nro_remito) values ('Proveedor SA','R-001') returning id");
ok(await falla(() => q(oper, "insert into recepciones(proveedor,nro_remito) values ('Proveedor SA','R-001')")), "remito duplicado del mismo proveedor rechazado");
ok(await falla(() => q(oper, "insert into recepcion_items(recepcion_id,sku,esperado,recibido) values ($1,'NOEXISTE',1,1)", [rc.id])), "recepción: código inexistente rechazado");
ok(await falla(() => q(oper, "insert into recepcion_items(recepcion_id,sku,esperado,recibido,danado) values ($1,'INV1',5,2,3)", [rc.id])), "dañado > recibido rechazado");
await q(oper, "insert into recepcion_items(recepcion_id,sku,esperado,recibido,danado,ubicacion,observaciones) values ($1,'INV1',10,10,0,'A-01-2',null),($1,'INV2',10,8,1,'B-03-1',null)", [rc.id]);
ok(await falla(() => q(oper, "select confirmar_recepcion($1)", [rc.id])), "diferencias sin observación => no confirma");
await q(oper, "update recepcion_items set observaciones='Faltaron 2, 1 golpeada' where recepcion_id=$1 and sku='INV2'", [rc.id]);
const antesStk = (await q(jefe, "select stock_actual from stock_calc where sku='INV2'"))[0].stock_actual;
const cf = (await q(oper, "select confirmar_recepcion($1) r", [rc.id]))[0].r;
ok(cf.unidades == 17 && cf.con_diferencias === true, "confirmar: 10 + (8-1 dañada) = 17 unidades, marca diferencias: " + JSON.stringify(cf));
const [s1] = await q(jefe, "select ajuste_local, stock_actual, ubicacion, stk from stock_calc where sku='INV1'");
ok(s1.ajuste_local == 10 && s1.stock_actual == s1.stk + 10 && s1.ubicacion === "A-01-2", "stock actualizado automáticamente y ubicación asignada");
ok((await q(jefe, "select stock_actual from stock_calc where sku='INV2'"))[0].stock_actual == antesStk + 7, "unidades dañadas no entran al stock");
ok(await falla(() => q(oper, "select confirmar_recepcion($1)", [rc.id])), "no se confirma dos veces");
ok(await falla(() => q(oper, "update recepcion_items set recibido=99 where recepcion_id=$1", [rc.id])), "recepción confirmada: no se modifica");
ok((await q(jefe, "select count(*) c from stock_movimientos where ref_id=$1", [rc.id]))[0].c == 2, "movimientos de stock registrados (historial)");
await q(jefe, "select stock_finalizar_importacion('t3.xlsx',2)");
ok((await q(jefe, "select ajuste_local from stock_productos where sku='INV1'"))[0].ajuste_local == 0, "al importar el LISTADO, lo recibido se incorpora (ajuste_local = 0)");

// ---- Tareas
const [tk] = await q(oper, "insert into tareas(titulo,sector,prioridad,operario_id,fecha_limite) values ('Ordenar góndola','Picking','Alta',1,current_date) returning id");
await q(oper, "update tareas set estado='En curso' where id=$1", [tk.id]);
ok((await q(oper, "select inicio from tareas where id=$1", [tk.id]))[0].inicio !== null, "iniciar tarea registra la hora de inicio");
await q(oper, "update tareas set estado='Finalizada' where id=$1", [tk.id]);
const [tf] = await q(oper, "select fin, minutos, a_tiempo from tareas_calc where id=$1", [tk.id]);
ok(tf.fin !== null && tf.minutos !== null && tf.a_tiempo === true, "finalizar registra fin, minutos y cumplimiento");
ok(await falla(() => q(oper, "update tareas set estado='Pendiente' where id=$1", [tk.id])), "tarea finalizada no se reabre");
ok((await q(vend, "select count(*) c from tareas"))[0].c == 0, "vendedor no ve tareas");

// ---- Postventa
ok(await falla(() => q(oper, "insert into services(gimnasio) values ('X')")), "operario no crea services (postventa solo ver)");
const [sv] = await q(jefe, "insert into services(gimnasio,diagnostico,presupuesto) values ('Gym Norte','Rotura de cable',15000) returning id");
await q(jefe, "update services set estado='En curso' where id=$1", [sv.id]);
ok((await q(oper, "select estado from services where id=$1", [sv.id]))[0].estado === "En curso", "operario ve los services");
ok(await falla(() => q(jefe, "insert into services(estado) values ('Inventado')")), "estado de service inválido rechazado");

// ---- Verificación de consistencia entre módulos (toda la actividad de arriba)
ok(await falla(() => q(vend, "select * from verificar_consistencia()")), "vendedor no puede correr la verificación");
const chk = await q(jefe, "select * from verificar_consistencia()");
const malos = chk.filter(c => !c.ok);
ok(chk.length >= 12 && malos.length === 0, `verificación de consistencia: ${chk.length} controles, ${malos.length} con problemas ${JSON.stringify(malos.map(m => m.chequeo))}`);

await db.exec("update insumos set stock_actual = stock_actual + 7 where id = 1");   // manipulación fuera de la app
const chk2 = await q(jefe, "select * from verificar_consistencia()");
ok(chk2.some(c => !c.ok && c.chequeo.startsWith("Insumos: stock = suma")), "la verificación DETECTA un stock de insumo alterado por fuera de la app");
await db.exec("update insumos set stock_actual = stock_actual - 7 where id = 1");

// ---- Auditoría de operaciones de negocio
const aud = await q(jefe, "select count(*) c from registro_auditoria where entidad in ('pedidos','armados','clientes')").catch(() => null);
const audRows = (await db.query("select count(*) c from registro_auditoria where entidad in ('pedidos','armados','clientes','transportes')")).rows[0].c;
ok(audRows > 5, `las operaciones quedan auditadas (${audRows} registros)`);

console.log(fallos ? `\n${fallos} FALLA(S)` : "\nTodo OK");
process.exit(fallos ? 1 : 0);
