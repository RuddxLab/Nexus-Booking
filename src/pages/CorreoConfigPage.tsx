import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { PageHeader } from '../components/Common/PageHeader'

type Proveedor = 'brevo' | 'smtp'

interface Config {
  proveedor:     Proveedor
  from_email:    string
  from_name:     string
  brevo_api_key: string
  smtp_host:     string
  smtp_port:     number
  smtp_user:     string
  smtp_pass:     string
  smtp_secure:   boolean
}

const DEFAULTS: Config = {
  proveedor: 'brevo', from_email: '', from_name: '',
  brevo_api_key: '', smtp_host: '', smtp_port: 587,
  smtp_user: '', smtp_pass: '', smtp_secure: false,
}

const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)' }
const INPUT: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const CARD: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 18, marginBottom: 14 }
const SEC: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: 'var(--color-ink-soft)', marginBottom: 12 }

export function CorreoConfigPage() {
  const {
    empresaId, sucursalId,
    setEmpresaId, setSucursalId,
    esAdmin, esSupervisor,
    empresas, sucursalesDeEmpresa,
  } = useFiltroEmpresa()

  const [config,     setConfig]     = useState<Config>(DEFAULTS)
  const [idConfig,   setIdConfig]   = useState<number | null>(null)
  const [cargando,   setCargando]   = useState(false)
  const [guardando,  setGuardando]  = useState(false)
  const [probando,   setProbando]   = useState(false)
  const [mensaje,    setMensaje]    = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [porSucursal, setPorSucursal] = useState(false)
  const [mostrarKey, setMostrarKey] = useState(false)
  const [mostrarPass, setMostrarPass] = useState(false)

  // Al cambiar empresa, resetear el toggle
  useEffect(() => {
    setPorSucursal(false)
  }, [empresaId])

  // Cargar config cuando cambia empresa o sucursal
  useEffect(() => {
    if (!empresaId) return
    setCargando(true)
    setIdConfig(null)
    setConfig(DEFAULTS)
    setMensaje(null)

    const cargar = async () => {
      try {
        // Buscar cualquier config activa de esta empresa, priorizando la sucursal actual
        const { data } = await supabase
          .from('empresa_correo_config')
          .select('*')
          .eq('id_empresa', empresaId)
          .eq('activo', true)
          .order('id_sucursal', { ascending: true })
          .limit(10)

        if (!data || data.length === 0) return

        // Preferir la que coincide con la sucursal actual
        const match = sucursalId
          ? (data.find(r => r.id_sucursal === sucursalId) ?? data[0])
          : data[0]

        cargarDesdeData(match)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [empresaId, sucursalId]) // eslint-disable-line

  function cargarDesdeData(data: any) {
    setIdConfig(data.id_config)
    setConfig({
      proveedor:     data.proveedor ?? 'brevo',
      from_email:    data.from_email ?? '',
      from_name:     data.from_name ?? '',
      brevo_api_key: '',
      smtp_host:     data.smtp_host ?? '',
      smtp_port:     data.smtp_port ?? 587,
      smtp_user:     data.smtp_user ?? '',
      smtp_pass:     '',
      smtp_secure:   data.smtp_secure ?? false,
    })
    setCargando(false)
  }

  function set<K extends keyof Config>(key: K, val: Config[K]) {
    setConfig(prev => ({ ...prev, [key]: val }))
    setMensaje(null)
  }

  async function encriptarValor(val: string): Promise<string | null> {
    if (!val) return null
    const { data, error } = await supabase.rpc('encriptar_valor', { p_valor: val })
    if (error) throw error
    return data
  }

  async function guardar() {
    if (!empresaId) return
    setGuardando(true)
    setMensaje(null)
    try {
      const brevoEnc = config.proveedor === 'brevo' && config.brevo_api_key
        ? await encriptarValor(config.brevo_api_key) : undefined
      const smtpEnc = config.proveedor === 'smtp' && config.smtp_pass
        ? await encriptarValor(config.smtp_pass) : undefined

      // Resolver id_sucursal — siempre debe quedar con valor
      let idSucursalFinal = sucursalId
      if (!idSucursalFinal) {
        const { data: suc } = await supabase
          .from('sucursales')
          .select('id_sucursal')
          .eq('id_empresa', empresaId)
          .eq('activo', true)
          .order('id_sucursal')
          .limit(1)
          .single()
        idSucursalFinal = suc?.id_sucursal ?? null
      }

      const payload: any = {
        id_empresa:  empresaId,
        id_sucursal: idSucursalFinal,
        proveedor:   config.proveedor,
        from_email:  config.from_email.trim(),
        from_name:   config.from_name.trim(),
        smtp_host:   config.smtp_host.trim() || null,
        smtp_port:   config.smtp_port,
        smtp_user:   config.smtp_user.trim() || null,
        smtp_secure: config.smtp_secure,
        activo:      true,
        updated_at:  new Date().toISOString(),
      }
      if (brevoEnc !== undefined) payload.brevo_api_key_enc = brevoEnc
      if (smtpEnc  !== undefined) payload.smtp_pass_enc     = smtpEnc

      if (idConfig) {
        await supabase.from('empresa_correo_config').update(payload).eq('id_config', idConfig)
      } else {
        const { data } = await supabase.from('empresa_correo_config').insert(payload).select().single()
        setIdConfig((data as any)?.id_config ?? null)
      }
      setConfig(prev => ({ ...prev, brevo_api_key: '', smtp_pass: '' }))
      setMensaje({ tipo: 'ok', texto: sucursalId
        ? `Configuración guardada para esta sucursal.`
        : `Configuración guardada para toda la empresa.`
      })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message ?? 'No se pudo guardar.' })
    } finally { setGuardando(false) }
  }

  async function probarConexion() {
    if (!empresaId || !config.from_email) return
    setProbando(true)
    setMensaje(null)
    try {
      const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL ?? ''
      const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
      const FUNCTIONS_URL = SUPABASE_URL.replace('.supabase.co', '.supabase.co/functions/v1')
      const res = await fetch(`${FUNCTIONS_URL}/enviar-correo-reserva`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          id_empresa:       empresaId,
          id_agendamiento:  0,
          email:            config.from_email,
          nombre_cliente:   'Prueba de conexión',
          nombre_prestador: 'Sistema',
          nombre_servicio:  'Test de correo',
          duracion:         30,
          fecha:            new Date().toISOString().split('T')[0],
          hora_inicio:      '10:00',
          hora_fin:         '10:30',
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMensaje({ tipo: 'ok', texto: `Correo de prueba enviado a ${config.from_email}` })
      } else {
        setMensaje({ tipo: 'error', texto: `Error al enviar: ${data.error ?? 'Verifica la API key y el email remitente.'}` })
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error de conexión: ${err.message ?? 'Intenta de nuevo.'}` })
    } finally { setProbando(false) }
  }

  const scope = sucursalId
    ? sucursalesDeEmpresa.find(s => s.id_sucursal === sucursalId)?.nombre_sucursal ?? 'Sucursal'
    : empresas.find(e => e.id_empresa === empresaId)?.nombre_empresa ?? 'Empresa'

  return (
    <div className="main" style={{ maxWidth: 640 }}>
      <PageHeader titulo="Configuración de correo" />

      {/* Selector empresa + sucursal */}
      <SelectorFiltro
        esAdmin={esAdmin}
        esSupervisor={esSupervisor}
        empresas={empresas}
        sucursalesDeEmpresa={sucursalesDeEmpresa}
        empresaId={empresaId}
        sucursalId={sucursalId}
        onEmpresaChange={setEmpresaId}
        onSucursalChange={setSucursalId}
        mostrarSucursal={false}
      />

      {/* Toggle: config por empresa o por sucursal específica */}
      {sucursalesDeEmpresa.length > 1 && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink-soft)' }}>
            <input
              type="checkbox"
              checked={porSucursal}
              onChange={e => setPorSucursal(e.target.checked)}
            />
            Configurar para una sucursal específica
          </label>
          {porSucursal && (
            <select
              value={sucursalId ?? ''}
              onChange={e => setSucursalId(Number(e.target.value) || sucursalesDeEmpresa[0]?.id_sucursal)}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 13 }}
            >
              <option value="">— Seleccionar sucursal —</option>
              {sucursalesDeEmpresa.map(s => (
                <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre_sucursal}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Contexto actual */}
      <div style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginBottom: 16, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
        {porSucursal && sucursalId
          ? <>Configurando correo solo para la sucursal <strong>{sucursalesDeEmpresa.find(s => s.id_sucursal === sucursalId)?.nombre_sucursal}</strong>. Sobreescribe la config de empresa para esa sucursal.</>
          : <>Configurando correo para <strong>toda la empresa</strong>. Aplica a todas las sucursales que no tengan config propia.</>
        }
      </div>

      {cargando ? (
        <p style={{ color: 'var(--color-ink-soft)' }}>Cargando…</p>
      ) : (<>

        {/* Proveedor */}
        <div style={CARD}>
          <div style={SEC}>Proveedor de envío</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['brevo', 'smtp'] as Proveedor[]).map(p => (
              <button key={p} onClick={() => set('proveedor', p)} style={{
                padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${config.proveedor === p ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: config.proveedor === p ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                color: config.proveedor === p ? 'var(--color-primary)' : 'var(--color-ink-soft)',
                cursor: 'pointer', transition: 'all .15s',
              }}>
                {p === 'brevo' ? '✉ Brevo (recomendado)' : '⚙ SMTP genérico'}
              </button>
            ))}
          </div>
        </div>

        {/* Remitente */}
        <div style={CARD}>
          <div style={SEC}>Datos del remitente</div>
          <div style={GRID2}>
            <div style={FIELD}>
              <label style={LABEL}>Nombre del remitente</label>
              <input style={INPUT} value={config.from_name} onChange={e => set('from_name', e.target.value)} placeholder="Ej: Polish Nail Bar" />
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Email del remitente</label>
              <input style={INPUT} type="email" value={config.from_email} onChange={e => set('from_email', e.target.value)} placeholder="hola@tunegocio.cl" />
            </div>
          </div>
        </div>

        {/* Brevo */}
        {config.proveedor === 'brevo' && (
          <div style={CARD}>
            <div style={SEC}>API Key de Brevo</div>
            <div style={FIELD}>
              <label style={LABEL}>
                API Key {idConfig && <span style={{ fontWeight: 400, textTransform: 'none' }}>(dejar vacío para mantener la actual)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...INPUT, paddingRight: 36 }}
                  type={mostrarKey ? 'text' : 'password'}
                  value={config.brevo_api_key}
                  onChange={e => set('brevo_api_key', e.target.value)}
                  placeholder={idConfig ? '••••••••••••••••' : 'xkeysib-...'}
                />
                <button onClick={() => setMostrarKey(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  {mostrarKey ? '🙈' : '👁'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>
                Obtén tu API key en <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>app.brevo.com</a>
              </p>
            </div>
          </div>
        )}

        {/* SMTP */}
        {config.proveedor === 'smtp' && (
          <div style={CARD}>
            <div style={SEC}>Configuración SMTP</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={GRID2}>
                <div style={FIELD}><label style={LABEL}>Servidor (host)</label><input style={INPUT} value={config.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" /></div>
                <div style={FIELD}><label style={LABEL}>Puerto</label><input style={INPUT} type="number" value={config.smtp_port} onChange={e => set('smtp_port', Number(e.target.value))} /></div>
              </div>
              <div style={GRID2}>
                <div style={FIELD}><label style={LABEL}>Usuario</label><input style={INPUT} value={config.smtp_user} onChange={e => set('smtp_user', e.target.value)} placeholder="correo@gmail.com" /></div>
                <div style={FIELD}>
                  <label style={LABEL}>Contraseña {idConfig && <span style={{ fontWeight: 400, textTransform: 'none' }}>(vacío = mantener)</span>}</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...INPUT, paddingRight: 36 }} type={mostrarPass ? 'text' : 'password'} value={config.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} placeholder={idConfig ? '••••••••' : 'Contraseña de app'} />
                    <button onClick={() => setMostrarPass(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                      {mostrarPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={config.smtp_secure} onChange={e => set('smtp_secure', e.target.checked)} />
                Usar SSL/TLS (puerto 465)
              </label>
            </div>
          </div>
        )}

        {/* Mensaje */}
        {mensaje && (
          <div style={{
            padding: '9px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 500,
            background: mensaje.tipo === 'ok' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
            color: mensaje.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
            border: `1px solid ${mensaje.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)'}22`,
          }}>
            {mensaje.tipo === 'ok' ? '✓ ' : '✗ '}{mensaje.texto}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
          <button className="btn btn--ghost" onClick={probarConexion} disabled={probando || !config.from_email}>
            {probando ? 'Enviando…' : 'Enviar correo de prueba'}
          </button>
        </div>
      </>)}
    </div>
  )
}
