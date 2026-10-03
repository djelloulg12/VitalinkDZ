import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useApiData, useAuth } from '../../auth'
import { api } from '../../api'
import { Followup } from '../../types'
import { Avatar, Field, Modal, toast } from '../../ui'
import { docNumber, exportCSV, printDoc } from '../../printutil'

const EMPTY: Followup = {
  patient_name: '', referral_id: null, kind: 'consultation', date: new Date().toISOString().slice(0, 10),
  summary: '', subjective: '', objective: '',
  vitals: { pulse: 0, bpSys: 0, bpDia: 0, temp: 0, spO2: 0, sugar: 0 },
  medications: [], attachments: [],
}

const KINDS: [string, string, string][] = [
  ['consultation', '🩺', 'معاينة طبية'],
  ['nursing', '💉', 'تدوين تمريضي'],
  ['vitals', '❤️', 'مؤشرات حيوية'],
  ['medication', '💊', 'وصفة / أدوية'],
]

const QUEUE_KEY = 'ryt_follow_offline_queue'
let pendingOps: any[] = []
try {
  pendingOps = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
} catch {}

function storeQueue(ops: any[]) {
  pendingOps = ops
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
}

export function Followups() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading, reload } = useApiData<Followup[]>('/followups', refresh)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | { id?: number; form: Followup }>(null)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [med, setMed] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const rows = useMemo(() => {
    let r = data || []
    if (q.trim()) r = r.filter((f) => f.patient_name.includes(q.trim()) || f.summary.includes(q.trim()))
    return r
  }, [data, q])

  const openNew = () => setModal({ form: { ...EMPTY, date: new Date().toISOString().slice(0, 10) } })
  const openEdit = (f: Followup) => setModal({
    id: f.id,
    form: { ...f, vitals: { ...f.vitals }, medications: [...(f.medications || [])], attachments: [...(f.attachments || [])] },
  })

  const pushQueue = async () => {
    if (!pendingOps.length) return
    try {
      await api('/followups/sync/push', {
        method: 'POST',
        body: JSON.stringify({ device: 'browser-' + (user?.name || 'x'), ops: pendingOps }),
      })
      storeQueue([])
      toast('تمت مزامنة السجلات المعلَّقة', 'success')
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast('فشلت المزامنة: ' + err.message, 'error')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal) return
    setBusy(true)
    const body = {
      ...modal.form,
      referral_id: modal.form.referral_id ? Number(modal.form.referral_id) : null,
      vitals: {
        pulse: Number(modal.form.vitals.pulse) || 0, bpSys: Number(modal.form.vitals.bpSys) || 0,
        bpDia: Number(modal.form.vitals.bpDia) || 0, temp: Number(modal.form.vitals.temp) || 0,
        spO2: Number(modal.form.vitals.spO2) || 0, sugar: Number(modal.form.vitals.sugar) || 0,
      },
      medications: modal.form.medications, attachments: modal.form.attachments,
    }
    try {
      if (!online) {
        storeQueue([...pendingOps, { op: modal.id ? 'update' : 'create', id: modal.id, payload: body }])
        toast('لا اتصال — حُفظ السجل محلياً وسيُزامن لاحقاً', 'success')
        setModal(null)
        return
      }
      if (modal.id) await api(`/followups/${modal.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/followups', { method: 'POST', body: JSON.stringify(body) })
      toast('حُفظ سجل المتابعة بنجاح', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (f: Followup) => {
    if (!f.id || !window.confirm('حذف هذا السجل؟')) return
    try {
      await api(`/followups/${f.id}`, { method: 'DELETE' })
      toast('حُذف السجل', 'success')
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const addMed = () => {
    if (!modal || !med.trim()) return
    const m = med.trim()
    if (!modal.form.medications.some((x) => x === m))
      setModal({ ...modal, form: { ...modal.form, medications: [...modal.form.medications, m] } })
    setMed('')
  }

  const addFile = (fn: File) => {
    if (!modal || !fn) return
    const reader = new FileReader()
    reader.onload = () => setModal({ ...modal, form: { ...modal.form, attachments: [...modal.form.attachments, { name: fn.name, dataUrl: String(reader.result) }] } })
    reader.readAsDataURL(fn)
  }

  const printOne = (f: Followup) =>
    printDoc({
      title: 'سجل المتابعة والتطورات — ملف المريض الموحّد',
      number: docNumber('FUP', f.id || 0),
      qr: `RIAYATI-FOLLOWUP:${f.id || 0}:${f.patient_name}`,
      sigs: [{ label: 'المسجِّل (الطبيب/الممرض)' }, { label: 'الاعتماد القانوني' }, { label: 'ختم المؤسسة' }],
      body: `
        <div class="kv"><span>المريض</span><b>${f.patient_name}</b></div>
        <div class="kv"><span>التاريخ</span><b>${f.date || '—'}</b></div>
        <div class="kv"><span>النوع</span><b>${(KINDS.find((k) => k[0] === f.kind) || ['', '', f.kind])[2]}</b></div>
        <div class="kv"><span>الخلاصة</span><b>${f.summary || '—'}</b></div>
        <div class="kv"><span>الشكوى الذاتية</span><b>${f.subjective || '—'}</b></div>
        <div class="kv"><span>الفحص الموضوعي</span><b>${f.objective || '—'}</b></div>
        <div class="kv"><span>المؤشرات الحيوية</span><b>نبض ${f.vitals.pulse || '—'} · ضغط ${f.vitals.bpSys || '—'}/${f.vitals.bpDia || '—'} · حرارة ${f.vitals.temp || '—'} · SaO2 ${f.vitals.spO2 || '—'}% · سكر ${f.vitals.sugar || '—'}</b></div>
        <div class="kv"><span>الأدوية</span><b>${(f.medications || []).join('، ') || '—'}</b></div>
        <div class="kv"><span>المسجِّل</span><b>${f.signed_by || '—'}</b></div>
        <div class="kv"><span>طبعت بموجب قانون 18-07 والملف الطبي الموحّد</span><b>رعايتي DZ</b></div>`,
    })

  const exportCSVFile = () =>
    exportCSV('followups.csv',
      ['رقم', 'المريض', 'النوع', 'التاريخ', 'الخلاصة', 'نبض', 'ضغط', 'سكر', 'المسجل'],
      rows.map((f) => [f.id, f.patient_name, (KINDS.find((k) => k[0] === f.kind) || ['', '', f.kind])[2], f.date, f.summary, f.vitals.pulse, `${f.vitals.bpSys}/${f.vitals.bpDia}`, f.vitals.sugar, f.signed_by || '']),
    )

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>ملف المتابعة والتدوينات (Offline-First)</h2>
          <span className="muted small">سجل طبي تمريضي موحّد للزيارات والقياسات — يعمل دون اتصال ويُزامن تلقائياً</span>
        </div>
        <div className="flex gap-8 flex-wrap">
          <span className={`conn-pill ${online ? 'conn-on' : 'conn-off'}`}>{online ? '🟢 متصل — الشبكة الوطنية' : '🔴 غير متصل — السجل محلي'}</span>
        </div>
      </div>

      <div className="flex gap-12 mb-16 flex-wrap items-center">
        <span className="badge badge-purple">📁 {rows.length} سجل</span>
        <span className={`badge ${pendingOps.length ? 'badge-orange' : 'badge-gray'}`}>⏳ {pendingOps.length} سجل غير مُزامن</span>
        {pendingOps.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={pushQueue}>🔄 مزامنة الآن</button>
        )}
        <input className="form-control" style={{ maxWidth: 260 }} placeholder="🔍 بحث بالاسم أو الخلاصة..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-line btn-sm" onClick={exportCSVFile}>⬇️ CSV</button>
        <button className="btn btn-gold" onClick={openNew}>➕ تدوينة / قياس جديد</button>
      </div>

      {!rows.length && <div className="empty-state"><div className="big">📁</div>لا سجلات متابعة بعد — أضف أول تدوينة طبية أو تمريضية</div>}

      <div className="grid grid-2">
        {rows.map((f) => (
          <div key={f.id} className="card followup-card">
            <div className="flex items-center justify-between gap-8 mb-12">
              <div className="pat-cell">
                <Avatar name={f.patient_name} size={46} />
                <div>
                  <b>{f.patient_name}</b>
                  <small className="muted">{(KINDS.find((k) => k[0] === f.kind) || ['', '', f.kind])[1]} {(KINDS.find((k) => k[0] === f.kind) || ['', '', f.kind])[2]} · {f.date || '—'}</small>
                </div>
              </div>
              <div className="flex gap-8 items-center">
                {f.signed_by && <span className="badge badge-green">✍ مُعتَمَد</span>}
                <button className="btn btn-soft btn-sm" onClick={() => openEdit(f)}>✏️</button>
                <button className="btn btn-line btn-sm" onClick={() => printOne(f)}>🖨️</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(f)}>🗑️</button>
              </div>
            </div>
            <div style={{ background: 'var(--purple-050)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>{f.summary || '—'}</div>
            {f.subjective || f.objective ? (
              <div className="small muted mt-8"><b>شكوى:</b> {f.subjective || '—'} <span style={{ margin: '0 6px' }}>·</span> <b>فحص:</b> {f.objective || '—'}</div>
            ) : null}
            <div className="flex gap-4 flex-wrap mt-12">
              {f.vitals?.pulse ? <span className="badge badge-white">❤️ نبض {f.vitals.pulse}</span> : null}
              {f.vitals?.bpSys ? <span className="badge badge-white">🩸 {f.vitals.bpSys}/{f.vitals.bpDia}</span> : null}
              {f.vitals?.temp ? <span className="badge badge-white">🌡 {f.vitals.temp}°</span> : null}
              {f.vitals?.spO2 ? <span className="badge badge-white">🫁 {f.vitals.spO2}%</span> : null}
              {f.vitals?.sugar ? <span className="badge badge-white">🍬 {f.vitals.sugar}</span> : null}
              {(f.medications || []).map((m) => <span key={m} className="badge badge-purple">💊 {m}</span>)}
              {(f.attachments || []).map((a) => <span key={a.name} className="badge badge-gray">📎 {a.name}</span>)}
            </div>
            <div className="small muted mt-12">المسجِّل: {f.signed_by || f.author || '—'}{f.signed_at ? ` · ${new Date(f.signed_at).toLocaleString('ar-DZ')}` : ''}</div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal.id ? 'تعديل تدوينة' : 'تدوينة / قياس جديد'} icon="📁"
          onClose={() => setModal(null)} size="modal-lg"
          foot={<>
            <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ (يعمل دون اتصال)'}</button>
          </>}>
          <form onSubmit={save}>
            <div className="form-row">
              <Field label="اسم المريض">
                <input className="form-control" required value={modal.form.patient_name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, patient_name: e.target.value } })} />
              </Field>
              <Field label="نوع التدوينة">
                <select className="form-control" value={modal.form.kind} onChange={(e) => setModal({ ...modal, form: { ...modal.form, kind: e.target.value } })}>
                  {KINDS.map((k) => <option key={k[0]} value={k[0]}>{k[1]} {k[2]}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="التاريخ">
                <input className="form-control" type="date" required value={modal.form.date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })} />
              </Field>
              <Field label="الخلاصة">
                <input className="form-control" required value={modal.form.summary} onChange={(e) => setModal({ ...modal, form: { ...modal.form, summary: e.target.value } })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="الشكوى الذاتية (Subjective)">
                <textarea className="form-control" rows={2} value={modal.form.subjective} onChange={(e) => setModal({ ...modal, form: { ...modal.form, subjective: e.target.value } })} />
              </Field>
              <Field label="الفحص الموضوعي (Objective)">
                <textarea className="form-control" rows={2} value={modal.form.objective} onChange={(e) => setModal({ ...modal, form: { ...modal.form, objective: e.target.value } })} />
              </Field>
            </div>
            <div className="card-title mt-12"><span className="ico">❤️</span> المؤشرات الحيوية</div>
            <div className="form-row grid-6">
              {([['pulse', 'نبض'], ['bpSys', 'ضغط انقباضي'], ['bpDia', 'ضغط انبساطي'], ['temp', 'حرارة °'], ['spO2', 'تشبع O2'], ['sugar', 'سكر']] as const).map(([k, l]) => (
                <Field key={k} label={l}>
                  <input className="form-control" type="number" value={(modal.form.vitals as any)[k]} onChange={(e) => setModal({ ...modal, form: { ...modal.form, vitals: { ...modal.form.vitals, [k]: e.target.value } } })} />
                </Field>
              ))}
            </div>
            <div className="card-title mt-12"><span className="ico">💊</span> الأدوية</div>
            <div className="flex gap-8 mb-8 items-center">
              <input className="form-control" style={{ maxWidth: 240 }} placeholder="اسم الدواء..." value={med} onChange={(e) => setMed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMed() } }} />
              <button type="button" className="btn btn-soft btn-sm" onClick={addMed}>➕ إضافة</button>
            </div>
            <div className="flex gap-4 flex-wrap mb-12">
              {modal.form.medications.map((m) => (
                <span key={m} className="badge badge-purple">💊 {m} {' '}
                  <a style={{ cursor: 'pointer' }} onClick={() => setModal({ ...modal, form: { ...modal.form, medications: modal.form.medications.filter((x) => x !== m) } })}>✕</a>
                </span>
              ))}
            </div>
            <div className="card-title"><span className="ico">📎</span> المرفقات</div>
            <div className="flex gap-4 flex-wrap mb-8">
              {(modal.form.attachments || []).map((a) => (
                <span key={a.name} className="badge badge-gray">📎 {a.name}</span>
              ))}
            </div>
            <input ref={fileRef} type="file" hidden onChange={(e) => { if (e.target.files?.[0]) addFile(e.target.files[0]); e.target.value = '' }} />
            <button type="button" className="btn btn-line btn-sm" onClick={() => fileRef.current?.click()}>⬆️ إرفاق مستند / صورة</button>
          </form>
        </Modal>
      )}
    </div>
  )
}