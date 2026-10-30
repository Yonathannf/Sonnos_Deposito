-- =====================================================================
-- Sonnos Depósito · Etapa 1 · Base: roles, permisos, perfiles, auditoría
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run
-- =====================================================================

-- ---------- Tablas ----------------------------------------------------
create table if not exists public.roles (
  id          smallint generated always as identity primary key,
  codigo      text not null unique,
  nombre      text not null,
  es_admin    boolean not null default false
);

create table if not exists public.permisos_rol (
  rol_id  smallint not null references public.roles(id) on delete cascade,
  panel   text not null,
  nivel   text not null check (nivel in ('sin_acceso','ver','editar')),
  primary key (rol_id, panel)
);

create table if not exists public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  email          text not null unique,
  rol_id         smallint not null references public.roles(id),
  activo         boolean not null default true,
  superusuario   boolean not null default false,
  creado_en      timestamptz not null default now()
);

create table if not exists public.registro_auditoria (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  usuario_id      uuid references auth.users(id) on delete set null,
  usuario_nombre  text,
  entidad         text not null,
  entidad_id      text not null,
  accion          text not null check (accion in ('crear','editar','borrar','otro')),
  campo           text,
  valor_anterior  text,
  valor_nuevo     text,
  descripcion     text
);
create index if not exists idx_auditoria_fecha   on public.registro_auditoria (fecha desc);
create index if not exists idx_auditoria_entidad on public.registro_auditoria (entidad, entidad_id);

-- ---------- Funciones de permisos -------------------------------------
create or replace function public.es_superusuario()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select superusuario and activo from perfiles where id = auth.uid()), false);
$$;

-- Nivel efectivo del usuario logueado sobre un panel.
-- superusuario o rol admin => 'editar' en todo. Usuario inactivo => 'sin_acceso'.
create or replace function public.nivel_panel(p_panel text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.id is null or not p.activo then 'sin_acceso'
    when p.superusuario or r.es_admin then 'editar'
    else coalesce(
      (select pr.nivel from permisos_rol pr where pr.rol_id = p.rol_id and pr.panel = p_panel),
      'sin_acceso')
  end
  from (select 1) x
  left join perfiles p on p.id = auth.uid()
  left join roles r on r.id = p.rol_id;
$$;

-- ---------- Auditoría -------------------------------------------------
-- Trigger genérico: lo reutilizan todas las tablas de negocio de las etapas siguientes.
create or replace function public.trg_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
  v_id     text;
  k        text;
  v_old    jsonb;
  v_new    jsonb;
begin
  select nombre into v_nombre from perfiles where id = auth.uid();

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id  := coalesce(v_new->>'id', v_new->>'rol_id', '?') ||
             case when tg_table_name = 'permisos_rol' then ':' || (v_new->>'panel') else '' end;
    insert into registro_auditoria(usuario_id, usuario_nombre, entidad, entidad_id, accion, descripcion)
    values (auth.uid(), v_nombre, tg_table_name, v_id, 'crear', v_new::text);
    return new;

  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    v_id  := coalesce(v_new->>'id', v_new->>'rol_id', '?') ||
             case when tg_table_name = 'permisos_rol' then ':' || (v_new->>'panel') else '' end;
    for k in select jsonb_object_keys(v_new) loop
      if v_old->k is distinct from v_new->k then
        insert into registro_auditoria(usuario_id, usuario_nombre, entidad, entidad_id, accion, campo, valor_anterior, valor_nuevo)
        values (auth.uid(), v_nombre, tg_table_name, v_id, 'editar', k, v_old->>k, v_new->>k);
      end if;
    end loop;
    return new;

  else -- DELETE
    v_old := to_jsonb(old);
    v_id  := coalesce(v_old->>'id', v_old->>'rol_id', '?') ||
             case when tg_table_name = 'permisos_rol' then ':' || (v_old->>'panel') else '' end;
    insert into registro_auditoria(usuario_id, usuario_nombre, entidad, entidad_id, accion, descripcion)
    values (auth.uid(), v_nombre, tg_table_name, v_id, 'borrar', v_old::text);
    return old;
  end if;
end $$;

drop trigger if exists aud_perfiles on public.perfiles;
create trigger aud_perfiles after insert or update or delete on public.perfiles
  for each row execute function public.trg_auditar();

drop trigger if exists aud_permisos on public.permisos_rol;
create trigger aud_permisos after insert or update or delete on public.permisos_rol
  for each row execute function public.trg_auditar();

-- Auditoría manual (acciones sin cambio de tabla, p. ej. reseteo de contraseña).
create or replace function public.registrar_auditoria(
  p_entidad text, p_entidad_id text, p_accion text, p_descripcion text)
returns void language sql security definer set search_path = public as $$
  insert into registro_auditoria(usuario_id, usuario_nombre, entidad, entidad_id, accion, descripcion)
  select auth.uid(), (select nombre from perfiles where id = auth.uid()),
         p_entidad, p_entidad_id, p_accion, p_descripcion
  where auth.uid() is not null;
$$;

-- ---------- Protección anti-escalada en perfiles ---------------------
-- Solo un superusuario puede otorgar/quitar el flag superusuario o tocar a un superusuario.
create or replace function public.trg_guard_perfiles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service_role (script de arranque)
  if not public.es_superusuario() then
    if tg_op = 'INSERT' and new.superusuario then
      raise exception 'Solo un superusuario puede crear otro superusuario';
    end if;
    if tg_op = 'UPDATE' and (new.superusuario is distinct from old.superusuario or old.superusuario) then
      raise exception 'Solo un superusuario puede modificar a un superusuario';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_perfiles on public.perfiles;
create trigger guard_perfiles before insert or update on public.perfiles
  for each row execute function public.trg_guard_perfiles();

-- ---------- Row Level Security ----------------------------------------
alter table public.roles              enable row level security;
alter table public.permisos_rol       enable row level security;
alter table public.perfiles           enable row level security;
alter table public.registro_auditoria enable row level security;

-- roles / permisos: lectura para cualquier usuario autenticado, escritura con permiso de usuarios
drop policy if exists roles_sel on public.roles;
create policy roles_sel on public.roles for select to authenticated using (true);

drop policy if exists permisos_sel on public.permisos_rol;
create policy permisos_sel on public.permisos_rol for select to authenticated using (true);
drop policy if exists permisos_mod on public.permisos_rol;
create policy permisos_mod on public.permisos_rol for all to authenticated
  using (public.nivel_panel('usuarios') = 'editar')
  with check (public.nivel_panel('usuarios') = 'editar');

-- perfiles: cada uno ve el suyo; quien tiene 'usuarios' ver/editar ve todos
drop policy if exists perfiles_sel on public.perfiles;
create policy perfiles_sel on public.perfiles for select to authenticated
  using (id = auth.uid() or public.nivel_panel('usuarios') in ('ver','editar'));
drop policy if exists perfiles_ins on public.perfiles;
create policy perfiles_ins on public.perfiles for insert to authenticated
  with check (public.nivel_panel('usuarios') = 'editar');
drop policy if exists perfiles_upd on public.perfiles;
create policy perfiles_upd on public.perfiles for update to authenticated
  using (public.nivel_panel('usuarios') = 'editar')
  with check (public.nivel_panel('usuarios') = 'editar');
-- Sin policy de DELETE: los perfiles no se borran, se desactivan.

-- auditoría: solo lectura con permiso 'historial'. Sin policies de insert/update/delete => inmutable.
drop policy if exists auditoria_sel on public.registro_auditoria;
create policy auditoria_sel on public.registro_auditoria for select to authenticated
  using (public.nivel_panel('historial') in ('ver','editar'));
revoke insert, update, delete, truncate on public.registro_auditoria from anon, authenticated;
revoke all on public.registro_auditoria from anon;
revoke delete on public.perfiles from anon, authenticated;

-- ---------- Datos iniciales: roles y matriz de permisos ----------------
insert into public.roles (codigo, nombre, es_admin) values
  ('dueno',           'Dueño',                true),
  ('jefe_deposito',   'Jefe de depósito',     false),
  ('vendedor',        'Vendedor',             false),
  ('operario_deposito','Operario de depósito', false)
on conflict (codigo) do nothing;

-- Paneles: dashboard, pedidos, hoja_de_ruta, clientes, transportes, armado, stock,
--          inventario, insumos, recepcion, tareas, postventa, reportes, historial, usuarios
-- (lo que no figura acá queda como 'sin_acceso')
with p(rol, panel, nivel) as (values
  -- Jefe de depósito: opera todo, excepto usuarios
  ('jefe_deposito','dashboard','editar'),('jefe_deposito','pedidos','editar'),
  ('jefe_deposito','hoja_de_ruta','editar'),('jefe_deposito','clientes','editar'),
  ('jefe_deposito','transportes','editar'),('jefe_deposito','armado','editar'),
  ('jefe_deposito','stock','editar'),('jefe_deposito','inventario','editar'),
  ('jefe_deposito','insumos','editar'),('jefe_deposito','recepcion','editar'),
  ('jefe_deposito','tareas','editar'),('jefe_deposito','postventa','editar'),
  ('jefe_deposito','reportes','editar'),('jefe_deposito','historial','ver'),
  -- Vendedor: cargar pedidos, ajustar clientes y transportes, ver estado y hoja de ruta
  ('vendedor','pedidos','editar'),('vendedor','clientes','editar'),
  ('vendedor','transportes','editar'),('vendedor','hoja_de_ruta','ver'),
  -- Operario de depósito: armado, despacho, recepción, conteos
  ('operario_deposito','dashboard','ver'),('operario_deposito','pedidos','ver'),
  ('operario_deposito','hoja_de_ruta','ver'),('operario_deposito','armado','editar'),
  ('operario_deposito','stock','ver'),('operario_deposito','inventario','editar'),
  ('operario_deposito','insumos','editar'),('operario_deposito','recepcion','editar'),
  ('operario_deposito','tareas','editar'),('operario_deposito','postventa','ver')
)
insert into public.permisos_rol (rol_id, panel, nivel)
select r.id, p.panel, p.nivel from p join public.roles r on r.codigo = p.rol
on conflict (rol_id, panel) do nothing;
