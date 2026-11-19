
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Banknote,
  Building2,
  HandCoins,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react'

const dailyNavigation = [
  {
    to: '/cash-collections',
    label: 'Collection',
    fullLabel: 'Cash Collection',
    icon: Banknote,
  },
  {
    to: '/cash-handovers',
    label: 'Handover',
    fullLabel: 'Cash Handover',
    icon: HandCoins,
  },
]

const otherNavigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/company-payments', label: 'Company Payments', icon: Building2 },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
]

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CC</div>
          <div>
            <strong>Collection</strong>
            <span>Management</span>
          </div>
        </div>

        <div className="sidebar-section-title">DAILY TRANSACTIONS</div>

        <nav className="navigation">
          {dailyNavigation.map(({ to, fullLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'nav-link active daily-nav-link' : 'nav-link daily-nav-link'
              }
            >
              <Icon size={20} />
              <span>{fullLabel}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section-title other-pages-title">OTHER PAGES</div>

        <nav className="navigation">
          {otherNavigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">Offline-first personal app</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-brand">
            <strong>Customer Collection</strong>
            <span className="offline-indicator">
              <i /> Offline ready
            </span>
          </div>

          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </header>

        {/* Other pages menu */}
        {menuOpen && (
          <>
            <button
              type="button"
              className="menu-backdrop"
              onClick={closeMenu}
              aria-label="Close menu"
            />

            <div className="app-menu">
              <div className="app-menu-heading">
                <strong>Other Pages</strong>
                <button type="button" onClick={closeMenu} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>

              {otherNavigation.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    isActive ? 'menu-link active' : 'menu-link'
                  }
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </>
        )}

        <div className="page-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile daily navigation */}
      <nav className="mobile-bottom-nav">
        {dailyNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'bottom-nav-item active' : 'bottom-nav-item'
            }
          >
            <Icon size={23} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
