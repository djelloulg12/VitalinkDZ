import { useAuth } from '../auth'
import { ROLE_INFO } from '../types'

export function Placeholder() {
  const { user } = useAuth()
  const info = ROLE_INFO[user?.role || ''] || { title: 'لوحة', desc: '', icon: '📋' }
  return (
    <div className="container page">
      <div className="card" style={{ textAlign: 'center', padding: '70px 30px' }}>
        <div style={{ fontSize: 76, marginBottom: 14 }}>{info.icon}</div>
        <h2>{info.title} — لوحة قيد الإعداد</h2>
        <p className="muted mt-12" style={{ maxWidth: 520, margin: '12px auto 0' }}>
          حسابك مسجّل بنجاح. الأقسام الكاملة لهذه اللوحة (الملف الصحي، الملف الطبي والتمريضي، السياحة العلاجية،
          لوحة الوكالة…) تُبنى في المراحل التالية. لوحة {info.title} الافتراضية تظهر هنا.
        </p>
        <p className="small muted mt-16">— Vitalink DZ — نبض الرعاية المتصل —</p>
      </div>
    </div>
  )
}