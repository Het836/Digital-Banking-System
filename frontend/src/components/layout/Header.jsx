import { NavLink, useLocation } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronDown,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Landmark,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
} from 'lucide-react';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/transfer', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/payment', label: 'Payments', icon: CreditCard },
  { to: '/transactions', label: 'Activity', icon: Receipt },
];

export default function Header({ account, onClearAccount, sidebarVisible, onToggleSidebar }) {
  const location = useLocation();

  return (
    <>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="Digital Bank home">
          <span className="brand-mark"><Landmark size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">northstar<span>bank</span></span>
        </NavLink>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Transfers' && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><HelpCircle size={17} /></span>
            <div><strong>Need a hand?</strong><small>Explore this local demo</small></div>
          </div>
          <div className="sidebar-status"><span className="status-dot online" /> Local services workspace</div>
          <div className="sidebar-copyright">NORTHSTAR BANK <span>·</span> DEMO</div>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label={sidebarVisible ? 'Hide navigation sidebar' : 'Show navigation sidebar'}
            aria-expanded={sidebarVisible}
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="breadcrumb">
            <span>Workspace</span><span className="crumb-slash">/</span>
            <strong>{navigation.find((item) => item.to === location.pathname)?.label || 'Overview'}</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="environment-pill"><span className="status-dot online" /> LOCAL ENVIRONMENT</span>
          <div className="topbar-divider" />
          <NavLink to="/accounts" className="account-switcher">
            <span className="account-avatar">{account?.accountHolderName?.slice(0, 1)?.toUpperCase() || <ArrowDownLeft size={16} />}</span>
            <span className="account-switcher-copy">
              <strong>{account?.accountHolderName || 'Choose an account'}</strong>
              <small>{account?.accountNumber ? `•••• ${account.accountNumber.slice(-4)}` : 'Connect a demo account'}</small>
            </span>
            <ChevronDown size={15} className="account-chevron" />
          </NavLink>
          {account && (
            <button type="button" className="icon-button clear-account" onClick={onClearAccount} aria-label="Clear selected account" title="Clear selected account">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}>
            <Icon size={18} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
