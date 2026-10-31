-- =====================================================================
-- Sonnos Depósito · Etapa 5 · Stock (foto diaria del ERP) y seguimiento
-- Ejecutar DESPUÉS de 0002_operativo.sql.
-- =====================================================================

-- Catálogo completo del ERP + stock por depósito (se reemplaza en cada importación del LISTADO)
create table if not exists public.stock_productos (
  sku text primary key,
  descripcion text,
  categoria text, subcategoria text, marca text,
  fisico_ramos int, disp_ramos int,
  fisico_mayogym int, disp_mayogym int,
  fisico_central int, disp_central int,
  fisico_full int, disp_full int,
  fisico_marmol int, disp_marmol int,
  fisico_outlet int, disp_outlet int,
  fisico_discontinuo int, disp_discontinuo int,
  fisico_compras int, disp_compras int,
  fisico_anticipada int, disp_anticipada int,
  fisico_showroom int,
  -- totales calculados por nosotros (la columna Stk del ERP es poco confiable)
  stk int generated always as (
    coalesce(fisico_ramos,0)+coalesce(fisico_mayogym,0)+coalesce(fisico_central,0)+coalesce(fisico_full,0)+
    coalesce(fisico_marmol,0)+coalesce(fisico_outlet,0)+coalesce(fisico_discontinuo,0)+coalesce(fisico_compras,0)+
    coalesce(fisico_anticipada,0)+coalesce(fisico_showroom,0)) stored,
  astk int generated always as (
    coalesce(disp_ramos,0)+coalesce(disp_mayogym,0)+coalesce(disp_central,0)+coalesce(disp_full,0)+
    coalesce(disp_marmol,0)+coalesce(disp_outlet,0)+coalesce(disp_discontinuo,0)+coalesce(disp_compras,0)+
    coalesce(disp_anticipada,0)) stored,
  -- "stock del sistema" para el control de inventario: MayoGym + Central + Anticipada + Outlet (físico)
  stk_control int generated always as (
    coalesce(fisico_mayogym,0)+coalesce(fisico_central,0)+coalesce(fisico_anticipada,0)+coalesce(fisico_outlet,0)) stored,
  minimo int check (minimo is null or minimo >= 0),
  en_seguimiento boolean not null default false,
  actualizado_en timestamptz not null default now()
);
create index if not exists idx_stock_desc on public.stock_productos using btree (lower(descripcion));
create index if not exists idx_stock_seg on public.stock_productos (en_seguimiento) where en_seguimiento;

-- Lista de arranque: qué SKUs se siguen y con qué mínimo (del Excel "Mínimos de stock")
create table if not exists public.seguimiento_default (sku text primary key, minimo int);
insert into public.seguimiento_default (sku, minimo) values
  ('197029',6),
  ('197030',6),
  ('197032',6),
  ('197037',48),
  ('197038',12),
  ('197039',24),
  ('197043',12),
  ('197044',24),
  ('197045',30),
  ('197046',6),
  ('197048',42),
  ('197050',12),
  ('197051',12),
  ('197053',6),
  ('197057',6),
  ('197058',24),
  ('197063',6),
  ('197089',10),
  ('197228',5),
  ('197229',200),
  ('197709',30),
  ('265001',1500),
  ('265002',3000),
  ('265003',3000),
  ('265004',500),
  ('265009',50),
  ('265010',50),
  ('265011',50),
  ('265012',50),
  ('265013',50),
  ('265014',50),
  ('265015',30),
  ('265016',30),
  ('265017',30),
  ('265100',300),
  ('265101',1000),
  ('265113',200),
  ('265114',100),
  ('265115',100),
  ('265230',150),
  ('265231',200),
  ('265232',100),
  ('265233',20),
  ('265234',20),
  ('265237',20),
  ('265238',20),
  ('265240',20),
  ('265245',100),
  ('265341',70),
  ('265365',10),
  ('265371',50),
  ('265384',10),
  ('265518',50),
  ('265519',50),
  ('361001',2600),
  ('361002',2600),
  ('361003',120),
  ('361008',30),
  ('412033',30),
  ('412212',30),
  ('412215',50),
  ('412475',4),
  ('412477',4),
  ('412515-10-1',10),
  ('412515-11-1',10),
  ('412515-13-1',10),
  ('412515-2-1',10),
  ('412515-6-1',5),
  ('412515-8-1',10),
  ('412515-9-1',10),
  ('412519-10-1',10),
  ('412519-11-1',10),
  ('412519-13-1',10),
  ('412519-2-1',10),
  ('412519-6-1',5),
  ('412519-8-1',10),
  ('412519-9-1',10),
  ('412521-10-1',5),
  ('412521-11-1',5),
  ('412521-13-1',5),
  ('412521-2-1',5),
  ('412521-6-1',5),
  ('412521-8-1',5),
  ('412521-9-1',5),
  ('412523-10-1',5),
  ('412523-11-1',5),
  ('412523-13-1',5),
  ('412523-2-1',5),
  ('412523-6-1',5),
  ('412523-8-1',5),
  ('412534-3-1',4),
  ('412544-10-1',8),
  ('412544-11-1',4),
  ('412544-13-1',8),
  ('412544-2-1',8),
  ('412544-26-1',6),
  ('412544-6-1',4),
  ('412544-7-1',4),
  ('412544-8-1',4),
  ('412544-9-1',4),
  ('412547',5),
  ('412548-10-1',15),
  ('412548-11-1',4),
  ('412548-13-1',15),
  ('412548-2-1',15),
  ('412548-26-1',8),
  ('412548-6-1',4),
  ('412548-7-1',4),
  ('412548-8-1',4),
  ('412548-9-1',4),
  ('412549',4),
  ('412550-10-1',8),
  ('412550-11-1',4),
  ('412550-13-1',8),
  ('412550-2-1',8),
  ('412550-6-1',4),
  ('412550-8-1',4),
  ('412550-9-1',4),
  ('412552-10-1',4),
  ('412552-11-1',4),
  ('412552-13-1',4),
  ('412552-2-1',4),
  ('412552-6-1',4),
  ('412552-8-1',4),
  ('412552-9-1',4),
  ('412559-13-1',50),
  ('412559-3-1',50),
  ('412559-6-1',20),
  ('412560',50),
  ('412607',4),
  ('412631',2),
  ('412637',20),
  ('412679',4),
  ('412681',4),
  ('992001',6),
  ('992002',6),
  ('992003',6),
  ('992004',6),
  ('992005',5),
  ('992006',5),
  ('992007',6),
  ('992008',6),
  ('992009',6),
  ('992010',6),
  ('992011',10),
  ('992012',3),
  ('992013',6),
  ('992014',6),
  ('992015',6),
  ('992016',6),
  ('992017',3),
  ('992018',3)
on conflict (sku) do nothing;

-- Foto diaria de los productos en seguimiento (permite ver tendencia y consumo)
create table if not exists public.stock_historial (
  sku text not null,
  fecha date not null,
  stk int not null,
  astk int not null,
  primary key (sku, fecha)
);

create table if not exists public.stock_importaciones (
  id integer generated by default as identity primary key,
  fecha timestamptz not null default now(),
  usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
  usuario_nombre text,
  archivo text,
  total int not null,
  alertas int not null default 0
);

-- Al terminar una importación: aplica la lista por defecto si aún no hay seguimiento,
-- saca la foto del día y deja el registro de la importación.
create or replace function public.stock_finalizar_importacion(p_archivo text, p_total int)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_alertas int; v_sin_seg boolean;
begin
  if not public.puede('stock','editar') then raise exception 'Sin permiso para importar stock'; end if;
  select not exists (select 1 from stock_productos where en_seguimiento) into v_sin_seg;
  if v_sin_seg then
    update stock_productos p set en_seguimiento = true, minimo = coalesce(p.minimo, d.minimo)
      from seguimiento_default d where d.sku = p.sku;
  end if;
  insert into stock_historial (sku, fecha, stk, astk)
    select sku, (now() at time zone 'America/Argentina/Buenos_Aires')::date, stk, astk
    from stock_productos where en_seguimiento
  on conflict (sku, fecha) do update set stk = excluded.stk, astk = excluded.astk;
  select count(*) into v_alertas from stock_productos where en_seguimiento and minimo is not null and stk < minimo;
  insert into stock_importaciones (usuario_nombre, archivo, total, alertas)
    values ((select nombre from perfiles where id = auth.uid()), p_archivo, p_total, v_alertas);
  return jsonb_build_object('alertas', v_alertas, 'seguimiento_default', v_sin_seg);
end $$;

create or replace view public.stock_calc with (security_invoker = true) as
select p.*,
  case when p.minimo is null then 'SIN MÍNIMO'
       when p.stk < p.minimo then 'ALERTA' else 'OK' end as estado
from public.stock_productos p;

-- Auditoría solo de lo que edita una persona (mínimo / seguimiento), no de la carga masiva
drop trigger if exists aud_stock_productos on public.stock_productos;
create trigger aud_stock_productos after update of minimo, en_seguimiento on public.stock_productos
  for each row execute function public.trg_auditar();

-- RLS
alter table public.stock_productos     enable row level security;
alter table public.seguimiento_default enable row level security;
alter table public.stock_historial     enable row level security;
alter table public.stock_importaciones enable row level security;
drop policy if exists stock_sel on public.stock_productos;
create policy stock_sel on public.stock_productos for select to authenticated
  using (public.puede('stock') or public.puede('inventario') or public.puede('recepcion'));
drop policy if exists stock_ins on public.stock_productos;
create policy stock_ins on public.stock_productos for insert to authenticated with check (public.puede('stock','editar'));
drop policy if exists stock_upd on public.stock_productos;
create policy stock_upd on public.stock_productos for update to authenticated
  using (public.puede('stock','editar')) with check (public.puede('stock','editar'));
drop policy if exists segdef_sel on public.seguimiento_default;
create policy segdef_sel on public.seguimiento_default for select to authenticated using (public.puede('stock'));
drop policy if exists stockhist_sel on public.stock_historial;
create policy stockhist_sel on public.stock_historial for select to authenticated using (public.puede('stock'));
drop policy if exists stockhist_ins on public.stock_historial;
create policy stockhist_ins on public.stock_historial for insert to authenticated with check (public.puede('stock','editar'));
drop policy if exists stockhist_upd on public.stock_historial;
create policy stockhist_upd on public.stock_historial for update to authenticated
  using (public.puede('stock','editar')) with check (public.puede('stock','editar'));
drop policy if exists stockimp_sel on public.stock_importaciones;
create policy stockimp_sel on public.stock_importaciones for select to authenticated using (public.puede('stock'));
drop policy if exists stockimp_ins on public.stock_importaciones;
create policy stockimp_ins on public.stock_importaciones for insert to authenticated with check (public.puede('stock','editar'));
