import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { PageHeader } from '../components/Common/PageHeader'
import type { NombreRol } from '../hooks/useUserRole'

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string)
  ?.replace('.supabase.co', '.supabase.co/functions/v1') ?? ''

interface UsuarioFila {
  id:            string
  id_empresa:    number
  email:         string
  nombre:        string
  nombre_rol:    NombreRol
  id_rol:        number
  ultimo_acceso: string | null
  creado_en:     string | null
}

interface EmpresaOpcion { id_empresa: number; nombre_empresa: string }
interface Rol { id_rol: number; nombre_rol: string }

const ETIQUETAS_ROL: Record<string, string> = {
  admin:           'Admin',
  supervisor:      'Supervisor',
  recepcionista:   'Recepcionista',
  agenda_operador: 'Operador agenda',
  prestador:       'Prestador',
}

const BADGE_COLOR: Record<string, string> = {
  admin:           '#C8A46A',
  supervisor:      '#6B7A5E',
  recepcionista:   '#4A8B62',
  agenda_operador: '#7A7A7A',
  prestador:       '#5B8FB9',
}

// Roles que un supervisor NO puede asignar
const ROLES_SOLO_ADMIN = ['admin']

async function callFn(method: string, params: Record<string, string>, body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''
  const url = new URL(`${FUNCTIONS_URL}/admin-usuarios`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
  return data
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function UsuariosPage() {
  const [usuarios,      setUsuarios]      = useState<UsuarioFila[]>([])
  const [empresas,      setEmpresas]      = useState<EmpresaOpcion[]>([])
  const [roles,         setRoles]         = useState<Rol[]>([])
  const [esAdmin,       setEsAdmin]       = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState<number | ''>('')
  const [cargando,      setCargando]      = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  // Modal invitar
  const [modalInvitar,  setModalInvitar]  = useState(false)
  const [invEmail,      setInvEmail]      = useState('')
  const [invNombre,     setInvNombre]     = useState('')
  const [invRol,        setInvRol]        = useState<number | ''>('')
  const [invEmpresa,    setInvEmpresa]    = useState<number | ''>('')
  const [invGuardando,  setInvGuardando]  = useState(false)
  const [invError,      setInvError]      = useState<string | null>(null)
  const [invOk,         setInvOk]         = useState<string | null>(null)

  // Modal cambiar rol
  const [modalRol,      setModalRol]      = useState<UsuarioFila | null>(null)
  const [nuevoRol,      setNuevoRol]      = useState<number | ''>('')
  const [nuevoNombre,   setNuevoNombre]   = useState('')
  const [rolGuardando,  setRolGuardando]  = useState(false)
  const [rolError,      setRolError]      = useState<string | null>(null)

  async function cargar(idEmpresaParam?: number) {
    setCargando(true); setError(null)
    try {
      const params: Record<string, string> = {}
      if (idEmpresaParam) params.id_empresa = String(idEmpresaParam)
      const res = await callFn('GET', params)
      const listaEmpresas: EmpresaOpcion[] = res.empresas ?? []
      const esAdminRes: boolean = res.es_admin ?? false

      setUsuarios(res.usuarios ?? [])
      setEmpresas(listaEmpresas)
      setEsAdmin(esAdminRes)

      // Supervisor: siempre fija la única empresa sin disparar el useEffect de filtro
      // Admin con una empresa: idem
      if (listaEmpresas.length === 1) {
        setEmpresaFiltro(listaEmpresas[0].id_empresa)
        setInvEmpresa(listaEmpresas[0].id_empresa)
      }
    } catch (e: any) {
      setError(e.message)
    } finally { setCargando(false) }
  }

  useEffect(() => {
    cargar()
    supabase.from('roles').select('id_rol, nombre_rol').order('id_rol')
      .then(({ data }) => setRoles(data ?? []))
  }, [])

  // El filtro de empresa solo recarga cuando el USUARIO lo cambia manualmente
  // (no cuando cargar() lo setea internamente)
  const [filtroManual, setFiltroManual] = useState(false)
  useEffect(() => {
    if (filtroManual && empresaFiltro !== '') {
      cargar(empresaFiltro as number)
      setFiltroManual(false)
    }
  }, [empresaFiltro, filtroManual])

  function cambiarEmpresaFiltro(val: number | '') {
    setEmpresaFiltro(val)
    setFiltroManual(true)
  }

  // Roles disponibles: supervisor no puede asignar 'admin'
  const rolesDisponibles = esAdmin
    ? roles
    : roles.filter(r => !ROLES_SOLO_ADMIN.includes(r.nombre_rol))

  // Supervisor: la Edge Function ya filtra — mostrar todo lo que llegó
  // Admin: filtrar localmente si seleccionó una empresa específica
  // Supervisor: además ocultar usuarios con rol admin
  const usuariosFiltrados = (() => {
    let lista = (!esAdmin || empresaFiltro === '')
      ? usuarios
      : usuarios.filter(u => u.id_empresa === empresaFiltro)
    if (!esAdmin) lista = lista.filter(u => u.nombre_rol !== 'admin')
    return lista
  })()

  async function handleInvitar() {
    if (!invEmail.trim() || !invRol || !invEmpresa) return setInvError('Completa todos los campos.')
    setInvGuardando(true); setInvError(null); setInvOk(null)
    try {
      const res = await callFn('POST', { accion: 'invitar' }, {
        email: invEmail.trim(), nombre: invNombre.trim(), id_rol: invRol, id_empresa: invEmpresa
      })
      if (res.ya_existia) {
        setInvOk(`El usuario ${invEmail.trim()} ya tenía cuenta. Se le asignó el rol seleccionado.`)
      } else {
        setInvOk(`Usuario creado. Se envió un correo de bienvenida a ${invEmail.trim()}.`)
      }
      setInvEmail(''); setInvNombre(''); setInvRol('')
      cargar(empresaFiltro !== '' ? empresaFiltro as number : undefined)
    } catch (e: any) {
      setInvError(e.message)
    } finally { setInvGuardando(false) }
  }

  async function handleCambiarRol() {
    if (!modalRol || !nuevoRol) return
    setRolGuardando(true); setRolError(null)
    try {
      await callFn('PATCH', { accion: 'cambiar-rol' }, {
        id_usuario: modalRol.id, id_rol: nuevoRol, id_empresa: modalRol.id_empresa, nombre: nuevoNombre.trim()
      })
      setModalRol(null)
      cargar(empresaFiltro !== '' ? empresaFiltro as number : undefined)
    } catch (e: any) {
      setRolError(e.message)
    } finally { setRolGuardando(false) }
  }

  async function handleRevocar(u: UsuarioFila) {
    if (!confirm(`¿Revocar el acceso de ${u.nombre || u.email}? El usuario no podrá ingresar al sistema pero sus datos se conservan.`)) return
    try {
      await callFn('DELETE', { accion: 'revocar', id_usuario: u.id, id_empresa: String(u.id_empresa) })
      cargar(empresaFiltro !== '' ? empresaFiltro as number : undefined)
    } catch (e: any) { alert(e.message) }
  }

  function abrirModalInvitar() {
    setModalInvitar(true); setInvOk(null); setInvError(null)
    setInvEmail(''); setInvNombre(''); setInvRol('')
    if (empresaFiltro !== '') setInvEmpresa(empresaFiltro as number)
    else if (empresas.length === 1) setInvEmpresa(empresas[0].id_empresa)
    else setInvEmpresa('')
  }

  const nombreEmpresa = (id: number) =>
    empresas.find(e => e.id_empresa === id)?.nombre_empresa ?? `Empresa ${id}`

  return (
    <div>
      <PageHeader titulo="Usuarios">
        <button className="btn btn--primary" onClick={abrirModalInvitar}>
          + Invitar usuario
        </button>
      </PageHeader>

      {/* Selector de empresa (solo si hay más de una) */}
      {empresas.length > 1 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-soft)' }}>Empresa:</label>
          <select
            value={empresaFiltro}
            onChange={e => cambiarEmpresaFiltro(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              padding: '7px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-ink)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            <option value="">Todas las empresas</option>
            {empresas.map(e => (
              <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {cargando ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>Cargando…</div>
      ) : (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                {[
                  'Nombre', 'Correo', 'Rol',
                  ...(empresas.length > 1 ? ['Empresa'] : []),
                  'Último acceso', ''
                ].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--color-ink-soft)', borderBottom: '1px solid var(--color-border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--color-ink-soft)' }}>
                    No hay usuarios en esta empresa.
                  </td>
                </tr>
              )}
              {usuariosFiltrados.map((u, i) => (
                <tr key={`${u.id}-${u.id_empresa}`}
                  style={{ borderBottom: i < usuariosFiltrados.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                    {u.nombre || <span style={{ color: 'var(--color-ink-soft)', fontStyle: 'italic' }}>Sin nombre</span>}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--color-ink-soft)', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700,
                      background: `${BADGE_COLOR[u.nombre_rol] ?? '#999'}22`,
                      color: BADGE_COLOR[u.nombre_rol] ?? '#999',
                    }}>
                      {ETIQUETAS_ROL[u.nombre_rol] ?? u.nombre_rol}
                    </span>
                  </td>
                  {empresas.length > 1 && (
                    <td style={{ padding: '12px 14px', color: 'var(--color-ink-soft)', fontSize: 12 }}>
                      {nombreEmpresa(u.id_empresa)}
                    </td>
                  )}
                  <td style={{ padding: '12px 14px', color: 'var(--color-ink-soft)' }}>{formatFecha(u.ultimo_acceso)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {/* Supervisor no puede modificar usuarios con rol admin */}
                    {(esAdmin || u.nombre_rol !== 'admin') && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn--ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => { setModalRol(u); setNuevoRol(u.id_rol); setNuevoNombre(u.nombre || ''); setRolError(null) }}>
                          Editar
                        </button>
                        <button className="btn btn--ghost"
                          style={{ fontSize: 12, padding: '4px 10px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => handleRevocar(u)}>
                          Revocar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Invitar ──────────────────────────────────────── */}
      {modalInvitar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }} onClick={() => setModalInvitar(false)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 28, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-elevated)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20, fontSize: 17 }}>Invitar usuario</h3>

            {invOk ? (
              <>
                <div style={{
                  background: 'var(--color-success-soft)', color: 'var(--color-success)',
                  borderRadius: 8, padding: '12px 14px', fontSize: 13, marginBottom: 20, lineHeight: 1.5,
                }}>✓ {invOk}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn--ghost" onClick={() => { setInvOk(null) }}>Invitar otro</button>
                  <button className="btn btn--primary" onClick={() => setModalInvitar(false)}>Cerrar</button>
                </div>
              </>
            ) : (
              <>
                {/* Selector de empresa solo si hay más de una */}
                {empresas.length > 1 && (
                  <div className="field">
                    <label>Empresa</label>
                    <select value={invEmpresa} onChange={e => setInvEmpresa(Number(e.target.value))}
                      style={{
                        width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                        color: 'var(--color-ink)', fontSize: 13,
                      }}>
                      <option value="">Selecciona una empresa…</option>
                      {empresas.map(e => (
                        <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label>Nombre completo</label>
                  <input type="text" value={invNombre} onChange={e => setInvNombre(e.target.value)}
                    placeholder="Nombre del usuario"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                      color: 'var(--color-ink)', fontSize: 13 }} />
                </div>

                <div className="field">
                  <label>Correo electrónico</label>
                  <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                      color: 'var(--color-ink)', fontSize: 13 }} />
                </div>

                <div className="field">
                  <label>Rol</label>
                  <select value={invRol} onChange={e => setInvRol(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                      color: 'var(--color-ink)', fontSize: 13,
                    }}>
                    <option value="">Selecciona un rol…</option>
                    {rolesDisponibles.map(r => (
                      <option key={r.id_rol} value={r.id_rol}>
                        {ETIQUETAS_ROL[r.nombre_rol] ?? r.nombre_rol}
                      </option>
                    ))}
                  </select>
                </div>

                <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginBottom: 20 }}>
                  El usuario recibirá un correo con instrucciones para ingresar.
                </p>

                {invError && <div className="error-text" style={{ marginBottom: 12 }}>{invError}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn--ghost" onClick={() => setModalInvitar(false)}>Cancelar</button>
                  <button className="btn btn--primary" disabled={invGuardando} onClick={handleInvitar}>
                    {invGuardando ? 'Creando…' : 'Crear usuario'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Cambiar rol ──────────────────────────────────── */}
      {modalRol && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }} onClick={() => setModalRol(null)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 28, width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-elevated)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6, fontSize: 17 }}>Editar usuario</h3>
            <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', marginBottom: 16 }}>{modalRol.email}</p>

            <div className="field">
              <label>Nombre</label>
              <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Nombre del usuario"
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                  color: 'var(--color-ink)', fontSize: 13,
                }} />
            </div>

            <div className="field">
              <label>Rol</label>
              <select value={nuevoRol} onChange={e => setNuevoRol(Number(e.target.value))}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                  color: 'var(--color-ink)', fontSize: 13,
                }}>
                {rolesDisponibles.map(r => (
                  <option key={r.id_rol} value={r.id_rol}>
                    {ETIQUETAS_ROL[r.nombre_rol] ?? r.nombre_rol}
                  </option>
                ))}
              </select>
            </div>

            {empresas.length > 1 && (
              <p style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginBottom: 8 }}>
                Empresa: {nombreEmpresa(modalRol.id_empresa)}
              </p>
            )}

            {rolError && <div className="error-text" style={{ marginBottom: 12 }}>{rolError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn--ghost" onClick={() => setModalRol(null)}>Cancelar</button>
              <button className="btn btn--primary" disabled={rolGuardando} onClick={handleCambiarRol}>
                {rolGuardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
