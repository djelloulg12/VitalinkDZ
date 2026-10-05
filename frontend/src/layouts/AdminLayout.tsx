import { NavLink, Navigate, NavLinkProps, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth'
import { Avatar } from '../ui'
import { ChangePasswordModal } from '../notifications'

const NAV: { to: string; icon: string; label: string }[] = [
  { to: '/admin', icon: '📊', label: 'نظرة عامة' },
  { to: '/admin/healthops', icon: '🛰️', label: 'العمليات الصحية (2α)' },
  { to: '/admin/wilayas', icon: '🗺️', label: 'الولايات (Wilayas DZ)' },
  { to: '/admin/staff', icon: '🩺', label: 'الكوادر والتراخيص' },
  { to: '/admin/referrals', icon: '🔄', label: 'الإحالة الإلكتروني' },
  { to: '/admin/followups', icon: '📁', label: 'ملفات المتابعة (Offline)' },
  { to: '/admin/associations', icon: '🏅', label: 'نقاط الجمعيات' },
  { to: '/admin/shifts', icon: '🗓️', label: 'نوبات العمل' },
  { to: '/admin/agencies', icon: '🧭', label: 'وكالات السياحة' },
  { to: '/admin/thermal', icon: '♨️', label: 'السياحة العلاجية' },
  { to: '/admin/zones', icon: '📍', label: 'الأسوار الجغرافية' },
  { to: '/admin/about', icon: '🎓', label: 'من نحن والسيرة' },
  { to: '/admin/gps', icon: '🛰️', label: 'GPS الميداني' },
  { to: '/admin/audit', icon: '📜', label: 'سجل العمليات (Audit)' },
]

const PLANNED: { icon: string; label: string }[] = []

function NavItem({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      {children}
    </NavLink>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const [changeOpen, setChangeOpen] = useState(false)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to={`/portal/${user.role}`} replace />

  return (
    <div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" onClick={() => (window.location.href = '/')}>
            <div className="brand-logo">❤️</div>
            <div className="brand-text">
              <b>VITALINK <span>DZ</span></b>
              <small>نبض الرعاية المتصل</small>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <span className="conn-pill conn-on">🛡️ متصل — الشبكة الوطنية</span>
          <div className="user-chip">
            <Avatar name={user.name} cls={user.avatar} />
            <div className="meta">
              <b>{user.name}</b>
              <small>{user.facility || 'لوحة المدير الوطني'}</small>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setChangeOpen(true)} title="تغيير كلمة المرور">🔑</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>خروج</button>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <div className="side-label">الإدارة الوطنية</div>
          {NAV.map((n) => (
            <NavItem key={n.to} to={n.to} end={n.to === '/admin'}>
              <span className="n-ico">{n.icon}</span>
              {n.label}
            </NavItem>
          ))}
          {PLANNED.length > 0 && (
            <>
              <div className="side-label">قريباً (المرحلة التالية)</div>
              {PLANNED.map((n) => (
                <div key={n.label} className="nav-item disabled">
                  <span className="n-ico">{n.icon}</span>
                  {n.label}
                </div>
              ))}
            </>
          )}
          <div className="side-card-promo">
            <b>Wilayas DZ — 58 ولاية</b>
            <p>قاعدة الولايات الوطنية مع ربط كل وحدة وطبيب وموقع.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-white" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>رسمي</span>
              <span className="badge badge-white" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>OFFLINE جاهز</span>
            </div>
          </div>
        </aside>
        <main className="main view-wrap">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV.slice(0, 6).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}
            >
              <span className="bn-ico">{n.icon}</span>
              {n.label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>

      {changeOpen && (
        <ChangePasswordModal onCancel={() => setChangeOpen(false)} onDone={() => setChangeOpen(false)} />
      )}
    </div>
  )
}