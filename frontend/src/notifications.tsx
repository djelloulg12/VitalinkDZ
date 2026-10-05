import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, changePassword } from './api'
import { Notification } from './types'
import { Field, Modal, toast } from './ui'

/** جرس الإشعارات الموحّدة — يظهر للمستخدمين المسجّلين فوق كل الشاشات. */
export function useUnread() {
  const [unread, setUnread] = useState(0)
  const reload = () => {
    api<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count || 0))
      .catch(() => {})
  }
  useEffect(() => {
    reload()
    const t = setInterval(reload, 30000)
    return () => clearInterval(t)
  }, [])
  return { unread, reload }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[] | null>(null)
  const { unread, reload } = useUnread()
  const navigate = useNavigate()

  const load = () => {
    api<Notification[]>('/notifications')
      .then(setItems)
      .catch(() => {})
  }

  const toggle = () => {
    setOpen((v) => {
      const nv = !v
      if (nv) load()
      return nv
    })
  }

  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' })
      reload()
      load()
    } catch {}
  }

  const openItem = async (n: Notification) => {
    if (!n.read) {
      try {
        await api(`/notifications/${n.id}/read`, { method: 'POST' })
      } catch {}
      reload()
      load()
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="notify-wrap">
      <button className="icon-btn notify-bell" aria-label="الإشعارات" onClick={toggle}>
        🔔
        {unread > 0 && <span className="notify-dot">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notify-panel" role="menu">
          <div className="notify-head">
            <b>الإشعارات</b>
            <button className="btn btn-ghost btn-sm" onClick={markAll}>قراءة الكل</button>
          </div>
          <div className="notify-list">
            {!items && <div className="notify-empty muted">جارٍ التحميل…</div>}
            {items && items.length === 0 && <div className="notify-empty muted">لا إشعارات جديدة.</div>}
            {items?.map((n) => (
              <button key={n.id} className={`notify-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <span className="notify-ico">{n.icon}</span>
                <span className="notify-txt">
                  <b>{n.title}</b>
                  {n.body && <small>{n.body}</small>}
                  <em>{new Date(n.created_at).toLocaleString('ar-DZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** نافذة تغيير كلمة المرور — تُستخدم طوعياً (من الشريط العلوي) وإلزامياً (بعد أول دخول). */
export function ChangePasswordModal({
  locked,
  onDone,
  onCancel,
}: {
  locked?: boolean
  onDone: () => void
  onCancel?: () => void
}) {
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [newP2, setNewP2] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP.length < 6) { toast('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف', 'warning'); return }
    if (newP !== newP2) { toast('تأكيد كلمة المرور غير مطابق', 'error'); return }
    setBusy(true)
    try {
      await changePassword(oldP, newP)
      toast('تم تغيير كلمة المرور بنجاح', 'success')
      onDone()
    } catch (err: any) {
      toast(err.message || 'فشل تغيير كلمة المرور', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={locked ? 'يجب تغيير كلمة المرور قبل المتابعة' : 'تغيير كلمة المرور'}
      icon="🔑"
      onClose={onCancel || (() => {})}
      closable={!locked}
      foot={
        <>
          {!locked && onCancel && <button className="btn btn-line" onClick={onCancel}>إلغاء</button>}
          <button className="btn btn-primary" onClick={submit as any} disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {locked && (
          <div className="alert alert-warning mb-16">
            🔐 لأمان حسابك، حدّد كلمة مرور جديدة (تُستخدم حالياً كلمة العرض التجريبية).
          </div>
        )}
        <Field label="كلمة المرور الحالية">
          <input className="form-control" type="password" required value={oldP} autoFocus onChange={(e) => setOldP(e.target.value)} />
        </Field>
        <Field label="كلمة المرور الجديدة">
          <input className="form-control" type="password" required minLength={6} value={newP} onChange={(e) => setNewP(e.target.value)} />
        </Field>
        <Field label="تأكيد كلمة المرور الجديدة">
          <input className="form-control" type="password" required value={newP2} onChange={(e) => setNewP2(e.target.value)} />
        </Field>
        <p className="small muted mt-8">استخدم 6 أحرف على الأقل، ويفضّل خلط الأرقام والرموز.</p>
      </form>
    </Modal>
  )
}