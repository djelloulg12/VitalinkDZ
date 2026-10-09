import React, { useEffect } from 'react'

export function toast(msg: string, type: 'success' | 'error' | 'warning' | '' = '') {
  const box = document.getElementById('toasts')
  if (!box) return
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  const icon = type === 'error' ? '✕' : type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ⓘ'
  el.innerHTML = `<span>${icon}</span><span></span>`
  el.querySelector('span:last-child')!.textContent = msg
  box.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity .3s'
    setTimeout(() => el.remove(), 320)
  }, 4200)
}

export function Avatar({ name, cls, size }: { name?: string; cls?: string; size?: number }) {
  const ch = (name || '؟').trim().charAt(0) || '؟'
  const c = cls || 'avatar-1'
  const style: React.CSSProperties = {}
  if (size) {
    style.width = size
    style.height = size
    style.fontSize = Math.round(size * 0.42)
  }
  return <div className={`avatar ${c}`} style={style}>{ch}</div>
}

export function Stat({ icon, num, label, bg }: { icon: string; num: string | number; label: string; bg: string }) {
  return (
    <div className="card stat-card">
      <div className={`s-ico ${bg}`}>{icon}</div>
      <div>
        <div className="s-num">{num}</div>
        <div className="s-lab">{label}</div>
      </div>
    </div>
  )
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  const full = Math.round(value)
  const out: React.ReactNode[] = []
  for (let i = 1; i <= max; i++) out.push(<span key={i} className={i <= full ? '' : 'muted'} style={i <= full ? {} : { color: '#E5E3F0' }}>★</span>)
  return <span className="stars">{out}</span>
}

export function Modal({
  title,
  icon,
  onClose,
  children,
  foot,
  size,
  closable = true,
}: {
  title: string
  icon?: string
  onClose: () => void
  children: React.ReactNode
  foot?: React.ReactNode
  size?: string
  closable?: boolean
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const orig = document.body.style.overflow
    const prevFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    if (closable) closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = orig
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus()
    }
  }, [closable])
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && closable) onClose()
      }}
    >
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="brand-logo" style={{ width: 38, height: 38, fontSize: 17, borderRadius: 12 }}>
            {icon || '📋'}
          </span>
          <h3>{title}</h3>
          {closable && <button className="icon-btn" ref={closeRef} aria-label="إغلاق" onClick={onClose}>✕</button>}
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function PageHead({
  icon,
  title,
  sub,
  actions,
}: {
  icon?: string
  title: string
  sub?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="page-hero mb-16">
      <div className="flex items-center gap-12" style={{ flexWrap: 'wrap' }}>
        <span className="brand-logo" style={{ width: 54, height: 54, fontSize: 26, borderRadius: 15 }}>{icon || '❤️'}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions && <div className="hero-actions">{actions}</div>}
      </div>
    </header>
  )
}

export function EmptyState({ icon, text }: { icon?: string; text?: string }) {
  return (
    <div className="empty-state">
      <div className="big">{icon || '🗂️'}</div>
      <p>{text || 'لا بيانات مسجلة بعد.'}</p>
    </div>
  )
}

/** دخول متتابع عند ظهور العنصر في الشاشة — يمنح الواجهات إحساساً حياً. */
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [shown, setShown] = React.useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    // حماية: لا يبقى أي محتوى محجوباً إن لم يعمل المراقب (أو خارج الشاشة في لقطة/طباعة).
    const safety = window.setTimeout(() => setShown(true), 2200)
    if (!('IntersectionObserver' in window)) {
      setShown(true)
      return () => window.clearTimeout(safety)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' },
    )
    io.observe(el)
    return () => {
      window.clearTimeout(safety)
      io.disconnect()
    }
  }, [shown])
  return (
    <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}

/** شريط تقدّم التمرير أعلى الشاشة — لمسة حيّة متدرجة. */
export function ScrollProgress() {
  const [p, setP] = React.useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setP(max > 4 ? Math.min(1, h.scrollTop / max) : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return <div className="scroll-progress" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />
}