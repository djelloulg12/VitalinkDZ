import { FormEvent, useState } from 'react'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { Association, InstitutionRef, Staff, ThermalStation, AdminStats } from '../../types'
import { Field, Modal, Stat, toast } from '../../ui'
import { exportCSV } from '../../printutil'

type Tab = 'overview' | 'referrals' | 'alerts' | 'associations' | 'network'

interface AlertRow {
  id: number; patient_name: string; level: string; metric: string
  value: string; message: string; acknowledged: boolean; ack_by?: string
  created_at?: string | null
}
interface RedAlertItem {
  id: number; patient_name: string; reason: string; medical_note: string
  age_hours: number; breached: boolean
  from?: InstitutionRef | null; to?: InstitutionRef | null
}

const L: Record<string, string> = { pulse: 'نبض', bp: 'ضغط', temp: 'حرارة', spO2: 'أكسجين', sugar: 'سكر' }

/** لوحة DASS — مديرية النشاط الاجتماعي: رصد وتنسيق الإحالات والطوارئ والجمعيات */
export function DassPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [evalModal, setEvalModal] = useState<null | { id: number; form: any }>(null)

  const stats = useApiData<AdminStats>('/admin/stats', refresh)
  const red = useApiData<{ count: number; items: RedAlertItem[] }>('/referrals/red-alerts', refresh)
  const sla = useApiData<any>('/referrals/sla', refresh)
  const refs = useApiData<any[]>('/referrals', refresh)
  const alerts = useApiData<AlertRow[]>('/alerts', refresh)
  const assoc = useApiData<Association[]>('/associations', refresh)
  const team = useApiData<Staff[]>('/staff', refresh)
  const stations = useApiData<ThermalStation[]>('/thermal/stations', refresh)

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ النظرة الوطنية'],
    ['referrals', '🚨 الإحالات والطوارئ'],
    ['alerts', '⚡ التنبيهات الحيوية'],
    ['associations', '🤝 الجمعيات'],
    ['network', '🧭 الشبكة والكفاءات'],
  ]

  const s = stats.data
  const sItems: [string, string | number][] = [
    ['🩺 كوادر', s?.staff ?? '—'], ['📁 ملفات متابعة', s?.followups ?? '—'],
    ['🚨 إحالات طارئة', s?.red_alerts ?? '—'], ['⚡ إنذارات حيوية مفتوحة', s?.alerts_open ?? '—'],
    ['🏥 مستشفيات', s?.hospitals ?? '—'], ['🏥 وحدات ميدانية', s?.units ?? '—'],
    ['🤝 جمعيات', s?.associations ?? '—'], ['♨️ محطات حموية', s?.stations ?? '—'],
    ['🧾 حجوزات علاجية', s?.bookings ?? '—'], ['📍 أسوار جغرافية', s?.zones ?? '—'],
  ]
  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged)

  const ackAlert = async (id: number) => {
    try {
      await api(`/alerts/${id}/ack`, { method: 'POST', body: JSON.stringify({ acknowledged: true }) })
      toast('أُقرّ الإنذار — اتُخذ مسار العلاجات', 'success')
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const evaluate = async (e: FormEvent) => {
    e.preventDefault()
    if (!evalModal) return
    try {
      const f = evalModal.form
      await api(`/associations/${evalModal.id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ visits: Number(f.visits) || 0, volunteers: Number(f.volunteers) || 0, activities: Number(f.activities) || 0, impact: Number(f.impact) || 0, notes: f.notes || '' }),
      })
      toast('عُدّلت نقاط التقييم الميداني', 'success')
      setEvalModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const csvRed = () => exportCSV('dass-red-alerts.csv',
    ['المريض', 'السبب', 'ملاحظة طبية', 'العمر(ساعة)', 'انتهاء المهلة'],
    (red.data?.items ?? []).map((r) => [r.patient_name, r.reason, r.medical_note, r.age_hours, r.breached ? 'نعم' : 'لا']))

  return (
    <div className="container page">
      <header className="flex items-center justify-between mb-16 page-head">
        <div>
          <h1>🤝 لوحة DASS — النشاط الاجتماعي</h1>
          <p className="muted">تنسيق الرعاية الاجتماعية والطبية: الإحالات، الطوارئ، الجمعيات، والشبكة الوطنية.</p>
        </div>
        <span className="badge badge-purple">🧭 {user?.name}</span>
      </header>

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          {(s?.alerts_open ?? 0) > 0 && (
            <div className="alert alert-danger mb-16" style={{ fontSize: 15 }}>
              ⚠️ هناك {s?.alerts_open ?? 0} إنذار حيوي مفتوح و{s?.red_alerts ?? 0} إحالة طارئة بانتظار الرد — راجع تبويبي «التنبيهات» و«الطوارئ».
            </div>
          )}
          <div className="grid grid-4 mb-16">
            {sItems.map(([ic, n]) => <Stat key={ic} icon={ic} num={n} label="" bg="var(--purple-050)" />)}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title">التزام الاستجابة (SLA)</div>
              <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                <b>متوسط الرد: {sla.data?.avg_hours ?? '—'} ساعة</b>
                <span className="badge badge-purple">أسوأ: {sla.data?.worst_hours ?? '—'}س</span>
              </div>
              <div className="vital-grid" style={{ marginTop: 10 }}>
                {(['<=24h', '<=48h', '>48h', 'undecided'] as const).map((k) => (
                  <div key={k} className="mini-stat"><b>{sla.data?.distribution?.[k] ?? 0}</b><span>{k === 'undecided' ? 'بدون قرار' : k}</span></div>
                ))}
              </div>
              <p className="small muted mt-8">هدف المنظومة: الطارئة≤6س، العادية≤48س.</p>
            </div>
            <div className="card">
              <div className="card-title">الأولوية الوطنية اللحظية</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <div className="alert alert-danger" style={{ fontSize: 15 }}>🚨 {s?.red_alerts ?? 0} إحالة طارئة معلقة — يُوجَّه لها الفريق المناوب</div>
                <div className="alert alert-warning" style={{ fontSize: 15 }}>⚡ {s?.alerts_open ?? 0} إنذار مؤشرات دون إقرار طبي</div>
                <div className="alert" style={{ fontSize: 15 }}>🧾 {s?.bookings ?? 0} حجز سياحة علاجية ({s?.pending ?? 0} بانتظار قرار الطبيب)</div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'referrals' && (
        <>
          <div className="flex items-center justify-between mb-12">
            <span className="badge badge-red">🚨 {red.data?.count ?? 0} طارئة معلقة</span>
            <button className="btn btn-primary btn-sm" onClick={csvRed}>⬇️ CSV الطوارئ</button>
          </div>
          {(red.data?.items ?? []).length === 0 && <p className="muted">لا إحالات طارئة معلقة حالياً 👍</p>}
          {(red.data?.items ?? []).map((r) => (
            <div key={r.id} className="card mb-12" style={{ borderColor: r.breached ? 'var(--red)' : 'var(--orange-100)', borderWidth: r.breached ? 2 : 1 }}>
              <div className="flex items-center justify-between">
                <b style={{ fontSize: 16 }}>👤 {r.patient_name}</b>
                <span className={`badge ${r.breached ? 'badge-red' : 'badge-orange'}`}>{r.breached ? `⏰ انتهت المهلة (${r.age_hours}س)` : `⏳ ${r.age_hours}س منذ الإحالة`}</span>
              </div>
              <p className="small mt-8" style={{ lineHeight: 1.8 }}><b>السبب:</b> {r.reason}</p>
              <div className="small muted" style={{ lineHeight: 1.8 }}>{r.medical_note}</div>
              <div className="flex gap-8 mt-8 small">
                <span className="badge badge-white">من: {r.from?.name || 'غير محدد'}</span>
                <span className="badge badge-white">إلى: {r.to?.name || 'غير محدد'}</span>
              </div>
            </div>
          ))}
          <div className="card mt-16">
            <div className="card-title">كل الإحالات ({refs.data?.length ?? 0})</div>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>المريض</th><th>الأولوية</th><th>الحالة</th><th>SLA</th></tr></thead>
              <tbody>
                {(refs.data ?? []).slice(0, 30).map((r) => (
                  <tr key={r.id}>
                    <td>{r.patient_name}</td>
                    <td>{r.severity === 'red' ? <span className="badge badge-red">طارئة</span> : <span className="badge badge-gray">عادية</span>}</td>
                    <td>{r.status === 'accepted' ? <span className="badge badge-green">مقبول</span> : r.status === 'rejected' ? <span className="badge badge-red">مرفوض</span> : <span className="badge badge-orange">قيد الانتظار</span>}</td>
                    <td>{r.sla_hours != null ? `${r.sla_hours}س` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'alerts' && (
        <div className="card">
          <div className="card-title">⚡ {openAlerts.length} إنذار مفتوح من أصل {(alerts.data ?? []).length}</div>
          {alerts.error && <p className="muted">{alerts.error}</p>}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {(alerts.data ?? []).map((a) => (
              <div key={a.id} className={`alert ${a.level === 'danger' ? 'alert-danger' : a.level === 'warning' ? 'alert-warning' : ''}`}
                   style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{a.level === 'danger' ? '⚠️' : '⚡'} <b>{a.patient_name}</b> — {L[a.metric] || a.metric}: {a.value} — {a.message}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {a.acknowledged
                    ? <span className="badge badge-green">أُقرّ {a.ack_by ? `بواسطة ${a.ack_by}` : ''}</span>
                    : <button className="btn btn-primary btn-sm" onClick={() => ackAlert(a.id)}>إقرار وإحالة للعلاج</button>}
                </span>
              </div>
            ))}
            {(alerts.data ?? []).length === 0 && <p className="muted">لا تنبيهات مسجلة.</p>}
          </div>
        </div>
      )}

      {tab === 'associations' && (
        <div className="grid grid-1 mb-16">
          <div className="card">
            <div className="card-title">🤝 الجمعيات النشطة ({assoc.data?.length ?? 0}) — تقييم ميداني ونقاط مكافآت</div>
            <div className="grid grid-4">
              {(assoc.data ?? []).slice(0, 8).map((a) => (
                <div key={a.id} className="mini-stat" style={{ textAlign: 'right', alignItems: 'flex-start' }}>
                  <b style={{ fontSize: 15 }}>{a.name}</b>
                  <span className="muted small">🏅 {a.reward?.badge ?? '—'} · ★ {a.points} · {a.wilaya_ar ?? '—'}</span>
                  <button className="btn btn-line btn-sm mt-8" onClick={() => setEvalModal({ id: a.id, form: { visits: a.visits, volunteers: a.volunteers, activities: a.activities, impact: 0, notes: '' } })}>📋 تقييم خاص</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'network' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">🩺 الكوادر والتعاقد أو الترخيص ({team.data?.length ?? 0})</div>
            <div className="grid grid-2" style={{ gap: 8, marginTop: 8 }}>
              {(team.data ?? []).slice(0, 20).map((p) => (
                <div key={p.id} className="mini-stat" style={{ alignItems: 'flex-start' }}>
                  <b>{p.kind === 'doctor' ? '🩺' : '💉'} {p.full_name}</b>
                  <span className="muted small">{p.specialty || '—'} · {p.wilaya_ar || '—'}</span>
                  <span className={`badge ${p.license_status === 'verified' ? 'badge-green' : 'badge-orange'}`}>{p.license_status === 'verified' ? 'معتمَد' : 'قيد التدقيق'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">♨️ محطات السياحة العلاجية ({stations.data?.length ?? 0})</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(stations.data ?? []).map((t) => (
                <div key={t.id} className="flex justify-between" style={{ alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <b>{t.name}</b>
                  <span className="badge badge-purple">♨️ {t.water_temp ?? '—'}°C</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {evalModal && (
        <Modal title="تقييم ميداني لجمعية" icon="📋" onClose={() => setEvalModal(null)} foot={
          <><button className="btn btn-line" onClick={() => setEvalModal(null)}>إلغاء</button>
          <button className="btn btn-primary" onClick={evaluate}>حفظ التقييم</button></>
        }>
          <div className="form-row">
            <Field label="زيارات ميدانية"><input className="form-control" type="number" min={0} value={evalModal.form.visits} onChange={(e) => setEvalModal({ ...evalModal, form: { ...evalModal.form, visits: e.target.value } })} /></Field>
            <Field label="متطوعون"><input className="form-control" type="number" min={0} value={evalModal.form.volunteers} onChange={(e) => setEvalModal({ ...evalModal, form: { ...evalModal.form, volunteers: e.target.value } })} /></Field>
            <Field label="أنشطة"><input className="form-control" type="number" min={0} value={evalModal.form.activities} onChange={(e) => setEvalModal({ ...evalModal, form: { ...evalModal.form, activities: e.target.value } })} /></Field>
            <Field label="أثر (وصف الأثر)"><input className="form-control" type="number" min={0} value={evalModal.form.impact} onChange={(e) => setEvalModal({ ...evalModal, form: { ...evalModal.form, impact: e.target.value } })} /></Field>
          </div>
          <Field label="ملاحظات"><textarea className="form-control" rows={3} value={evalModal.form.notes} onChange={(e) => setEvalModal({ ...evalModal, form: { ...evalModal.form, notes: e.target.value } })} /></Field>
          <p className="small muted mt-8">النقاط = زيارات×10 + متطوعين×5 + أنشطة×40 + أثر×150 — وفق نموذج DASS الوطني.</p>
        </Modal>
      )}
    </div>
  )
}