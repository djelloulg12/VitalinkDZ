import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { DEMO_USERNAME, ROLE_INFO } from '../types'
import { toast, Modal, Field } from '../ui'

const ROLES = ['nurse', 'doctor', 'admin', 'patient', 'family', 'dass', 'agency', 'thermal', 'pharmacist', 'researcher']

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [pendingRole, setPendingRole] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('demo123')
  const [busy, setBusy] = useState(false)

  const openRole = (role: string) => {
    setPendingRole(role)
    setUsername(DEMO_USERNAME[role] || '')
    setPassword('demo123')
  }

  const submit = async () => {
    if (!pendingRole) return
    setBusy(true)
    try {
      const u = await login(username, password)
      toast(`مرحباً ${u.name}`, 'success')
      if (u.role === 'admin') navigate('/admin')
      else if (u.role === 'researcher') navigate('/cv')
      else navigate(`/portal/${u.role}`)
    } catch (e: any) {
      toast(e.message || 'فشل تسجيل الدخول', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-head">
          <div className="brand-logo">❤️</div>
          <h1>
            VITALINK DZ <span className="muted">— نبض الرعاية المتصل</span>
          </h1>
          <p>منظومة وطنية موحدة للرعاية الصحية والاجتماعية والسياحة العلاجية</p>
        </div>

        <div className="role-cards">
          {ROLES.map((r) => {
            const info = ROLE_INFO[r]
            return (
              <div key={r} className="role-card" onClick={() => openRole(r)}>
                <div className="r-ico">{info.icon}</div>
                <b>{info.title}</b>
                <small>{info.desc}</small>
                <span className="go">دخول ←</span>
              </div>
            )
          })}
        </div>
      </div>

      {pendingRole && (
        <Modal
          title={`الدخول — ${ROLE_INFO[pendingRole].title}`}
          icon={ROLE_INFO[pendingRole].icon}
          onClose={() => setPendingRole(null)}
          foot={
            <>
              <button className="btn btn-line" onClick={() => setPendingRole(null)}>إلغاء</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
              </button>
            </>
          }
        >
          <div className="form-row">
            <Field label="اسم المستخدم">
              <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="كلمة المرور">
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
          <p className="small muted mt-8">حساب تجريبي مسبق التعبئة — كلمة المرور: demo123 (يمكن تغييرها).</p>
        </Modal>
      )}
    </div>
  )
}