# Sonnos Depósito

App web (Next.js 16 + Supabase) que reemplaza los Excel del depósito de Sonnos.
Estado: **Etapa 1 — base** (login, 4 roles, permisos por panel, auditoría).

## Puesta en marcha

1. **Supabase**: crear un proyecto en https://supabase.com. En *SQL Editor* pegar y ejecutar
   `supabase/migrations/0001_base.sql`.
2. En *Authentication > Providers > Email* dejar habilitado el login con contraseña y
   **desactivar "Allow new users to sign up"** (los usuarios los crea un superusuario desde la app).
3. Copiar `.env.example` a `.env.local` y completar las 3 claves (*Project Settings > API*).
4. `npm install`
5. Crear el primer superusuario:
   `node --env-file=.env.local scripts/crear-superusuario.mjs "tu@email.com" "Jonathan Franco"`
6. `npm run dev` y entrar a http://localhost:3000

## Deploy en Vercel

Importar el repo desde GitHub y cargar las 3 variables de entorno de `.env.example`
(`SUPABASE_SERVICE_ROLE_KEY` solo como variable de servidor, sin prefijo `NEXT_PUBLIC_`).

## Roles y permisos

| Rol | Alcance |
|---|---|
| Dueño | Acceso total |
| Jefe de depósito | Opera todo; historial solo lectura; sin gestión de usuarios |
| Vendedor | Carga pedidos, edita clientes y transportes; ve la hoja de ruta |
| Operario de depósito | Armado, inventario, insumos, recepción y tareas; consulta lo demás |

Los **superusuarios** (flag `perfiles.superusuario`, solo se otorga por script) tienen acceso total
y son los únicos que pueden modificar a otro superusuario. La matriz se edita en
*Usuarios > Matriz de permisos*. Los permisos se aplican en la base con RLS
(`nivel_panel()`), no solo en la interfaz.

## Auditoría

`registro_auditoria` es inmutable (sin policies de update/delete). El trigger `trg_auditar()` se
engancha a cada tabla de negocio que se agregue en las próximas etapas.
