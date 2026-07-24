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
  -- Promociones (2x1, cupones, gift cards)
  v_2x1 int; v_cupon int; v_gc int; v_r3 jsonb; v_r4 jsonb; v_v3 int;
  v_saldo numeric;
  v_gc_a int; v_gc_b int; v_gc_c int;
  v_v_aud int; r_aud record;
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

  -- MÓDULO 7 · PROMOCIONES (2x1, cupones, gift cards) — de vuelta como admin
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);

  -- 7.1 · 2x1 sobre el corte ($12.000 neto): lleva 2 paga 1 → regala uno
  insert into descuentos (id_empresa, nombre, tipo, valor, aplica_a, id_servicio, nx_lleva, nx_paga, activo)
  values (v_emp,'2x1 en cortes','NXM',0,'SERVICIOS',v_corte,2,1,true)
  returning id_descuento into v_2x1;
  v_r3 := emitir_venta(v_emp, v_suc,
    jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_corte,'id_prestador',v_ana,'cantidad',2)),
    null,null,'Promo 2x1', jsonb_build_array(jsonb_build_object('medio','DEBITO','monto',14280)),
    null, v_2x1);
  insert into res values (14,'Promociones','2x1: 2 cortes de $12.000 → descuento $12.000, total $14.280',
    (v_r3->>'descuento')::numeric = 12000 and (v_r3->>'total')::numeric = 14280,
    'descuento='||(v_r3->>'descuento')||' total='||(v_r3->>'total'));

  -- 7.2 · Cupón de un solo uso
  insert into descuentos (id_empresa, nombre, tipo, valor, aplica_a, codigo, max_usos, activo)
  values (v_emp,'Cupón bienvenida','PORCENTAJE',50,'TODO','BIENVENIDA',1,true)
  returning id_descuento into v_cupon;
  v_r4 := emitir_venta(v_emp, v_suc,
    jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
    null,null,'Cupón 1', jsonb_build_array(jsonb_build_object('medio','DEBITO','monto',4760)),
    null, v_cupon);
  insert into res values (15,'Promociones','cupón 50% descuenta $4.000 sobre el neto de $8.000',
    (v_r4->>'descuento')::numeric = 4000 and (v_r4->>'total')::numeric = 4760,
    'descuento='||(v_r4->>'descuento')||' total='||(v_r4->>'total'));
  select usos into n from descuentos where id_descuento = v_cupon;
  insert into res values (16,'Promociones','el uso del cupón queda contabilizado', n = 1, 'usos='||n);
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Cupón 2', jsonb_build_array(jsonb_build_object('medio','DEBITO','monto',4760)),
      null, v_cupon);
    insert into res values (17,'Promociones','cupón agotado se rechaza en el segundo uso', false, 'se permitió (mal)');
  exception when others then
    insert into res values (17,'Promociones','cupón agotado se rechaza en el segundo uso', true, 'bloqueado: '||sqlerrm);
  end;

  -- 7.3 · Gift card: emitir, cobrar con ella y recuperar el saldo al anular
  v_gc := (emitir_gift_card(v_emp,'GC-TEST-E2E',50000)->>'id_gift_card')::int;
  select saldo into v_saldo from gift_cards where id_gift_card = v_gc;
  insert into res values (18,'Gift cards','se emite con saldo $50.000', v_saldo = 50000, 'saldo='||v_saldo);
  v_r3 := emitir_venta(v_emp, v_suc,
    jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
    null,null,'Pago con gift card',
    jsonb_build_array(jsonb_build_object('medio','GIFTCARD','monto',9520,'id_gift_card',v_gc)));
  v_v3 := (v_r3->>'id_venta')::int;
  select saldo into v_saldo from gift_cards where id_gift_card = v_gc;
  insert into res values (19,'Gift cards','cobrar $9.520 deja saldo $40.480', v_saldo = 40480, 'saldo='||v_saldo);
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_corte,'id_prestador',v_ana,'cantidad',5)),
      null,null,'Sin saldo',
      jsonb_build_array(jsonb_build_object('medio','GIFTCARD','monto',71400,'id_gift_card',v_gc)));
    insert into res values (20,'Gift cards','sin saldo suficiente se rechaza', false, 'se permitió (mal)');
  exception when others then
    insert into res values (20,'Gift cards','sin saldo suficiente se rechaza', true, 'bloqueado: '||sqlerrm);
  end;
  perform anular_venta(v_v3,'prueba gift card');
  select saldo into v_saldo from gift_cards where id_gift_card = v_gc;
  insert into res values (21,'Gift cards','anular devuelve el saldo a $50.000', v_saldo = 50000, 'saldo='||v_saldo);
  select count(*) into n from gift_card_movimientos where id_gift_card = v_gc;
  insert into res values (22,'Gift cards','quedan 3 movimientos (emisión, consumo, reversa)', n = 3, 'movimientos='||n);

  -- MÓDULO 8 · CUADRATURA DE PAGOS · el vuelto es exclusivo del efectivo
  -- (barba: neto $8.000 + IVA = total $9.520)
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Vuelto efectivo', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',20000,'ajuste_redondeo',0)));
    insert into res values (23,'Cuadratura','efectivo $20.000 sobre $9.520 → permite vuelto', true, 'ok');
  exception when others then insert into res values (23,'Cuadratura','efectivo permite vuelto', false, 'rechazo: '||sqlerrm); end;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Débito de más', jsonb_build_array(jsonb_build_object('medio','DEBITO','monto',10000)));
    insert into res values (24,'Cuadratura','débito de más se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (24,'Cuadratura','débito de más se rechaza', true, sqlerrm); end;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Mezcla de más', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',5000,'ajuste_redondeo',0),
                                                   jsonb_build_object('medio','DEBITO','monto',5000)));
    insert into res values (25,'Cuadratura','mezcla con exceso se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (25,'Cuadratura','mezcla con exceso se rechaza', true, sqlerrm); end;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Mezcla exacta', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',5000,'ajuste_redondeo',0),
                                                   jsonb_build_object('medio','DEBITO','monto',4520)));
    insert into res values (26,'Cuadratura','mezcla exacta se acepta', true, 'ok');
  exception when others then insert into res values (26,'Cuadratura','mezcla exacta se acepta', false, 'rechazo: '||sqlerrm); end;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Insuficiente', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',5000,'ajuste_redondeo',0)));
    insert into res values (27,'Cuadratura','pago insuficiente se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (27,'Cuadratura','pago insuficiente se rechaza', true, sqlerrm); end;
  begin
    -- El ajuste de la Ley 20.956 no es vuelto: $4.517 débito + $5.003 en efectivo
    -- que se entregan como $5.000 (ajuste −3) siguen cuadrando los $9.520.
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Redondeo legal', jsonb_build_array(jsonb_build_object('medio','DEBITO','monto',4517),
                                                    jsonb_build_object('medio','EFECTIVO','monto',5000,'ajuste_redondeo',-3)));
    insert into res values (28,'Cuadratura','el redondeo Ley 20.956 no se confunde con vuelto', true, 'ok');
  exception when others then insert into res values (28,'Cuadratura','redondeo Ley 20.956', false, 'rechazo: '||sqlerrm); end;
  begin
    -- Un medio no se repite: dos pagos en efectivo son un solo pago por la suma
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Doble efectivo', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',5000,'ajuste_redondeo',0),
                                                    jsonb_build_object('medio','EFECTIVO','monto',4520,'ajuste_redondeo',0)));
    insert into res values (29,'Cuadratura','el mismo medio repetido se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (29,'Cuadratura','el mismo medio repetido se rechaza', true, sqlerrm); end;

  -- Las gift cards son la excepción a la regla anterior: son instrumentos al
  -- portador con saldo propio, así que se pueden usar varias en una venta.
  -- Cada tarjeta se emite con saldo de sobra para que un rechazo no pueda
  -- confundirse con falta de saldo.
  v_gc_a := (emitir_gift_card(v_emp,'GC-A-E2E',5000)->>'id_gift_card')::int;
  v_gc_b := (emitir_gift_card(v_emp,'GC-B-E2E',5000)->>'id_gift_card')::int;
  v_gc_c := (emitir_gift_card(v_emp,'GC-C-E2E',50000)->>'id_gift_card')::int;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Dos gift cards',
      jsonb_build_array(jsonb_build_object('medio','GIFTCARD','monto',5000,'id_gift_card',v_gc_a),
                        jsonb_build_object('medio','GIFTCARD','monto',4520,'id_gift_card',v_gc_b)));
    select saldo into v_saldo from gift_cards where id_gift_card = v_gc_b;
    insert into res values (30,'Cuadratura','dos gift cards DISTINTAS se aceptan', v_saldo = 480, 'saldo B='||v_saldo);
  exception when others then insert into res values (30,'Cuadratura','dos gift cards distintas se aceptan', false, 'rechazo: '||sqlerrm); end;
  begin
    perform emitir_venta(v_emp, v_suc,
      jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
      null,null,'Misma gift card dos veces',
      jsonb_build_array(jsonb_build_object('medio','GIFTCARD','monto',3000,'id_gift_card',v_gc_c),
                        jsonb_build_object('medio','GIFTCARD','monto',6520,'id_gift_card',v_gc_c)));
    insert into res values (31,'Cuadratura','la MISMA gift card dos veces se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (31,'Cuadratura','la MISMA gift card dos veces se rechaza', true, sqlerrm); end;

  -- MÓDULO 9 · AUDITORÍA DE ANULACIONES
  -- Anular es el vector clásico de fuga de caja (se cobra, se anula, se queda
  -- el efectivo): lo que importa es que quede quién, cuándo y por qué.
  v_v_aud := (emitir_venta(v_emp, v_suc,
    jsonb_build_array(jsonb_build_object('tipo','SERVICIO','id_servicio',v_barba,'id_prestador',v_beto)),
    null,null,'Auditoría', jsonb_build_array(jsonb_build_object('medio','EFECTIVO','monto',9520)))->>'id_venta')::int;
  begin
    perform anular_venta(v_v_aud);
    insert into res values (32,'Auditoría','anular sin motivo se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (32,'Auditoría','anular sin motivo se rechaza', true, sqlerrm); end;
  begin
    perform anular_venta(v_v_aud, 'ups');
    insert into res values (33,'Auditoría','motivo demasiado breve se rechaza', false, 'se permitió (mal)');
  exception when others then insert into res values (33,'Auditoría','motivo demasiado breve se rechaza', true, sqlerrm); end;
  perform anular_venta(v_v_aud, 'Cobro duplicado por error del cajero');
  select anulada_por, motivo_anulacion, fecha_anulacion into r_aud from ventas where id_venta = v_v_aud;
  insert into res values (34,'Auditoría','la anulación registra quién, cuándo y por qué',
    r_aud.anulada_por = v_admin and r_aud.motivo_anulacion = 'Cobro duplicado por error del cajero'
      and r_aud.fecha_anulacion is not null,
    'por='||coalesce(r_aud.anulada_por::text,'null')||' motivo='||coalesce(r_aud.motivo_anulacion,'null'));
  select count(*) into n from anulaciones_periodo(v_hoy, v_hoy, v_emp) where id_venta = v_v_aud;
  insert into res values (35,'Auditoría','la anulación aparece en el reporte', n = 1, 'filas='||n);
  -- El reporte respeta el aislamiento igual que el dashboard
  perform set_config('request.jwt.claims', json_build_object('sub',v_sup,'role','authenticated')::text, true);
  select count(*) into n from anulaciones_periodo(v_hoy, v_hoy, v_emp);
  insert into res values (36,'Auditoría','supervisor ajeno no ve las anulaciones de la 27', n = 0, 'filas='||n);
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
end $$;

select paso, modulo, caso, case when ok then '✅ PASS' else '❌ FAIL' end as resultado, detalle
from res order by paso;
rollback;
