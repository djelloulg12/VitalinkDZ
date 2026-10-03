import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { getPosition, mapsLink } from '../../platform/geo'
import { Followup, CarePlan, Consent, Prescription, Staff } from '../../types'
import { EmptyState, Field, PageHead, toast } from '../../ui'

type Tab = 'overview' | 'vitals' | 'rx' | 'care' | 'team' | 'sos'

interface AlertRow {
  id: number; patient_name: string; level: string; metric: string
  value: string; message: string; acknowledged: boolean; created_at: string | null
}

/** بوابة المستفيد (ملفه الصحي) — قياساتي، روشتي، الموافقات والخطة، الفريق، والاستغاثة. */
export function PatientPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [rq, setRq] = useState('')
  const [patient, setPatient] = useState(user?.name || '')
  const [sosRec, setSosRec] = useState('')

  const fu = useApiData<Followup[]>(patient ? `/followups?patient=${encodeURIComponent(patient)}` : '/followups', refresh)
  const myRx = useApiData<Prescription[]>(patient ? `/prescriptions?patient=${encodeURIComponent(patient)}` : '/prescriptions', refresh)
  const consents = useApiData<Consent[]>(patient ? `/consents?patient=${encodeURIComponent(patient)}` : '/consents', refresh)
  const plans = useApiData<CarePlan[]>(patient ? `/careplans?patient=${encodeURIComponent(patient)}` : '/careplans', refresh)
  const alerts = useApiData<AlertRow[]>('/alerts?open_only=true', refresh)
  const team = useApiData<Staff[]>('/staff', refresh)

  const myAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged && (!patient || a.patient_name === patient))
  const myPlan = (plans.data ?? []).find((p) => p.patient_name === patient) || (plans.data ?? [])[0]
  const last = (fu.data ?? []).find((f) => f.vitals && Object.keys(f.vitals).length)
  const v = last?.vitals ?? {}

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ ملفي الصحي'],
    ['vitals', '❤️ قياساتي'],
    ['rx', '💊 روشتي'],
    ['care', '📋 الموافقات والخطة'],
    ['team', '🧑‍⚕️ فريقي'],
    ['sos', '🆘 طوارئ'],
  ]

  const addVitals = async (e: FormEvent) => {
    e.preventDefault()
    const parts = rq.split(/[,/]/).map((x) => x.trim())
    if (!patient.trim() || parts.length < 3) { toast('أدخل اسمك ثم القياسات بنمط: نبض/انقباضي/انبساطي/حرارة/O2/سكر', 'warning'); return }
    try {
      await api('/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_name: patient.trim(), kind: 'vitals', date: new Date().toISOString().slice(0, 10),
          summary: 'متابعة ذاتية من بوابة المستفيد',
          vitals: { pulse: Number(parts[0]) || 0, bpSys: Number(parts[1]) || 0, bpDia: Number(parts[2]) || 0, temp: Number(parts[3]) || 0, spO2: Number(parts[4]) || 0, sugar: Number(parts[5]) || 0 },
          medications: [], attachments: [],
        }),
      })
      toast('حُفظ قياسك ودخل محرك الإنذار الذكي', 'success'); setRq(''); setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const sos = async () => {
    const fix = await getPosition(7000)
    const located = !!(fix.lat || fix.lng)
    const detail = `${patient} يطلب مساعدة فورية${located ? ` — الموقع بدقة ${Math.round(fix.acc)}م` : ''}`
    try {
      const r = await api<{ ref: string }>('/sos/relay', { method: 'POST', body: JSON.stringify({ patient_name: patient || user?.name || '', lat: fix.lat, lng: fix.lng, detail, channel: 'both' }) })
      setSosRec(r.ref)
    } catch { }
    const url = `sms:${user?.phone || '0555001102'}?&body=${encodeURIComponent(
      '🆘 SOS رعايتي — المستفيد: ' + patient +
      (located ? ` — موقعي: ${mapsLink(fix.lat, fix.lng)}` : ' — فعّل GPS لتحديد الموقع') + ' — يرجى التدخل')}`
    window.location.href = url
    toast(located ? `أُرسل البلاغ وأُثبّت موقعك بدقة ${Math.round(fix.acc)} متر` : 'أُرسل البلاغ — لم يُحدّد الموقع، فعّل GPS وحاول مجدداً', located ? 'success' : 'warning')
    setTab('overview')
  }

  return (
    <div className="container page portal-shell">
      <PageHead icon="🧑‍🦳" title="بوابة المستفيد — ملفي الصحي"
        sub="تابع قياساتك، روشتك، موافقاتك وخطة ما بعد العلاج، وفريقك؛ واطلب الاستغاثة بضغطة واحدة."
        actions={
          <>
            <span className="hero-chip">👤 {user?.name}</span>
            <Link className="btn btn-gold btn-sm" to="/vital">📱 تطبيق Vital DZ</Link>
          </>
        } />

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          {myAlerts.length > 0 && (
            <div className="alert alert-danger mb-16">⚠️ لديك {myAlerts.length} تنبيه صحي — راجع «قياساتي» واعرض بياناتك على طبيبك.</div>
          )}
          <div className="grid grid-4 mb-16">
            {[
              ['📈', (fu.data ?? []).length, 'قياس مسجل'],
              ['💊', (myRx.data ?? []).length, 'روشتة'],
              ['✍️', (consents.data ?? []).length, 'موافقة'],
              ['🆘', myAlerts.length, 'إنذار نشط'],
            ].map(([ic, n, l]) => (
              <div key={l as string} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--green-050)' }}>{ic}</div>
                <div><div className="s-num">{n}</div><div className="s-lab">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">📈</span> أحدث مؤشراتك الحيوية</div>
              {last ? (
                <div className="grid grid-3" style={{ gap: 10 }}>
                  {[['🫀', v.pulse, 'نبض/د'], ['🩺', v.bpSys ? `${v.bpSys}/${v.bpDia ?? '?'}` : '—', 'ضغط'], ['🌡️', v.temp, 'حرارة'], ['🫁', v.spO2, 'O2%'], ['🍬', v.sugar, 'سكر']].map(([i, val, lab]) => (
                    <div key={lab as string} className="mini-stat" style={{ padding: 12 }}>
                      <b style={{ fontSize: 20 }}>{i} {val ?? '—'}</b>
                      <div className="small muted">{lab}</div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon="📈" text="لا قياسات بعد — سجّل أول قياس من تبويب قياساتي." />}
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">🗺️</span> خطة ما بعد العلاج</div>
              {myPlan ? (
                <>
                  <b>{myPlan.title}</b>
                  <p className="small muted">{myPlan.summary}</p>
                  {myPlan.goals.map((g, i) => (
                    <div key={i} className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
                      <span>{g.done ? '🟢' : '⚪'}</span><b style={{ fontSize: 14 }}>{g.g}</b>
                    </div>
                  ))}
                </>
              ) : <EmptyState icon="🗺️" text="لا خطة مسجلة بعد." />}
            </div>
          </div>
        </>
      )}

      {tab === 'vitals' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title"><span className="ico">❤️</span> تسجيل قياس ذاتي</div>
            <form onSubmit={addVitals}>
              <Field label="اسمك"><input className="form-control" value={patient} onChange={(e) => setPatient(e.target.value)} required /></Field>
              <Field label="القياسات — نبض/انقباضي/انبساطي/حرارة/O2/سكر">
                <input className="form-control" dir="ltr" value={rq} onChange={(e) => setRq(e.target.value)} placeholder="78/131/85/36.6/97/1.1" required />
              </Field>
              <button className="btn btn-primary btn-glow" style={{ width: '100%' }}>💾 حفظ القياس</button>
            </form>
          </div>
          <div className="card">
            <div className="card-title"><span className="ico">📄</span> سجل قياساتي ({fu.data?.length ?? 0})</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(fu.data ?? []).slice(0, 10).map((f) => (
                <div key={f.id} className="list-item">
                  <div className="lico" style={{ width: 38, height: 38, fontSize: 18 }}>📈</div>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 13 }}>{f.kind_label ?? f.kind}</b>
                    <div className="small muted">
                      {f.vitals?.pulse ? `نبض ${f.vitals.pulse} · ` : ''}{f.vitals?.bpSys ? `ضغط ${f.vitals.bpSys}/${f.vitals.bpDia} · ` : ''}{f.vitals?.temp ? `${f.vitals.temp}° · ` : ''}{f.vitals?.spO2 ? `O2 ${f.vitals.spO2}%` : ''}
                    </div>
                  </div>
                  <span className="badge badge-white" style={{ fontSize: 10 }}>{f.date || f.created_at?.slice(0, 10)}</span>
                </div>
              ))}
              {(fu.data ?? []).length === 0 && <p className="small muted">لا قياسات بعد.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'rx' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {(myRx.data ?? []).map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div><b>🧾 <span dir="ltr">{r.ref}</span> — {r.patient_name}</b>
                  <span className={`badge ${r.status === 'open' ? 'rx-status-open' : 'rx-status-dispensed'}`}>{r.status === 'open' ? 'بانتظار الصرف' : 'صُرفت'}</span>
                  <div className="small muted">{r.doctor_name} · {r.institution}{r.purpose ? ' — ' + r.purpose : ''}</div></div>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {r.items.map((it, i) => (
                  <div key={i} className="rx-item"><b>{it.drug}</b><span className="small muted">{it.strength} · {it.dosage}</span><span className="badge badge-white">×{it.qty}</span></div>
                ))}
              </div>
            </div>
          ))}
          {(myRx.data ?? []).length === 0 && <EmptyState icon="💊" text="لا وصفات مسجلة — تصلك الروشتات الموقعة من طبيبك هنا." />}
        </div>
      )}

      {tab === 'care' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title"><span className="ico">✍️</span> موافقاتي الرقمية ({consents.data?.length ?? 0})</div>
            {(consents.data ?? []).map((c) => (
              <div key={c.id} className="list-item mb-8">
                <div className="lico">{c.revoked ? '🚫' : '✅'}</div>
                <div style={{ flex: 1 }}>
                  <b>{c.type_label}</b>
                  <div className="small muted">{c.scope} · {c.granted_to} · تنتهي: {c.expires_on || 'غير محدد'}</div>
                </div>
                <span className={`badge ${c.revoked ? 'badge-gray' : 'badge-green'}`}>{c.revoked ? 'ملغاة' : 'سارية'}</span>
              </div>
            ))}
            {(consents.data ?? []).length === 0 && <EmptyState icon="✍️" text="لا موافقات — كل موافقة سُجلت بإرادتك تُعرض هنا بشفافية." />}
          </div>
          <div className="card">
            <div className="card-title"><span className="ico">🗺️</span> خطة ما بعد العلاج</div>
            {myPlan ? (
              <>
                <b>{myPlan.title}</b>
                <p className="small muted">{myPlan.summary}</p>
                <div className="card-title mt-12"><span className="ico">⏰</span> الجدول</div>
                {myPlan.schedule.map((t, i) => (
                  <div key={i} className="flex justify-between" style={{ padding: '6px 0' }}>
                    <b style={{ fontSize: 14 }}>{t.task}</b><span className="badge badge-purple">{t.when}</span>
                  </div>
                ))}
              </>
            ) : <EmptyState icon="🗺️" text="لا خطة مسجلة." />}
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="card">
          <div className="card-title"><span className="ico">🧑‍⚕️</span> فريق رعايتي ({team.data?.length ?? 0})</div>
          {(team.data ?? []).map((m) => (
            <div key={m.id} className="flex items-center gap-8" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className={`avatar ${m.kind === 'doctor' ? 'avatar-2' : 'avatar-4'}`}>{m.full_name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{m.full_name}</b>
                <div className="small muted">{m.specialty || 'ممرض'} · {m.wilaya_ar || ''}</div>
              </div>
              <a className="btn btn-ghost btn-sm" href={`tel:${m.phone || '0555001102'}`}>📞 اتصل</a>
            </div>
          ))}
        </div>
      )}

      {tab === 'sos' && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div className="big">🆘</div>
          <b style={{ fontSize: 19 }}>طوارئ — الحماية المدنية (الرقم الوطني 14)</b>
          <p className="muted small mt-8">يُسجل بلاغك في النظام، ويوصل فريق الإسعاف، وتفتح رسالة SMS فورية حتى دون إنترنت.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-danger sosh-btn" style={{ padding: '14px 26px' }} onClick={sos}>🚨 أرسل البلاغ</button>
            <a className="btn btn-gold sosh-btn" href="tel:14">📞 اتصال 14</a>
          </div>
          {sosRec && <div className="small mt-12" style={{ background: 'var(--red-050)', borderRadius: 10, padding: 10 }}>بلاغك مسجل: <b dir="ltr">{sosRec}</b> — يُتابَع في لوحة الحماية المدنية والممرض.</div>}
        </div>
      )}
    </div>
  )
}