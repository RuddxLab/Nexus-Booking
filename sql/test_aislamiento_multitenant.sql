-- ============================================================================
-- TEST DE AISLAMIENTO MULTI-TENANT — Nexus Booking
-- Correr en el SQL Editor de Supabase (QA o PROD) ANTES de cada deploy.
-- Objetivo: detectar regresiones que permitan cruce de información.
--
-- PARTE 1 (abajo): agnóstica de datos. No requiere editar nada.
--                  Devuelve una grilla con PASS/FAIL por chequeo.
-- PARTE 2 (al final): impersonación cross-tenant. Editar los 3 valores del
--                     bloque CONFIG con datos reales del ambiente y correr.
-- Regla: si CUALQUIER fila dice FAIL, NO desplegar hasta resolver.
-- ============================================================================

-- ======================= PARTE 1 — CHEQUEOS ESTRUCTURALES ===================
WITH
-- Whitelist de objetos que anon PUEDE leer (ajustar solo si se agrega una
-- vista/tabla pública nueva a propósito).
anon_whitelist(obj) AS (
  VALUES ('categorias'),('dias_bloqueados'),('prestador_ausencias'),
         ('prestador_horarios'),('prestador_servicios'),
         ('v_prestadores_publico'),('v_servicios_publico'),('v_sucursales_publico')
),
-- Tablas tenant que DEBEN tener RLS activo.
tenant_tables(t) AS (
  VALUES ('empresas'),('sucursales'),('prestadores'),('servicios'),('categorias'),
         ('tipo_categorias'),('clientes'),('agendamientos'),('prestador_horarios'),
         ('prestador_ausencias'),('prestador_servicios'),('dias_bloqueados'),('usuario_roles')
),
-- Tablas sensibles que anon NUNCA debe poder leer.
sensibles(t) AS (
  VALUES ('clientes'),('agendamientos'),('empresas'),('prestadores'),
         ('servicios'),('usuario_roles'),('roles'),('sucursales')
),
-- Funciones con secretos: revocadas de anon Y authenticated.
secretas(f) AS (
  VALUES ('desencriptar_valor'),('get_correo_config'),('generar_token_recovery')
)
SELECT * FROM (
  -- 1) Ninguna policy RLS usa el patrón session-var prohibido
  SELECT 1 AS n, 'RLS sin session-var (current_setting/app.current)' AS chequeo,
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END AS resultado,
         COALESCE(string_agg(policyname,', '),'ninguna') AS detalle
  FROM pg_policies
  WHERE schemaname='public'
    AND (COALESCE(qual,'')||COALESCE(with_check,'')) ~* 'current_setting|current_empresa_id|app\.current'

  UNION ALL
  -- 2) Footgun (funciones session-var) NO existen
  SELECT 2, 'Footgun session-var eliminado',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(proname,', '),'ninguna')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('current_empresa_id','set_app_empresa_slug')

  UNION ALL
  -- 3) anon NO puede leer ninguna tabla sensible
  SELECT 3, 'anon sin SELECT en tablas sensibles',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(t,', '),'ninguna')
  FROM sensibles
  WHERE has_table_privilege('anon','public.'||t,'SELECT')

  UNION ALL
  -- 4) La superficie de lectura de anon == whitelist (ni de más, ni de menos)
  SELECT 4, 'Superficie de lectura anon == whitelist',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(objeto, ', '),'ok')
  FROM (
    -- objetos que anon puede leer pero NO están en la whitelist (fuga potencial)
    SELECT c.relname AS objeto
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','v','m')
      AND has_table_privilege('anon', c.oid, 'SELECT')
      AND c.relname NOT IN (SELECT obj FROM anon_whitelist)
    UNION
    -- objetos de la whitelist que anon YA NO puede leer (algo se rompió)
    SELECT w.obj
    FROM anon_whitelist w
    WHERE NOT has_table_privilege('anon', 'public.'||w.obj, 'SELECT')
  ) q

  UNION ALL
  -- 5) Todas las tablas tenant tienen RLS activo
  SELECT 5, 'RLS activo en todas las tablas tenant',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(t,', '),'todas ok')
  FROM tenant_tables tt
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tt.t AND c.relrowsecurity
  )

  UNION ALL
  -- 6) Funciones con secretos revocadas de anon Y authenticated
  SELECT 6, 'Funciones con secretos revocadas (anon+auth)',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(f,', '),'ok')
  FROM secretas s
  WHERE has_function_privilege('anon', 'public.'||f||'(integer,integer)','EXECUTE')  -- get_correo_config
     OR (s.f<>'get_correo_config' AND EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace nn ON nn.oid=p.pronamespace
          WHERE nn.nspname='public' AND p.proname=s.f
            AND (has_function_privilege('anon', p.oid,'EXECUTE')
              OR has_function_privilege('authenticated', p.oid,'EXECUTE'))))

  UNION ALL
  -- 7) Ninguna función SECURITY DEFINER en public con search_path mutable
  SELECT 7, 'SECURITY DEFINER sin search_path mutable',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         COALESCE(string_agg(proname,', '),'todas ok')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg ILIKE 'search_path=%'
    )
) checks
ORDER BY n;

-- ======================= PARTE 2 — IMPERSONACIÓN CROSS-TENANT ================
-- EDITAR el bloque CONFIG con datos reales del ambiente:
--   :usuario  = UUID de un usuario staff real (cualquier rol) acotado a UNA empresa
--   :empresa_propia = id_empresa a la que ese usuario SÍ pertenece
--   :empresa_ajena  = id_empresa a la que NO pertenece + id_prestador de esa ajena
-- Correr este bloque por separado. Todo debe dar 0 / null (sin fuga).
/*
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"<<UUID_USUARIO>>","role":"authenticated"}', true);
SELECT
  (SELECT count(*) FROM prestadores   WHERE id_empresa = <<EMPRESA_AJENA>>) AS fuga_prestadores,
  (SELECT count(*) FROM servicios     WHERE id_empresa = <<EMPRESA_AJENA>>) AS fuga_servicios,
  (SELECT count(*) FROM agendamientos WHERE id_empresa = <<EMPRESA_AJENA>>) AS fuga_agendamientos,
  (SELECT count(*) FROM clientes      WHERE id_empresa = <<EMPRESA_AJENA>>) AS fuga_clientes,
  (SELECT count(*) FROM empresas      WHERE id_empresa = <<EMPRESA_AJENA>>) AS fuga_empresa,
  (SELECT count(*) FROM agendamientos_por_prestador(<<PRESTADOR_AJENO>>,'2000-01-01','2100-01-01')) AS fuga_rpc_agend,
  email_prestador(<<PRESTADOR_AJENO>>) AS fuga_email;
ROLLBACK;
-- Esperado: todos los count = 0 y fuga_email = null
*/
