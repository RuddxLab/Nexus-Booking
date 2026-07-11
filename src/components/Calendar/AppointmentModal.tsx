import { useState } from 'react'
import { Modal } from '../Common/Modal'
import { crearAgendamiento, cancelarAgendamiento, DobleReservaError } from '../../services/agendamientosService'
import { enviarCorreoReserva, enviarCorreoCancelacion } from '../../services/correoService'
import { validarEmail, formatearRut, validarRut, limpiarRut } from '../../utils/validators'
import { formatearHora } from '../../utils/calendarUtils'
import { PAISES_TELEFONO, separarTelefono, armarTelefono, validarTelefono } from '../../data/paisesTelefono'
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

export function AppointmentModal({
  fecha,
  horaInicial,
  citaExistente,
  prestadores,
  servicios,
  idEmpresa,
  idSucursal,
  onClose,
  onSaved
}: Props) {
  const [nombreCliente, setNombreCliente] = useState(citaExistente?.nombre_cliente ?? '')
  const [telefono, setTelefono] = useState(citaExistente?.telefono ?? '')
  const [email, setEmail] = useState(citaExistente?.email ?? '')
  const [rut, setRut] = useState(citaExistente?.rut ?? '')
  const [idPrestador, setIdPrestador] = useState<number>(citaExistente?.id_prestador ?? prestadores[0]?.id_prestador ?? 0)
  const [idServicio, setIdServicio] = useState<number>(citaExistente?.id_servicio ?? servicios[0]?.id_servicio ?? 0)
  const [horaInicio, setHoraInicio] = useState(citaExistente?.hora_inicio ?? horaInicial)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const servicioSeleccionado = servicios.find((s) => s.id_servicio === idServicio)
  const telefonoSeparado = separarTelefono(telefono ?? '')
  const paisTelefono = PAISES_TELEFONO.find((p) => p.codigo === telefonoSeparado.codigo)

  function calcularHoraFin(inicio: string, duracionMin: number) {
    const [h, m] = inicio.split(':').map(Number)
    const total = h * 60 + m + duracionMin
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const horaFinCalculada = citaExistente
    ? formatearHora(citaExistente.hora_fin)
    : servicioSeleccionado
      ? calcularHoraFin(horaInicio, servicioSeleccionado.duracion)
      : ''

  async function handleGuardar() {
    setError(null)
    if (!nombreCliente.trim()) return setError('El nombre del cliente es obligatorio.')
    if (!servicioSeleccionado) return setError('Selecciona un servicio.')
    if (!email.trim()) return setError('El correo es obligatorio.')
    if (email && !validarEmail(email)) return setError('El correo no tiene un formato válido.')
    if (rut && !validarRut(rut)) return setError('El RUT no es válido.')
    if (!telefonoSeparado.numero) return setError('El teléfono es obligatorio.')
    if (!validarTelefono(telefono)) {
      return setError(`El teléfono debe tener ${paisTelefono?.digitos ?? '?'} dígitos para ${paisTelefono?.pais ?? telefonoSeparado.codigo}.`)
    }

    setGuardando(true)
    try {
      await crearAgendamiento({
        id_empresa: idEmpresa,
        id_sucursal: idSucursal,
        id_prestador: idPrestador,
        id_servicio: idServicio,
        id_cliente: 0,
        nombre_cliente: nombreCliente,
        telefono,
        email,
        rut: rut ? limpiarRut(rut) : null,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFinCalculada,
        estado: 'AGENDADA'
      } as any)

      // Enviar correo de confirmación si hay email
      if (email) {
        const prestador = prestadores.find((p) => p.id_prestador === idPrestador)
        enviarCorreoReserva({
          id_agendamiento: 0, // no tenemos el ID aquí, pero el correo se envía igual
          nombre_cliente: nombreCliente,
          email,
          telefono,
          nombre_prestador: prestador?.nombre_prestador ?? '',
          nombre_servicio: servicioSeleccionado?.nombre_servicio ?? '',
          duracion: servicioSeleccionado?.duracion ?? 0,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFinCalculada
        })
      }

      onSaved()
    } catch (err) {
      if (err instanceof DobleReservaError) setError(err.message)
      else setError('No se pudo guardar la cita. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCancelar() {
    if (!citaExistente) return
    setGuardando(true)
    try {
      await cancelarAgendamiento(citaExistente.id_agendamiento)

      // Enviar correo de cancelación al cliente si tiene email
      if (citaExistente.email) {
        const prestador = prestadores.find(p => p.id_prestador === citaExistente.id_prestador)
        const servicio  = servicios.find(s => s.id_servicio === citaExistente.id_servicio)
        enviarCorreoCancelacion({
          nombre_cliente:   citaExistente.nombre_cliente,
          email:            citaExistente.email,
          nombre_prestador: prestador?.nombre_prestador ?? '',
          nombre_servicio:  servicio?.nombre_servicio ?? '',
          fecha:            citaExistente.fecha,
          hora_inicio:      formatearHora(citaExistente.hora_inicio),
          hora_fin:         formatearHora(citaExistente.hora_fin),
        })
      }

      onSaved()
    } catch {
      setError('No se pudo cancelar la cita.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title={citaExistente ? 'Detalle de la cita' : 'Nueva cita'} onClose={onClose}>
      <div className="form-grid">
        <div className="field form-grid--span2">
          <label>Cliente</label>
          <input value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} disabled={!!citaExistente} />
        </div>
        <div className="field">
          <label>RUT</label>
          <input value={rut ?? ''} placeholder="Ej: 12.345.678-9" disabled={!!citaExistente} onChange={(e) => setRut(formatearRut(e.target.value))} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
            <select value={telefonoSeparado.codigo} style={{ flex: '0 0 auto', width: 80 }} disabled={!!citaExistente} onChange={(e) => setTelefono(armarTelefono(e.target.value, telefonoSeparado.numero))}>
              {PAISES_TELEFONO.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.bandera} {p.codigo}</option>
              ))}
            </select>
            <input style={{ flex: '1 1 0', minWidth: 0 }} value={telefonoSeparado.numero} placeholder={`${paisTelefono?.digitos ?? ''} dígitos`} disabled={!!citaExistente} onChange={(e) => {
              const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, paisTelefono?.digitos ?? 15)
              setTelefono(armarTelefono(telefonoSeparado.codigo, soloNumeros))
            }} />
          </div>
        </div>
        <div className="field">
          <label>Correo</label>
          <input type="email" value={email ?? ''} onChange={(e) => setEmail(e.target.value)} disabled={!!citaExistente} />
        </div>
        <div className="field">
          <label>Prestador</label>
          <select value={idPrestador} onChange={(e) => setIdPrestador(Number(e.target.value))} disabled={!!citaExistente}>
            {prestadores.map((p) => (
              <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Servicio</label>
          {citaExistente ? (
            <input value={citaExistente.servicios ? `${citaExistente.servicios.nombre_servicio} · ${citaExistente.servicios.duracion} min` : 'Sin servicio registrado'} disabled />
          ) : (
            <select value={idServicio} onChange={(e) => setIdServicio(Number(e.target.value))}>
              {servicios.map((s) => (
                <option key={s.id_servicio} value={s.id_servicio}>{s.nombre_servicio} · {s.duracion} min</option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label>Hora inicio</label>
          <input type="time" value={formatearHora(horaInicio)} onChange={(e) => setHoraInicio(e.target.value)} disabled={!!citaExistente} />
        </div>
        <div className="field">
          <label>Hora fin</label>
          <input value={horaFinCalculada} disabled />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {citaExistente ? (
          citaExistente.estado !== 'CANCELADA' && (
            <button className="btn btn--danger" onClick={handleCancelar} disabled={guardando}>Cancelar cita</button>
          )
        ) : (
          <button className="btn btn--primary" onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cita'}</button>
        )}
        <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
