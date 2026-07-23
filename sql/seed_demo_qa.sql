-- ═══════════════════════════════════════════════════════════════════════════
-- SEMILLA · Empresa "DEMO QA" completa para probar todos los módulos.
-- Idempotente: si ya existe (slug 'demo-qa'), no la recrea.
-- Se asocia al usuario admin para que aparezca en la UI.
-- Ejecutar en QA (axgxsmovzfmaasyzmnqn). NO en PROD.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_admin uuid := 'ceed05a8-34c2-40c1-a787-0443ad8f752e';  -- usuario admin
  v_emp int; v_suc int;
  v_tcs int; v_tcp int; v_cpelu int; v_cret int;
  v_corte int; v_barba int; v_cons int;
  v_shampoo int; v_cera int;
  v_ana int; v_beto int;
  v_cl1 int; v_cl2 int;
  d int;
begin
  if exists (select 1 from empresas where slug = 'demo-qa') then
    raise notice 'DEMO QA ya existe, no se recrea';
    return;
  end if;

  insert into empresas (nombre_empresa, slug, activo, catalogo_por_sucursal, tasa_iva, regla_comision, regla_redondeo)
  values ('DEMO QA', 'demo-qa', true, false, 19, 'MAYOR', 'TOTAL') returning id_empresa into v_emp;

  insert into sucursales (id_empresa, nombre_sucursal, slug, activo)
  values (v_emp, 'Casa Matriz', 'demo-qa', true) returning id_sucursal into v_suc;

  insert into tipo_categorias (id_empresa, id_sucursal, nombre_tipo_categoria, codigo, activo)
  values (v_emp, v_suc, 'Servicios', 'SERV', true) returning id_tipocategoria into v_tcs;
  insert into tipo_categorias (id_empresa, id_sucursal, nombre_tipo_categoria, codigo, activo)
  values (v_emp, v_suc, 'Productos', 'PROD', true) returning id_tipocategoria into v_tcp;

  insert into categorias (id_empresa, id_sucursal, id_tipocategoria, nombre_categoria, activo)
  values (v_emp, v_suc, v_tcs, 'Peluquería', true) returning id_categoria into v_cpelu;
  insert into categorias (id_empresa, id_sucursal, id_tipocategoria, nombre_categoria, activo)
  values (v_emp, v_suc, v_tcp, 'Retail', true) returning id_categoria into v_cret;

  -- Servicios: %/monto fijo, con y sin IVA
  insert into servicios (id_empresa, id_sucursal, id_categoria, nombre_servicio, valor, duracion, maneja_iva, comision, tipo_comision, activo)
  values (v_emp, v_suc, v_cpelu, 'Corte de pelo', 12000, 30, 1, 20, 'P', true) returning id_servicio into v_corte;
  insert into servicios (id_empresa, id_sucursal, id_categoria, nombre_servicio, valor, duracion, maneja_iva, comision, tipo_comision, activo)
  values (v_emp, v_suc, v_cpelu, 'Perfilado de barba', 8000, 20, 1, 2000, 'M', true) returning id_servicio into v_barba;
  insert into servicios (id_empresa, id_sucursal, id_categoria, nombre_servicio, valor, duracion, maneja_iva, comision, tipo_comision, activo)
  values (v_emp, v_suc, v_cpelu, 'Asesoría de imagen (exento)', 15000, 40, 0, 0, 'P', true) returning id_servicio into v_cons;

  insert into productos (id_empresa, id_sucursal, id_categoria, nombre, precio_venta, maneja_iva, maneja_stock, activo)
  values (v_emp, v_suc, v_cret, 'Shampoo premium', 6000, true, true, true) returning id_producto into v_shampoo;
  insert into productos (id_empresa, id_sucursal, id_categoria, nombre, precio_venta, maneja_iva, maneja_stock, activo)
  values (v_emp, v_suc, v_cret, 'Cera modeladora', 5000, true, true, true) returning id_producto into v_cera;

  insert into prestadores (id_empresa, id_sucursal, nombre_prestador, comision, tipo_comision, reserva_online, activo, dias_agenda, buffer_min, paso_agenda)
  values (v_emp, v_suc, 'Ana Prueba', 15, 'P', 1, true, 30, 0, 0) returning id_prestador into v_ana;
  insert into prestadores (id_empresa, id_sucursal, nombre_prestador, comision, tipo_comision, reserva_online, activo, dias_agenda, buffer_min, paso_agenda)
  values (v_emp, v_suc, 'Beto Prueba', 5000, 'M', 1, true, 30, 0, 0) returning id_prestador into v_beto;

  insert into prestador_servicios (id_empresa, id_sucursal, id_prestador, id_servicio)
  values (v_emp,v_suc,v_ana,v_corte),(v_emp,v_suc,v_ana,v_barba),(v_emp,v_suc,v_ana,v_cons),
         (v_emp,v_suc,v_beto,v_corte),(v_emp,v_suc,v_beto,v_barba);

  foreach d in array array[1,2,3,4,5,6] loop  -- Lun–Sáb
    insert into prestador_horarios (id_empresa, id_sucursal, id_prestador, dia, hora_inicio, hora_fin, activo)
    values (v_emp,v_suc,v_ana, d,'09:00','18:00',true),
           (v_emp,v_suc,v_beto,d,'09:00','18:00',true);
  end loop;

  insert into clientes (id_empresa, nombre_cliente, rut, email, telefono, activo)
  values (v_emp,'María Demo','11111111-1','maria@demo.cl','+56911111111',true) returning id_cliente into v_cl1;
  insert into clientes (id_empresa, nombre_cliente, rut, email, telefono, activo)
  values (v_emp,'Pedro Demo','22222222-2','pedro@demo.cl','+56922222222',true) returning id_cliente into v_cl2;

  -- Citas de HOY por cobrar (para el POS "Agenda de hoy")
  insert into agendamientos (id_empresa,id_sucursal,id_prestador,id_servicio,id_cliente,nombre_cliente,telefono,email,fecha,hora_inicio,hora_fin,estado,estado_pago,token_cancelacion)
  values (v_emp,v_suc,v_ana, v_corte,v_cl1,'María Demo','+56911111111','maria@demo.cl',hoy_chile(),'10:00','10:30','AGENDADA','PENDIENTE',gen_random_uuid()),
         (v_emp,v_suc,v_beto,v_barba,v_cl2,'Pedro Demo','+56922222222','pedro@demo.cl',hoy_chile(),'11:00','11:20','AGENDADA','PENDIENTE',gen_random_uuid());

  insert into usuario_roles (id_usuario, id_empresa, id_rol, nombre)
  values (v_admin, v_emp, 1, 'Ruddy (demo)')
  on conflict (id_usuario, id_empresa) do nothing;

  raise notice 'DEMO QA creada: empresa=% sucursal=%', v_emp, v_suc;
end $$;

select id_empresa, nombre_empresa, slug from empresas where slug='demo-qa';
