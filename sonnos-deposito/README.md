# Sonnos Depósito

App web (Next.js 16 + Supabase + Vercel) que reemplaza los Excel del depósito de Sonnos.

## Módulos
Dashboard · Pedidos · Hoja de ruta · Clientes · Transportes · Armado (registro, indicadores, operarios) ·
Stock (importa el LISTADO del ERP, alertas de mínimo) · Inventario (conteos con tolerancia ±3 %) ·
Insumos (movimientos inmutables, solicitudes de compra, ranking) · Recepción de mercadería (fotos, suma al stock) ·
Tareas · Postventa · Reportes (9 tipos, Excel y PDF) · Historial/auditoría con control de consistencia · Usuarios y permisos.

## Puesta en marcha
1. **Supabase**: SQL Editor → ejecutar en orden `supabase/migrations/0001_base.sql` y luego `migraciones_0002_a_0006.sql`
   (o los archivos 0002…0006 uno por uno).
2. *Authentication > Providers > Email*: desactivar "Allow new users to sign up".
3. (Opcional) cargar los datos históricos con `supabase/seed/01…05` (**no van a GitHub**, ver `.gitignore`).
4. Copiar `.env.example` a `.env.local` y completar las claves. `npm install`.
5. Primer superusuario: `node --env-file=.env.local scripts/crear-superusuario.mjs "mail" "Nombre"`.
6. `npm run dev`.

## Deploy
Vercel con Root Directory `sonnos-deposito` y las variables de `.env.example`
(la clave secreta solo del lado servidor).

## Reglas de negocio clave
- Pedido: Impreso → Armado → Entregado (un trigger impide saltear Armado). Registrar un armado vincula el pedido por número y lo pasa a Armado.
- Stock = foto diaria importada del LISTADO. Las recepciones suman a `ajuste_local` hasta la próxima importación.
- Inventario: acierto si la diferencia es ≤ 3 % del stock de sistema. Conteos cerrados y recepciones confirmadas son inmutables.
- Insumos: el stock solo cambia por movimientos (ingreso/consumo), no se editan ni borran.
- Todo cambio queda en `registro_auditoria` (inmutable). `/historial` corre 13 controles de consistencia entre módulos.

## Tests
`npm run test:permisos` y `npm run test:operativo` (Postgres embebido PGlite, sin necesitar Supabase).

## Backups
El plan gratuito de Supabase **no hace backups automáticos**. Descargar periódicamente un dump
(Project Settings > Database > Backups, o `pg_dump` con la cadena de conexión) o pasar a plan Pro.
