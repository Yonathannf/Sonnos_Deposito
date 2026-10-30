import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(readFileSync(new URL("../migrations/0001_base.sql", import.meta.url),"utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
               grant execute on all functions in schema public to authenticated;`);
// re-aplicar revokes de la migración (grant all los pisó, igual que Supabase por defecto)
await db.exec(`revoke insert, update, delete, truncate on public.registro_auditoria from anon, authenticated;
               revoke delete on public.perfiles from anon, authenticated;`);

let fallos = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALLA"), m); if (!c) fallos++; };

async function mk(email, nombre, rol, extra = {}) {
  const { rows:[u] } = await db.query("insert into auth.users(email) values ($1) returning id",[email]);
  await db.query(`insert into perfiles(id,nombre,email,rol_id,superusuario,activo)
    values ($1,$2,$3,(select id from roles where codigo=$4),$5,$6)`,
    [u.id,nombre,email,rol,extra.su??false,extra.activo??true]);
  return u.id;
}
const jonathan = await mk("jon@x","Jonathan","jefe_deposito",{su:true});
const jefe2    = await mk("jefe2@x","Jefe Dos","jefe_deposito");
const dueno    = await mk("dueno@x","Dueño Uno","dueno");
const vendedor = await mk("v@x","Vende","vendedor");
const operario = await mk("o@x","Opera","operario_deposito");
const inactivo = await mk("i@x","Inactivo","vendedor",{activo:false});

async function como(uid, fn) {          // ejecuta como rol 'authenticated' con auth.uid() = uid
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.sub',$1,false)",[uid]);
  try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.sub','',false)"); }
}
const nivel = (uid,p) => como(uid, async()=> (await db.query("select nivel_panel($1) n",[p])).rows[0].n);
const falla = async (fn) => { try { await fn(); return false; } catch { return true; } };

// --- Matriz aprobada ---
ok(await nivel(jonathan,"usuarios")==="editar" && await nivel(jonathan,"stock")==="editar", "superusuario: editar todo");
ok(await nivel(dueno,"usuarios")==="editar", "dueño (es_admin): editar todo");
ok(await nivel(jefe2,"usuarios")==="sin_acceso", "jefe de depósito: SIN acceso a usuarios");
ok(await nivel(jefe2,"pedidos")==="editar" && await nivel(jefe2,"historial")==="ver", "jefe: pedidos editar, historial solo ver");
ok(await nivel(vendedor,"pedidos")==="editar", "vendedor: carga pedidos");
ok(await nivel(vendedor,"clientes")==="editar" && await nivel(vendedor,"transportes")==="editar", "vendedor: edita clientes y transportes");
ok(await nivel(vendedor,"hoja_de_ruta")==="ver", "vendedor: hoja de ruta solo ver");
for (const p of ["stock","inventario","insumos","recepcion","armado","reportes","historial","usuarios","dashboard","tareas","postventa"])
  ok(await nivel(vendedor,p)==="sin_acceso", `vendedor: ${p} sin acceso`);
ok(await nivel(operario,"armado")==="editar" && await nivel(operario,"reportes")==="sin_acceso", "operario: armado sí, reportes no");
ok(await nivel(inactivo,"pedidos")==="sin_acceso", "usuario inactivo: sin acceso a nada");

// --- RLS ---
ok(await como(vendedor, async()=> (await db.query("select count(*) c from registro_auditoria")).rows[0].c)==0, "vendedor no ve auditoría (0 filas)");
ok(await falla(()=>como(vendedor,()=>db.query("insert into perfiles(id,nombre,email,rol_id) values (gen_random_uuid(),'x','x@x',1)"))), "vendedor no puede crear perfiles");
ok(await falla(()=>como(jefe2,()=>db.query("update permisos_rol set nivel='editar' where panel='stock' and rol_id=(select id from roles where codigo='vendedor')"))) 
   || (await como(jefe2, async()=> (await db.query("update permisos_rol set nivel='editar' where panel='stock' and rol_id=(select id from roles where codigo='vendedor') returning 1")).rows.length))===0, "jefe no puede cambiar la matriz de permisos");
ok(await como(vendedor, async()=> (await db.query("select count(*) c from perfiles")).rows[0].c)==1, "vendedor solo ve su propio perfil");
ok(await como(dueno, async()=> (await db.query("select count(*) c from perfiles")).rows[0].c)==6, "dueño ve todos los perfiles");

// --- Anti-escalada ---
ok(await falla(()=>como(dueno,()=>db.query("update perfiles set superusuario=true where id=$1",[vendedor]))), "dueño NO puede crear un superusuario");
ok(await falla(()=>como(dueno,()=>db.query("update perfiles set activo=false where id=$1",[jonathan]))), "dueño NO puede tocar a un superusuario");
ok(!(await falla(()=>como(jonathan,()=>db.query("update perfiles set rol_id=(select id from roles where codigo='dueno') where id=$1",[vendedor])))), "superusuario SÍ puede cambiar roles");

// --- Auditoría ---
const antes = (await db.query("select count(*) c from registro_auditoria")).rows[0].c;
await como(jonathan,()=>db.query("update permisos_rol set nivel='ver' where panel='clientes' and rol_id=(select id from roles where codigo='vendedor')"));
const { rows: aud } = await db.query("select usuario_nombre, entidad, campo, valor_anterior, valor_nuevo from registro_auditoria order by id desc limit 1");
ok(aud[0]?.usuario_nombre==="Jonathan" && aud[0].campo==="nivel" && aud[0].valor_anterior==="editar" && aud[0].valor_nuevo==="ver", "auditoría registra quién, campo, antes y después: "+JSON.stringify(aud[0]));
ok(await falla(()=>como(jonathan,()=>db.query("update registro_auditoria set descripcion='x'"))), "auditoría: UPDATE prohibido incluso al superusuario");
ok(await falla(()=>como(jonathan,()=>db.query("delete from registro_auditoria"))), "auditoría: DELETE prohibido incluso al superusuario");
ok(await falla(()=>como(jonathan,()=>db.query("delete from perfiles where id=$1",[vendedor]))), "perfiles no se pueden borrar");
await como(jonathan,()=>db.query("select registrar_auditoria('perfiles',$1,'otro','Contraseña restablecida')",[vendedor]));
ok((await db.query("select 1 from registro_auditoria where descripcion='Contraseña restablecida'")).rows.length===1, "registrar_auditoria (reset de contraseña) funciona");

console.log(fallos? `\n${fallos} FALLA(S)` : "\nTodo OK");
process.exit(fallos?1:0);
