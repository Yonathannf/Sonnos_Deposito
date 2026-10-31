-- =====================================================================
-- Sonnos Depósito · Etapa 9 · Verificación de consistencia entre módulos
-- Ejecutar DESPUÉS de 0005_operaciones.sql. Se consulta desde la app (Historial)
-- o con:  select * from public.verificar_consistencia();
-- =====================================================================
create or replace function public.verificar_consistencia()
returns table (chequeo text, ok boolean, cantidad int, detalle text)
language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  if not (public.puede('historial') or public.puede('usuarios')) then raise exception 'Sin permiso'; end if;

  select count(*) into v from insumos i
    where i.stock_actual <> coalesce((select sum(case m.tipo when 'consumo' then -m.cantidad else m.cantidad end)
                                      from insumo_movimientos m where m.insumo_id = i.id), 0);
  return query select 'Insumos: stock = suma de sus movimientos', v = 0, v, 'Insumos cuyo stock no coincide con el historial de movimientos';

  select count(*) into v from insumos where stock_actual < 0;
  return query select 'Insumos: sin stock negativo', v = 0, v, 'Insumos con stock negativo';

  select count(*) into v from stock_productos p
    where p.ajuste_local <> coalesce((select sum(m.cantidad) from stock_movimientos m where m.sku = p.sku and m.incorporado_en is null), 0);
  return query select 'Stock: lo recibido pendiente = movimientos sin incorporar', v = 0, v, 'Productos cuyo ajuste local no coincide con los movimientos de recepción';

  select count(*) into v from (
    select r.id from recepciones r where r.estado = 'Confirmada'
      and coalesce((select sum(i.recibido - i.danado) from recepcion_items i where i.recepcion_id = r.id), 0)
        <> coalesce((select sum(m.cantidad) from stock_movimientos m where m.ref_tabla = 'recepciones' and m.ref_id = r.id), 0)) x;
  return query select 'Recepciones confirmadas = movimientos de stock', v = 0, v, 'Recepciones confirmadas cuyas unidades no coinciden con lo sumado al stock';

  select count(*) into v from recepciones r where r.estado = 'Borrador'
    and exists (select 1 from stock_movimientos m where m.ref_tabla = 'recepciones' and m.ref_id = r.id);
  return query select 'Recepciones en borrador sin movimientos', v = 0, v, 'Borradores que ya movieron stock';

  select count(*) into v from pedidos where estado in ('Armado','Entregado') and fecha_armado is null;
  return query select 'Pedidos armados/entregados con fecha de armado', v = 0, v, 'Pedidos armados o entregados sin fecha de armado';

  select count(*) into v from armados a join pedidos p on p.id = a.pedido_id where a.estado = 'FINALIZADO' and p.estado = 'Impreso';
  return query select 'Armados finalizados vs. estado del pedido', v = 0, v, 'Pedidos con armado registrado que figuran como "Impreso"';

  select count(*) into v from pedidos p join rutas r on r.id = p.ruta_id where p.dia_a_despachar is distinct from r.fecha;
  return query select 'Pedidos en hoja de ruta con el día correcto', v = 0, v, 'Pedidos asignados a una ruta de otra fecha';

  select count(*) into v from pedidos where estado = 'Entregado' and operario_id is null and bultos is null;
  return query select 'Informativo: pedidos entregados sin operario ni bultos', true, v, 'Datos históricos incompletos; no es un error del sistema';

  select count(*) into v from conteos c where c.estado = 'Cerrado' and not exists (select 1 from conteo_items i where i.conteo_id = c.id);
  return query select 'Conteos cerrados con artículos', v = 0, v, 'Conteos cerrados vacíos';

  select count(*) into v from conteo_items_calc i join conteos c on c.id = i.conteo_id
    where c.estado = 'Cerrado' and i.resultado in ('FALTANTE','SOBRANTE') and i.ajuste is null and c.cerrado_en is not null
      and c.creado_por is not null;   -- los conteos históricos migrados no generan ajustes
  return query select 'Diferencias de conteos cerrados con ajuste asignado', v = 0, v, 'Diferencias fuera de tolerancia sin ajuste pendiente/resuelto';

  select count(*) into v from tareas where (estado = 'Finalizada' and (fin is null or inicio is null)) or (estado = 'En curso' and inicio is null);
  return query select 'Tareas con tiempos completos', v = 0, v, 'Tareas finalizadas/en curso sin hora de inicio o fin';

  select count(*) into v from solicitudes_compra s where s.estado = 'Recibida'
    and not exists (select 1 from insumo_movimientos m where m.solicitud_id = s.id);
  return query select 'Solicitudes recibidas con ingreso de insumo', v = 0, v, 'Solicitudes marcadas como recibidas sin su ingreso';
end $$;
