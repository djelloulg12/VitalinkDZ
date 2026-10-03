import { FormEvent, useEffect, useState } from 'react'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { countPending, enqueue, onOnline, syncNow } from '../../offline/sync'
import { BreakGlass, DutyShift, Followup, SosDispatch, Staff } from '../../types'
import { EmptyState, Field, Modal, PageHead, toast } from '../../ui'

type Tab = 'overview' | 'vitals' | 'alerts' | 'shifts' | 'sos' | 'glass'

interface AlertRow {
  id: number; patient_name: string; level: string; metric: string
  value: string; message: string; acknowledged: boolean; created_at: string | null
}

const METRIC_AR = (m: string) => ({ pulse: 'النبض', bp: 'الضغط', temp: 'الحرارة', spO2: 'الأكسجين', sugar: 'السكر' }[m] ?? m)

/** بوابة الممرض المتنقل — قياسات ميدانية، إنذارات، نوبات، SOS، وكسر الزجاج الميداني. */
export function NursePortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [q, setQ] = useState('')
  const [patient, setPatient] = useState('')
  const [bgModal, setBgModal] = useState(false)
  const [bgOTP, setBgOTP] = useState<BreakGlass | null>(null)
  const [otp, setOtp] = useState('')

  const fu = useApiData<Followup[]>('/followups', refresh)
  const alerts = useApiData<AlertRow[]>('/alerts?open_only=true', refresh)
  const shifts = useApiData<DutyShift[]>('/shifts', refresh)
  const team = useApiData<Staff[]>('/staff', refresh)
  const stats = useApiData<any>('/admin/stats', refresh)
  const dispatches = useApiData<SosDispatch[]>('/sos/dispatches', refresh)
  const bg = useApiData<BreakGlass[]>('/access/break-glass', refresh)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => { countPending().then((n) => { if (alive) setPending(n) }).catch(() => undefined) }
    load()
    const off = onOnline(() => { load(); setRefresh((x) => x + 1) })
    return () => { alive = false; off() }
  }, [])

  const doSync = async () => {
    setSyncing(true)
    try { const r = await syncNow(); setPending(r.pending); toast(`تمت المزامنة: رُفع ${r.pushed} وعُدم ${r.errors}`, r.errors ? 'warning' : 'success'); setRefresh((x) => x + 1) }
    catch (e: any) { toast(e.message, 'error') }
    finally { setSyncing(false) }
  }

  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged)
  const openDisp = (dispatches.data ?? []).filter((d) => d.status !== 'resolved')
  const s = stats.data
  const today = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' })

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ مهام اليوم'],
    ['vitals', '❤️ قياس ميداني'],
    ['alerts', `🔔 إنذارات (${openAlerts.length})`],
    ['shifts', '🗓️ نوباتي'],
    ['sos', `🚨 SOS (${openDisp.length})`],
    ['glass', '🛡️ كسر الزجاج'],
  ]

  const sendVitals = async (e: FormEvent) => {
    e.preventDefault()
    const v = q.split(/[,/]/).map((x) => x.trim())
    if (!patient.trim() || v.length < 3) { toast('أدخل المريض ثم القياسات بنمط: نبض/انقباضي/انبساطي/حرارة/O2/سكر', 'warning'); return }
    const body = {
      patient_name: patient.trim(), kind: 'vitals', date: new Date().toISOString().slice(0, 10),
      summary: 'قياس ميداني — بوابة الممرض المتنقل',
      vitals: { pulse: Number(v[0]) || 0, bpSys: Number(v[1]) || 0, bpDia: Number(v[2]) || 0, temp: Number(v[3]) || 0, spO2: Number(v[4]) || 0, sugar: Number(v[5]) || 0 },
      medications: [], attachments: [],
    }
    try {
      if (!navigator.onLine) {
        await enqueue({ op: 'create', entity: 'followup', id: null, payload: body as any })
        toast('لا اتصال — حُفظ محلياً وسيُزامَن تلقائياً عند عودة الشبكة', 'success')
      } else {
        await api('/followups', { method: 'POST', body: JSON.stringify(body) })
        toast('سُجل القياس وأُدخل لمحرك الإنذار التنبؤي', 'success')
      }
      setQ(''); setPatient(''); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const ack = async (id: number) => {
    try {
      const r = await api(`/alerts/${id}/ack`, { method: 'POST', body: JSON.stringify({ acknowledged: true }) })
      toast(r.acknowledged ? 'أُقرّ الإنذار وسجّل في Audit' : 'حدّث', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const setDisp = async (id: number, status: string) => {
    try {
      await api(`/sos/dispatches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'enroute' ? 'أُرسل فريقك للموقع — الفرقة البلدية مجهزة' : 'أُغلق البلاغ', 'success'); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const requestBG = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason') || '')
    try {
      const b = await api<BreakGlass>('/access/break-glass', { method: 'POST', body: JSON.stringify({ reason }) })
      setBgOTP(b); toast('طُلب الوصول الميداني — راجع OTP', 'success'); setBgModal(false)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const verifyBG = async (bgId: number) => {
    try {
      await api(`/access/break-glass/${bgId}/verify`, { method: 'POST', body: JSON.stringify({ otp }) })
      toast('وصل ميداني مفعّل 30 دقيقة — مقيَّد في السجل', 'success')
      setBgOTP(null); setOtp(''); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  return (
    <div className="container page portal-shell">
      <PageHead icon="🩺" title={`بوابة الممرض المتنقل`}
        sub={`مهامك اليوم لهذا اليوم — ${today}. قياسات ميدانية، إنذارات حيوية، نوبات، وإسناد SOS للحماية المدنية.`}
        actions={
          <>
            <span className="hero-chip">🌊 {user?.name}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('vitals')}>❤️ قياس جديد</button>
          </>
        } />

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          {pending > 0 && (
            <div className="alert alert-info mb-16">
              📶 <b>{pending} قياس</b> محفوظ محلياً بانتظار المزامنة — {syncing ? 'جارٍ الرفع…' : 'سيُرفع تلقائياً مع الشبكة'}
            </div>
          )}
          {openAlerts.length > 0 && (
            <div className="alert alert-danger mb-16">⚠️ <b>{openAlerts.length} إنذار فتح</b> — راجع تبويب الإنذارات وبدأ أولاً بالحرج.</div>
          )}
          <div className="grid grid-4 mb-16">
            {[
              ['🔔', openAlerts.length, 'إنذارات مفتوحة'],
              ['📋', fu.data?.length ?? 0, 'قياسات مسجلة'],
              ['🗓️', shifts.data?.length ?? 0, 'نوبات هذا الأسبوع'],
              ['🚨', s?.sos_fired ?? 0, 'بلاغات SOS'],
            ].map(([ic, n, l]) => (
              <div key={l as string} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--blue-050)' }}>{ic}</div>
                <div><div className="s-num">{n}</div><div className="s-lab">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">🧑‍⚕️</span> الفريق المرافق لي</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(team.data ?? []).slice(0, 5).map((m) => (
                  <div key={m.id} className="list-item">
                    <div className={`lico ${m.kind === 'doctor' ? '' : 'lico-teal'}`}>{m.kind === 'doctor' ? '🩺' : '🤝'}</div>
                    <div style={{ flex: 1 }}>
                      <b>{m.full_name}</b>
                      <div className="small muted">{m.specialty || 'ممرض'} · {m.wilaya_ar || ''}</div>
                    </div>
                    <a className="btn btn-ghost btn-sm" href={`tel:${m.phone || '0555001102'}`}>📞</a>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">📡</span> آخر القياسات الميدانية ({fu.data?.length ?? 0})</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(fu.data ?? []).slice(0, 6).map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-8" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                    <span className="small"><b>{f.patient_name}</b> — {f.kind_label ?? f.kind}</span>
                    <span className="badge badge-white" style={{ fontSize: 11 }}>{f.created_at?.slice(0, 16) || f.date}</span>
                  </div>
                ))}
                {(fu.data ?? []).length === 0 && <p className="small muted">لا قياسات بعد — سجّل أول قياس.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'vitals' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title"><span className="ico">❤️</span> تسجيل قياس ميداني</div>
            <form onSubmit={sendVitals}>
              <Field label="اسم المريض"><input className="form-control" required value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="الاسم الكامل" /></Field>
              <Field label="القياسات — نبض/انقباضي/انبساطي/حرارة/O2/سكر">
                <input className="form-control" dir="ltr" required value={q} onChange={(e) => setQ(e.target.value)} placeholder="78/131/85/36.6/97/1.1" />
              </Field>
              <div className="alert alert-info mb-12">💡 يُمرَّر القياس فوراً على محرك <b>الإنذار التنبؤي</b>؛ القيم الحرجية تُطلق Red Alert وتُشعِر الحماية المدنية.</div>
              <button className="btn btn-primary btn-glow" style={{ width: '100%' }}>{navigator.onLine ? '💾 حفظ وربط بالمحرك' : '📴 حفظ محلي (Offline First)'}</button>
            </form>
          </div>
          <div className="card">
            <div className="card-title"><span className="ico">📊</span> آخر قياس (آخر سجل)</div>
            {(() => { const last = (fu.data ?? []).find((f) => f.vitals && Object.keys(f.vitals).length); if (!last) return <p className="muted small">لا قياسات حتى الآن.</p>; const v = last.vitals; return (<>
              <div className="grid grid-3" style={{ gap: 10 }}>
                {[['🫀', v.pulse, 'نبض/د'], ['🩺', v.bpSys ? `${v.bpSys}/${v.bpDia}` : '—', 'ضغط'], ['🌡️', v.temp, 'حرارة'], ['🫁', v.spO2, 'O2%'], ['🍬', v.sugar, 'سكر']].map(([i, val, lab]) => (
                  <div key={lab as string} className="mini-stat">
                    <b style={{ fontSize: 22 }}>{i} {val ?? '—'}</b>
                    <span className="small muted">{lab}</span>
                  </div>
                ))}
              </div>
              <div className="small muted mt-12">{last.patient_name} <span dir="ltr">{last.created_at || ''}</span></div>
            </>) })()}
            <div className="card-title mt-16"><span className="ico">💾</span> حالة المزامنة</div>
            <div className="list-item mb-8"><div className="lico">📶</div><div style={{ flex: 1 }}>
              <b>{pending > 0 ? `${pending} قياس معلّق` : 'الكل متزامن'}</b>
              <div className="small muted">{syncing ? 'يرفع الآن…' : 'مزامنة تلقائية عند الاتصال'}</div>
            </div>
              <button className="btn btn-ghost btn-sm" disabled={syncing} onClick={doSync}>↻ مزامنة</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {openAlerts.length === 0 && <EmptyState icon="🔔" text="لا إنذارات مفتوحة — المؤشرات مستقرة." />}
          {openAlerts.map((a) => (
            <div key={a.id} className={`card ${a.level === 'danger' ? 'alert-card-red' : 'alert-card-orange'}`}>
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b>{a.level === 'danger' ? '⚠️ إنذار حرج' : '⚡ تنبيه'} — {METRIC_AR(a.metric)}: {a.value}</b>
                  <div className="small muted">{a.patient_name} · {a.message}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-white" style={{ fontSize: 11 }}>{a.created_at?.slice(0, 16)}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => ack(a.id)}>✔ سجّلتُه وأتحرك</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'shifts' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="grid grid-4 mb-16">
            {[...new Set((shifts.data ?? []).flatMap((x) => [x.date]))].slice(-4).reverse().map((d) => (
              <div key={d} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--orange-050)' }}>🗓️</div>
                <div><div className="s-num" style={{ fontSize: 15, direction: 'ltr' }}>{d}</div><div className="s-lab">نوبات اليوم في وحدتك</div></div>
              </div>
            ))}
          </div>
          {(shifts.data ?? []).map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>{t.staff_name}</b> <span className="badge badge-purple">{t.shift_label ?? t.shift}</span>
                  <div className="small muted">{t.unit} · {t.date}</div></div>
                <span className="small muted">{t.note}</span>
              </div>
            </div>
          ))}
          {(shifts.data ?? []).length === 0 && <EmptyState icon="🗓️" text="لا نوبات مسجلة للأسبوع بعد." />}
        </div>
      )}

      {tab === 'sos' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {openDisp.length === 0 && <EmptyState icon="🚨" text="لا بلاغات SOS نشطة." />}
          {openDisp.map((d) => (
            <div key={d.id} className="card" style={{ borderColor: d.status === 'fired' ? 'var(--red-100)' : 'var(--orange-100)', borderWidth: 2 }}>
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🚨 <span dir="ltr">{d.ref}</span></b>
                  <div className="small muted">{d.patient_name} · قناة {d.channel} · {d.created_at?.slice(0, 16)}</div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {d.maps ? <a className="btn btn-line btn-sm" href={d.maps} target="_blank" rel="noreferrer">📍 موقع</a> : null}
                  <button className="btn btn-soft btn-sm" onClick={() => setDisp(d.id, d.status === 'fired' ? 'enroute' : 'resolved')}>
                    {d.status === 'fired' ? '🧭 مباشرة للموقع' : '✔ أنهيتُ التدخل'}
                  </button>
                </div>
              </div>
              {d.detail && <p className="small mt-8">{d.detail}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'glass' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="alert alert-warning">🛡️ <b>كسر الزجاج</b> — وصول طارئ مؤطر للبيانات خارج الصلاحيات: يطلب رمز OTP، يعمل 30 دقيقة، ويبقى في سجل التدقيق بحساب صاحبه.</div>
          <div className="store">
            <button className="btn btn-primary" onClick={() => setBgModal(true)}>🧊 طلب وصول ميداني طارئ</button>
          </div>
          {(bg.data ?? []).map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🛡️ {b.requester}</b> <span className="badge badge-purple">{b.role}</span>
                  <p className="small muted mt-8">{b.reason}</p></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${b.status === 'active' ? 'badge-red' : b.status === 'released' ? 'badge-gray' : 'badge-orange'}`}>
                    {b.status === 'active' ? `مفعّل حتى ${b.expires_at?.slice(11, 16) || ''}` : b.status === 'released' ? 'مغلق' : 'بOTP'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {bgModal && (
        <Modal title="كسر الزجاج الميداني" icon="🛡️" onClose={() => setBgModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setBgModal(false)}>إلغاء</button>
          <button type="submit" form="bg-form" className="btn btn-primary btn-glow">طلب OTP</button></>
        }>
          <form id="bg-form" onSubmit={requestBG}>
            <Field label="سبب الطوارئ (8 أحرف على الأقل)"><textarea className="form-control" name="reason" rows={3} required placeholder="حالة حرجة: تعذر فتح الملف…" /></Field>
            <p className="small muted">التفعيل مقيَّد 30 دقيقة مع تتبع Audit. الرمز يُسلم في بيئة العرض ليُعاينه المُدرِّب.</p>
          </form>
        </Modal>
      )}

      {bgOTP && (
        <Modal title="التحقق OTP" icon="🔐" onClose={() => setBgOTP(null)} foot={
          <><button className="btn btn-line" onClick={() => setBgOTP(null)}>إلغاء</button>
          <button className="btn btn-primary btn-glow" onClick={() => verifyBG(bgOTP.id)}>تفعيل الوصول</button></>
        }>
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, background: 'var(--purple-100)', display: 'inline-block', padding: '12px 34px', borderRadius: 14, letterSpacing: 4 }} dir="ltr">{bgOTP.otp_plain}</div>
          </div>
          <Field label="أو أدخل الرمز"><input className="form-control" dir="ltr" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" /></Field>
        </Modal>
      )}
    </div>
  )
}