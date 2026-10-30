// Uso:  node --env-file=.env.local scripts/crear-superusuario.mjs "email@dominio.com" "Nombre Apellido" [rol]
// Crea el usuario en Supabase Auth + su perfil como superusuario. Rol por defecto: jefe_deposito.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

const [email, nombre, rolCodigo = "jefe_deposito"] = process.argv.slice(2);
if (!email || !nombre) {
  console.error('Uso: node --env-file=.env.local scripts/crear-superusuario.mjs "email" "Nombre" [rol]');
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Contraseña (mín. 8 caracteres): ");
rl.close();
if (password.length < 8) { console.error("La contraseña es muy corta."); process.exit(1); }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: rol, error: eRol } = await admin.from("roles").select("id").eq("codigo", rolCodigo).single();
if (eRol || !rol) { console.error(`No existe el rol "${rolCodigo}". ¿Corriste la migración 0001?`); process.exit(1); }

const { data: u, error: eU } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (eU) { console.error("Auth:", eU.message); process.exit(1); }

const { error: eP } = await admin.from("perfiles").insert({
  id: u.user.id, nombre, email: email.toLowerCase(), rol_id: rol.id, superusuario: true,
});
if (eP) {
  await admin.auth.admin.deleteUser(u.user.id);
  console.error("Perfil:", eP.message);
  process.exit(1);
}
console.log(`Listo: ${nombre} <${email}> creado como superusuario (${rolCodigo}).`);
