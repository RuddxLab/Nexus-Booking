import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { signOut } from '../../services/authService'
import { useUserRole, PUEDE_GESTIONAR_CATALOGO } from '../../hooks/useUserRole'
import { supabase } from '../../services/supabaseClient'

// ── Colores ───────────────────────────────────────────────────────────────────
const COLORS: Record<string, { glow: string; grad: string; pill: string }> = {
  agenda:        { glow: '#6366f1', grad: 'linear-gradient(135deg,#a5b4fc,#6366f1)', pill: '#6366f1' },
  clientes:      { glow: '#10b981', grad: 'linear-gradient(135deg,#6ee7b7,#10b981)', pill: '#10b981' },
  staff:         { glow: '#f59e0b', grad: 'linear-gradient(135deg,#fcd34d,#f59e0b)', pill: '#f59e0b' },
  tipocats:      { glow: '#8b5cf6', grad: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', pill: '#8b5cf6' },
  categorias:    { glow: '#ec4899', grad: 'linear-gradient(135deg,#f9a8d4,#ec4899)', pill: '#ec4899' },
  catalogo:      { glow: '#06b6d4', grad: 'linear-gradient(135deg,#67e8f9,#06b6d4)', pill: '#06b6d4' },
  staffserv:     { glow: '#0ea5e9', grad: 'linear-gradient(135deg,#7dd3fc,#0ea5e9)', pill: '#0ea5e9' },
  horarios:      { glow: '#14b8a6', grad: 'linear-gradient(135deg,#5eead4,#14b8a6)', pill: '#14b8a6' },
  ausencias:     { glow: '#f43f5e', grad: 'linear-gradient(135deg,#fda4af,#f43f5e)', pill: '#f43f5e' },
  sucursales:    { glow: '#84cc16', grad: 'linear-gradient(135deg,#bef264,#84cc16)', pill: '#84cc16' },
  empresa:       { glow: '#a78bfa', grad: 'linear-gradient(135deg,#ddd6fe,#a78bfa)', pill: '#a78bfa' },
  usuarios:      { glow: '#fb923c', grad: 'linear-gradient(135deg,#fed7aa,#fb923c)', pill: '#fb923c' },
  tema:          { glow: '#e879f9', grad: 'linear-gradient(135deg,#f5d0fe,#e879f9)', pill: '#e879f9' },
  correo:        { glow: '#06b6d4', grad: 'linear-gradient(135deg,#67e8f9,#06b6d4)', pill: '#06b6d4' },
  reservas:      { glow: '#64748b', grad: 'linear-gradient(135deg,#cbd5e1,#64748b)', pill: '#64748b' },
  salir:         { glow: '#ef4444', grad: 'linear-gradient(135deg,#fca5a5,#ef4444)', pill: '#ef4444' },
}

// ── Iconos SVG ────────────────────────────────────────────────────────────────
const Ico = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d}/>
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2}/>}
  </svg>
)

const Icons: Record<string, React.ReactNode> = {
  agenda:     <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>,
  clientes:   <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>,
  staff:      <Ico d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>,
  tipocats:   <Ico d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>,
  categorias: <Ico d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>,
  catalogo:   <Ico d="M4 6h16M4 10h16M4 14h16M4 18h16"/>,
  staffserv:  <Ico d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>,
  horarios:   <Ico d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>,
  ausencias:  <Ico d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>,
  sucursales: <Ico d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>,
  empresa:    <Ico d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4z"/>,
  usuarios:   <Ico d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>,
  tema:       <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>,
  correo:     <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>,
  reservas:   <Ico d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>,
  salir:      <Ico d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>,
  chevron:    <Ico d="M19 9l-7 7-7-7"/>,
}

// ── Botón NavLink individual ──────────────────────────────────────────────────
function SidebarBtn({ to, label, colorKey, end = false, onClick }: {
  to: string; label: string; colorKey: string; end?: boolean; onClick?: () => void
}) {
  const c = COLORS[colorKey] ?? COLORS.agenda
  return (
    <NavLink
      to={to} end={end} onClick={onClick}
      className={({ isActive }) => 'sb-btn' + (isActive ? ' sb-btn--active' : '')}
      style={({ isActive }) => isActive ? ({ '--sb-glow': c.glow, '--sb-grad': c.grad, '--sb-pill': c.pill } as React.CSSProperties) : {}}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <>
              <span className="sb-ping sb-ping1"/>
              <span className="sb-ping sb-ping2"/>
              <span className="sb-glow"/>
            </>
          )}
          <span className="sb-icon">{Icons[colorKey] ?? Icons.agenda}</span>
          <span className="sb-pill">{label}</span>
        </>
      )}
    </NavLink>
  )
}

// ── Botón de acción (sin NavLink) ─────────────────────────────────────────────
function ActionBtn({ label, colorKey, icon, onClick }: {
  label: string; colorKey: string; icon: React.ReactNode; onClick?: () => void
}) {
  const c = COLORS[colorKey] ?? COLORS.salir
  return (
    <button
      className="sb-btn sb-action"
      onClick={onClick}
      style={{ '--sb-glow': c.glow, '--sb-grad': c.grad, '--sb-pill': c.pill } as React.CSSProperties}
    >
      <span className="sb-icon">{icon}</span>
      <span className="sb-pill">{label}</span>
    </button>
  )
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function SidebarSection({ titulo, icono, colorKey, children, rutas }: {
  titulo: string
  icono: React.ReactNode
  colorKey: string
  children: React.ReactNode
  rutas: string[]  // rutas que pertenecen a esta sección para auto-expandir
}) {
  const location = useLocation()
  const activa = rutas.some(r => location.pathname.startsWith(r))
  const [abierta, setAbierta] = useState(activa)

  // Abrir automáticamente si la ruta activa es de esta sección
  useEffect(() => {
    if (activa) setAbierta(true)
  }, [location.pathname]) // eslint-disable-line

  const c = COLORS[colorKey] ?? COLORS.agenda

  return (
    <div className="sb-section">
      <button
        className={'sb-section-hd' + (abierta ? ' sb-section-hd--open' : '') + (activa ? ' sb-section-hd--active' : '')}
        onClick={() => setAbierta(v => !v)}
        style={activa ? ({ '--sb-glow': c.glow } as React.CSSProperties) : {}}
      >
        <span className="sb-icon" style={{ width: 28, height: 28, borderRadius: 8 }}>{icono}</span>
        <span className="sb-pill" style={{ flex: 1 }}>{titulo}</span>
        <span className="sb-section-arrow" style={{
          transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
          transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'flex', opacity: .5,
        }}>
          {Icons.chevron}
        </span>
      </button>
      <div
        className="sb-section-bd"
        style={{
          maxHeight: abierta ? 600 : 0,
          overflow: 'hidden',
          transition: 'max-height .3s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ paddingLeft: 8, paddingTop: 2, paddingBottom: 4 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Botón de Reservas con desplegable ────────────────────────────────────────
interface EmpresaOpcion {
  slug: string
  nombre: string
  sucursales: { slug: string; nombre: string }[]
}

function ReservasBtn({ slugEmpresa, esAdmin }: { slugEmpresa: string | null; esAdmin: boolean }) {
  const [abierto, setAbierto]   = useState(false)
  const [opciones, setOpciones] = useState<EmpresaOpcion[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [abierto])

  // Cargar empresas y sucursales cuando se abre (solo admin ve todas)
  useEffect(() => {
    if (!abierto) return
    const cargar = async () => {
      const { data: empresas } = await supabase
        .from('empresas')
        .select('slug, nombre_empresa, id_empresa')
        .eq('activo', true)
        .order('nombre_empresa')

      if (!empresas) return

      const resultado: EmpresaOpcion[] = []
      for (const emp of empresas) {
        const { data: subs } = await supabase
          .from('sucursales')
          .select('slug, nombre_sucursal')
          .eq('id_empresa', emp.id_empresa)
          .eq('activo', true)
          .order('id_sucursal')

        resultado.push({
          slug: emp.slug,
          nombre: emp.nombre_empresa,
          sucursales: (subs ?? []).map(s => ({ slug: s.slug ?? emp.slug, nombre: s.nombre_sucursal })),
        })
      }
      setOpciones(resultado)
    }
    cargar()
  }, [abierto])

  // Si no es admin, abrir directo sin desplegable
  const handleClick = () => {
    if (!esAdmin) {
      if (slugEmpresa) window.open(`/r/${slugEmpresa}`, '_blank')
      return
    }
    setAbierto(v => !v)
  }

  const c = COLORS.reservas
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        className="sb-btn sb-action"
        onClick={handleClick}
        style={{ '--sb-glow': c.glow, '--sb-grad': c.grad, '--sb-pill': c.pill } as React.CSSProperties}
      >
        <span className="sb-icon">{Icons.reservas}</span>
        <span className="sb-pill">Reservas</span>
        {esAdmin && <span style={{ fontSize: 9, opacity: .5, marginLeft: 'auto' }}>▾</span>}
      </button>

      {abierto && esAdmin && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, boxShadow: 'var(--shadow-elevated)',
          minWidth: 200, zIndex: 100, overflow: 'hidden',
        }}>
          {opciones.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-ink-soft)' }}>Cargando…</div>
          )}
          {opciones.map(emp => (
            <div key={emp.slug}>
              {/* Si tiene 1 sucursal, mostrar directo. Si tiene varias, mostrar empresa + sucursales */}
              {emp.sucursales.length === 1 ? (
                <button
                  onClick={() => { window.open(`/r/${emp.sucursales[0].slug}`, '_blank'); setAbierto(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', background: 'none', border: 'none',
                    fontSize: 13, color: 'var(--color-ink)', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {emp.nombre}
                </button>
              ) : (
                <>
                  <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)' }}>
                    {emp.nombre}
                  </div>
                  {emp.sucursales.map(suc => (
                    <button
                      key={suc.slug}
                      onClick={() => { window.open(`/r/${suc.slug}`, '_blank'); setAbierto(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 14px 7px 22px', background: 'none', border: 'none',
                        fontSize: 13, color: 'var(--color-ink)', cursor: 'pointer',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      → {suc.nombre}
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
interface Props { abierto?: boolean; onNavegar?: () => void }

export function Sidebar({ abierto = false, onNavegar }: Props) {
  const { rol, slugEmpresa, loading } = useUserRole()

  const puedeVerCatalogo = !loading && rol && PUEDE_GESTIONAR_CATALOGO.includes(rol)
  const esAdmin      = !loading && rol === 'admin'
  const esSupervisor = !loading && rol === 'supervisor'
  const linkReservas = slugEmpresa ? `/r/${slugEmpresa}` : '/'

  return (
    <aside className={'sidebar' + (abierto ? ' sidebar--abierto' : '')}>
      <div className="sb-brand">NX</div>

      <div className="sb-links">
        {/* Agenda siempre visible */}
        <SidebarBtn to="/admin" label="Agenda" colorKey="agenda" end onClick={onNavegar}/>

        {/* Sección Clientes */}
        {puedeVerCatalogo && (
          <SidebarSection
            titulo="Clientes"
            icono={Icons.clientes}
            colorKey="clientes"
            rutas={['/admin/clientes']}
          >
            <SidebarBtn to="/admin/clientes" label="Clientes" colorKey="clientes" onClick={onNavegar}/>
          </SidebarSection>
        )}

        {/* Sección Catálogo */}
        {puedeVerCatalogo && (
          <SidebarSection
            titulo="Catálogo"
            icono={Icons.catalogo}
            colorKey="catalogo"
            rutas={['/admin/tipo-categorias', '/admin/categorias', '/admin/servicios', '/admin/prestador-servicios']}
          >
            <SidebarBtn to="/admin/tipo-categorias"     label="Tipo categ."    colorKey="tipocats"   onClick={onNavegar}/>
            <SidebarBtn to="/admin/categorias"          label="Categorías"     colorKey="categorias" onClick={onNavegar}/>
            <SidebarBtn to="/admin/servicios"           label="Servicios"      colorKey="catalogo"   onClick={onNavegar}/>
            <SidebarBtn to="/admin/prestador-servicios" label="Prest. & Serv." colorKey="staffserv"  onClick={onNavegar}/>
          </SidebarSection>
        )}

        {/* Sección Prestadores */}
        {puedeVerCatalogo && (
          <SidebarSection
            titulo="Prestadores"
            icono={Icons.staff}
            colorKey="staff"
            rutas={['/admin/prestadores', '/admin/horarios', '/admin/ausencias']}
          >
            <SidebarBtn to="/admin/prestadores" label="Prestadores" colorKey="staff"     onClick={onNavegar}/>
            <SidebarBtn to="/admin/horarios"    label="Horarios"    colorKey="horarios"  onClick={onNavegar}/>
            <SidebarBtn to="/admin/ausencias"   label="Ausencias"   colorKey="ausencias" onClick={onNavegar}/>
          </SidebarSection>
        )}

        {/* Sección Admin */}
        {esAdmin && (
          <SidebarSection
            titulo="Administración"
            icono={Icons.empresa}
            colorKey="empresa"
            rutas={['/admin/sucursales', '/admin/empresas', '/admin/usuarios', '/admin/tema', '/admin/correo']}
          >
            <SidebarBtn to="/admin/sucursales" label="Sucursales"   colorKey="sucursales" onClick={onNavegar}/>
            <SidebarBtn to="/admin/empresas"   label="Empresa"      colorKey="empresa"    onClick={onNavegar}/>
            <SidebarBtn to="/admin/usuarios"   label="Usuarios"     colorKey="usuarios"   onClick={onNavegar}/>
            <SidebarBtn to="/admin/tema"       label="Tema visual"  colorKey="tema"       onClick={onNavegar}/>
            <SidebarBtn to="/admin/correo"     label="Correo"       colorKey="correo"     onClick={onNavegar}/>
          </SidebarSection>
        )}

        {/* Supervisor solo ve usuarios */}
        {esSupervisor && (
          <SidebarBtn to="/admin/usuarios" label="Usuarios" colorKey="usuarios" onClick={onNavegar}/>
        )}
      </div>

      <div className="sb-spacer"/>

      <div className="sb-links">
        <ReservasBtn slugEmpresa={linkReservas.replace('/r/', '')} esAdmin={esAdmin} />
        <ActionBtn label="Salir" colorKey="salir" icon={Icons.salir} onClick={() => signOut()}/>
      </div>
    </aside>
  )
}
