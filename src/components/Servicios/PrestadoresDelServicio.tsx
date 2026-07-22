import { useEffect, useState } from 'react'
import { prestadoresService } from '../../services/entityServices'
import { listPrestadorIdsDeServicio } from '../../services/disponibilidadService'
import { vincularPrestadorServicio, desvincularPrestadorServicio } from '../../services/prestadorServiciosAdminService'
import type { Prestador, Servicio } from '../../types'

/** Fila expandible: qué prestadores ofrecen este servicio, con checkboxes para vincular/desvincular. */
export function PrestadoresDelServicio({ servicio }: { servicio: Servicio }) {
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [vinculados, setVinculados] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      prestadoresService.listAll('nombre_prestador', servicio.id_empresa),
      listPrestadorIdsDeServicio(servicio.id_servicio, servicio.id_empresa)
    ])
      .then(([todos, ids]) => {
        setPrestadores(todos)
        setVinculados(new Set(ids))
      })
      .finally(() => setCargando(false))
  }, [servicio.id_servicio])

  async function toggle(prestador: Prestador, marcado: boolean) {
    setGuardandoId(prestador.id_prestador)
    try {
      if (marcado) {
        await vincularPrestadorServicio(prestador.id_prestador, servicio.id_servicio, {
          idEmpresa: servicio.id_empresa,
          idSucursal: servicio.id_sucursal
        })
      } else {
        await desvincularPrestadorServicio(prestador.id_prestador, servicio.id_servicio)
      }
      setVinculados((prev) => {
        const nuevo = new Set(prev)
        if (marcado) nuevo.add(prestador.id_prestador)
        else nuevo.delete(prestador.id_prestador)
        return nuevo
      })
    } finally {
      setGuardandoId(null)
    }
  }

  if (cargando) return <p style={{ color: 'var(--color-ink-soft)', padding: '8px 4px' }}>Cargando…</p>

  return (
    <div style={{ padding: '8px 4px' }}>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-soft)', marginBottom: 8 }}>
        Prestadores que ofrecen "{servicio.nombre_servicio}"
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
        {prestadores.map((p) => (
          <label key={p.id_prestador} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, opacity: guardandoId === p.id_prestador ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={vinculados.has(p.id_prestador)}
              disabled={guardandoId !== null}
              onChange={(e) => toggle(p, e.target.checked)}
            />
            {p.nombre_prestador}
          </label>
        ))}
        {prestadores.length === 0 && <span style={{ color: 'var(--color-ink-soft)', fontSize: 13 }}>No hay prestadores creados.</span>}
      </div>
    </div>
  )
}
