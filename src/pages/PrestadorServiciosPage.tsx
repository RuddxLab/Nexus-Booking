import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { PageHeader } from '../components/Common/PageHeader'
import {
  vincularPrestadorServicio,
  desvincularPrestadorServicio,
} from '../services/prestadorServiciosAdminService'
import type { Prestador, Servicio, Categoria } from '../types'

export function PrestadorServiciosPage() {
  const { empresaId, sucursalId, setEmpresaId, setSucursalId, esAdmin, esSupervisor, empresas, sucursalesDeEmpresa } = useFiltroEmpresa()

  const [prestadores,  setPrestadores]  = useState<Prestador[]>([])
  const [servicios,    setServicios]    = useState<Servicio[]>([])
  const [categorias,   setCategorias]   = useState<Categoria[]>([])
  const [vinculados,   setVinculados]   = useState<Set<number>>(new Set())

  const [prestadorSel, setPrestadorSel] = useState<number | ''>('')
  const [cargando,     setCargando]     = useState(true)
  const [cargandoVinc, setCargandoVinc] = useState(false)
  const [guardandoId,  setGuardandoId]  = useState<number | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [busqueda,     setBusqueda]     = useState('')

  // Cargar prestadores, servicios y categorías filtrados por empresa y sucursal
  useEffect(() => {
    if (!empresaId) return
    setCargando(true)
    setPrestadorSel('')
    const qPrests = supabase.from('prestadores').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_prestador')
    const qServs = supabase.from('servicios').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_servicio')
    const qCats = supabase.from('categorias').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_categoria')

    // Aplicar filtro de sucursal si está seleccionada
    const queries = sucursalId
      ? [
          qPrests.eq('id_sucursal', sucursalId),
          qServs.eq('id_sucursal', sucursalId),
          qCats.eq('id_sucursal', sucursalId),
        ]
      : [qPrests, qServs, qCats]

    Promise.resolve(Promise.all(queries))
      .then(([{ data: prests }, { data: servs }, { data: cats }]) => {
        setPrestadores((prests ?? []) as Prestador[])
        setServicios((servs ?? []) as Servicio[])
        setCategorias((cats ?? []) as Categoria[])
        if (prests && prests.length > 0) setPrestadorSel(prests[0].id_prestador)
      }).finally(() => setCargando(false))
  }, [empresaId, sucursalId])

  // Cargar servicios vinculados al prestador seleccionado
  useEffect(() => {
    if (!prestadorSel) return
    setCargandoVinc(true)
    Promise.resolve(
      supabase.from('prestador_servicios')
        .select('id_servicio')
        .eq('id_prestador', prestadorSel)
    ).then(({ data }) => {
      setVinculados(new Set((data ?? []).map((r: any) => r.id_servicio)))
    }).finally(() => setCargandoVinc(false))
  }, [prestadorSel])

  // Agrupar servicios por categoría, con filtro de búsqueda
  const serviciosPorCategoria = useMemo(() => {
    const txt = busqueda.trim().toLowerCase()
    const filtrados = txt
      ? servicios.filter(s => s.nombre_servicio.toLowerCase().includes(txt))
      : servicios
    const mapa = new Map<number, Servicio[]>()
    for (const s of filtrados) {
      const lista = mapa.get(s.id_categoria) ?? []
      lista.push(s)
      mapa.set(s.id_categoria, lista)
    }
    return mapa
  }, [servicios, busqueda])

  const totalVinculados = vinculados.size
  const totalServicios  = servicios.length

  async function toggleServicio(idServicio: number, marcar: boolean) {
    if (!prestadorSel || !empresaId || !sucursalId) return
    setGuardandoId(idServicio)
    setError(null)
    try {
      if (marcar) {
        await vincularPrestadorServicio(prestadorSel as number, idServicio, {
          idEmpresa: empresaId as number,
          idSucursal: sucursalId as number,
        })
        setVinculados(prev => new Set([...prev, idServicio]))
      } else {
        await desvincularPrestadorServicio(prestadorSel as number, idServicio)
        setVinculados(prev => { const n = new Set(prev); n.delete(idServicio); return n })
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al actualizar')
    } finally {
      setGuardandoId(null)
    }
  }

  async function marcarTodos(marcar: boolean) {
    if (!prestadorSel || !empresaId || !sucursalId) return
    setCargandoVinc(true)
    setError(null)
    try {
      if (marcar) {
        // Insertar solo los que no están vinculados
        const faltantes = servicios
          .filter(s => !vinculados.has(s.id_servicio))
          .map(s => ({
            id_prestador: prestadorSel as number,
            id_servicio:  s.id_servicio,
            id_empresa:   empresaId,
            id_sucursal:  sucursalId,
          }))
        if (faltantes.length > 0) {
          const { error } = await supabase.from('prestador_servicios').insert(faltantes as any)
          if (error) throw error
        }
        setVinculados(new Set(servicios.map(s => s.id_servicio)))
      } else {
        const { error } = await supabase.from('prestador_servicios')
          .delete()
          .eq('id_prestador', prestadorSel as number)
          .eq('id_empresa', empresaId)
        if (error) throw error
        setVinculados(new Set())
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al actualizar')
    } finally {
      setCargandoVinc(false)
    }
  }

  const prestadorActual = prestadores.find(p => p.id_prestador === prestadorSel)

  if (cargando) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>Cargando…</div>
  )

  return (
    <div>
      <PageHeader titulo="Servicios por Prestador" />
      <SelectorFiltro
        esAdmin={esAdmin}
        esSupervisor={esSupervisor}
        empresas={empresas}
        sucursalesDeEmpresa={sucursalesDeEmpresa}
        empresaId={empresaId}
        sucursalId={sucursalId}
        onEmpresaChange={setEmpresaId}
        onSucursalChange={setSucursalId}
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
              color: 'var(--color-ink)', fontSize: 14,
              fontWeight: 500,
            }}
          >
            {prestadores.map(p => (
              <option key={p.id_prestador} value={p.id_prestador}>
                {p.nombre_prestador}
              </option>
            ))}
          </select>
        </div>

        {prestadorSel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 12, color: 'var(--color-ink-soft)',
              background: 'var(--color-surface-2)',
              padding: '4px 10px', borderRadius: 20,
            }}>
              {totalVinculados} / {totalServicios} servicios asignados
            </span>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 12, padding: '5px 12px' }}
              disabled={cargandoVinc}
              onClick={() => marcarTodos(true)}
            >
              Marcar todos
            </button>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 12, padding: '5px 12px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              disabled={cargandoVinc}
              onClick={() => marcarTodos(false)}
            >
              Quitar todos
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* Búsqueda */}
      {prestadorSel && (
        <div style={{ marginBottom: 16, position: 'relative', maxWidth: 360 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-ink-soft)', fontSize: 16, pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar servicio…"
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink)', fontSize: 13,
            }}
          />
        </div>
      )}

      {/* Lista de servicios agrupada por categoría */}
      {prestadorSel && !cargandoVinc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categorias.map(cat => {
            const lista = serviciosPorCategoria.get(cat.id_categoria)
            if (!lista?.length) return null

            const todosVinculados = lista.every(s => vinculados.has(s.id_servicio))
            const algunoVinculado = lista.some(s => vinculados.has(s.id_servicio))

            return (
              <div key={cat.id_categoria} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                {/* Header de categoría */}
                <div style={{
                  padding: '10px 16px',
                  background: 'var(--color-surface-2)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Checkbox de categoría completa */}
                    <input
                      type="checkbox"
                      checked={todosVinculados}
                      ref={el => { if (el) el.indeterminate = algunoVinculado && !todosVinculados }}
                      disabled={guardandoId !== null || cargandoVinc}
                      onChange={async (e) => {
                        setCargandoVinc(true)
                        try {
                          for (const s of lista) {
                            if (e.target.checked && !vinculados.has(s.id_servicio)) {
                              await toggleServicio(s.id_servicio, true)
                            } else if (!e.target.checked && vinculados.has(s.id_servicio)) {
                              await toggleServicio(s.id_servicio, false)
                            }
                          }
                        } finally { setCargandoVinc(false) }
                      }}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{cat.nombre_categoria}</span>
                    <span style={{
                      fontSize: 11, color: 'var(--color-ink-soft)',
                      background: 'var(--color-surface-3)',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      {lista.filter(s => vinculados.has(s.id_servicio)).length}/{lista.length}
                    </span>
                  </div>
                </div>

                {/* Servicios de la categoría */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 0,
                }}>
                  {lista.map((s, i) => {
                    const marcado   = vinculados.has(s.id_servicio)
                    const guardando = guardandoId === s.id_servicio

                    return (
                      <label
                        key={s.id_servicio}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px',
                          borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                          cursor: guardando ? 'wait' : 'pointer',
                          opacity: guardando ? 0.5 : 1,
                          transition: 'background 0.15s',
                          background: marcado ? 'var(--color-primary-soft)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (!marcado) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = marcado ? 'var(--color-primary-soft)' : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={guardandoId !== null || cargandoVinc}
                          onChange={e => toggleServicio(s.id_servicio, e.target.checked)}
                          style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: marcado ? 600 : 400, color: 'var(--color-ink)' }}>
                            {s.nombre_servicio}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 1 }}>
                            {s.duracion} min · ${Number(s.valor).toLocaleString('es-CL')}
                          </div>
                        </div>
                        {marcado && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                            background: 'var(--color-primary-soft)',
                            padding: '2px 7px', borderRadius: 8, flexShrink: 0,
                          }}>✓</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {serviciosPorCategoria.size === 0 && (
            <div style={{
              padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}>
              No se encontraron servicios{busqueda ? ` para "${busqueda}"` : ''}.
            </div>
          )}
        </div>
      )}

      {cargandoVinc && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-soft)' }}>
          Actualizando…
        </div>
      )}
    </div>
  )
}
