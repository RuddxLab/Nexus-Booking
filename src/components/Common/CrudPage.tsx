import { useEffect, useState, ReactNode, Fragment } from 'react'
import { Modal } from './Modal'
import { PageHeader } from './PageHeader'
import { SelectorFiltro } from './SelectorFiltro'
import { IconEditar, IconEliminar, IconNuevo, IconBuscar, IconExcel, IconGuardar } from './icons'
import * as XLSX from 'xlsx'
import { REGIONES, REGIONES_COMUNAS } from '../../data/chileRegionesComunas'
import { formatearRut, limpiarRut, validarRut, validarEmail, EJEMPLO_RUT } from '../../utils/validators'
import { PAISES_TELEFONO, separarTelefono, armarTelefono, validarTelefono } from '../../data/paisesTelefono'
import { TelefonoPicker } from './TelefonoPicker'
import { useFiltroEmpresa } from '../../hooks/useFiltroEmpresa'

export interface CrudField {
  key: string
  label: string
  type?: 'text' | 'number' | 'checkbox' | 'sino' | 'region' | 'comuna' | 'select' | 'date' | 'rut' | 'email' | 'telefono'
  required?: boolean
  dependsOn?: string
  options?: { value: string | number; label: string }[]
  /** Opciones dinámicas en función del valor del campo `dependsOn`
   *  (ej. sucursales filtradas por la empresa seleccionada). Si se define,
   *  tiene prioridad sobre `options`. */
  opcionesDe?: (dep: any) => { value: string | number; label: string }[]
  ancho?: 'completo'
  soloEdicion?: boolean
  soloLectura?: boolean  // visible pero no editable en ningún modo
}

export interface CrudColumn {
  key: string
  label: string
  render?: (row: any) => ReactNode
  type?: string
  required?: boolean
}

interface CrudService<T> {
  listAll: (orderBy?: string, idEmpresa?: number, idSucursal?: number) => Promise<T[]>
  create:  (payload: Partial<T>) => Promise<T>
  update:  (id: number | string, payload: Partial<T>, idEmpresa?: number | null) => Promise<T>
  remove:  (id: number | string, idEmpresa?: number | null) => Promise<void>
}

interface Props<T extends Record<string, any>> {
  titulo:      string
  idKey:       string
  service:     CrudService<T>
  columnas:    CrudColumn[]
  campos:      CrudField[]
  orderBy?:    string
  defaults?:   Partial<T>
  busqueda?:   { campos: string[]; placeholder?: string }
  filaExpandible?:  (row: T) => ReactNode
  transformPayload?: (payload: Partial<T>, esNuevo: boolean) => Partial<T>
  /** Si false, no filtra por sucursal aunque haya una seleccionada (ej. tablas sin id_sucursal) */
  filtrarPorSucursal?: boolean
  /** Si true, el manejo de sucursal depende del flag `servicios_por_sucursal` de la
   *  empresa seleccionada: en modo compartido (false) se oculta el filtro y el campo
   *  id_sucursal (no requerido → se guarda NULL, registro a nivel empresa); en modo
   *  por-sucursal (true) se comporta como siempre (filtra y exige sucursal). */
  sucursalPorFlagEmpresa?: boolean
  recargarCuando?: unknown[]
  /** Habilita filtro por rango de fecha y botón de descarga CSV */
  campoFecha?: string  // ej: 'created_at' | 'fecha_creacion'
}

function coincideBusqueda(valor: unknown, query: string): boolean {
  const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '')
  return normalizar(String(valor ?? '')).includes(normalizar(query))
}

const SEL_STYLE: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 180,
}

export function CrudPage<T extends Record<string, any>>({
  titulo, idKey, service, columnas, campos, orderBy,
  defaults, busqueda, filaExpandible, transformPayload,
  recargarCuando = [],
  filtrarPorSucursal = true,
  sucursalPorFlagEmpresa = false,
  campoFecha,
}: Props<T>) {

  // ── Filtro empresa/sucursal integrado ────────────────────────────────────
  const {
    empresaId, sucursalId,
    setEmpresaId, setSucursalId,
    esAdmin, esSupervisor,
    empresas, sucursalesDeEmpresa,
  } = useFiltroEmpresa()

  // Modo de servicios de la empresa seleccionada. Si la empresa comparte
  // servicios (false), la sucursal deja de ser una dimensión: no se filtra la
  // lista, se oculta el selector y el campo id_sucursal (se guarda NULL).
  const serviciosPorSucursal =
    empresas.find(e => e.id_empresa === empresaId)?.servicios_por_sucursal ?? true
  const filtrarSucursal = filtrarPorSucursal && (!sucursalPorFlagEmpresa || serviciosPorSucursal)
  const ocultarCampoSucursal = sucursalPorFlagEmpresa && !serviciosPorSucursal
  const camposActivos = ocultarCampoSucursal
    ? campos.filter(c => c.key !== 'id_sucursal')
    : campos

  const [filas,           setFilas]           = useState<T[]>([])
  const [cargando,        setCargando]        = useState(true)
  const [editando,        setEditando]        = useState<Partial<T> | null>(null)
  const [error,           setError]           = useState<string | null>(null)
  const [query,           setQuery]           = useState('')
  const [filaExpandidaId, setFilaExpandidaId] = useState<any>(null)
  const [fechaDesde,      setFechaDesde]      = useState('')
  const [fechaHasta,      setFechaHasta]      = useState('')

  const filasVisibles = (() => {
    let resultado = filas
    if (busqueda && query.trim()) {
      resultado = resultado.filter(f => busqueda.campos.some(c => coincideBusqueda((f as any)[c], query)))
    }
    if (campoFecha && fechaDesde) {
      resultado = resultado.filter(f => {
        const val = String((f as any)[campoFecha] ?? '').substring(0, 10)
        return val >= fechaDesde
      })
    }
    if (campoFecha && fechaHasta) {
      resultado = resultado.filter(f => {
        const val = String((f as any)[campoFecha] ?? '').substring(0, 10)
        return val <= fechaHasta
      })
    }
    return resultado
  })()

  function resolverValorCampo(fila: T, campo: CrudField): string {
    const val = (fila as any)[campo.key]
    if (val === null || val === undefined || val === '') return ''

    switch (campo.type) {
      case 'checkbox':
        return val ? 'Sí' : 'No'
      case 'sino':
        return Number(val) === 1 ? 'Sí' : 'No'
      case 'select':
        // Resolver el label de la opción seleccionada
        return campo.options?.find(o => String(o.value) === String(val))?.label ?? String(val)
      case 'date':
        // Formatear fecha YYYY-MM-DD a DD/MM/YYYY
        return String(val).substring(0, 10).split('-').reverse().join('/')
      case 'rut':
        // Formatear RUT si es necesario
        return String(val)
      default:
        return String(val)
    }
  }

  function descargarExcel() {
    if (filasVisibles.length === 0) return

    const camposXLS = campos.filter(c => !c.soloEdicion)
    const headers   = camposXLS.map(c => c.label)

    const data = filasVisibles.map(fila =>
      camposXLS.reduce((row, campo) => {
        const val = resolverValorCampo(fila, campo)
        // Intentar convertir a número si el campo es numérico
        row[campo.label] = campo.type === 'number' && val !== '' ? Number(val) : val
        return row
      }, {} as Record<string, unknown>)
    )

    const ws = XLSX.utils.json_to_sheet(data, { header: headers })

    // Ancho automático de columnas basado en el contenido
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...data.map(row => String(row[h] ?? '').length)
      )
      return { wch: Math.min(maxLen + 2, 40) }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31)) // Excel limita a 31 chars
    XLSX.writeFile(wb, `${titulo.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function cargar() {
    if (!empresaId) return  // Esperar a que el filtro resuelva la empresa
    setCargando(true)
    try {
      setFilas(await service.listAll(
        orderBy,
        empresaId,
        filtrarSucursal ? (sucursalId ?? undefined) : undefined,
      ))
    } finally {
      setCargando(false)
    }
  }

  // Recargar cuando cambia empresa o sucursal en el selector, o el modo de la empresa
  useEffect(() => {
    cargar()
  }, [empresaId, sucursalId, serviciosPorSucursal]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNuevo() {
    setError(null)
    // Prerellenar empresa y sucursal del filtro actual.
    //
    // Dos guardas, cada una por un motivo distinto:
    //
    // 1) idKey !== 'id_*' — NUNCA inyectar la PK de la propia tabla. CrudPage
    //    usa editando[idKey] para distinguir alta de edición (ver guardar()),
    //    el título del modal y el filtro de campos soloEdicion. Inyectarla
    //    convertía un "Nuevo" en un UPDATE silencioso de la fila filtrada:
    //    pasaba en EmpresasPage (idKey='id_empresa') y SucursalesPage
    //    (idKey='id_sucursal').
    //
    // 2) filtrarPorSucursal — hay tablas sin columna id_sucursal (empresas,
    //    clientes). Inyectarla ahí reventaba con
    //    "Could not find the 'id_sucursal' column ... in the schema cache".
    const extra: any = {}
    if (empresaId && idKey !== 'id_empresa') {
      extra.id_empresa = empresaId
    }
    if (sucursalId && idKey !== 'id_sucursal' && filtrarSucursal) {
      extra.id_sucursal = sucursalId
    }
    setEditando({ ...(defaults ?? {}), ...extra } as Partial<T>)
  }

  function abrirEditar(fila: T) {
    setError(null)
    setEditando(fila)
  }

  function validarFormulario(): string | null {
    for (const campo of camposActivos) {
      const valor = (editando as any)?.[campo.key]
      const vacio = campo.type === 'telefono'
        ? !separarTelefono(String(valor ?? '')).numero
        : valor === undefined || valor === null || valor === ''
      if (campo.required && vacio) return `"${campo.label}" es obligatorio.`
      if (campo.type === 'rut'   && !vacio && !validarRut(String(valor)))   return `El RUT de "${campo.label}" no es válido.`
      if (campo.type === 'email' && !vacio && !validarEmail(String(valor))) return `El correo de "${campo.label}" no tiene un formato válido.`
      if (campo.type === 'telefono' && !vacio && !validarTelefono(String(valor))) {
        const { codigo } = separarTelefono(String(valor))
        const pais = PAISES_TELEFONO.find(p => p.codigo === codigo)
        return `El teléfono de "${campo.label}" debe tener ${pais?.digitos ?? '?'} dígitos para ${pais?.pais ?? codigo}.`
      }
    }
    return null
  }

  function prepararPayload(): Partial<T> {
    const payload: any = { ...editando }
    const camposNumericos = new Set(
      camposActivos.filter(c => c.type === 'number').map(c => c.key)
    )
    for (const campo of camposActivos) {
      if (campo.type === 'rut' && typeof payload[campo.key] === 'string')
        payload[campo.key] = limpiarRut(payload[campo.key])
      if (campo.type === 'telefono' && !separarTelefono(String(payload[campo.key] ?? '')).numero)
        payload[campo.key] = null
    }
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') {
        // Campos numéricos vacíos → 0 (la BD tiene constraints >= 0)
        payload[key] = camposNumericos.has(key) ? 0 : null
      }
    }
    return payload
  }

  async function guardar() {
    if (!editando) return
    const err = validarFormulario()
    if (err) { setError(err); return }
    const esNuevo = !(editando as any)[idKey]
    let payload = prepararPayload()
    if (transformPayload) payload = transformPayload(payload, esNuevo)
    try {
      if (!esNuevo) await service.update((editando as any)[idKey], payload, empresaId)
      else          await service.create(payload)
      setEditando(null)
      cargar()
    } catch (err: any) {
      setError(err.message ?? 'No se pudo guardar.')
    }
  }

  async function eliminar(fila: T) {
    const tieneActivo = 'activo' in (fila as any)
    const msg = tieneActivo
      ? '¿Desactivar este registro? Dejará de aparecer disponible, pero no se borra su historial.'
      : '¿Eliminar este registro? Esta acción no se puede deshacer.'
    if (!confirm(msg)) return
    if (tieneActivo) await service.update((fila as any)[idKey], { activo: false } as any, empresaId)
    else             await service.remove((fila as any)[idKey], empresaId)
    cargar()
  }

  return (
    <div className="main">
      <PageHeader titulo={titulo}>
        {campoFecha && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              Fecha:
            </span>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              title="Desde"
              style={{ ...SEL_STYLE, minWidth: 'auto', fontSize: 12, padding: '5px 8px' }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-ink-soft)' }}>—</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              title="Hasta"
              style={{ ...SEL_STYLE, minWidth: 'auto', fontSize: 12, padding: '5px 8px' }}
            />
            {(fechaDesde || fechaHasta) && (
              <button
                className="btn btn--ghost"
                onClick={() => { setFechaDesde(''); setFechaHasta('') }}
                style={{ fontSize: 11, padding: '4px 8px' }}
                title="Limpiar filtro de fechas"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <button
          className="btn btn--ghost btn--icon"
          onClick={descargarExcel}
          title="Descargar Excel"
          disabled={filasVisibles.length === 0}
          style={{ opacity: filasVisibles.length === 0 ? 0.4 : 1 }}
        >
          <IconExcel /> Excel
        </button>
        <button className="btn btn--primary btn--icon" onClick={abrirNuevo} title="Nuevo registro">
          <IconNuevo /> Nuevo
        </button>
      </PageHeader>

      {/* ── Selector empresa + sucursal ── */}
      <SelectorFiltro
        esAdmin={esAdmin}
        esSupervisor={esSupervisor}
        empresas={empresas}
        sucursalesDeEmpresa={sucursalesDeEmpresa}
        empresaId={empresaId}
        sucursalId={sucursalId}
        onEmpresaChange={setEmpresaId}
        onSucursalChange={setSucursalId}
        mostrarSucursal={filtrarSucursal}
      />

      {busqueda && (
        <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-soft)', display: 'flex' }}>
              <IconBuscar />
            </span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={busqueda.placeholder ?? 'Buscar…'}
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>
      )}

      {cargando ? (
        <p style={{ color: 'var(--color-ink-soft)' }}>Cargando…</p>
      ) : (
        <div className="card table-scroll">
          <table className="table table--responsive">
            <thead>
              <tr>
                {columnas.map(c => <th key={c.key}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filasVisibles.map(fila => {
                const id = (fila as any)[idKey]
                const expandida = filaExpandidaId === id
                return (
                  <Fragment key={id}>
                    <tr>
                      {columnas.map(c => (
                        <td key={c.key} data-label={c.label}>
                          {c.render ? c.render(fila) : String((fila as any)[c.key] ?? '')}
                        </td>
                      ))}
                      <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {filaExpandible && (
                          <button className="btn btn--ghost btn--icon-only"
                            onClick={() => setFilaExpandidaId(expandida ? null : id)}
                            title={expandida ? 'Ocultar' : 'Ver más'}>
                            {expandida ? '▾' : '▸'}
                          </button>
                        )}{' '}
                        <button className="btn btn--ghost btn--icon-only" onClick={() => abrirEditar(fila)} title="Editar">
                          <IconEditar />
                        </button>{' '}
                        <button className="btn btn--ghost btn--icon-only"
                          onClick={() => eliminar(fila)}
                          title={'activo' in (fila as any) ? 'Desactivar' : 'Eliminar'}>
                          <IconEliminar />
                        </button>
                      </td>
                    </tr>
                    {expandida && filaExpandible && (
                      <tr key={`${id}-expandida`}>
                        <td colSpan={columnas.length + 1} style={{ background: 'var(--color-surface-2)' }}>
                          {filaExpandible(fila)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={columnas.length + 1} style={{ color: 'var(--color-ink-soft)' }}>
                    {query.trim() ? 'Sin resultados para tu búsqueda.' : 'Sin registros todavía.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal title={(editando as any)[idKey] ? 'Editar' : 'Nuevo registro'} onClose={() => setEditando(null)}>
          <div className="form-grid">
            {camposActivos.filter(c => !(c.soloEdicion && !(editando as any)[idKey])).map(campo => {
              const valor = (editando as any)[campo.key]
              const cls   = 'field' + (campo.ancho === 'completo' ? ' form-grid--span2' : '')

              if (campo.type === 'checkbox') return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <input type="checkbox" checked={Boolean(valor)}
                    onChange={e => setEditando({ ...editando, [campo.key]: e.target.checked })} />
                </div>
              )

              if (campo.type === 'sino') return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <select value={Number(valor) === 1 ? '1' : '0'}
                    onChange={e => setEditando({ ...editando, [campo.key]: Number(e.target.value) })}>
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </div>
              )

              if (campo.type === 'region') return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <select value={valor ?? ''} onChange={e => {
                    const dep = campos.find(c => c.type === 'comuna' && c.dependsOn === campo.key)
                    setEditando({ ...editando, [campo.key]: e.target.value, ...(dep ? { [dep.key]: '' } : {}) })
                  }}>
                    <option value="">Selecciona una región…</option>
                    {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )

              if (campo.type === 'comuna') {
                const region  = campo.dependsOn ? (editando as any)[campo.dependsOn] : null
                const comunas = region ? REGIONES_COMUNAS[region] ?? [] : []
                return (
                  <div className={cls} key={campo.key}>
                    <label>{campo.label}</label>
                    <select value={valor ?? ''} disabled={!region}
                      onChange={e => setEditando({ ...editando, [campo.key]: e.target.value })}>
                      <option value="">{region ? 'Selecciona una comuna…' : 'Primero elige una región'}</option>
                      {comunas.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )
              }

              if (campo.type === 'select') {
                const depVal   = campo.dependsOn ? (editando as any)[campo.dependsOn] : undefined
                const opciones = campo.opcionesDe ? campo.opcionesDe(depVal) : (campo.options ?? [])
                const bloqueado = !!campo.dependsOn && (depVal === undefined || depVal === null || depVal === '')
                return (
                  <div className={cls} key={campo.key}>
                    <label>{campo.label}</label>
                    <select value={valor ?? ''} disabled={bloqueado}
                      onChange={e => {
                        const op = opciones.find(o => String(o.value) === e.target.value)
                        const nuevoVal = op ? op.value : e.target.value
                        const deps = campos.filter(c => c.type === 'select' && c.dependsOn === campo.key)
                        const resets = Object.fromEntries(deps.map(d => [d.key, '']))
                        setEditando({ ...editando, [campo.key]: nuevoVal, ...resets })
                      }}>
                      <option value="">{bloqueado ? 'Primero elige…' : 'Selecciona…'}</option>
                      {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )
              }

              if (campo.type === 'rut') return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <input value={valor ?? ''} placeholder={EJEMPLO_RUT}
                    onChange={e => setEditando({ ...editando, [campo.key]: formatearRut(e.target.value) })} />
                </div>
              )

              if (campo.type === 'email') return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <input type="email" placeholder="Ej: nombre@correo.com" value={valor ?? ''}
                    onChange={e => setEditando({ ...editando, [campo.key]: e.target.value })} />
                </div>
              )

              if (campo.type === 'telefono') {
                const { codigo, numero } = separarTelefono(valor ?? '')
                const pais = PAISES_TELEFONO.find(p => p.codigo === codigo)
                return (
                  <div className={cls} key={campo.key}>
                    <label>{campo.label}</label>
                    <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                      <TelefonoPicker
                        value={valor ?? ''}
                        onChange={nuevoVal => {
                          // Solo actualizar el código, mantener el número
                          const { codigo: nuevoCod } = separarTelefono(nuevoVal)
                          setEditando({ ...editando, [campo.key]: armarTelefono(nuevoCod, numero) })
                        }}
                      />
                      <input style={{ flex: '1 1 0', minWidth: 0 }} value={numero}
                        placeholder={`${pais?.digitos ?? ''} dígitos`}
                        onChange={e => {
                          const soloNum = e.target.value.replace(/\D/g, '').slice(0, pais?.digitos ?? 15)
                          setEditando({ ...editando, [campo.key]: armarTelefono(codigo, soloNum) })
                        }} />
                    </div>
                  </div>
                )
              }

              return (
                <div className={cls} key={campo.key}>
                  <label>{campo.label}</label>
                  <input
                    type={campo.type ?? 'text'}
                    required={campo.required}
                    value={valor ?? ''}
                    readOnly={campo.soloLectura}
                    style={campo.soloLectura ? { opacity: 0.5, cursor: 'not-allowed', userSelect: 'none' } : undefined}
                    onChange={campo.soloLectura ? undefined : e => setEditando({
                      ...editando,
                      [campo.key]: campo.type === 'number' ? Number(e.target.value) : e.target.value
                    })}
                  />
                </div>
              )
            })}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn--primary btn--icon" onClick={guardar}><IconGuardar /> Guardar</button>
            <button className="btn btn--ghost" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
