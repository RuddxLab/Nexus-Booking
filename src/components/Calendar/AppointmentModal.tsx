import { useState, useMemo } from 'react'
import { Modal } from '../Common/Modal'
import { crearAgendamiento, cancelarAgendamiento, DobleReservaError } from '../../services/agendamientosService'
import { enviarCorreoReserva, enviarCorreoCancelacion } from '../../services/correoService'
import { validarEmail, formatearRut, validarRut, limpiarRut } from '../../utils/validators'
import { formatearHora } from '../../utils/calendarUtils'
import { PAISES_TELEFONO, separarTelefono, armarTelefono, validarTelefono } from '../../data/paisesTelefono'
import { TelefonoPicker } from '../Common/TelefonoPicker'
import type { Agendamiento, PrestadorPublico, Servicio } from '../../types'

interface Props {
  fecha: string
  horaInicial: string
  citaExistente: Agendamiento | null
  prestadores: PrestadorPublico[]
  servicios: Servicio[]
  idEmpresa: number
  idSucursal: number
  onClose: () => void
  onSaved: () => void
}

// Genera slots de 30 min entre 07:00 y 21:00
function generarSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 21) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}
const SLOTS = generarSlots()

// Agrupa servicios por categoría para el selector visual
function agruparPorCategoria(servicios: Servicio[]) {
  const mapa = new Map<number, Servicio[]>()
  for (const s of servicios) {
    const lista = mapa.get(s.id_categoria) ?? []
    lista.push(s)
    mapa.set(s.id_categoria, lista)
  }
  return mapa
}

export function AppointmentModal({
  fecha, horaInicial, citaExistente, prestadores, servicios,
  idEmpresa, idSucursal, onClose, onSaved
}: Props) {
  const [nombreCliente, setNombreCliente] = useState(citaExistente?.nombre_cliente ?? '')
  const [telefono,      setTelefono]      = useState(citaExistente?.telefono ?? '')
  const [email,         setEmail]         = useState(citaExistente?.email ?? '')
  const [rut,           setRut]           = useState(citaExistente?.rut ?? '')
  const [idPrestador,   setIdPrestador]   = useState<number>(citaExistente?.id_prestador ?? prestadores[0]?.id_prestador ?? 0)
  const [idServicio,    setIdServicio]    = useState<number>(citaExistente?.id_servicio ?? servicios[0]?.id_servicio ?? 0)
  const [horaInicio,    setHoraInicio]    = useState(citaExistente?.hora_inicio ?? horaInicial)
  const [busqServ,      setBusqServ]      = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [guardando,     setGuardando]     = useState(false)

  const servicioSeleccionado = servicios.find(s => s.id_servicio === idServicio)
  const telefonoSeparado     = separarTelefono(telefono ?? '')
  const paisTelefono         = PAISES_TELEFONO.find(p => p.codigo === telefonoSeparado.codigo)

  // Servicios filtrados por búsqueda
  const serviciosFiltrados = useMemo(() => {
    const txt = busqServ.trim().toLowerCase()
    return txt ? servicios.filter(s => s.nombre_servicio.toLowerCase().includes(txt)) : servicios
  }, [servicios, busqServ])

  function calcularHoraFin(inicio: string, duracionMin: number) {
    const [h, m] = inicio.split(':').map(Number)
    const total  = h * 60 + m + duracionMin
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const horaFinCalculada = citaExistente
    ? formatearHora(citaExistente.hora_fin)
    : servicioSeleccionado
      ? calcularHoraFin(horaInicio, servicioSeleccionado.duracion)
      : ''

  async function handleGuardar() {
    setError(null)
    if (!nombreCliente.trim())                    return setError('El nombre del cliente es obligatorio.')
    if (!servicioSeleccionado)                    return setError('Selecciona un servicio.')
    if (!email.trim())                            return setError('El correo es obligatorio.')
    if (email && !validarEmail(email))            return setError('El correo no tiene un formato válido.')
    if (rut && !validarRut(rut))                  return setError('El RUT no es válido.')
    if (!telefonoSeparado.numero)                 return setError('El teléfono es obligatorio.')
    if (!validarTelefono(telefono))               return setError(`El teléfono debe tener ${paisTelefono?.digitos ?? '?'} dígitos para ${paisTelefono?.pais ?? telefonoSeparado.codigo}.`)

    setGuardando(true)
    try {
      await crearAgendamiento({
        id_empresa: idEmpresa, id_sucursal: idSucursal,
        id_prestador: idPrestador, id_servicio: idServicio, id_cliente: 0,
        nombre_cliente: nombreCliente, telefono, email,
        rut: rut ? limpiarRut(rut) : null,
        fecha, hora_inicio: horaInicio, hora_fin: horaFinCalculada, estado: 'AGENDADA'
      } as any)

      if (email) {
        const prestador = prestadores.find(p => p.id_prestador === idPrestador)
        enviarCorreoReserva({
          id_agendamiento: 0, id_empresa: idEmpresa, id_sucursal: idSucursal,
          nombre_cliente: nombreCliente, email, telefono,
          nombre_prestador: prestador?.nombre_prestador ?? '',
          nombre_servicio: servicioSeleccionado?.nombre_servicio ?? '',
          duracion: servicioSeleccionado?.duracion ?? 0,
          fecha, hora_inicio: horaInicio, hora_fin: horaFinCalculada
        })
      }
      onSaved()
    } catch (err) {
      if (err instanceof DobleReservaError) setError(err.message)
      else setError('No se pudo guardar la cita. Intenta de nuevo.')
    } finally { setGuardando(false) }
  }

  async function handleCancelar() {
    if (!citaExistente) return
    setGuardando(true)
    try {
      await cancelarAgendamiento(citaExistente.id_agendamiento)
      if (citaExistente.email) {
        const prestador = prestadores.find(p => p.id_prestador === citaExistente.id_prestador)
        const servicio  = servicios.find(s => s.id_servicio === citaExistente.id_servicio)
        enviarCorreoCancelacion({
          id_empresa: idEmpresa,
          nombre_cliente: citaExistente.nombre_cliente, email: citaExistente.email,
          nombre_prestador: prestador?.nombre_prestador ?? '',
          nombre_servicio: servicio?.nombre_servicio ?? '',
          fecha: citaExistente.fecha,
          hora_inicio: formatearHora(citaExistente.hora_inicio),
          hora_fin: formatearHora(citaExistente.hora_fin),
        })
      }
      onSaved()
    } catch { setError('No se pudo cancelar la cita.') }
    finally { setGuardando(false) }
  }

  // ── Estilos inline reutilizables ─────────────────────────────────────────
  const card: React.CSSProperties = {
    border: '1px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-surface)', overflow: 'hidden',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', color: 'var(--color-ink-soft)',
    padding: '8px 12px', background: 'var(--color-surface-2)',
    borderBottom: '1px solid var(--color-border)',
  }

  return (
    <Modal title={citaExistente ? 'Detalle de la cita' : 'Nueva cita'} onClose={onClose}>

      {/* ── Vista de cita existente ── */}
      {citaExistente ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Resumen */}
          <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { lbl: 'Cliente',     val: citaExistente.nombre_cliente },
              { lbl: 'Teléfono',    val: citaExistente.telefono ?? '—' },
              { lbl: 'Correo',      val: citaExistente.email ?? '—' },
              { lbl: 'RUT',         val: citaExistente.rut ?? '—' },
              { lbl: 'Servicio',    val: citaExistente.servicios ? `${citaExistente.servicios.nombre_servicio} · ${citaExistente.servicios.duracion} min` : '—' },
              { lbl: 'Prestador',   val: prestadores.find(p => p.id_prestador === citaExistente.id_prestador)?.nombre_prestador ?? '—' },
              { lbl: 'Hora inicio', val: formatearHora(citaExistente.hora_inicio) },
              { lbl: 'Hora fin',    val: formatearHora(citaExistente.hora_fin) },
            ].map(({ lbl, val }, i) => (
              <div key={i} style={{ padding: '9px 12px', borderBottom: i < 6 ? '1px solid var(--color-border)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {citaExistente.estado !== 'CANCELADA' && (
              <button className="btn btn--danger" onClick={handleCancelar} disabled={guardando}>Cancelar cita</button>
            )}
            <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      ) : (
        /* ── Formulario nueva cita ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Datos del cliente */}
          <div style={card}>
            <div style={sectionTitle}>Cliente</div>
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field form-grid--span2">
                <label>Nombre completo</label>
                <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="field">
                <label>RUT <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                <input value={rut ?? ''} placeholder="12.345.678-9" onChange={e => setRut(formatearRut(e.target.value))} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <TelefonoPicker
                    value={telefono ?? ''}
                    onChange={nuevoVal => {
                      const { codigo: nuevoCod } = separarTelefono(nuevoVal)
                      setTelefono(armarTelefono(nuevoCod, telefonoSeparado.numero))
                    }}
                  />
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    value={telefonoSeparado.numero}
                    placeholder={`${paisTelefono?.digitos ?? ''} dígitos`}
                    onChange={e => {
                      const n = e.target.value.replace(/\D/g, '').slice(0, paisTelefono?.digitos ?? 15)
                      setTelefono(armarTelefono(telefonoSeparado.codigo, n))
                    }}
                  />
                </div>
              </div>
              <div className="field form-grid--span2">
                <label>Correo electrónico</label>
                <input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
            </div>
          </div>

          {/* Prestador */}
          <div style={card}>
            <div style={sectionTitle}>Prestador</div>
            <div style={{ padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {prestadores.map(p => (
                <button
                  key={p.id_prestador}
                  onClick={() => setIdPrestador(p.id_prestador)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 20,
                    border: `1.5px solid ${idPrestador === p.id_prestador ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: idPrestador === p.id_prestador ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: idPrestador === p.id_prestador ? 'var(--color-primary)' : 'var(--color-ink)',
                    fontWeight: idPrestador === p.id_prestador ? 600 : 400,
                    fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: idPrestador === p.id_prestador ? 'var(--color-primary)' : 'var(--color-surface-2)',
                    color: idPrestador === p.id_prestador ? '#fff' : 'var(--color-ink-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {p.nombre_prestador.charAt(0)}
                  </span>
                  {p.nombre_prestador}
                </button>
              ))}
            </div>
          </div>

          {/* Servicio */}
          <div style={card}>
            <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Servicio</span>
              <input
                value={busqServ}
                onChange={e => setBusqServ(e.target.value)}
                placeholder="Buscar…"
                style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-ink)', width: 120 }}
              />
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {serviciosFiltrados.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-ink-soft)', padding: '8px 0' }}>Sin resultados</div>
              )}
              {serviciosFiltrados.map(s => (
                <button
                  key={s.id_servicio}
                  onClick={() => setIdServicio(s.id_servicio)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: idServicio === s.id_servicio ? 'var(--color-primary-soft)' : 'transparent',
                    transition: 'background .12s', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: idServicio === s.id_servicio ? 600 : 400, color: idServicio === s.id_servicio ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                    {s.nombre_servicio}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginLeft: 8, whiteSpace: 'nowrap' as const }}>
                    {s.duracion} min · ${Number(s.valor).toLocaleString('es-CL')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Hora */}
          <div style={card}>
            <div style={sectionTitle}>Hora de inicio</div>
            <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => setHoraInicio(slot)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: `1.5px solid ${horaInicio === slot ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: horaInicio === slot ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: horaInicio === slot ? '#fff' : 'var(--color-ink)',
                    cursor: 'pointer', transition: 'all .12s',
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
            {servicioSeleccionado && horaInicio && (
              <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--color-ink-soft)' }}>
                Fin estimado: <strong style={{ color: 'var(--color-ink)' }}>{horaFinCalculada}</strong>
                {' '}· {servicioSeleccionado.duracion} min
              </div>
            )}
          </div>

          {error && <div className="error-text">{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cita'}
            </button>
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
