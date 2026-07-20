import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Envío centralizado: una sola cuenta Brevo de plataforma (secrets del proyecto).
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL') ?? 'no-reply@nexusbooking.cl';
const FROM_NAME     = 'Nexus Booking';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function formatFecha(f: string) {
  const d = new Date(f + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildHtml(d: any, fromName: string): string {
  const fecha = cap(formatFecha(d.fecha));

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Cita cancelada</title>
</head>
<body style="margin:0;padding:0;background:#111110;font-family:'Inter',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">Tu cita de ${d.nombre_servicio} ha sido cancelada</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111110;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#1A1A17;border:1px solid #2E2E2A;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#2A2A26 0%,#1E1E1B 100%);padding:28px 32px 24px;border-bottom:1px solid #2E2E2A;">
              <div style="display:inline-block;background:#8A9278;border-radius:8px;padding:5px 12px;margin-bottom:14px;">
                <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-weight:700;font-size:12px;color:#1A1A17;letter-spacing:0.05em;text-transform:uppercase;">Nexus Booking</span>
              </div>
              <h1 style="margin:0 0 4px;font-family:'Space Grotesk',Helvetica,sans-serif;font-size:22px;font-weight:700;color:#F0EDE4;letter-spacing:-0.02em;">${fromName}</h1>
              <p style="margin:0;font-size:12px;color:#6A6860;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;">Cancelaci&#243;n de cita</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0 0 6px;font-size:15px;color:#F0EDE4;">Hola, <span style="font-weight:600;color:#F0EDE4;">${d.nombre_cliente}</span></p>
              <p style="margin:0;font-size:14px;color:#9A978E;line-height:1.6;">Te informamos que tu cita ha sido cancelada.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#222220;border:1px solid #2E2E2A;border-radius:12px;overflow:hidden;">
                <tr><td style="background:linear-gradient(90deg,#E5584F,#C0453E);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6A6860;">Servicio</p>
                    <p style="margin:0 0 16px;font-family:'Space Grotesk',Helvetica,sans-serif;font-size:17px;font-weight:700;color:#F0EDE4;">${d.nombre_servicio}</p>
                    <div style="border-top:1px solid #2E2E2A;margin-bottom:16px;"></div>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding-right:12px;vertical-align:top;">
                          <p style="margin:0 0 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6A6860;">Profesional</p>
                          <p style="margin:0;font-size:14px;font-weight:500;color:#C8C5BC;">${d.nombre_prestador}</p>
                        </td>
                        <td width="50%" style="vertical-align:top;">
                          <p style="margin:0 0 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6A6860;">Fecha</p>
                          <p style="margin:0;font-size:14px;font-weight:500;color:#C8C5BC;">${fecha}</p>
                        </td>
                      </tr>
                      <tr><td colspan="2" style="height:14px;"></td></tr>
                      <tr>
                        <td colspan="2">
                          <p style="margin:0 0 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6A6860;">Horario</p>
                          <p style="margin:0;">
                            <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:20px;font-weight:700;color:#9A978E;text-decoration:line-through;">${d.hora_inicio}</span>
                            <span style="font-size:13px;color:#4A4A46;margin:0 6px;">&#8594;</span>
                            <span style="font-family:'Space Grotesk',Helvetica,sans-serif;font-size:16px;font-weight:600;color:#6A6860;text-decoration:line-through;">${d.hora_fin}</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;">
              <p style="margin:0;font-size:11px;color:#4A4A46;line-height:1.6;">Si tienes dudas, cont&#225;ctanos directamente. &mdash; <span style="color:#6A6860;">${fromName}</span></p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:10px;color:#3A3A36;text-align:center;letter-spacing:0.06em;text-transform:uppercase;">Enviado v&#237;a Nexus Booking</p>
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
      return new Response(JSON.stringify({ error: 'Faltan datos' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'sin_config_central' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const html = buildHtml(d, FROM_NAME);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: d.email, name: d.nombre_cliente }],
        subject: `Tu cita de ${d.nombre_servicio} ha sido cancelada`,
        htmlContent: html,
      }),
    });

    return new Response(JSON.stringify({ ok: res.ok }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
