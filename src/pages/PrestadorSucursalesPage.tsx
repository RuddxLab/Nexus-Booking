import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { PageHeader } from '../components/Common/PageHeader'
import {
  listSucursalesDePrestador,
  vincularPrestadorSucursal,
  desvincularPrestadorSucursal,
} from '../services/prestadorSucursalesService'
import type { Prestador, Sucursal } from '../types'

/**
 * Asigna cada prestador a una o varias sucursales de su empresa
 * (tabla puente prestador_sucursales). Reemplaza a la antigua
 * "Sucursal" única del prestador.
 */
export function PrestadorSucursalesPage() {
  const { empresaId, sucursalId, setEmpresaId, setSucursalId, esAdmin, esSupervisor, empresas, sucursalesDeEmpresa } = useFiltroEmpresa()

  const [prestadores,  setPrestadores]  = useState<Prestador[]>([])
  const [sucursales,   setSucursales]   = useState<Sucursal[]>([])
  const [inscritas,    setInscritas]    = useState<Set<number>>(new Set())

  const [prestadorSel, setPrestadorSel] = useState<number | ''>('')
  const [cargando,     setCargando]     = useState(true)
  const [cargandoVinc, setCargandoVinc] = useState(false)
  const [guardandoId,  setGuardandoId]  = useState<number | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  // Prestadores y sucursales de la empresa
  useEffect(() => {
    if (!empresaId) return
    setCargando(true)
    setPrestadorSel('')
    const qPrests = supabase.from('prestadores').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_prestador')
    const qSucs = supabase.from('sucursales').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_sucursal')

    Promise.all([qPrests, qSucs])
      .then(([{ data: prests }, { data: sucs }]) => {
        setPrestadores((prests ?? []) as Prestador[])
        setSucursales((sucs ?? []) as Sucursal[])
        if (prests && prests.length > 0) setPrestadorSel(prests[0].id_prestador)
      })
      .finally(() => setCargando(false))
  }, [empresaId])

  // Sucursales en las que está inscrito el prestador seleccionado
  useEffect(() => {
    if (!prestadorSel) { setInscritas(new Set()); return }
    setCargandoVinc(true)
    listSucursalesDePrestador(prestadorSel as number)
      .then(ids => setInscritas(new Set(ids)))
      .catch(e => setError(e.message ?? 'Error al cargar'))
      .finally(() => setCargandoVinc(false))
  }, [prestadorSel])

  async function toggleSucursal(idSucursal: number, marcar: boolean) {
    if (!prestadorSel || !empresaId) return
    // No permitir dejar al prestador sin ninguna sucursal
    if (!marcar && inscritas.size <= 1) {
      setError('El prestador debe pertenecer al menos a una sucursal.')
      return
    }
    setGuardandoId(idSucursal)
    setError(null)
    try {
      if (marcar) {
        await vincularPrestadorSucursal(prestadorSel as number, idSucursal, empresaId as number)
        setInscritas(prev => new Set([...prev, idSucursal]))
      } else {
        await desvincularPrestadorSucursal(prestadorSel as number, idSucursal)
        setInscritas(prev => { const n = new Set(prev); n.delete(idSucursal); return n })
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al actualizar')
    } finally {
      setGuardandoId(null)
    }
  }

  if (cargando) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>Cargando…</div>
  )

  return (
    <div className="main">
      <PageHeader titulo="Sucursales por Prestador" />
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

      {/* Selector de prestador */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-soft)', whiteSpace: 'nowrap' }}>
            Prestador:
          </label>
          <select
            value={prestadorSel}
            onChange={e => setPrestadorSel(Number(e.target.value))}
            style={{
              flex: 1, padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink)', fontSize: 14, fontWeight: 500,
            }}
          >
            {prestadores.map(p => (
              <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
            ))}
          </select>
        </div>

        {prestadorSel && (
          <span style={{
            fontSize: 12, color: 'var(--color-ink-soft)',
            background: 'var(--color-surface-2)',
            padding: '4px 10px', borderRadius: 20,
          }}>
            {inscritas.size} / {sucursales.length} sucursales
          </span>
        )}
      </div>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Lista de sucursales */}
      {prestadorSel && !cargandoVinc && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          {sucursales.map((su, i) => {
            const marcado   = inscritas.has(su.id_sucursal)
            const guardando = guardandoId === su.id_sucursal
            return (
              <label
                key={su.id_sucursal}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  cursor: guardando ? 'wait' : 'pointer',
                  opacity: guardando ? 0.5 : 1,
                  background: marcado ? 'var(--color-primary-soft)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={guardandoId !== null || cargandoVinc}
                  onChange={e => toggleSucursal(su.id_sucursal, e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, fontWeight: marcado ? 600 : 400, color: 'var(--color-ink)' }}>
                  {su.nombre_sucursal}
                </span>
                {marcado && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                    background: 'var(--color-primary-soft)', padding: '2px 7px', borderRadius: 8,
                  }}>✓</span>
                )}
              </label>
            )
          })}
          {sucursales.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>
              Esta empresa no tiene sucursales activas.
            </div>
          )}
        </div>
      )}

      {cargandoVinc && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>Actualizando…</div>
      )}
    </div>
  )
}
