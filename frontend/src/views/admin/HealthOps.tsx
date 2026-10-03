import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { BreakGlass, CarePlan, Consent, Prescription, PsychScreen, PsychSession, SosDispatch } from '../../types'
import { EmptyState, Field, Modal, PageHead, toast } from '../../ui'

type Tab = 'overview' | 'rx' | 'bg' | 'sos' | 'psych' | 'care'

/** العمليات الصحية اليومية — المرحلة 2α: روشتات، كسر زجاج، SOS، نفسية، موافقات وخطط. */
export function HealthOps() {
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [bgModal, setBgModal] = useState(false)
  const [bgOTP, setBgOTP] = useState<BreakGlass | null>(null)
  const [otp, setOtp] = useState('')
  const [rxModal, setRxModal] = useState(false)
  const [consentModal, setConsentModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)

  const stats = useApiData<any>('/admin/stats', refresh)
  const rx = useApiData<Prescription[]>('/prescriptions', refresh)
  const bg = useApiData<BreakGlass[]>('/access/break-glass', refresh)
  const sos = useApiData<SosDispatch[]>('/sos/dispatches', refresh)
  const psych = useApiData<PsychScreen[]>('/psych/screening', refresh)
  const sessions = useApiData<PsychSession[]>('/psych/sessions', refresh)
  const resources = useApiData<any[]>('/psych/resources', refresh)
  const consents = useApiData<Consent[]>('/consents', refresh)
  const plans = useApiData<CarePlan[]>('/careplans', refresh)

  const s = stats.data
  const openRx = (rx.data || []).filter((r) => r.status === 'open')
  const openBg = (bg.data || []).filter((b) => b.status === 'active')
  const openSos = (sos.data || []).filter((d) => d.status !== 'resolved')

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ النظرة التشغيلية'],
    ['rx', `💊 الروشتات (${openRx.length})`],
    ['bg', `🛡️ كسر الزجاج (${openBg.length})`],
    ['sos', `🚨 SOS (${openSos.length})`],
    ['psych', '🧠 الصحة النفسية'],
    ['care', '📋 الموافقات والخطط'],
  ]

  const dispense = async (id: number) => {
    try {
      await api(`/prescriptions/${id}/dispense`, { method: 'POST', body: JSON.stringify({}) })
      toast('صُرفت الروشتة', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const requestBG = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason') || '')
    try {
      const b = await api<BreakGlass>('/access/break-glass', { method: 'POST', body: JSON.stringify({ reason }) })
      setBgOTP(b)
      toast('طُلب الوصول الطارئ — راجع رمز OTP', 'success')
      setBgModal(false)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const verifyBG = async (bgId: number) => {
    try {
      await api(`/access/break-glass/${bgId}/verify`, { method: 'POST', body: JSON.stringify({ otp }) })
      toast('وصول طارئ مفعّل لمدة 30 دقيقة — مقيَّد بالسجل', 'success')
      setBgOTP(null); setOtp(''); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const releaseBG = async (bgId: number) => {
    try {
      await api(`/access/break-glass/${bgId}/release`, { method: 'POST', body: JSON.stringify({ note: 'إغلاق المناوبة' }) })
      toast('أُغلق الوصول الطارئ', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const setSos = async (id: number, status: string) => {
    try {
      await api(`/sos/dispatches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'resolved' ? 'أُغلق البلاغ' : 'سُجّل مسار الفريق', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const revoke = async (id: number) => {
    try {
      await api(`/consents/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) })
      toast('الرجوع عن الموافقة — سجّل قانونياً', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const toggleGoal = async (pid: number, idx: number) => {
    try {
      await api(`/careplans/${pid}/goal/${idx}`, { method: 'POST', body: JSON.stringify({ done: true }) })
      toast('أُنزلت الغاية على أنها منجزة', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const createRx = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await api('/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: String(fd.get('patient') || ''), purpose: String(fd.get('purpose') || ''),
          institution: String(fd.get('institution') || ''),
          items: [
            { drug: String(fd.get('drug') || ''), strength: String(fd.get('strength') || ''),
              dosage: String(fd.get('dosage') || ''), duration: String(fd.get('duration') || ''),
              qty: Number(fd.get('qty')) || 1 },
          ],
        }),
      })
      toast('أُصدرت الروشتة إلكترونياً', 'success'); setRxModal(false); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const createConsent = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await api('/consents', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: String(fd.get('patient') || ''), type: String(fd.get('type') || 'record'),
          granted_to: String(fd.get('to') || ''), scope: String(fd.get('scope') || ''),
          expires_on: String(fd.get('exp') || ''),
        }),
      })
      toast('سُجلت الموافقة الرقمية', 'success'); setConsentModal(false); setRefresh((x) => x + 1)
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

  const setSession = async (id: number, status: string) => {
    try {
      await api(`/psych/sessions/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      toast('حُدّثت الجلسة', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  return (
    <div className="container page portal-shell">
      <PageHead icon="🛰️" title="العمليات الصحية اليومية"
        sub="مديرية تشغيلية: روشتات، وصول طارئ، SOS، صحة نفسية، موافقات وخطط ما بعد العلاج."
        actions={
          <button className="btn btn-gold btn-sm" onClick={() => setRxModal(true)}>➕ إصدار روشتة</button>
        } />

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-4 mb-16">
            {[
              ['💊', s?.rx_open ?? '—', 'روشتات مفتوحة'],
              ['📦', s?.low_stock ?? '—', 'صنوف ناقصة'],
              ['🛡️', s?.bg_active ?? '—', 'وصول طارئ مفعل'],
              ['🚨', s?.sos_fired ?? '—', 'بلاغات SOS نشطة'],
              ['🧠', s?.psych_runs ?? '—', 'فحوص نفسية'],
              ['🗓️', s?.tele_pending ?? '—', 'جلسات بانتظار التأكيد'],
              ['✍️', s?.consents ?? '—', 'موافقات سارية'],
              ['🗺️', s?.careplans ?? '—', 'خطط ما بعد العلاج'],
            ].map(([ic, n, l]) => (
              <div key={l as string} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--purple-050)' }}>{ic}</div>
                <div><div className="s-num">{n}</div><div className="s-lab">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="alert alert-info">
            🎯 ابدأ بالروشتات المفتوحة <b>({openRx.length})</b>، ثم افحص مفعّلات كسر الزجاج، ثم بلاغات SOS غير المحلولة.
          </div>
        </>
      )}

      {tab === 'rx' && (
        <>
          {openRx.length === 0 && <EmptyState icon="💊" text="لا روشتات مفتوحة." />}
          {openRx.map((r) => (
            <div key={r.id} className="card mb-12">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🧾 <span dir="ltr">{r.ref}</span></b>
                  <div className="small muted">{r.patient_name} · {r.doctor_name} · {r.institution}</div></div>
                <button className="btn btn-primary btn-sm" onClick={() => dispense(r.id)}>✔ صرف</button>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {r.items.map((it, i) => (
                  <div key={i} className="rx-item"><b>{it.drug}</b><span className="small muted">{it.strength} · {it.dosage}</span><span className="badge badge-white">×{it.qty}</span></div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'bg' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="flex gap-8 store">
            <button className="btn btn-primary" onClick={() => setBgModal(true)}>🧊 طلب وصول طارئ (كسر الزجاج)</button>
          </div>
          {(bg.data || []).map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b>🛡️ {b.requester} <span className="badge badge-purple">{b.role}</span></b>
                  <p className="small muted mt-8">{b.reason}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${b.status === 'active' ? 'badge-red' : b.status === 'released' ? 'badge-gray' : 'badge-orange'}`}>
                    {b.status === 'active' ? `مفعّل حتى ${b.expires_at?.slice(11, 19) || ''}` : b.status === 'released' ? 'مغلق' : 'بOTP'}
                  </span>
                  {b.status === 'active' && <button className="btn btn-soft btn-sm" onClick={() => releaseBG(b.id)}>إغلاق</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sos' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {openSos.length === 0 && <EmptyState icon="🚨" text="لا بلاغات نشطة." />}
          {openSos.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🚨 <span dir="ltr">{d.ref}</span></b>
                  <div className="small muted">{d.patient_name} · {d.channel} · {d.created_at?.slice(0, 16)}</div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {d.maps ? <a className="btn btn-line btn-sm" href={d.maps} target="_blank" rel="noreferrer">📍 خريطة</a> : null}
                  <button className="btn btn-soft btn-sm" onClick={() => setSos(d.id, d.status === 'fired' ? 'enroute' : 'resolved')}>
                    {d.status === 'fired' ? 'فريق متجه' : 'إغلاق'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'psych' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title"><span className="ico">🧠</span> نتائج الفحوص الذاتية</div>
            {(psych.data || []).map((p) => (
              <div key={p.id} className="list-item mb-8">
                <div className="lico">{p.kind === 'caregiver' ? '🤝' : '🧠'}</div>
                <div style={{ flex: 1 }}>
                  <b>{p.patient_name}</b> <span className="badge badge-purple">{p.kind === 'phq' ? 'PHQ' : p.kind === 'gad' ? 'GAD' : 'مقدِّم الرعاية'}</span>
                  <div className="small muted">{p.advice}</div>
                </div>
                <span className={`badge ${p.level === 'severe' ? 'badge-red' : p.level === 'moderate' ? 'badge-orange' : 'badge-green'}`}>{p.score} · {p.level}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title"><span className="ico">🗓️</span> جلسات الاستشارة عن بُعد</div>
            {(sessions.data || []).map((sess) => (
              <div key={sess.id} className="list-item mb-8">
                <div className="lico">{sess.kind === 'video' ? '📹' : sess.kind === 'voice' ? '🎧' : '💬'}</div>
                <div style={{ flex: 1 }}>
                  <b>{sess.patient_name}</b> — {sess.specialist}
                  <div className="small muted">{sess.slot || 'موعد قريب'} · {sess.reason}</div>
                </div>
                {sess.status === 'pending'
                  ? <button className="btn btn-primary btn-sm" onClick={() => setSession(sess.id, 'confirmed')}>تأكيد</button>
                  : <span className={`badge ${sess.status === 'done' ? 'badge-green' : 'badge-blue'}`}>{sess.status}</span>}
              </div>
            ))}
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title"><span className="ico">📚</span> موارد الدعم النفسي</div>
            <div className="grid grid-4">
              {(resources.data || []).map((r) => (
                <div key={r.id} className="mini-stat" style={{ textAlign: 'right', alignItems: 'flex-start' }}>
                  <b style={{ fontSize: 26 }}>{r.icon}</b>
                  <b style={{ fontSize: 14 }}>{r.title}</b>
                  <span className="small muted">{r.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'care' && (
        <>
          <div className="flex gap-8 mb-16">
            <button className="btn btn-primary" onClick={() => setConsentModal(true)}>✍️ موافقة رقمية</button>
            <button className="btn btn-soft" onClick={() => setPlanModal(true)}>🗺️ خطة ما بعد العلاج</button>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">✍️</span> الموافقات ({consents.data?.length ?? 0})</div>
              {(consents.data || []).map((c) => (
                <div key={c.id} className="list-item mb-8">
                  <div className="lico">{c.revoked ? '🚫' : '✅'}</div>
                  <div style={{ flex: 1 }}>
                    <b>{c.patient_name}</b> <span className="badge badge-purple">{c.type_label}</span>
                    <div className="small muted">{c.scope} · ينتهي: {c.expires_on || 'غير محدد'}</div>
                  </div>
                  {!c.revoked && <button className="btn btn-ghost btn-sm" onClick={() => revoke(c.id)}>رجوع</button>}
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">🗺️</span> خطط ما بعد العلاج ({plans.data?.length ?? 0})</div>
              {(plans.data || []).map((p) => (
                <div key={p.id} className="list-item mb-8" style={{ alignItems: 'flex-start' }}>
                  <div className="lico">🗺️</div>
                  <div style={{ flex: 1 }}>
                    <b>{p.patient_name}</b> — {p.title}
                    <div className="small muted">{p.summary}</div>
                    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                      {p.goals.map((g, i) => (
                        <div key={i} className="flex items-center gap-8 small">
                          <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => toggleGoal(p.id, i)}>{g.done ? '🟢' : '⚪'}</button>
                          <span style={{ textDecoration: g.done ? 'line-through' : 'none', color: g.done ? 'var(--muted)' : 'var(--ink-2)' }}>{g.g}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {bgModal && (
        <Modal title="طلب كسر الزجاج (وصول طارئ)" icon="🛡️" onClose={() => setBgModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setBgModal(false)}>إلغاء</button>
          <button type="submit" form="bg-form" className="btn btn-primary btn-glow">طلب الوصول</button></>
        }>
          <form id="bg-form" onSubmit={requestBG}>
            <Field label="سبب الطوارئ (8 أحرف على الأقل)"><textarea className="form-control" name="reason" rows={3} required /></Field>
            <p className="small muted">سيتحقق النظام برمز OTP عبر قناة SMS — سلوك مقيَّد في سجل التدقيق لمدة 30 دقيقة.</p>
          </form>
        </Modal>
      )}

      {bgOTP && (
        <Modal title="التحقق من OTP" icon="🔐" onClose={() => setBgOTP(null)} foot={
          <><button className="btn btn-line" onClick={() => setBgOTP(null)}>إلغاء</button>
          <button className="btn btn-primary btn-glow" onClick={() => verifyBG(bgOTP.id)}>تفعيل الوصول</button></>
        }>
          <div className="alert alert-warning">📲 بيئة العرض: الرمز يُسلَّم هنا ليُعاينه المدرب — في الإنتاج يُرسل عبر SMS/الحماية المدنية.</div>
          <div style={{ textAlign: 'center', margin: '18px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, background: 'var(--purple-100)', display: 'inline-block', padding: '12px 34px', borderRadius: 14, letterSpacing: 4 }} dir="ltr">{bgOTP.otp_plain}</div>
            <p className="small muted mt-12">صلاحية الطلب: {bgOTP.created_at?.slice(0, 19)}</p>
          </div>
          <Field label="أو أدخل الرمز المرسل يدوياً"><input className="form-control" dir="ltr" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" /></Field>
        </Modal>
      )}

      {rxModal && (
        <Modal title="إصدار روشتة إلكترونية" icon="💊" onClose={() => setRxModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setRxModal(false)}>إلغاء</button>
          <button type="submit" form="rx-form" className="btn btn-primary">إصدار وتوقيع</button></>
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
              <Field label="المدة"><input className="form-control" name="duration" placeholder="شهر / أسبوعان" /></Field>
            </div>
          </form>
        </Modal>
      )}

      {consentModal && (
        <Modal title="تسجيل موافقة رقمية" icon="✍️" onClose={() => setConsentModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setConsentModal(false)}>إلغاء</button>
          <button type="submit" form="cn-form" className="btn btn-primary">حفظ</button></>
        }>
          <form id="cn-form" onSubmit={createConsent}>
            <div className="form-row">
              <Field label="المستفيد"><input className="form-control" name="patient" required /></Field>
              <Field label="النوع">
                <select className="form-control" name="type">
                  <option value="record">اطلاع على الملف الطبي</option>
                  <option value="treatment">العلاج والمتابعة</option>
                  <option value="research">مشاركة بحثية (بإخفاء الهوية)</option>
                  <option value="sharing">مشاركة مع مؤسسات النظام</option>
                </select>
              </Field>
            </div>
            <Field label="الممنوح له"><input className="form-control" name="to" placeholder="الفريق المعالج / صيدلية …" /></Field>
            <Field label="النطاق"><input className="form-control" name="scope" placeholder="وصف دقيق لما يُسمح به" /></Field>
            <Field label="تاريخ الانتهاء (YYYY-MM-DD)"><input className="form-control" name="exp" placeholder="2027-09-20" /></Field>
          </form>
        </Modal>
      )}

      {planModal && (
        <Modal title="خطة ما بعد العلاج" icon="🗺️" onClose={() => setPlanModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setPlanModal(false)}>إلغاء</button>
          <button type="submit" form="plan-form" className="btn btn-primary">حفظ الخطة</button></>
        }>
          <form id="plan-form" onSubmit={createPlan}>
            <div className="form-row">
              <Field label="المستفيد"><input className="form-control" name="patient" required /></Field>
              <Field label="العنوان"><input className="form-control" name="title" placeholder="خطة ما بعد الاستقرار" /></Field>
            </div>
            <Field label="الملخص"><input className="form-control" name="summary" /></Field>
            <Field label="الغايات (سطر لكل غاية)"><textarea className="form-control" name="goals" rows={3} placeholder={'مراقبة الغليسيميا أسبوعياً\nالمشي 20 دقيقة يومياً'} /></Field>
            <Field label="المهام والمواعيد (سطر لكل مهمة)"><textarea className="form-control" name="schedule" rows={3} placeholder={'قياس صباحي\nجرعة غليمبريد بعد الفطور'} /></Field>
          </form>
        </Modal>
      )}
    </div>
  )
}