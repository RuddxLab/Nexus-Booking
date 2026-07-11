import { NavLink } from 'react-router-dom'
import { signOut } from '../../services/authService'
import { useUserRole, PUEDE_GESTIONAR_CATALOGO } from '../../hooks/useUserRole'
import { useTheme } from '../../hooks/useTheme'

// ── Iconos SVG ────────────────────────────────────────────────────────────────

const IconAgenda = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
  </svg>
)
const IconClientes = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)
const IconStaff = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
  </svg>
)
const IconCatalogo = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
  </svg>
)
const IconStaffServ = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
  </svg>
)
const IconCategorias = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
  </svg>
)
const IconTipoCat = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
  </svg>
)
const IconHorarios = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IconAusencias = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
  </svg>
)
const IconSucursales = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
  </svg>
)
const IconEmpresa = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4z"/>
  </svg>
)
const IconUsuarios = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IconTema = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
  </svg>
)
const IconReservas = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
  </svg>
)
const IconTema2 = ({ oscuro }: { oscuro: boolean }) => oscuro ? (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
  </svg>
) : (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
  </svg>
)
const IconSalir = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface LinkDef {
  to: string
  label: string
  Icon: React.ComponentType
}

// ── Botón individual ──────────────────────────────────────────────────────────

function SidebarBtn({
  to, label, Icon, end = false, onClick
}: LinkDef & { end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => 'sb-btn' + (isActive ? ' sb-btn--active' : '')}
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
          <span className="sb-icon">
            <Icon />
          </span>
          <span className="sb-pill">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function ActionBtn({
  label, Icon, onClick
}: { label: string; Icon: React.ComponentType; onClick?: () => void }) {
  return (
    <button className="sb-btn" onClick={onClick}>
      <span className="sb-icon"><Icon /></span>
      <span className="sb-pill">{label}</span>
    </button>
  )
}

// ── Sidebar principal ─────────────────────────────────────────────────────────

interface Props {
  abierto?: boolean
  onNavegar?: () => void
}

export function Sidebar({ abierto = false, onNavegar }: Props) {
  const { rol, slugEmpresa, loading } = useUserRole()
  const { tema, alternarTema } = useTheme()

  const puedeVerCatalogo = !loading && rol && PUEDE_GESTIONAR_CATALOGO.includes(rol)
  const esAdmin      = !loading && rol === 'admin'
  const esSupervisor = !loading && rol === 'supervisor'

  const linkReservas = slugEmpresa ? `/r/${slugEmpresa}` : '/'

  const linksMain: LinkDef[] = [
    { to: '/admin',                    label: 'Agenda',           Icon: IconAgenda },
    ...(puedeVerCatalogo ? [
      { to: '/admin/clientes',            label: 'Clientes',         Icon: IconClientes },
      { to: '/admin/prestadores',         label: 'Staff',            Icon: IconStaff },
      { to: '/admin/tipo-categorias',     label: 'Tipo Categorías',  Icon: IconTipoCat },
      { to: '/admin/categorias',          label: 'Categorías',       Icon: IconCategorias },
      { to: '/admin/servicios',           label: 'Catálogo',         Icon: IconCatalogo },
      { to: '/admin/prestador-servicios', label: 'Staff & Servicios',Icon: IconStaffServ },
      { to: '/admin/horarios',            label: 'Horarios',         Icon: IconHorarios },
      { to: '/admin/ausencias',           label: 'Ausencias',        Icon: IconAusencias },
      { to: '/admin/sucursales',          label: 'Sucursales',       Icon: IconSucursales },
    ] as LinkDef[] : []),
    ...(esAdmin ? [
      { to: '/admin/empresas', label: 'Empresa',     Icon: IconEmpresa },
      { to: '/admin/usuarios', label: 'Usuarios',    Icon: IconUsuarios },
      { to: '/admin/tema',     label: 'Tema visual', Icon: IconTema },
    ] as LinkDef[] : []),
    ...(esSupervisor ? [
      { to: '/admin/usuarios', label: 'Usuarios', Icon: IconUsuarios },
    ] as LinkDef[] : []),
  ]

  return (
    <aside className={'sidebar' + (abierto ? ' sidebar--abierto' : '')}>
      {/* Brand */}
      <div className="sb-brand">NX</div>

      {/* Links principales */}
      <div className="sb-links">
        {linksMain.map(l => (
          <SidebarBtn
            key={l.to} to={l.to} label={l.label} Icon={l.Icon}
            end={l.to === '/admin'} onClick={onNavegar}
          />
        ))}
      </div>

      <div className="sb-spacer"/>

      {/* Acciones inferiores */}
      <div className="sb-links">
        <ActionBtn label="Reservas" Icon={IconReservas}
          onClick={() => window.open(linkReservas, '_blank')} />
        <ActionBtn
          label={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
          Icon={() => <IconTema2 oscuro={tema === 'oscuro'} />}
          onClick={alternarTema}
        />
        <ActionBtn label="Salir" Icon={IconSalir} onClick={() => signOut()} />
      </div>
    </aside>
  )
}
