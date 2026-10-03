import { FormEvent, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { CarePlan, Consent, Prescription, PsychScreen, PsychSession, Referral, ThermalBooking } from '../../types'
import { EmptyState, Field, Modal, PageHead, toast } from '../../ui'

type Tab = 'overview' | 'refs' | 'rx' | 'care' | 'psych' | 'thermal'

/** بوابة مستشفى / طبيب — الإحالات وتقييد SLA، الروشتات، الخطط والموافقات، النفسية، والسياحة العلاجية. */
export function DoctorPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [rxModal, setRxModal] = useState(false)
  const [refModal, setRefModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)

  const refs = useApiData<Referral[]>('/referrals', refresh)
  const alerts = useApiData<any[]>('/alerts?open_only=true', refresh)
  const stats = useApiData<any>('/admin/stats', refresh)
  const rx = useApiData<Prescription[]>('/prescriptions', refresh)
  const plans = useApiData<CarePlan[]>('/careplans', refresh)
  const consents = useApiData<Consent[]>('/consents', refresh)
  const screening = useApiData<PsychScreen[]>('/psych/screening', refresh)
  const sessions = useApiData<PsychSession[]>('/psych/sessions', refresh)
  const bookings = useApiData<ThermalBooking[]>('/thermal/bookings', refresh)

  const s = stats.data
  const openRefs = (refs.data ?? []).filter((r) => r.status === 'pending')
  const redRefs = (refs.data ?? []).filter((r) => r.severity === 'red' && r.status === 'pending')
  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged)
  const openRx = (rx.data ?? []).filter((r) => r.status === 'open')
  const pendingSessions = (sessions.data ?? []).filter((x) => x.status === 'pending')
  const pendingBookings = (bookings.data ?? []).filter((b) => b.status === 'pending')

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ تصفح المناوبة'],
    ['refs', `🔄 الإحالات (${openRefs.length})`],
    ['rx', `💊 الروشتات (${openRx.length})`],
    ['care', '📋 الموافقات والخطط'],
    ['psych', `🧠 النفسية (${pendingSessions.length})`],
    ['thermal', `♨️ سياحة علاجية (${pendingBookings.length})`],
  ]

  const decide = async (id: number, status: string) => {
    try {
      await api(`/referrals/${id}/decide`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'accepted' ? 'قُبلت الإحالة — توقيع طبي مسجل' : 'رُفضت الإحالة', status === 'accepted' ? 'success' : 'warning')
      setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const ackAlert = async (id: number) => {
    try {
      await api(`/alerts/${id}/ack`, { method: 'POST', body: JSON.stringify({ acknowledged: true }) })
      toast('أُقرّ الإنذار وسجّل في Audit', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const createRef = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const r = await api<Referral>('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: String(fd.get('patient') || ''), reason: String(fd.get('reason') || ''),
          medical_note: String(fd.get('note') || ''), severity: String(fd.get('severity') || 'normal') as any,
          from_institution_id: null, to_institution_id: null,
          ...(String(fd.get('sla') || '') ? { sla_hours: Number(fd.get('sla')) } : {}),
        }),
      })
      toast(r.severity === 'red' ? '🚨 Red Alert — أُشعرت الحماية المدنية' : 'أُرسلت الإحالة', 'success')
      setRefModal(false); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const createRx = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const r = await api<Prescription>('/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: String(fd.get('patient') || ''), purpose: String(fd.get('purpose') || ''),
          institution: String(fd.get('institution') || ''),
          items: [{ drug: String(fd.get('drug') || ''), strength: String(fd.get('strength') || ''),
            dosage: String(fd.get('dosage') || ''), duration: String(fd.get('duration') || ''), qty: Number(fd.get('qty')) || 1 }],
        }),
      })
      toast(`أُصدرت وصفتك الموقعة رقمياً ${r.ref}`, 'success')
      setRxModal(false); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const createPlan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const goals = String(fd.get('goals') || '').split('\n').map((g) => g.trim()).filter(Boolean)
    try {
      await api('/careplans', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: String(fd.get('patient') || ''), title: String(fd.get('title') || ''),
          summary: String(fd.get('summary') || ''),
          goals: goals.map((g) => ({ g, done: false })),
          schedule: String(fd.get('schedule') || '').split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ task: t, when: 'أسبوعياً' })),
        }),
      })
      toast('أُنشئت خطة ما بعد العلاج', 'success'); setPlanModal(false); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const confirmSession = async (id: number, status: string) => {
    try {
      await api(`/psych/sessions/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'confirmed' ? 'أُكدت الجلسة' : 'حُددت مكتملة', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const approveBooking = async (id: number) => {
    try {
      await api(`/thermal/bookings/${id}/approve?approved=true`, { method: 'PUT' })
      toast('أُجيزت الرحلة العلاجية — توقيع الطبيب مسجل', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  return (
    <div className="container page portal-shell">
      <PageHead icon="🏥" title="بوابة مستشفى / طبيب"
        sub={`جدول المناوبة العملي — إحالات تلتزم بمعايير SLA 24/48 س، روشتات موقعة، وخطط ما بعد العلاج.`}
        actions={
          <>
            <span className="hero-chip">🩺 {user?.name}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setRxModal(true)}>➕ روشتة</button>
            <button className="btn btn-gold btn-sm" onClick={() => setRefModal(true)}>🔄 إحالة</button>
          </>
        } />

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          {redRefs.length > 0 && (
            <div className="alert alert-danger mb-16">🚨 <b>{redRefs.length} إحالة حمراء</b> تنتظر قرارك — يتطلب القانون 18-07 الحسم قبل تجاوز 24 ساعة.</div>
          )}
          {openAlerts.length > 0 && (
            <div className="alert alert-warning mb-16">⚠️ <b>{openAlerts.length} إنذار</b> من محرك الإنذار التنبؤي يحتاج تقييم السريري.</div>
          )}
          <div className="grid grid-4 mb-16">
            {[
              ['🔄', openRefs.length, 'إحالات بانتظار القرار'],
              ['🚨', redRefs.length, 'إحالات حمراء'],
              ['💊', openRx.length, 'روشتات للصرف'],
              ['🧠', pendingSessions.length, 'جلسات للتأكيد'],
            ].map(([ic, n, l]) => (
              <div key={l as string} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--green-050)' }}>{ic}</div>
                <div><div className="s-num">{n}</div><div className="s-lab">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">📊</span> مؤشرات المنشأة</div>
              {[
                ['المرضى المسجلون', s?.patients ?? '—'],
                ['الكوادر الطبية', s?.doctors ?? '—'],
                ['الممرضون', s?.nurses ?? '—'],
                ['طلبات السياحة العلاجية', s?.bookings ?? '—'],
                ['قياسات المتابعة', s?.followups ?? '—'],
                ['إنذارات مفتوحة', s?.alerts_open ?? '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="muted small">{l}</span><b>{v}</b>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">⏱️</span> التزام الإحالات بمؤشر SLA</div>
              <p className="small muted">زمن الحسم الإجمالي الموزون — يظهر في لوحة DASS والمدير الوطني مع الإنذارات.</p>
              <div className="alert alert-success">✅ <b>{openRefs.length === 0 ? 'لا إحالات معلقة' : `${openRefs.length} إحالة بانتظار قرارك`}</b> — كلما حسمت أبكر، ارتفع رصيد الامتثال الوطني.</div>
            </div>
          </div>
        </>
      )}

      {tab === 'refs' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {(refs.data ?? []).map((r) => (
            <div key={r.id} className={`card ${r.severity === 'red' && r.status === 'pending' ? 'red-border' : ''}`}>
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b>🔄 {r.patient_name}</b>
                  {r.severity === 'red' && <span className="badge badge-red">RED ALERT</span>}
                  {r.status === 'pending' && <span className="badge badge-orange">بانتظار القرار</span>}
                  {r.status === 'accepted' && <span className="badge badge-green">مقبولة</span>}
                  {r.status === 'rejected' && <span className="badge badge-gray">مرفوضة</span>}
                  <div className="small muted">{r.reason} — بواسطة: {r.created_by} · {r.created_at?.slice(0, 16)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {r.status === 'pending' && (<>
                    <button className="btn btn-success btn-sm" onClick={() => decide(r.id, 'accepted')}>✔ قبول</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => decide(r.id, 'rejected')}>✕ رفض</button>
                  </>)}
                </div>
              </div>
              {r.medical_note && <p className="small mt-8" style={{ color: 'var(--ink-2)' }}>{r.medical_note}</p>}
              {r.from && <div className="small muted">من {r.from.name} {r.to && <>← يشبك مع {r.to.name}</>}</div>}
            </div>
          ))}
          {(refs.data ?? []).length === 0 && <EmptyState icon="🔄" text="لا إحالات مسجلة." />}
        </div>
      )}

      {tab === 'rx' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {(rx.data ?? []).slice(0, 8).map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🧾 <span dir="ltr">{r.ref}</span> — {r.patient_name}</b>
                  <span className={`badge ${r.status === 'open' ? 'badge-blue' : 'badge-green'}`}>{r.status === 'open' ? 'بانتظار الصرف' : 'صُرفت'}</span>
                  <div className="small muted">{r.doctor_name} · {r.institution}</div></div>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {r.items.map((it, i) => (
                  <div key={i} className="rx-item"><b>{it.drug}</b><span className="small muted">{it.strength} · {it.dosage}</span><span className="badge badge-white">×{it.qty}</span></div>
                ))}
              </div>
            </div>
          ))}
          {(rx.data ?? []).length === 0 && <div className="alert alert-info">لم تُصدر وصفتك بعد — اضغط «➕ روشتة».</div>}
        </div>
      )}

      {tab === 'care' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="store"><button className="btn btn-primary" onClick={() => setPlanModal(true)}>🗺️ خطة ما بعد العلاج</button></div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">🗺️</span> الخطط ({plans.data?.length ?? 0})</div>
              {(plans.data ?? []).map((p) => (
                <div key={p.id} className="list-item mb-8" style={{ alignItems: 'flex-start' }}>
                  <div className="lico">🗺️</div>
                  <div style={{ flex: 1 }}>
                    <b>{p.patient_name}</b> — {p.title}
                    <div className="small muted">{p.summary}</div>
                    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                      {p.goals.map((g, i) => (
                        <div key={i} className="flex items-center gap-8 small">
                          <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => toggleGoal(p.id, i, setRefresh)}>{g.done ? '🟢' : '⚪'}</button>
                          <span style={{ textDecoration: g.done ? 'line-through' : 'none', color: g.done ? 'var(--muted)' : 'var(--ink-2)' }}>{g.g}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(plans.data ?? []).length === 0 && <EmptyState icon="🗺️" text="لا خطط بعد." />}
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">✍️</span> الموافقات الرقمية ({consents.data?.length ?? 0})</div>
              {(consents.data ?? []).map((c) => (
                <div key={c.id} className="list-item mb-8">
                  <div className="lico">{c.revoked ? '🚫' : '✅'}</div>
                  <div style={{ flex: 1 }}>
                    <b>{c.patient_name}</b> <span className="badge badge-purple">{c.type_label}</span>
                    <div className="small muted">{c.scope} · {c.granted_to}</div>
                  </div>
                  <span className={`badge ${c.revoked ? 'badge-gray' : 'badge-green'}`}>{c.revoked ? 'ملغاة' : 'سارية'}</span>
                </div>
              ))}
              {(consents.data ?? []).length === 0 && <EmptyState icon="✍️" text="لا موافقات بعد." />}
            </div>
          </div>
        </div>
      )}

      {tab === 'psych' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title"><span className="ico">🧠</span> نتائج الفحوص</div>
            {(screening.data ?? []).map((p) => (
              <div key={p.id} className="list-item mb-8">
                <div className="lico">{p.kind === 'caregiver' ? '🤝' : '🧠'}</div>
                <div style={{ flex: 1 }}>
                  <b>{p.patient_name}</b> <span className="badge badge-purple">{p.kind === 'phq' ? 'PHQ' : p.kind === 'gad' ? 'GAD' : 'مقدِّم رعاية'}</span>
                  <div className="small muted">{p.advice}</div>
                </div>
                <span className={`badge ${p.level === 'severe' ? 'badge-red' : p.level === 'moderate' ? 'badge-orange' : 'badge-green'}`}>{p.score} · {p.level}</span>
              </div>
            ))}
            {(screening.data ?? []).length === 0 && <EmptyState icon="🧠" text="لا فحوص بعد." />}
          </div>
          <div className="card">
            <div className="card-title"><span className="ico">🗓️</span> جلسات الاستشارة ({pendingSessions.length} معلّقة)</div>
            {(sessions.data ?? []).map((sn) => (
              <div key={sn.id} className="list-item mb-8">
                <div className="lico">{sn.kind === 'video' ? '📹' : sn.kind === 'voice' ? '🎧' : '💬'}</div>
                <div style={{ flex: 1 }}>
                  <b>{sn.patient_name}</b> — {sn.specialist}
                  <div className="small muted">{sn.slot || 'موعد'} · {sn.reason}</div>
                </div>
                {sn.status === 'pending'
                  ? <button className="btn btn-primary btn-sm" onClick={() => confirmSession(sn.id, 'confirmed')}>تأكيد</button>
                  : <span className={`badge ${sn.status === 'done' ? 'badge-green' : 'badge-blue'}`}>{sn.status}</span>}
              </div>
            ))}
            {(sessions.data ?? []).length === 0 && <EmptyState icon="🗓️" text="لا جلسات بعد." />}
          </div>
        </div>
      )}

      {tab === 'thermal' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="alert alert-info">♨️ الرحلة العلاجية لا تُباع دون <b>إجازة طبيب</b> — القرار مسجل بالاسم والوقت في Audit.</div>
          {(bookings.data ?? []).filter((b) => b.status === 'pending').map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b>{b.patient_name}</b> — {b.station_name || 'حمام'}
                  <div className="small muted">{b.date_start} → {b.date_end} · {b.price} دج · {b.insurance_label || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-orange">بانتظار الإجازة</span>
                  <button className="btn btn-success btn-sm" onClick={() => approveBooking(b.id)}>✔ إجازة علاجية</button>
                </div>
              </div>
            </div>
          ))}
          {(bookings.data ?? []).filter((b) => b.status === 'pending').length === 0 && (
            <EmptyState icon="♨️" text="لا طلبات سياحة علاجية معلقة." />
          )}
        </div>
      )}

      {rxModal && (
        <Modal title="إصدار روشتة إلكترونية موقعة" icon="💊" onClose={() => setRxModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setRxModal(false)}>إلغاء</button>
          <button type="submit" form="rx-form" className="btn btn-primary">🔏 إصدار وتوقيع</button></>
        }>
          <form id="rx-form" onSubmit={createRx}>
            <Field label="المريض"><input className="form-control" name="patient" required /></Field>
            <Field label="الغرض/التشخيص"><input className="form-control" name="purpose" /></Field>
            <Field label="المؤسسة"><input className="form-control" name="institution" /></Field>
            <div className="form-row-3">
              <Field label="الدواء"><input className="form-control" name="drug" required /></Field>
              <Field label="الجرعة"><input className="form-control" name="strength" placeholder="500mg" /></Field>
              <Field label="الكمية"><input className="form-control" name="qty" type="number" min={1} defaultValue={10} /></Field>
            </div>
            <div className="form-row">
              <Field label="التعليمات"><input className="form-control" name="dosage" placeholder="قرص صباحاً ومساءً" /></Field>
              <Field label="المدة"><input className="form-control" name="duration" placeholder="شهر" /></Field>
            </div>
          </form>
        </Modal>
      )}

      {refModal && (
        <Modal title="إحالة إلكترونية" icon="🔄" onClose={() => setRefModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setRefModal(false)}>إلغاء</button>
          <button type="submit" form="ref-form" className="btn btn-primary">إرسال</button></>
        }>
          <form id="ref-form" onSubmit={createRef}>
            <Field label="المريض"><input className="form-control" name="patient" required /></Field>
            <Field label="سبب الإحالة"><input className="form-control" name="reason" required /></Field>
            <Field label="الملاحظة الطبية (تُخزَّن مشفرة)"><textarea className="form-control" name="note" rows={3} /></Field>
            <div className="form-row">
              <Field label="الخطورة">
                <select className="form-control" name="severity">
                  <option value="normal">عادية</option>
                  <option value="red">🔴 حمراء (Red Alert → الحماية المدنية)</option>
                </select>
              </Field>
              <Field label="أجل الحسم بساعات (اختياري)"><input className="form-control" name="sla" type="number" min={1} placeholder="24" /></Field>
            </div>
          </form>
        </Modal>
      )}

      {planModal && (
        <Modal title="خطة ما بعد العلاج" icon="🗺️" onClose={() => setPlanModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setPlanModal(false)}>إلغاء</button>
          <button type="submit" form="plan-form" className="btn btn-primary">حفظ</button></>
        }>
          <form id="plan-form" onSubmit={createPlan}>
            <div className="form-row">
              <Field label="المستفيد"><input className="form-control" name="patient" required /></Field>
              <Field label="العنوان"><input className="form-control" name="title" placeholder="خطة ما بعد الاستقرار" /></Field>
            </div>
            <Field label="الملخص"><input className="form-control" name="summary" /></Field>
            <Field label="الغايات (سطر لكل غاية)"><textarea className="form-control" name="goals" rows={3} placeholder={'قياس السكر أسبوعياً\nالمشي 20 دقيقة يومياً'} /></Field>
            <Field label="المهام (سطر لكل مهمة)"><textarea className="form-control" name="schedule" rows={3} placeholder={'قياس صباحي\nنظام غذائي'} /></Field>
          </form>
        </Modal>
      )}
    </div>
  )
}

async function toggleGoal(pid: number, idx: number, setRefresh: Dispatch<SetStateAction<number>>) {
  try {
    await api(`/careplans/${pid}/goal/${idx}`, { method: 'POST', body: JSON.stringify({ done: true }) })
    toast('أُنزلت الغاية منجز', 'success'); setRefresh((x) => x + 1)
  } catch (e: any) { toast(e.message, 'error') }
}