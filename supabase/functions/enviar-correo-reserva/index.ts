import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL     = (Deno.env.get('SITE_URL') ?? 'https://nexusbookingcl.pages.dev').replace(/\/+$/, '');
// Envío centralizado: una sola cuenta Brevo de plataforma (secrets del proyecto).
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL') ?? 'no-reply@nexusbooking.cl';
const FROM_NAME     = 'Nexus Booking';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatFecha(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function esColorOscuro(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return (r*0.299 + g*0.587 + b*0.114) < 140;
}

function buildHtml(d: any, fromName: string, cancelarUrl: string, reagendarUrl: string, sucNombre: string, sucDireccion: string): string {
  const cFondo      = d.color_fondo      ?? '#FAFAF5';
  const cSuperficie = d.color_superficie ?? '#FFFFFF';
  const cBorde      = d.color_borde      ?? '#DDD9CE';
  const cTexto      = d.color_texto      ?? '#2C2C28';
  const cAccento    = d.color_acento     ?? '#C8A46A';
  const cSobreAccento = esColorOscuro(cAccento) ? '#FFFFFF' : '#1A1A17';
  const fecha = cap(formatFecha(d.fecha));

  const bloqueSucursal = sucNombre ? `
                    <div style="border-top:1px solid ${cBorde};margin:14px 0;"></div>
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${cTexto}66;margin-bottom:3px;">Sucursal</div>
                    <div style="font-size:14px;font-weight:600;color:${cTexto};">${sucNombre}</div>
                    ${sucDireccion ? `<div style="font-size:12px;color:${cTexto}99;margin-top:2px;">&#128205; ${sucDireccion}</div>` : ''}` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Cita confirmada</title>
</head>
<body style="margin:0;padding:0;background:${cFondo};font-family:'Inter',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">Cita confirmada: ${d.nombre_servicio} &middot; ${d.hora_inicio}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cFondo};min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:${cSuperficie};border:1px solid ${cBorde};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 20px;border-bottom:1px solid ${cBorde};">
              <div style="display:inline-block;background:${cAccento};border-radius:7px;padding:4px 11px;margin-bottom:12px;">
                <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-weight:700;font-size:11px;color:${cSobreAccento};letter-spacing:0.05em;text-transform:uppercase;">Nexus Booking</span>
              </div>
              <div style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:20px;font-weight:700;color:${cTexto};letter-spacing:-0.02em;margin-bottom:2px;">${fromName}</div>
              <div style="font-size:11px;color:${cTexto}88;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;">Confirmaci&#243;n de reserva</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0;">
              <p style="margin:0 0 4px;font-size:15px;color:${cTexto};">Hola, <strong style="color:${cTexto};">${d.nombre_cliente}</strong></p>
              <p style="margin:0;font-size:13px;color:${cTexto}AA;line-height:1.6;">Tu cita ha sido agendada con &#233;xito. Aqu&#237; tienes el resumen.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cFondo};border:1px solid ${cBorde};border-radius:12px;overflow:hidden;">
                <tr><td style="background:${cAccento};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                      <tr>
                        <td>
                          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${cTexto}66;margin-bottom:3px;">Servicio</div>
                          <div style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:16px;font-weight:700;color:${cTexto};">${d.nombre_servicio}</div>
                        </td>
                        <td align="right" valign="middle">
                          <div style="display:inline-block;background:${cAccento}18;border:1px solid ${cAccento}44;border-radius:20px;padding:3px 10px;">
                            <span style="font-size:11px;font-weight:600;color:${cAccento};">${d.duracion} min</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <div style="border-top:1px solid ${cBorde};margin-bottom:14px;"></div>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-right:10px;vertical-align:top;">
                          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${cTexto}66;margin-bottom:3px;">Profesional</div>
                          <div style="font-size:13px;font-weight:500;color:${cTexto};">${d.nombre_prestador}</div>
                        </td>
                        <td width="50%" style="vertical-align:top;">
                          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${cTexto}66;margin-bottom:3px;">Fecha</div>
                          <div style="font-size:13px;font-weight:500;color:${cTexto};">${fecha}</div>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="height:14px;"></td></tr>
                      <tr>
                        <td colspan="2">
                          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${cTexto}66;margin-bottom:5px;">Horario</div>
                          <div>
                            <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:22px;font-weight:700;color:${cAccento};">${d.hora_inicio}</span>
                            <span style="font-size:12px;color:${cTexto}55;margin:0 6px;">&#8594;</span>
                            <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:17px;font-weight:600;color:${cTexto}99;">${d.hora_fin}</span>
                          </div>
                        </td>
                      </tr>
                    </table>${bloqueSucursal}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" align="center">
                    <a href="${reagendarUrl}" style="display:block;padding:11px 0;background:${cAccento};border-radius:10px;font-family:'Space Grotesk',Helvetica,sans-serif;font-size:13px;font-weight:700;color:${cSobreAccento};text-decoration:none;letter-spacing:0.02em;text-align:center;">Reagendar</a>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" align="center">
                    <a href="${cancelarUrl}" style="display:block;padding:11px 0;background:${cAccento}18;border:1px solid ${cAccento}55;border-radius:10px;font-family:'Space Grotesk',Helvetica,sans-serif;font-size:13px;font-weight:600;color:${cAccento};text-decoration:none;letter-spacing:0.02em;text-align:center;">Cancelar cita</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid ${cBorde};">
              <p style="margin:0;font-size:11px;color:${cTexto}55;line-height:1.6;">Si no solicitaste esta cita, puedes ignorar este correo. &mdash; <span style="color:${cTexto}88;">${fromName}</span></p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:10px;color:${cTexto}44;text-align:center;letter-spacing:0.06em;text-transform:uppercase;">Enviado v&#237;a Nexus Booking</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const d = await req.json();
    if (!d.email || !d.nombre_cliente) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan datos obligatorios' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'sin_config_central' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    let token: string = (typeof d.token === 'string' && d.token) ? d.token : '';
    let idSucursal: number | null = d.id_sucursal ? Number(d.id_sucursal) : null;

    // Recuperar token e id_sucursal desde el agendamiento si no vinieron.
    if ((!token || !idSucursal) && d.id_agendamiento) {
      const { data } = await sb.from('agendamientos')
        .select('token_cancelacion, id_sucursal')
        .eq('id_agendamiento', Number(d.id_agendamiento))
        .single();
      if (!token && data?.token_cancelacion) token = data.token_cancelacion;
      if (!idSucursal && data?.id_sucursal) idSucursal = data.id_sucursal;
    }

    // Datos de la sucursal para mostrar en el correo.
    let sucNombre = ''; let sucDireccion = '';
    if (idSucursal) {
      const { data: suc } = await sb.from('sucursales')
        .select('nombre_sucursal, direccion, comuna, ciudad')
        .eq('id_sucursal', idSucursal)
        .single();
      if (suc) {
        sucNombre = suc.nombre_sucursal ?? '';
        sucDireccion = [suc.direccion, suc.comuna, suc.ciudad].filter((x: any) => x && String(x).trim()).join(', ');
      }
    }

    const slug = (typeof d.slug === 'string' && d.slug) ? d.slug : '';
    const baseUrl      = slug ? `${SITE_URL}/r/${slug}` : SITE_URL;
    const cancelarUrl  = token ? `${baseUrl}/cancelar?token=${token}` : `${baseUrl}/reservar`;
    const reagendarUrl = token ? `${baseUrl}/cancelar?token=${token}&accion=reagendar` : `${baseUrl}/reservar`;

    const html = buildHtml(d, FROM_NAME, cancelarUrl, reagendarUrl, sucNombre, sucDireccion);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: d.email, name: d.nombre_cliente }],
        subject: `✅ Cita confirmada: ${d.nombre_servicio} · ${d.hora_inicio}`,
        htmlContent: html,
      }),
    });

    const body = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: res.ok, messageId: body?.messageId }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
