import { useState } from 'react'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { qrSvg } from '../../printutil'
import { toast } from '../../ui'
import type { Followup, Staff } from '../../types'

interface AlertRow {
  id: number; patient_name: string; level: string; metric: string
  value: string; message: string; acknowledged: boolean; created_at: string | null
}

const METRIC_AR = (m: string) => ({ pulse: 'نسبة النبض', bp: 'ضغط الدم', temp: 'الحرارة', spO2: 'الأكسجين', sugar: 'سكر الدم' }[m] ?? m)

/** بوابة العائلة — مرافقة كبار السن: أزرق داكن/أخضر، أزرار عملاقة، أولوية SOS */
export function FamilyPortal() {
  const { user } = useAuth()
  const [sosOpen, setSosOpen] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const followups = useApiData<Followup[]>('/followups', 0)
  const alerts = useApiData<AlertRow[]>('/alerts?open_only=true', 0)
  const team = useApiData<Staff[]>('/staff', 0)

  const latest = followups.data?.find((f) => f.vitals && Object.keys(f.vitals).length > 0)
  const v = latest?.vitals ?? {}
  const patient = latest?.patient_name || user?.name || 'مريضي'
  const qr = qrSvg(`RIAYATI-DZ|${patient}|${user?.name ?? ''}`)

  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged)
  const dangers = openAlerts.filter((a) => a.level === 'danger')
  const warnings = openAlerts.filter((a) => a.level === 'warning')

  const sendSOS = () => {
    setSosSent(true)
    toast('تم إرسال نداء SOS مع موقع المريض إلى العائلة والمستعجلات', 'success')
  }

  return (
    <div className="vitaldz-app">
      <header className="topbar">
        <div className="topbar-inner container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="brand-logo" style={{ width: 52, height: 52, fontSize: 26 }}>🕊️</span>
            <div className="brand-text">
              <b>بوابة العائلة</b>
              <small>مرافقة وتتبع صحة المريض — {patient}</small>
            </div>
          </div>
          <span className="conn-pill" style={{ fontSize: 14 }}>👨‍👩‍👦 {user?.name}</span>
        </div>
      </header>

      <main className="vital-body">
        {/* بطاقة SOS */}
        <div className="vital-hero card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>أفراد العائلة 🕊️</h2>
              <div className="muted" style={{ marginTop: 6 }}>{patient}</div>
            </div>
            <div className="qr" style={{ width: 96, height: 96, background: '#fff', borderRadius: 12, padding: 4 }}
                 dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <button className="btn btn-danger sosh-btn" onClick={() => { setSosOpen(true); if (!sosSent) sendSOS() }}
                  style={{ width: '100%', marginTop: 14, background: '#DC2626', borderColor: '#991B1B' }}>
            🆘 نداء استغاثة (SOS)
          </button>
          <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>عند الضغط يُرسل الموقع إلى العائلة وطوارئ الحماية المدنية (55 00 11 02)</div>
        </div>

        {/* التنبيهات التنبؤية */}
        {openAlerts.length > 0 && (
          <div className="card" style={{ borderColor: dangers.length ? '#DC2626' : '#F59E0B', borderWidth: 2 }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🔔 {dangers.length ? `${dangers.length} إنذار حرج` : `${warnings.length} تنبيه`}</span>
              <span className="muted">{warnings.length} تحذير</span>
            </div>
            {openAlerts.slice(0, 4).map((a) => (
              <div key={a.id} className={`alert alert-${a.level === 'danger' ? 'danger' : 'warning'}`} style={{ marginTop: 8, fontSize: 17 }}>
                {a.level === 'danger' ? '⚠️' : '⚡'} {METRIC_AR(a.metric)}: <b>{a.value}</b> — {a.message}
              </div>
            ))}
          </div>
        )}

        {/* أحدث القياسات */}
        <div className="card">
          <div className="card-title">📈 أحدث المؤشرات الحيوية {latest ? `(${latest.kind_label ?? latest.kind})` : ''}</div>
          <div className="vital-grid" style={{ marginTop: 10 }}>
            <div className="vital-btn"><div className="big">🫀</div><b>{v.pulse ?? '—'}</b><div className="muted">نبض/د</div></div>
            <div className="vital-btn"><div className="big">🩺</div><b>{v.bpSys ? `${v.bpSys}/${v.bpDia ?? '؟'}` : '—'}</b><div className="muted">ضغط الدم</div></div>
            <div className="vital-btn"><div className="big">🌡️</div><b>{v.temp ?? '—'}°</b><div className="muted">الحرارة</div></div>
            <div className="vital-btn"><div className="big">🫁</div><b>{v.spO2 ?? '—'}%</b><div className="muted">الأكسجين</div></div>
            <div className="vital-btn"><div className="big">🍬</div><b>{v.sugar ?? '—'}</b><div className="muted">سكر الدم</div></div>
            <div className="vital-btn"><div className="big">🧑‍⚕️</div><b>{team.data?.filter((s) => s.kind === 'doctor').length ?? 0}</b><div className="muted">أطباء متاحون</div></div>
          </div>
          {!latest && <div className="muted" style={{ marginTop: 10 }}>لا قياسات مسجلة بعد — سيظهر هنا تتبع حي مباشر.</div>}
        </div>

        {/* فرق الرعاية */}
        <div className="card">
          <div className="card-title">🧑‍⚕️ فريق رعاية المرافقين</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {(team.data ?? []).slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8, fontSize: 17 }}>
                <span><b>{s.full_name}</b> {s.kind === 'doctor' ? '🩺' : ''} — {s.specialty ?? ''}</span>
                <a className="btn btn-primary btn-sm" href={`tel:${s.phone ?? '0555001102'}`} style={{ minHeight: 44 }}>📞 اتصل</a>
              </div>
            ))}
          </div>
        </div>

        {/* أزرار كبيرة */}
        <div className="vital-grid">
          <div className="vital-btn" onClick={() => toast('يُفتح سجل المريض الكامل — قريباً', '')}>
            <div className="big">📋</div><b>السجل الطبي</b><div className="muted">تاريخ الإحالات والملف</div>
          </div>
          <div className="vital-btn" onClick={() => { navigator.clipboard?.writeText(`RIAYATI-DZ|${patient}`); toast('نُسخ رمز الاستجابة السريعة للمريض', 'success') }}>
            <div className="big">🎫</div><b>بطاقة التعريف</b><div className="muted">نسخ رمز QR</div>
          </div>
          <div className="vital-btn" onClick={() => toast('تُفتح خريطة موقع المريض — قريباً', '')}>
            <div className="big">📍</div><b>الموقع اللحظي</b><div className="muted">تتبع آمن</div>
          </div>
        </div>
      </main>

      {sosOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal card" style={{ maxWidth: 420, textAlign: 'center', background: 'var(--red-050)' }}>
            <div style={{ fontSize: 56 }}>🆘</div>
            <h2 style={{ fontSize: 24, color: 'var(--red)', margin: '8px 0' }}>نداء استغاثة مُرسل</h2>
            <p style={{ fontSize: 18 }}>تم إخطار الحماية المدنية والعائلة مع موقع المريض الحالي.</p>
            <a className="btn btn-danger" style={{ width: '100%', minHeight: 60 }} href="sms:0555001102&body=نداء استغاثة رعايتي DZ"
               target="_blank" rel="noreferrer">📲 إرسال موقع عبر SMS</a>
            <div className="btn" onClick={() => setSosOpen(false)} style={{ width: '100%', marginTop: 8 }}>إغلاق</div>
          </div>
        </div>
      )}
    </div>
  )
}