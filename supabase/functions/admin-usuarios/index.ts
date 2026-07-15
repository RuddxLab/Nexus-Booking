import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// El admin es una ruta única compartida por todos los tenants (/admin/login);
// lo que va por slug es solo la reserva pública. Por eso una sola URL sirve.
const SITE_URL      = Deno.env.get('SITE_URL') ?? 'https://polishnailbar.pages.dev';

const ROLES_SUPERVISOR = ['supervisor','recepcionista','agenda_operador','prestador'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

interface ConfigCorreo {
  proveedor: string | null;
  from_email: string | null;
  from_name: string | null;
  brevo_api_key: string | null;
}

/**
 * Config de correo de la empresa (tabla empresa_correo_config, key desencriptada).
 * La invitación es a una EMPRESA, no a una sucursal: por eso no pasamos
 * p_id_sucursal y dejamos que la RPC caiga a la primera sucursal activa.
 */
async function obtenerConfigCorreo(sb: any, idEmpresa: number): Promise<ConfigCorreo | null> {
  const { data, error } = await sb.rpc('get_correo_config', { p_id_empresa: idEmpresa });
  if (error) {
    console.error('[correo] get_correo_config falló:', error.message);
    return null;
  }
  return (data as ConfigCorreo) ?? null;
}

type ResultadoCorreo = { ok: true } | { ok: false; error: string };

/**
 * Devuelve el resultado en vez de tragárselo. Antes esto era
 * `try { ... } catch (_) {}` y un fetch sin revisar res.ok: si Brevo
 * respondía 401 nadie se enteraba jamás.
 */
async function enviarEmailBienvenida(
  cfg: ConfigCorreo | null, email: string, nombre: string, nombreEmpresa: string,
): Promise<ResultadoCorreo> {
  if (!cfg) {
    return { ok: false, error: `"${nombreEmpresa}" no tiene configuración de correo activa. Configúrala en Correo y reenvía la invitación.` };
  }
  if (cfg.proveedor !== 'brevo' || !cfg.brevo_api_key) {
    return { ok: false, error: `La configuración de correo de "${nombreEmpresa}" no tiene una API key de Brevo válida.` };
  }
  if (!cfg.from_email) {
    return { ok: false, error: `La configuración de correo de "${nombreEmpresa}" no tiene remitente (from_email).` };
  }

  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Segoe UI,sans-serif;background:#f7f6f3;padding:24px;">' +
    '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e4e1d8;">' +
    '<h1 style="font-size:20px;margin:0 0 4px;">' + nombreEmpresa + '</h1>' +
    '<p style="color:#6b675f;font-size:13px;margin:0 0 24px;">Invitaci&oacute;n al sistema</p>' +
    '<hr style="border:none;border-top:1px solid #e4e1d8;margin:0 0 24px;">' +
    '<p style="margin:0 0 12px;">Hola <strong>' + nombre + '</strong>,</p>' +
    '<p style="color:#6b675f;margin:0 0 24px;">Se te ha creado una cuenta en <strong>' + nombreEmpresa + '</strong>.</p>' +
    '<p style="color:#6b675f;margin:0 0 24px;">Para ingresar, visita el sistema y usa la opci&oacute;n <strong>&ldquo;&iquest;Olvidaste tu contrase&ntilde;a?&rdquo;</strong> con este correo para establecer tu contrase&ntilde;a.</p>' +
    '<div style="text-align:center;margin:24px 0;">' +
    '<a href="' + SITE_URL + '/admin/login" style="display:inline-block;padding:13px 28px;background:#6b7a5e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Ir al sistema</a>' +
    '</div>' +
    '<p style="color:#999;font-size:11px;margin:24px 0 0;">Si no esperabas esta invitaci&oacute;n, puedes ignorar este correo.</p>' +
    '</div></body></html>';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': cfg.brevo_api_key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: cfg.from_name || nombreEmpresa, email: cfg.from_email },
        to: [{ email, name: nombre }],
        subject: 'Invitación a ' + nombreEmpresa,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('[correo] Brevo', res.status, detalle);
      return { ok: false, error: `Brevo rechazó el envío (${res.status}). ${detalle.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[correo] excepción:', e);
    return { ok: false, error: 'No se pudo contactar a Brevo: ' + String(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'No autorizado' }, 401);

  const { data: misRoles } = await userClient
    .from('usuario_roles')
    .select('id_empresa, roles(nombre_rol), empresas(id_empresa, nombre_empresa)')
    .eq('id_usuario', user.id);

  if (!misRoles?.length) return json({ error: 'Sin roles asignados' }, 403);

  const esAdmin     = misRoles.some((r: any) => (r.roles as any)?.nombre_rol === 'admin');
  const esSupervisor = !esAdmin && misRoles.some((r: any) => (r.roles as any)?.nombre_rol === 'supervisor');
  if (!esAdmin && !esSupervisor) return json({ error: 'Sin permisos' }, 403);

  const sb    = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url   = new URL(req.url);
  const accion = url.searchParams.get('accion') ?? '';

  // GET: listar usuarios
  if (req.method === 'GET') {
    const idEmpresaParam = url.searchParams.get('id_empresa');
    const empresasPermitidas: number[] = esAdmin
      ? (idEmpresaParam ? [Number(idEmpresaParam)] : misRoles.map((r: any) => r.id_empresa))
      : [misRoles[0].id_empresa];

    const { data: urs, error } = await sb
      .from('usuario_roles')
      .select('id_usuario, id_empresa, id_rol, nombre, roles(nombre_rol)')
      .in('id_empresa', empresasPermitidas);
    if (error) return json({ error: error.message }, 500);

    const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const authMap: Record<string, any> = {};
    for (const u of authList?.users ?? []) authMap[u.id] = u;

    const usuarios = (urs ?? []).map((u: any) => ({
      id:            u.id_usuario,
      id_empresa:    u.id_empresa,
      email:         authMap[u.id_usuario]?.email ?? '—',
      nombre:        u.nombre ?? '',
      nombre_rol:    (u.roles as any)?.nombre_rol ?? '—',
      id_rol:        u.id_rol,
      ultimo_acceso: authMap[u.id_usuario]?.last_sign_in_at ?? null,
      creado_en:     authMap[u.id_usuario]?.created_at ?? null,
    }));

    const empresas = esAdmin
      ? misRoles.map((r: any) => ({ id_empresa: r.id_empresa, nombre_empresa: (r.empresas as any)?.nombre_empresa ?? r.id_empresa }))
      : [{ id_empresa: misRoles[0].id_empresa, nombre_empresa: (misRoles[0].empresas as any)?.nombre_empresa ?? misRoles[0].id_empresa }];

    return json({ usuarios, empresas, es_admin: esAdmin });
  }

  const body = req.method !== 'DELETE' ? await req.json().catch(() => ({})) : {};

  // POST: crear usuario / invitar / reenviar invitación
  if (req.method === 'POST' && accion === 'invitar') {
    const { email, id_rol, id_empresa, nombre } = body;
    if (!email || !id_rol || !id_empresa) return json({ error: 'Faltan email, id_rol o id_empresa' }, 400);

    if (esAdmin) {
      if (!misRoles.some((r: any) => r.id_empresa === Number(id_empresa))) return json({ error: 'No tienes acceso a esa empresa' }, 403);
    } else {
      if (Number(id_empresa) !== misRoles[0].id_empresa) return json({ error: 'Solo puedes invitar a tu empresa' }, 403);
    }

    const { data: rolData } = await sb.from('roles').select('nombre_rol').eq('id_rol', id_rol).maybeSingle();
    if (!rolData) return json({ error: 'Rol no válido' }, 400);
    if (esSupervisor && !ROLES_SUPERVISOR.includes(rolData.nombre_rol)) return json({ error: 'Sin permiso para ese rol' }, 403);

    const { data: empresaData } = await sb.from('empresas').select('nombre_empresa').eq('id_empresa', Number(id_empresa)).maybeSingle();
    const nombreEmpresa = empresaData?.nombre_empresa ?? 'Nexus Booking';

    const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = authList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim());

    let userId: string;
    let yaExistia = false;

    if (existingUser) {
      userId = existingUser.id;
      yaExistia = true;
    } else {
      const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'Aa1!';
      const { data: created, error: createErr } = await sb.auth.admin.createUser({ email: email.trim(), password: tempPassword, email_confirm: true });
      if (createErr) return json({ error: createErr.message }, 400);
      userId = created.user.id;
    }

    const { error: urErr } = await sb.from('usuario_roles')
      .upsert({ id_usuario: userId, id_empresa: Number(id_empresa), id_rol, nombre: nombre || null }, { onConflict: 'id_usuario,id_empresa' });
    if (urErr) return json({ error: urErr.message }, 500);

    // El correo se envía SIEMPRE, exista o no el usuario en Auth.
    // Antes vivía dentro del else de arriba: como "revocar" no borra el
    // usuario de auth.users, reinvitar nunca reenviaba nada. Además el
    // correo es idempotente (solo dice "usa ¿olvidaste tu contraseña?"),
    // así que reenviarlo no rompe nada.
    const cfg     = await obtenerConfigCorreo(sb, Number(id_empresa));
    const correo  = await enviarEmailBienvenida(cfg, email.trim(), nombre || email.split('@')[0], nombreEmpresa);

    return json({
      ok: true,
      id: userId,
      email,
      ya_existia: yaExistia,
      correo_enviado: correo.ok,
      correo_error: correo.ok ? null : correo.error,
    });
  }

  // PATCH: cambiar rol o nombre
  if (req.method === 'PATCH' && accion === 'cambiar-rol') {
    const { id_usuario, id_rol, id_empresa, nombre } = body;
    if (!id_usuario || !id_rol || !id_empresa) return json({ error: 'Faltan parámetros' }, 400);

    if (esAdmin) {
      if (!misRoles.some((r: any) => r.id_empresa === Number(id_empresa))) return json({ error: 'Sin acceso' }, 403);
    } else {
      if (Number(id_empresa) !== misRoles[0].id_empresa) return json({ error: 'Sin acceso' }, 403);
    }

    const { data: rolData } = await sb.from('roles').select('nombre_rol').eq('id_rol', id_rol).maybeSingle();
    if (!rolData) return json({ error: 'Rol no válido' }, 400);
    if (esSupervisor && !ROLES_SUPERVISOR.includes(rolData.nombre_rol)) return json({ error: 'Sin permiso para ese rol' }, 403);

    const updateData: any = { id_rol };
    if (nombre !== undefined) updateData.nombre = nombre || null;

    const { error } = await sb.from('usuario_roles').update(updateData).eq('id_usuario', id_usuario).eq('id_empresa', Number(id_empresa));
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // DELETE: revocar acceso
  if (req.method === 'DELETE' && accion === 'revocar') {
    const id_usuario = url.searchParams.get('id_usuario');
    const id_empresa = url.searchParams.get('id_empresa');
    if (!id_usuario || !id_empresa) return json({ error: 'Faltan parámetros' }, 400);
    if (id_usuario === user.id) return json({ error: 'No puedes revocar tu propio acceso' }, 400);

    if (esAdmin) {
      if (!misRoles.some((r: any) => r.id_empresa === Number(id_empresa))) return json({ error: 'Sin acceso' }, 403);
    } else {
      if (Number(id_empresa) !== misRoles[0].id_empresa) return json({ error: 'Sin acceso' }, 403);
    }

    const { error } = await sb.from('usuario_roles').delete().eq('id_usuario', id_usuario).eq('id_empresa', Number(id_empresa));
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Acción no reconocida' }, 400);
});
