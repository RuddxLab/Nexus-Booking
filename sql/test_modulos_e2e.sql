-- ═══════════════════════════════════════════════════════════════════════════
-- CORREDOR DE PRUEBAS E2E · ejercita todos los módulos sobre la empresa DEMO QA
-- (slug 'demo-qa', id 27 en QA). Requiere haber corrido seed_demo_qa.sql antes.
--
-- Corre TODO en una transacción y hace ROLLBACK al final: no deja rastro.
-- Se puede re-ejecutar infinitas veces. Devuelve un reporte PASS/FAIL por caso.
--
-- Impersona vía request.jwt.claims (lo que lee auth.uid()). Las RPCs públicas
-- son SECURITY DEFINER y no dependen del rol del que llama.
-- ═══════════════════════════════════════════════════════════════════════════
begin;
create temp table res(paso int, modulo text, caso text, ok boolean, detalle text);

do $$
declare
  v_admin uuid := 'ceed05a8-34c2-40c1-a787-0443ad8f752e';       -- admin de DEMO QA
  v_sup   uuid := '1ce8b3f7-2652-46b8-9467-8303f5115b37';       -- supervisor de OTRA empresa
  v_emp int := 27; v_suc int; v_ana int; v_beto int;
  v_corte int; v_barba int; v_shampoo int;
  v_hoy date := hoy_chile();
  v_res json; v_ag int; v_r1 jsonb; v_r2 jsonb; v_v1 int; v_v2 int;
  v_com numeric; v_ori text; v_pago text; n int;
begin
  select id_sucursal into v_suc from sucursales where id_empresa=v_emp;
  select id_prestador into v_ana  from prestadores where id_empresa=v_emp and nombre_prestador='Ana Prueba';
  select id_prestador into v_beto from prestadores where id_empresa=v_emp and nombre_prestador='Beto Prueba';
  select id_servicio  into v_corte from servicios where id_empresa=v_emp and nombre_servicio='Corte de pelo';
  select id_servicio  into v_barba from servicios where id_empresa=v_emp and nombre_servicio='Perfilado de barba';
  select id_producto  into v_shampoo from productos where id_empresa=v_emp and nombre='Shampoo premium';

  -- MÓDULO 1 · RESERVA PÚBLICA (anónima)
  perform set_config('request.jwt.claims','', true);
  insert into res values (1,'Reserva pública','resolver_tenant devuelve empresa 27',
    (resolver_tenant_publico('demo-qa')->>'id_empresa')::int = 27,
    'id='||coalesce((resolver_tenant_publico('demo-qa')->>'id_empresa'),'null'));
  select count(*) into n from servicios_publico(27);
  insert into res values (2,'Reserva pública','servicios_publico = 3', n=3, 'n='||n);
  select count(*) into n from prestadores_publico(27);
  insert into res values (3,'Reserva pública','prestadores_publico = 2', n=2, 'n='||n);
  v_res := crear_reserva_publica(v_emp,v_suc,v_ana,v_corte,v_hoy,'15:00','Test Bot','+56900000000','testbot@demo.cl',null);
  v_ag := (v_res->>'id')::int;
  insert into res values (4,'Reserva pública','crear_reserva_publica crea cita', v_ag is not null, 'id_cita='||coalesce(v_ag::text,'null'));
  select count(*) into n from horas_ocupadas_publico(v_ana, v_hoy, 27) where hora_inicio='15:00';
  insert into res values (5,'Reserva pública','horas_ocupadas refleja la reserva', n=1, 'coincidencias='||n);

  -- MÓDULO 2 · PUNTO DE VENTA (admin)
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  v_r1 := emitir_venta(v_emp, v_suc,
    jsonb_build_array(
      jsonb_build_object('tipo','SERVICIO','id_servicio',v_corte,'id_prestador',v_ana,'id_agendamiento',v_ag),
      jsonb_build_object('tipo','PRODUCTO','id_producto',v_shampoo)),
    null,null,'Cliente Test',
    jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',20000,'ajuste_redondeo',0),
                      jsonb_build_object('medio','DEBITO','monto',1420)));
  v_v1 := (v_r1->>'id_venta')::int;
  insert into res values (6,'Punto de venta','emitir_venta total 21.420 (neto 18.000 + IVA 3.420)',
    (v_r1->>'total')::numeric = 21420, 'total='||(v_r1->>'total'));
  select comision_monto, comision_origen into v_com, v_ori from venta_items where id_venta=v_v1 and id_servicio=v_corte;
  insert into res values (7,'Comisiones','MAYOR elige servicio 20% ($2.400) > prestador 15% ($1.800)',
    v_com=2400 and v_ori='SERVICIO', 'comision='||v_com||' origen='||v_ori);
  select estado_pago into v_pago from agendamientos where id_agendamiento=v_ag;
  insert into res values (8,'Punto de venta','la cita cobrada queda PAGADO', v_pago='PAGADO', 'estado_pago='||v_pago);

  -- MÓDULO 3 · ANULACIÓN
  perform anular_venta(v_v1,'prueba automática');
  select estado_pago into v_pago from agendamientos where id_agendamiento=v_ag;
  insert into res values (9,'Anulación','anular libera la cita a PENDIENTE', v_pago='PENDIENTE', 'estado_pago='||v_pago);

  -- MÓDULO 4 · WALK-IN + comisión monto fijo
  v_r2 := emitir_venta(v_emp, v_suc,
    jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
    null,null,'Walk-in',
    jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',9520)));
  v_v2 := (v_r2->>'id_venta')::int;
  select comision_monto, comision_origen into v_com, v_ori from venta_items where id_venta=v_v2 and id_servicio=v_barba;
  insert into res values (10,'Comisiones','MAYOR elige prestador $5.000 > servicio $2.000 (montos fijos)',
    (v_r2->>'total')::numeric=9520 and v_com=5000 and v_ori='PRESTADOR',
    'total='||(v_r2->>'total')||' comision='||v_com||' origen='||v_ori);

  -- MÓDULO 5 · DASHBOARD
  insert into res values (11,'Dashboard','1 venta emitida por $9.520 (la 1 fue anulada)',
    (dashboard_resumen(v_hoy,v_hoy,27)->'kpis'->>'ventas_emitidas')::numeric = 1
    and (dashboard_resumen(v_hoy,v_hoy,27)->'kpis'->>'ingresos_facturados')::numeric = 9520,
    'ventas='||(dashboard_resumen(v_hoy,v_hoy,27)->'kpis'->>'ventas_emitidas')
    ||' facturado='||(dashboard_resumen(v_hoy,v_hoy,27)->'kpis'->>'ingresos_facturados'));

  -- MÓDULO 6 · AISLAMIENTO (supervisor de otra empresa)
  perform set_config('request.jwt.claims', json_build_object('sub',v_sup,'role','authenticated')::text, true);
  insert into res values (12,'Aislamiento','supervisor ajeno ve 0 en el dashboard de la 27',
    (dashboard_resumen(v_hoy,v_hoy,27)->>'empresas_visibles')::int = 0,
    'empresas_visibles='||(dashboard_resumen(v_hoy,v_hoy,27)->>'empresas_visibles'));
  begin
    perform emitir_venta(27, v_suc, jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)));
    insert into res values (13,'Aislamiento','supervisor ajeno NO puede emitir en la 27', false, 'se permitió (mal)');
  exception when insufficient_privilege then
    insert into res values (13,'Aislamiento','supervisor ajeno NO puede emitir en la 27', true, 'bloqueado');
  end;
end $$;

select paso, modulo, caso, case when ok then '✅ PASS' else '❌ FAIL' end as resultado, detalle
from res order by paso;
rollback;
