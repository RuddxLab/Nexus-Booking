import { NavLink } from 'react-router-dom'
import { signOut } from '../../services/authService'
import { useUserRole, PUEDE_GESTIONAR_CATALOGO } from '../../hooks/useUserRole'
import { useTheme } from '../../hooks/useTheme'

const LINK_CALENDARIO = { to: '/admin', label: 'Agenda', icono: '📅' }

// Links de catálogo — visibles para admin y supervisor
const LINKS_CATALOGO = [
  { to: '/admin/clientes',            label: 'Clientes',            icono: '👥' },
  { to: '/admin/prestadores',         label: 'Staff',               icono: '✂️' },
  { to: '/admin/tipo-categorias',     label: 'Tipo Categorías',     icono: '📁' },
  { to: '/admin/categorias',          label: 'Categorías',          icono: '🏷️' },
  { to: '/admin/servicios',           label: 'Catálogo',            icono: '🗂️' },
  { to: '/admin/prestador-servicios', label: 'Servicios por Staff', icono: '🔗' },
  { to: '/admin/horarios',            label: 'Horarios',            icono: '🕒' },
  { to: '/admin/ausencias',           label: 'Ausencias',           icono: '🚫' },
  { to: '/admin/sucursales',          label: 'Sucursales',          icono: '🏢' },
]

// Solo admin puede gestionar empresas y usuarios
const LINK_EMPRESAS  = { to: '/admin/empresas', label: 'Empresa',  icono: '🏛️' }
const LINK_USUARIOS  = { to: '/admin/usuarios', label: 'Usuarios', icono: '👤' }
const LINK_TEMA      = { to: '/admin/tema',     label: 'Tema visual', icono: '🎨' }

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

  const links = [
    LINK_CALENDARIO,
    ...(puedeVerCatalogo ? LINKS_CATALOGO : []),
    ...(esAdmin      ? [LINK_EMPRESAS, LINK_USUARIOS, LINK_TEMA] : []),
    ...(esSupervisor ? [LINK_USUARIOS] : []),
  ]

  const linkReservas = slugEmpresa ? `/r/${slugEmpresa}` : '/'

  return (
    <aside className={'sidebar' + (abierto ? ' sidebar--abierto' : '')}>
      <div className="sidebar__brand">NX</div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/admin'}
          onClick={onNavegar}
          className={({ isActive }) =>
            'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
          }
        >
          <span className="sidebar__link-icon">{link.icono}</span>
          <span>{link.label}</span>
        </NavLink>
      ))}
      <div style={{ flex: 1 }} />
      <a href={linkReservas} target="_blank" rel="noreferrer" className="sidebar__link">
        <span className="sidebar__link-icon">🔗</span>
        <span>Reservas</span>
      </a>
      <button className="sidebar__link" style={{ background: 'none', border: 'none' }} onClick={alternarTema}>
        <span className="sidebar__link-icon">{tema === 'oscuro' ? '☀️' : '🌙'}</span>
        <span>{tema === 'oscuro' ? 'Claro' : 'Oscuro'}</span>
      </button>
      <button className="sidebar__link" style={{ background: 'none', border: 'none' }} onClick={() => signOut()}>
        <span className="sidebar__link-icon">⏻</span>
        <span>Salir</span>
      </button>
    </aside>
  )
}
