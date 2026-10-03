import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useApiData } from '../auth'
import { api } from '../api'
import { Staff, Prescription, CarePlan, Consent, PsychScreen } from '../types'
import { qrSvg } from '../printutil'
import { toast, Field } from '../ui'
import { enqueue, queueList, countPending, syncNow, onOnline } from '../offline/sync'
import { getPosition, mapsLink } from '../platform/geo'
import type { GeoFix } from '../platform/geo'

type Screen = 'home' | 'vitals' | 'sos' | 'pills' | 'team' | 'offline' | 'rx' | 'plan' | 'consent' | 'psych'

const ZARIT = [
  'تشعر أنك بحاجة لفترات راحة لنفسك؟',
  'تشعر بالإرهاق عند التفكير بما تقدمه للرعاية؟',
  'تجد صعوبة في تنظيم وقتك والرعاية معاً؟',
  'تقلق من مستقبل من ترعاه عندما لا تكون موجوداً؟',
  'تجد الدعم العائلي غير كافٍ؟',
]

export function VitalDZ() {
  const { user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [screen, setScreen] = useState<Screen>('home')
  const [q, setQ] = useState('')
  const [patient, setPatient] = useState('')
  const [sosStatus, setSosStatus] = useState('')
  const [sosRef, setSosRef] = useState('')
  const [pills, setPills] = useState<{ name: string; time: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('vital_pills') || '[]') } catch { return [] }
  })
  const [pillName, setPillName] = useState('')
  const [pillTime, setPillTime] = useState('08:00')
  const [speaking, setSpeaking] = useState(false)
  const [seenReport, setSeenReport] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [dementia, setDementia] = useState(() => localStorage.getItem('vital_dementia') === '1')
  const [clock, setClock] = useState('')
  const [darijaOpen, setDarijaOpen] = useState(false)
  const [darijaMsg, setDarijaMsg] = useState('')
  const [darijaRep, setDarijaRep] = useState('')
  const [zarit, setZarit] = useState<number[]>([1, 1, 1, 1, 1])
  const [psychRes, setPsychRes] = useState<PsychScreen | null>(null)
  const [slot, setSlot] = useState('')
  const [sessionReason, setSessionReason] = useState('')
  const team = useApiData<Staff[]>('/staff', 0)
  const rx = useApiData<Prescription[]>('/prescriptions', 0)
  const plans = useApiData<CarePlan[]>('/careplans', 0)
  const consents = useApiData<Consent[]>('/consents', 0)
  const recRef = useRef<any>(null)
  const [installEvt, setInstallEvt] = useState<any>(null)
  const isNativeApp = (() => { const C = (window as any).Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()) })()
  const onAndroid = /android/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const installApp = async () => {
    if (!installEvt) { toast(onAndroid ? 'افتح عبر المزيد ثم «إضافة إلى الشاشة الرئيسية»' : 'من قائمة المتصفح: مشاركة ثم «إضافة للشاشة الرئيسية»', 'warning'); return }
    installEvt.prompt()
    const choice = await installEvt.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') { setInstallEvt(null); toast('تم تثبيت رعايتي على هاتفك — ستجده على الشاشة الرئيسية', 'success') }
  }

  const setServer = () => {
    const cur = localStorage.getItem('vdz_api') || 'http://10.0.2.2:8100'
    const v = window.prompt('عنوان خادم المنصة (يُستخدم داخل التطبيق الأصلي):', cur)
    if (v && v.trim()) { localStorage.setItem('vdz_api', v.trim()); toast('حُفظ الخادم — أعد تسجيل الدخول', 'success') }
  }

  useEffect(() => {
    localStorage.setItem('vital_dementia', dementia ? '1' : '0')
  }, [dementia])

  useEffect(() => {
    if (!dementia) return
    const tick = () => {
      const d = new Date()
      setClock(d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) + ' — ' + d.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' }))
    }
    tick()
    const t = setInterval(tick, 15000)
    return () => clearInterval(t)
  }, [dementia])

  useEffect(() => {
    queueList().then((q) => setPendingCount(q.length)).catch(() => {})
    const unsub = onOnline(() => {
      countPending().then((n) => {
        setPendingCount(n)
        if (n > 0) {
          syncNow().then((r) => {
            setPendingCount(r.pending)
            if (r.pushed > 0) toast('تمت المزامنة التلقائية للمؤشرات المعلّقة', 'success')
          }).catch(() => {})
        }
      }).catch(() => {})
    })
    return () => { unsub() }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    localStorage.setItem('vital_pills', JSON.stringify(pills))
  }, [pills])

  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const locate = () => {
    if (!navigator.geolocation) { setGeo(null); return }
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeo(null),
      { timeout: 6000 },
    )
  }

  /* نبض الحضور الدائم — يبقى التطبيق متصلاً بالمنصة مع موقعه كل 60 ثانية */
  useEffect(() => {
    if (!online) return
    const C = (window as any).Capacitor
    const app = C && C.isNativePlatform && C.isNativePlatform() ? 'android' : 'vitaldz'
    const dev = `${user?.role || 'vital'}-${user?.id || 'guest'}`
    let cache: { lat: number; lng: number } | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    const freshen = async () => {
      const f = await getPosition(4000)
      if (f.lat || f.lng) cache = { lat: f.lat, lng: f.lng }
    }
    const beat = async () => {
      try {
        await api('/presence', {
          method: 'POST',
          body: JSON.stringify({ device: dev, app, patient_name: patient || user?.name || '', role: user?.role || '', lat: cache?.lat || 0, lng: cache?.lng || 0, acc: 0 }),
        })
      } catch { /* يبقى محلياً حتى عودة الشبكة */ }
    }
    freshen()
    beat()
    timer = setInterval(() => { beat(); freshen() }, 60000)
    return () => { if (timer) clearInterval(timer) }
  }, [online])

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ar-DZ'
      u.rate = 0.95
      window.speechSynthesis.speak(u)
    }
  }

  const sendVitals = async (e: FormEvent) => {
    e.preventDefault()
    const v = q.split(/[,/]/).map((x) => x.trim())
    if (v.length < 3 || !patient.trim()) { toast('أدخل المريض ثم القياسات بالشكل المطلوب', 'warning'); return }
    const body = {
      patient_name: patient.trim(), kind: 'vitals', date: new Date().toISOString().slice(0, 10),
      summary: 'قياس تطبيق Vital DZ',
      vitals: { pulse: Number(v[0]) || 0, bpSys: Number(v[1]) || 0, bpDia: Number(v[2]) || 0, temp: Number(v[3]) || 0, spO2: Number(v[4]) || 0, sugar: Number(v[5]) || 0 },
      medications: [], attachments: [],
    }
    try {
      if (!online) {
        await enqueue({ op: 'create', entity: 'followup', id: null, payload: body })
        setPendingCount((n) => n + 1)
        toast('لا اتصال — حُفظ القياس محلياً وستُزامَن تلقائياً', 'success')
      }
      else await api('/followups', { method: 'POST', body: JSON.stringify(body) })
      setQ(''); setPatient('')
      setSeenReport(`نبض ${body.vitals.pulse} · ضغط ${body.vitals.bpSys}/${body.vitals.bpDia} · حرارة ${body.vitals.temp || '—'} · O2 ${body.vitals.spO2 || '—'}`)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const syncNowAll = async () => {
    const p = await countPending().catch(() => 0)
    if (!p) { toast('لا سجلات معلقة', 'success'); return }
    try {
      const r = await syncNow()
      setPendingCount(r.pending)
      toast(r.pushed > 0 ? `تمت المزامنة: ${r.pushed} سجل` : 'لا تغييرات معلقة', 'success')
    } catch (err: any) { toast('فشلت المزامنة: ' + err.message, 'error') }
  }

  const sos = async () => {
    setSosStatus('جارٍ تثبيت موقعك الدقيق…')
    const fix: GeoFix = await getPosition(8000)
    const located = !!(fix.lat || fix.lng)
    const detail = `${patient ? 'المريض: ' + patient : ''}${located ? ` — الموقع بدقة ${Math.round(fix.acc)}م (${fix.source})` : ' — لم يحدّد الموقع (فعّل GPS)'}`
    let ref = ''
    if (online) {
      try {
        const r = await api<{ ref: string }>('/sos/relay', {
          method: 'POST',
          body: JSON.stringify({ patient_name: patient || user?.name || '', lat: fix.lat, lng: fix.lng, detail, channel: 'both' }),
        })
        setSosRef(r.ref); ref = r.ref
      } catch { /* SMS يبقى خطة بديلة */ }
    }
    const smsBody =
      '🆘 SOS رعايتي' + (ref ? ` (${ref})` : '') + (patient ? ' — المريض: ' + patient : '') +
      (located ? ` — موقعي: ${mapsLink(fix.lat, fix.lng)}` : ' — بدون تحديد موقع (فعّل GPS)') +
      (online ? '' : ' — (بدون إنترنت: نجا عند وصول الشبكة)')
    setTimeout(() => {
      window.location.href = `sms:${user?.phone || '0555001102'}?&body=${encodeURIComponent(smsBody)}`
      setSosStatus(
        'أُرسل بلاغ الاستغاثة' + (ref ? ` — مرجع: ${ref}` : '') +
        (located ? ` — موقعك مُثبَّت بدقة ${Math.round(fix.acc)} متر` : ' — لم يُحدّد الموقع؛ جرّب خارج البناية مع تشغيل GPS') +
        ' — يتحرك فريق الإنقاذ فوراً',
      )
      setScreen('sos')
    }, 700)
  }

  const endSOS = () => { window.location.href = 'tel:14'; setSosStatus('اتصال بالرقم الوطني 14…') }

  const remindNow = () => {
    if (!online) { toast('التذكير يعمل محلياً حتى دون إنترنت', 'success'); return }
    if (!('Notification' in window)) { toast('المتصفح لا يدعم الإشعارات', 'warning'); return }
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification('💊 رعايتي — تذكير الأدوية', { body: 'حان موعد جرعتك التالية. لا تنسَ الدواء، وكل صحة!' })
      toast('حُفظ التذكير الذكي', 'success')
    })
  }

  const addPill = () => {
    if (!pillName.trim()) return
    setPills([...pills, { name: pillName.trim(), time: pillTime }])
    setPillName('')
  }

  const listen = (cb: (t: string) => void) => {
    const W = window as any
    if (!W.SpeechRecognition && !W.webkitSpeechRecognition) { toast('هذا الجهاز لا يدعم الإدخال الصوتي', 'warning'); return }
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'ar-DZ'
    setSpeaking(true)
    rec.onresult = (ev: any) => {
      cb(ev.results[0][0].transcript)
      setSpeaking(false)
    }
    rec.onerror = () => { setSpeaking(false); toast('لم يُسمع صوت واضح — حاول مجدداً', 'warning') }
    rec.onend = () => setSpeaking(false)
    recRef.current = rec
    rec.start()
  }

  const speakMeasure = () => listen((t) => { setQ(t); toast('التقطتُ قياساتك — ضعها بصيغة: نبض/انقباضي/انبساطي/حرارة/O2/سكر', 'success') })

  const runZarit = async (e: FormEvent) => {
    e.preventDefault()
    if (!patient.trim()) { toast('أدخل اسم المستفيد أولاً', 'warning'); return }
    try {
      const r = await api<PsychScreen>('/psych/screen', {
        method: 'POST',
        body: JSON.stringify({ patient_name: patient.trim(), kind: 'caregiver', answers: zarit }),
      })
      setPsychRes(r)
      toast(`نتيجة الفحص: ${r.level} (${r.score})`, 'success')
    } catch (err: any) { toast(err.message, 'error') }
  }

  const requestSession = async () => {
    try {
      await api('/psych/sessions', {
        method: 'POST',
        body: JSON.stringify({ patient_name: patient.trim() || user?.name || '', specialist: 'د. نفسي مناوب', kind: 'video', slot, reason: sessionReason || 'دعم نفسي' }),
      })
      toast('حُجزت الجلسة — سيؤكدها المختص قريباً', 'success')
      setSlot(''); setSessionReason('')
    } catch (err: any) { toast(err.message, 'error') }
  }

  // -------- مساعد الدارجة --------
  const darijaReply = (t: string): string => {
    const s = t.trim()
    if (/تذكير|دواء|دوائي|الأدو/.test(s)) { setScreen('pills'); return 'فتحنا الصيدلية ديالك! شنو الدواء لي تاخدو؟' }
    if (/قياس|مؤشرات|الضغط|نبض|حرارة/.test(s)) { setScreen('vitals'); return 'مليح، قول لي القياسات براحة ونحوافظ عليهم.' }
    if (/استغاثة|sos|نجدوني|خطر/.test(s)) { setScreen('sos'); return 'واخا، دابا نوجهك لزر الاستغاثة. خاف لا، نحنا هنا!' }
    if (/طبيب|دكتور|فريقي|ممرض/.test(s)) { setScreen('team'); return 'هاو الفريق الطبي ديالك.' }
    if (/روشتي|وصفة|دواء اللي.? كتب|صيدلية/.test(s)) { setScreen('rx'); return 'هاو الروشتي الإلكترونية ديالك.' }
    if (/نفسيتي|ملول|محزن|قلق/.test(s)) { setScreen('psych'); return 'ما تفكرش بوحدك — نتا مهم. ها ميزان الراحة وطلب الجلسة.' }
    if (/وقت|ساعة|شنو الوقت/.test(s)) { const d = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }); speak('الوقت دابا ' + d); return 'الوقت دابا ' + d }
    if (/شكرا|بارك الله|سلام|باك/.test(s)) { speak('والصحة والسلامة، روحني تعالى!' ); return 'العفو! نتوما في القلب.' }
    setScreen('home')
    return 'نفهمك؟ قول: تذكير الدواء، قياس، استغاثة، فريقي، روشتي، نفسيتي، أو الوقت.'
  }

  const darijaTalk = () => {
    setDarijaOpen(true)
    listen((t) => {
      const reply = darijaReply(t)
      setDarijaMsg(t)
      setDarijaRep(reply)
      if (!/(الوقت|شكرا|بارك الله|سلام|باك)/.test(t)) {
        const u = new SpeechSynthesisUtterance(reply.replace(/[^\u0600-\u06FF\s]/g, ''))
        u.lang = 'ar-DZ'; u.rate = 0.95
        window.speechSynthesis.speak(u)
      }
    })
  }

  const B: { icon: string; label: string; sub: string; s: Screen }[] = [
    { icon: '❤️', label: 'قياس المؤشرات', sub: 'نبض/ضغط/حرارة', s: 'vitals' },
    { icon: '🆘', label: 'استغاثة SOS', sub: 'SMS + الحماية المدنية', s: 'sos' },
    { icon: '💊', label: 'تذكير الدواء', sub: 'ذهبي ذكي', s: 'pills' },
    { icon: '🧾', label: 'روشتي', sub: 'الوصفة الإلكترونية', s: 'rx' },
    { icon: '🗺️', label: 'خطَّتي', sub: 'ما بعد العلاج', s: 'plan' },
    { icon: '✍️', label: 'موافقا', sub: 'الموافقات الرقمية', s: 'consent' },
    { icon: '🧠', label: 'نفسيتي', sub: 'الراحة والدعم', s: 'psych' },
    { icon: '🏥', label: 'فريقي الطبي', sub: 'الأطباء والممرضون', s: 'team' },
    { icon: '📶', label: 'المزامنة', sub: pendingCount + ' معلق', s: 'offline' },
  ]

  const myRx = (rx.data || []).filter((r) => r.patient_name === patient || patient === '')
  const myPlan = (plans.data || []).find((p) => p.patient_name === patient || patient === '')
  const myConsents = (consents.data || []).filter((c) => c.patient_name === patient || patient === '')

  return (
    <div className={`vitaldz-app ${dementia ? 'dementia-mode' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-logo">📱</div>
            <div className="brand-text"><b>Vital <span>DZ</span></b><small>تطبيق كبار السن — {online ? 'متصل' : 'بدون إنترنت'}</small></div>
          </div>
          <div style={{ flex: 1 }} />
          <span className={`conn-pill ${online ? 'conn-on' : 'conn-off'}`}>
            {online ? (pendingCount > 0 ? `📶 ${pendingCount} معلّق` : '● متصل دائمًا') : '● المزامنة عند الاتصال'}
          </span>
          <button className={`chip-btn ${dementia ? 'active' : ''}`} onClick={() => setDementia(!dementia)} title="الوضع الخرفي كبار" style={{ color: dementia ? '#fff' : undefined }}>
            {dementia ? '🧓 وضع بسيط' : '🌙 سهولة'}
          </button>
        </div>
      </header>

      <div className="vital-body">
        {screen === 'home' && (
          <>
            <div className="card vital-hero" style={{ textAlign: 'center', padding: '26px 18px' }}>
              {dementia && (
                <div className="dementia-clock" style={{ display: 'grid', gap: 8 }}>
                  <b style={{ fontSize: 34 }}>🕐 {clock}</b>
                  <small>نظّمنا لك كل شيء — اضغط على الأيقونة الكبيرة</small>
                </div>
              )}
              <div className="small muted dementia-hide">{dementia ? '' : 'المستفيد / المرافق'}</div>
              {!dementia && <b style={{ fontSize: 20 }}>{user?.name || 'مستخدم المنظومة'}</b>}
              {dementia && <b style={{ fontSize: 26 }}>{user?.name || 'أهلًا بك'}</b>}
              <div className="small muted dementia-hide">بطاقة المريض (QR) — تُتلى من طرف الجوال</div>
              {patient.trim() && <div className="qr" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: qrSvg(`RIAYATI-DZ|VITAL|${patient.trim()}`, 100) }} />}
              <div className="flex gap-8 mt-12 dementia-hide" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link className="btn btn-gold btn-sm" to="/">🧑‍💻 المنظومة الكاملة</Link>
                {!isNativeApp && <button className="btn btn-line btn-sm" style={{ borderColor: 'rgba(255,255,255,.4)', color: '#EAF7EF' }} onClick={installApp}>📲 تثبيت التطبيق على الهاتف</button>}
                {isNativeApp && <button className="btn btn-line btn-sm" style={{ borderColor: 'rgba(255,255,255,.4)', color: '#EAF7EF' }} onClick={setServer}>🌐 إعداد الخادم</button>}
              </div>
            </div>
            {/* زر النجدة العملاق — ضغطة واحدة ترسل الموقع إلى الحماية المدنية */ }
            <div className="card" style={{ padding: 15, marginTop: 14, border: '2px solid #DC2626', background: 'linear-gradient(140deg,#FFF5F5,#FEF2F2)' }}>
              <button className="btn btn-danger sosh-btn sos-huge" onClick={sos}
                      style={{ width: '100%', background: '#DC2626', borderColor: '#991B1B', boxShadow: '0 18px 34px -14px rgba(220,38,38,.7)' }}>
                🆘 طلب الطوارئ — SOS
              </button>
              <div className="small" style={{ marginTop: 8, textAlign: 'center', color: '#991B1B' }}>ضغطة واحدة تُثبّت موقعك وتبلغ الحماية المدنية (14) وعائلتك فوراً</div>
            </div>
            <div className="grid grid-3 vital-grid">
              {B.map((b) => (
                <button key={b.s} className="card vital-btn" onClick={() => setScreen(b.s)}>
                  <div className="big">{b.icon}</div>
                  <b>{b.label}</b>
                  <div className="small muted dementia-hide">{b.sub}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {screen === 'vitals' && (
          <div className="card">
            <div className="flex gap-8 mb-12">
              <button className="btn btn-ghost btn-sm" onClick={() => setScreen('home')}>← رجوع</button>
            </div>
            <div className="card-title"><span className="ico">❤️</span> قياس المؤشرات الحيوية (نبض/انقباضي/انبساطي/حرارة/O2/سكر)</div>
            <form onSubmit={sendVitals} className="mb-12">
              <div className="form-group"><label>اسم المريض</label>
                <input className="form-control" required value={patient} onChange={(e) => setPatient(e.target.value)} /></div>
              <div className="form-group">
                <label>القياسات — مثال: 78/130/80/36.6/97/1.1</label>
                <div className="flex gap-8">
                  <input className="form-control" dir="ltr" value={q} onChange={(e) => setQ(e.target.value)} placeholder="79/131/85/36.5/96/1.2" />
                  <button type="button" className={`btn ${speaking ? 'btn-gold' : 'btn-line'}`} onClick={speakMeasure}>🎤</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }}>حفظ القياس</button>
            </form>
            {seenReport && <div className="small" style={{ background: 'var(--green-050)', borderRadius: 10, padding: 10 }}>✅ {seenReport}</div>}
          </div>
        )}

        {screen === 'sos' && (
          <div className="card" style={{ textAlign: 'center', padding: '24px 18px' }}>
            <div className="big">🆘</div>
            <b style={{ fontSize: 19 }}>تنبيه طارئ — SOS / الحماية المدنية</b>
            <p className="muted small mt-8">إشعار فوري لرقم النجدة 14 بسجل البلاغ، مع SMS عبر هاتفك تعمل دون إنترنت، وتحديد الموقع إن توفر GPS.</p>
            <div className="flex gap-8" style={{ justifyContent: 'center', marginTop: 14 }}>
              <button className="btn btn-danger sosh-btn" style={{ padding: '14px 26px' }} onClick={sos}>🚨 إرسال الاستغاثة</button>
              <button className="btn btn-gold sosh-btn" onClick={endSOS}>📞 اتصال 14</button>
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-line btn-sm" onClick={locate}>📍 {geo ? `${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}` : 'تحديد موقعي'}</button>
            </div>
            {sosStatus && <div className="small mt-12" style={{ background: 'var(--red-050)', borderRadius: 10, padding: 10 }}>{sosStatus}</div>}
            {sosRef && <div className="small muted mt-8">مرجع التتبع: <b dir="ltr">{sosRef}</b> — متاح للوحة القيادة</div>}
            <div className="small muted mt-12">🛡️ الحماية المدنية تتلقى البلاغ — قانون 18-07 — SLA 6 ساعات للإحالة الحمراء</div>
          </div>
        )}

        {screen === 'pills' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">💊</span> تذكير الأدوية الذكي — يعمل محلياً</div>
            <div className="flex gap-8 mb-12">
              <input className="form-control" placeholder="اسم الدواء" value={pillName} onChange={(e) => setPillName(e.target.value)} />
              <input className="form-control" type="time" value={pillTime} onChange={(e) => setPillTime(e.target.value)} style={{ maxWidth: 120 }} />
              <button className="btn btn-primary" onClick={addPill}>➕</button>
            </div>
            {pills.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-8" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>💊 {p.name}</b> <span className="muted small">عند {p.time}</span></span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPills(pills.filter((_, x) => x !== i))}>✕</button>
              </div>
            ))}
            <button className="btn btn-gold" style={{ width: '100%', marginTop: 12 }} onClick={remindNow}>🔔 تفعيل التنبيهات</button>
          </div>
        )}

        {screen === 'rx' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">🧾</span> روشتي — الوصفة الإلكترونية {patient && <span className="badge badge-blue">{patient}</span>}</div>
            {!patient && <div className="alert alert-info mb-12">أدخل اسم المريض في شاشة «قياس المؤشرات» أو اطّلع على كل الوصفات أدناه.</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {myRx.map((r) => (
                <div key={r.id} className="rx-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div className="flex items-center justify-between" style={{ width: '100%' }}>
                    <b>🧾 <span dir="ltr">{r.ref}</span> — {r.patient_name}</b>
                    <span className={`badge ${r.status === 'open' ? 'rx-status-open' : 'rx-status-dispensed'}`}>{r.status === 'open' ? 'بانتظار الصرف' : 'صُرفت'}</span>
                  </div>
                  <div className="small muted">{r.doctor_name} · {r.institution}{r.purpose ? ' — ' + r.purpose : ''}</div>
                  {r.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-8 small" style={{ width: '100%' }}>
                      <span style={{ color: 'var(--purple-600)' }}>💊</span><b>{it.drug}</b>
                      <span className="muted">{it.strength} · {it.dosage}</span>
                      <span className="muted">مدة: {it.duration}</span>
                      <span className="badge badge-white">×{it.qty}</span>
                    </div>
                  ))}
                </div>
              ))}
              {myRx.length === 0 && <p className="muted small">لا وصفات مسجلة بعد.</p>}
            </div>
          </div>
        )}

        {screen === 'plan' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">🗺️</span> خطَّتي — ما بعد العلاج</div>
            {myPlan ? (
              <>
                <b>{myPlan.title}</b>
                <p className="small muted">{myPlan.summary}</p>
                <div className="card-title mt-12"><span className="ico">🎯</span> الغايات</div>
                {myPlan.goals.map((g, i) => (
                  <div key={i} className="flex items-center gap-8" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                    <span>{g.done ? '🟢' : '⚪'}</span>
                    <b style={{ fontSize: 15, textDecoration: g.done ? 'line-through' : 'none', color: g.done ? 'var(--muted)' : 'var(--ink-2)' }}>{g.g}</b>
                  </div>
                ))}
                <div className="card-title mt-12"><span className="ico">⏰</span> الجدول</div>
                {myPlan.schedule.map((t, i) => (
                  <div key={i} className="flex justify-between" style={{ padding: '6px 0' }}>
                    <b style={{ fontSize: 14 }}>{t.task}</b><span className="badge badge-purple">{t.when}</span>
                  </div>
                ))}
              </>
            ) : <p className="muted">لا خطة مسجلة لهذا المستفيد.</p>}
          </div>
        )}

        {screen === 'consent' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">✍️</span> موافقاتي الرقمية</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {myConsents.map((c) => (
                <div key={c.id} className="rx-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div className="flex items-center justify-between" style={{ width: '100%' }}>
                    <b>{c.revoked ? '🚫' : '✅'} {c.type_label}</b>
                    <span className={`badge ${c.revoked ? 'badge-gray' : 'badge-green'}`}>{c.revoked ? 'ملغاة' : 'سارية'}</span>
                  </div>
                  <div className="small muted">{c.scope}</div>
                  <div className="small muted">الممنوح له: {c.granted_to} · تنتهي: {c.expires_on || 'غير محدد'} · مرجع: <span dir="ltr">{c.ref}</span></div>
                </div>
              ))}
              {myConsents.length === 0 && <p className="muted small">لا موافقات مسجلة بعد.</p>}
            </div>
          </div>
        )}

        {screen === 'psych' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">🧠</span> نفسيتي — ميزان مقدم الرعاية</div>
            <p className="small muted">أجب عن 5 عبارات بصدق (0 = أبداً … 4 = دائماً) لتقييم إرهاق الرعاية.</p>
            <form onSubmit={runZarit} className="mb-12">
              <div className="form-group"><label>اسم المستفيد / المقدِّم</label>
                <input className="form-control" value={patient} onChange={(e) => setPatient(e.target.value)} required /></div>
              {ZARIT.map((sentence, i) => (
                <div key={i} className="flex items-center justify-between gap-8" style={{ padding: '9px 0', borderBottom: '1px dashed var(--line)' }}>
                  <b style={{ fontSize: 14 }}>{i + 1}. {sentence}</b>
                  <select className="form-control" style={{ maxWidth: 130 }} value={zarit[i]}
                    onChange={(e) => setZarit(zarit.map((v, x) => x === i ? Number(e.target.value) : v))}>
                    {[0, 1, 2, 3, 4].map((v) => <option key={v} value={v}>{v === 0 ? 'أبداً' : v === 1 ? 'نادراً' : v === 2 ? 'أحياناً' : v === 3 ? 'غالباً' : 'دائماً'}</option>)}
                  </select>
                </div>
              ))}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>قياس الإرهاق</button>
            </form>
            {psychRes && (
              <div className={`alert ${psychRes.level === 'severe' ? 'alert-danger' : psychRes.level === 'moderate' ? 'alert-warning' : 'alert-success'}`}>
                <b>النتيجة: {psychRes.score} — {psychRes.level === 'severe' ? 'إرهاق مرتفع' : psychRes.level === 'moderate' ? 'إرهاق متوسط' : 'إرهاق خفيف'}</b>
                <div className="small">{psychRes.advice}</div>
              </div>
            )}
            <div className="card-title mt-16" style={{ marginTop: 22 }}><span className="ico">🗓️</span> حجز جلسة دعم عن بُعد</div>
            <div className="flex gap-8 mb-12">
              <input className="form-control" placeholder="الموعد المفضل (مثال: 2026-10-03 18:00)" value={slot} onChange={(e) => setSlot(e.target.value)} />
            </div>
            <textarea className="form-control mb-12" rows={2} placeholder="ماذا تريد أن تقول للمختص؟" value={sessionReason} onChange={(e) => setSessionReason(e.target.value)} />
            <button className="btn btn-gold" style={{ width: '100%' }} onClick={requestSession}>📹 طلب جلسة (فيديو / صوت / نص)</button>
          </div>
        )}

        {screen === 'team' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">🏥</span> فريقي الطبي ({team.data?.length || 0})</div>
            {(team.data || []).map((s) => (
              <div key={s.id} className="flex items-center gap-8" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div className={`avatar ${s.kind === 'doctor' ? 'avatar-2' : 'avatar-4'}`}>{s.full_name.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{s.full_name}</b>
                  <div className="small muted">{s.specialty || '—'} · {s.wilaya_ar || ''}</div>
                </div>
                <span className={`badge ${s.license_status === 'verified' ? 'badge-green' : 'badge-orange'}`}>{s.license_status === 'verified' ? 'معتمَد' : 'قيد التدقيق'}</span>
              </div>
            ))}
          </div>
        )}

        {screen === 'offline' && (
          <div className="card">
            <button className="btn btn-ghost btn-sm mb-12" onClick={() => setScreen('home')}>← رجوع</button>
            <div className="card-title"><span className="ico">📶</span> المزامنة Offline-First</div>
            <p className="muted small">يعمل التطبيق دون إنترنت — تُحفظ قياساتك محلياً وتُدفع للمنظومة حين تُعيد الاتصال.</p>
            <div className="flex items-center justify-between gap-8" style={{ background: 'var(--purple-050)', padding: 12, borderRadius: 10 }}>
              <span>⏳ <b>{pendingCount}</b> قياس معلّق — يُرفع تلقائياً عند عودة الاتصال</span>
              <button className="btn btn-success btn-sm" onClick={syncNowAll}>🔄 مزامنة الآن</button>
            </div>
          </div>
        )}
      </div>

      {!dementia && (
        <div className="darija-widget">
          {darijaOpen && (
            <div className="darija-open">
              <div className="darija-head">
                <span style={{ fontSize: 22 }}>🗣️</span>
                <b>مساعد «دارجة» الصوتي</b>
                <div style={{ flex: 1 }} />
                <button onClick={() => { setDarijaOpen(false); setDarijaMsg(''); setDarijaRep('') }} style={{ color: '#fff', fontSize: 18 }}>✕</button>
              </div>
              <div className="darija-body">
                {darijaMsg && <div className="darija-msg darija-usr">🗣 {darijaMsg}</div>}
                {darijaRep && <div className="darija-msg darija-bot">🤖 {darijaRep}</div>}
                {!darijaMsg && <div className="darija-msg darija-bot">ها أنا نسمعك! قل بصوتك: «تذكير الدواء»، «قياس»، «استغاثة»، «فريقي»، «روشتي»، «نفسيتي» أو «الوقت».</div>}
              </div>
              <div className="darija-free">
                <button className={`btn btn-gold ${speaking ? 'listening' : ''}`} style={{ width: '100%' }} onClick={darijaTalk}>
                  {speaking ? '🎙️ أنصت…' : '🎤 تكلم بالدارجة'}
                </button>
              </div>
            </div>
          )}
          <button className={`darija-fab ${speaking ? 'listening' : ''}`} onClick={() => { setDarijaOpen(!darijaOpen); if (!darijaOpen) { setDarijaMsg(''); setDarijaRep('') } }} title="مساعد دارجة">🗣️</button>
        </div>
      )}
    </div>
  )
}