import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { DEMO_USERNAME, ROLE_INFO, User } from '../types'
import { toast, Modal, Field } from '../ui'

const ROLES = ['nurse', 'doctor', 'admin', 'patient', 'family', 'dass', 'agency', 'thermal', 'pharmacist', 'researcher']

const FEATS = [
  { icon: '❤️', txt: 'سجل صحي موحد وراسخ', cls: 'dot-red' },
  { icon: '🏥', txt: 'إحالات وتنسيق متعدد الأطراف', cls: 'dot-purple' },
  { icon: '🌍', txt: 'سياحة علاجية دولية', cls: 'dot-green' },
  { icon: '🧓', txt: 'وضع رعاية كبار السن', cls: 'dot-gold' },
]

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

  const go = (u: User) => {
    toast(`مرحباً ${u.name}`, 'success')
    if (u.role === 'admin') navigate('/admin')
    else if (u.role === 'researcher') navigate('/cv')
    else navigate(`/portal/${u.role}`)
  }

  const submit = async () => {
    if (!pendingRole) return
    setBusy(true)
    try {
      const u = await login(username, password)
      go(u)
    } catch (e: any) {
      toast(e.message || 'فشل تسجيل الدخول', 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && pendingRole) submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingRole, username, password])

  return (
    <div className="login-shell">
      <aside className="login-brand-panel">
        <div className="hero-orbs" aria-hidden="true"><i /><i /><i /></div>
        <div className="login-brand-top">
          <div className="brand-logo">❤️</div>
          <div>
            <b>رعايتي DZ</b>
            <small>Vitalink — نبض الرعاية المتصل</small>
          </div>
        </div>

        <div className="login-brand-mid">
          <h2>منظومة وطنية موحّدة للرعاية<br />الصحية والاجتماعية والسياحة العلاجية</h2>
          <p className="lbm">
            منصة جزائرية تصل المريض، الطبيب، الممرّض، الأسرة والمؤسسات الصحية عبر سجل موحّد آمن،
            حضور لحظي وإحالات ذكية — بلمسة وإنسانيتين في التنقل بين الجهات.
          </p>
          <div className="feature-chips">
            {FEATS.map((f) => (
              <span className="feat" key={f.txt}>
                <span className={`dot ${f.cls}`} /> {f.icon} {f.txt}
              </span>
            ))}
          </div>
        </div>

        <div className="login-brand-foot">
          <span>🔒 اتصال مشفّر</span>
          <span>•</span>
          <span>متوافق مع الجوال (PWA)</span>
          <span>•</span>
          <span>التشغيل دون إنترنت</span>
        </div>
      </aside>

      <section className="login-panel-side">
        <div className="login-panel-box">
          <div className="login-panel-title">
            <h1>بوابة الدخول الموحّدة</h1>
            <p>اختر هويتك للبدء — يتم تعبئة الحساب التجريبي تلقائياً</p>
          </div>

          <div className="role-cards">
            {ROLES.map((r) => {
              const info = ROLE_INFO[r]
              return (
                <div
                  key={r}
                  className="role-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openRole(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRole(r) } }}
                >
                  <div className="r-ico">{info.icon}</div>
                  <b>{info.title}</b>
                  <small>{info.desc}</small>
                  <span className="go">دخول ←</span>
                </div>
              )
            })}
          </div>

          <div className="quick-start">
            <span className="qs-step"><b>1</b> اختر هويتك</span>
            <span className="qs-step"><b>2</b> اضغط دخول — الحساب جاهز</span>
            <span className="qs-step"><b>3</b> استكشف المنظومة</span>
          </div>

          <p className="login-panel-foot">
            حساب تجريبي جاهز لكل دور · كلمة المرور <b>demo123</b> · يمكنك تغييرها لاحقاً من ملفك الشخصي
          </p>

          <div className="login-panel-links">
            <span className="muted small">منظومة عامة أيضاً:</span>
            <Link to="/">الرئيسية</Link>
            <span>·</span>
            <Link to="/tourism">السياحة العلاجية</Link>
            <span>·</span>
            <Link to="/about">من نحن</Link>
          </div>
        </div>
      </section>

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
              <input className="form-control" value={username} autoFocus onChange={(e) => setUsername(e.target.value)} />
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