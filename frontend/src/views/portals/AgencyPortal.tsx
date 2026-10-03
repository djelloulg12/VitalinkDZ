import { FormEvent, useState } from 'react'
import { useApiData, useAuth } from '../../auth'
import { api } from '../../api'
import { Agency, Referral } from '../../types'
import { Field, Modal, toast } from '../../ui'

type Tab = 'info' | 'fleet' | 'guides' | 'packages'
const TABS: [Tab, string][] = [
  ['info', '🏢 معلومات الوكالة'],
  ['fleet', '🚑 الأسطول الطبي'],
  ['guides', '🧑‍✈️ المرشدون'],
  ['packages', '🎁 الحزم وربط الإحالات'],
]

export function AgencyPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<Agency[]>('/agencies', refresh)
  const pendingRefs = useApiData<Referral[]>('/agencies/link/referrals', refresh)
  const [tab, setTab] = useState<Tab>('info')
  const [editProfile, setEditProfile] = useState(false)
  const [modal, setModal] = useState<null | { kind: 'fleet' | 'guide' | 'package'; form: any }>(null)
  const [link, setLink] = useState<null | { ref: string; pkg: string }>(null)
  const [busy, setBusy] = useState(false)

  const agencies = data || []
  const mine = user?.role === 'admin' ? agencies[0] : agencies.find((a) => a.id === 1 || a.name.includes('غرداية')) || agencies[0]
  const [pf, setPf] = useState<null | Agency>(null)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!pf) return
    try {
      await api(`/agencies/${pf.id}`, { method: 'PUT', body: JSON.stringify({ name: pf.name, license_no: pf.license_no, wilaya_id: pf.wilaya_id, city: pf.city, phone: pf.phone, desc: pf.desc }) })
      toast('حُفظت معلومات الوكالة', 'success')
      setEditProfile(false)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const addItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal || !mine) return
    setBusy(true)
    try {
      const body = modal.kind === 'fleet'
        ? { kind: modal.form.kind, plate: modal.form.plate, seats: Number(modal.form.seats), medical: modal.form.medical }
        : modal.kind === 'guide'
        ? { name: modal.form.name, langs: modal.form.langs, phone: modal.form.phone, license: modal.form.license }
        : { title: modal.form.title, destination: modal.form.destination, nights: Number(modal.form.nights), price: Number(modal.form.price), includes: modal.form.includes, treatments: modal.form.treatments }
      await api(`/agencies/${mine.id}/${modal.kind === 'package' ? 'packages' : modal.kind + 's'}`, { method: 'POST', body: JSON.stringify(body) })
      toast('أُضيف بنجاح', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const doLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!link) return
    try {
      await api(`/agencies/link/${Number(link.ref)}/package/${Number(link.pkg)}`, { method: 'POST' })
      toast('رُبطت الإحالة بالحزمة العلاجية', 'success')
      setLink(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>

  return (
    <div className="container page">
      <div className="section-head">
        <div>
          <h2>بوابة وكالات السياحة والأسفار</h2>
          <span className="muted small">أربعة أقسام لإدارة رحلات الرعاية العلاجية وربطها بالإحالات الطبية</span>
        </div>
        <span className="badge badge-purple">🧭 حساب: {user?.name}</span>
      </div>

      <div className="tabs mb-16">
        {TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {!mine ? <div className="empty-state"><div className="big">🧭</div>لا وكالة مرتبطة بحسابك</div> : (
        <>
          {tab === 'info' && (
            <div className="card" style={{ maxWidth: 620 }}>
              <div className="flex items-center justify-between gap-8 mb-12">
                <b style={{ fontSize: 17 }}>{mine.name}</b>
                <button className="btn btn-soft btn-sm" onClick={() => { setPf({ ...mine }); setEditProfile(true) }}>✏️ تعديل</button>
              </div>
              <div className="kv-row"><span>رقم الترخيص</span><b>{mine.license_no || '—'}</b></div>
              <div className="kv-row"><span>المدينة</span><b>{mine.city || '—'}</b></div>
              <div className="kv-row"><span>الهاتف</span><b dir="ltr">{mine.phone || '—'}</b></div>
              <div className="kv-row"><span>الوصف</span><b style={{ whiteSpace: 'normal' }}>{mine.desc || '—'}</b></div>
            </div>
          )}

          {tab === 'fleet' && (
            <div>
              <button className="btn btn-gold mb-16" onClick={() => setModal({ kind: 'fleet', form: { kind: 'ambulance', plate: '', seats: 4, medical: true } })}>🚑 إضافة وسيلة</button>
              <div className="grid grid-2">
                {mine.fleet.map((v) => (
                  <div key={v.id} className="card">
                    <div className="flex items-center justify-between"><b>{v.kind === 'ambulance' ? '🚑 سيارة إسعاف' : v.kind === 'medical_bus' ? '🚌 حافلة طبية' : '🚐 حافلة صغيرة'}</b><span className="badge badge-purple">{v.medical ? 'مرافق طبي' : 'عادية'}</span></div>
                    <div className="kv-row mt-8"><span>اللوحة</span><b dir="ltr">{v.plate}</b></div>
                    <div className="kv-row"><span>المقاعد</span><b>{v.seats}</b></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'guides' && (
            <div>
              <button className="btn btn-gold mb-16" onClick={() => setModal({ kind: 'guide', form: { name: '', langs: '', phone: '', license: '' } })}>🧑‍✈️ إضافة مرشد</button>
              <div className="grid grid-3">
                {mine.guides.map((g) => (
                  <div key={g.id} className="card">
                    <b>{g.name}</b>
                    <div className="small muted mt-8">🌐 {g.langs || '—'}</div>
                    <div className="small muted">📞 {g.phone || '—'}</div>
                    <div className="small muted">🪪 {g.license || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'packages' && (
            <div>
              <div className="flex gap-8 mb-16 flex-wrap">
                <button className="btn btn-gold" onClick={() => setModal({ kind: 'package', form: { title: '', destination: '', nights: 7, price: 0, includes: '', treatments: '' } })}>🎁 حزمة جديدة</button>
                <button className="btn btn-line" onClick={() => setLink({ ref: '', pkg: '' })}>🔗 ربط إحالة بحزمة</button>
              </div>
              <div className="grid grid-2">
                {mine.packages.map((p) => (
                  <div key={p.id} className="card">
                    <div className="flex items-center justify-between"><b>{p.title}</b><b>{p.price.toLocaleString('ar-DZ')} دج</b></div>
                    <div className="small muted mt-8">📍 {p.destination} · {p.nights} ليالٍ</div>
                    <div className="small muted">📋 {p.treatments || '—'}</div>
                    <div className="small" style={{ background: 'var(--purple-050)', borderRadius: 8, padding: 8, marginTop: 8 }}>{p.includes || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="card mt-16">
                <div className="card-title"><span className="ico">🔄</span> إحالات في انتظار الربط ({pendingRefs.data?.length || 0})</div>
                {(pendingRefs.data || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <div><b style={{ fontSize: 13 }}>#{r.id} — {r.patient_name}</b><div className="small muted">{r.reason}</div></div>
                    <button className="btn btn-soft btn-sm" onClick={() => setLink({ ref: String(r.id), pkg: '' })}>ربط بحزمة</button>
                  </div>
                ))}
                {!pendingRefs.data?.length && <p className="muted small">لا إحالات معلّقة حالياً.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {editProfile && pf && (
        <Modal title="تعديل معلومات الوكالة" icon="🏢" onClose={() => setEditProfile(false)}
          foot={<>
            <button className="btn btn-line" onClick={() => setEditProfile(false)}>إلغاء</button>
            <button className="btn btn-success" onClick={saveProfile}>حفظ</button>
          </>}>
          <form onSubmit={saveProfile}>
            <Field label="اسم الوكالة"><input className="form-control" required value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="رقم الترخيص"><input className="form-control" value={pf.license_no || ''} onChange={(e) => setPf({ ...pf, license_no: e.target.value })} /></Field>
              <Field label="المدينة"><input className="form-control" value={pf.city || ''} onChange={(e) => setPf({ ...pf, city: e.target.value })} /></Field>
            </div>
            <Field label="الهاتف"><input className="form-control" dir="ltr" value={pf.phone || ''} onChange={(e) => setPf({ ...pf, phone: e.target.value })} /></Field>
            <Field label="الوصف"><textarea className="form-control" rows={3} value={pf.desc || ''} onChange={(e) => setPf({ ...pf, desc: e.target.value })} /></Field>
          </form>
        </Modal>
      )}

      {modal && (
        <Modal title="إضافة عنصر" icon="➕" onClose={() => setModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={addItem} disabled={busy}>{busy ? '…' : 'حفظ'}</button>
          </>}>
          <form onSubmit={addItem}>
            {modal.kind === 'fleet' && (<>
              <div className="flex gap-8 mb-8">
                {['ambulance', 'medical_bus', 'minibus'].map((k) => (
                  <button key={k} type="button" className={`btn ${modal.form.kind === k ? 'btn-primary' : 'btn-line'}`} onClick={() => setModal({ ...modal, form: { ...modal.form, kind: k } })}>
                    {k === 'ambulance' ? '🚑' : k === 'medical_bus' ? '🚌' : '🚐'} {k === 'ambulance' ? 'إسعاف' : k === 'medical_bus' ? 'حافلة طبية' : 'ميني'}
                  </button>
                ))}
              </div>
              <Field label="اللوحة"><input className="form-control" required value={modal.form.plate} onChange={(e) => setModal({ ...modal, form: { ...modal.form, plate: e.target.value } })} /></Field>
              <div className="form-row">
                <Field label="المقاعد"><input className="form-control" type="number" min={1} value={modal.form.seats} onChange={(e) => setModal({ ...modal, form: { ...modal.form, seats: e.target.value } })} /></Field>
                <label className="flex gap-8 items-center" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={modal.form.medical} onChange={(e) => setModal({ ...modal, form: { ...modal.form, medical: e.target.checked } })} /><span>مرافق طبي</span></label>
              </div>
            </>)}
            {modal.kind === 'guide' && (<>
              <Field label="الاسم"><input className="form-control" required value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} /></Field>
              <Field label="اللغات"><input className="form-control" value={modal.form.langs} onChange={(e) => setModal({ ...modal, form: { ...modal.form, langs: e.target.value } })} /></Field>
              <Field label="الهاتف"><input className="form-control" dir="ltr" value={modal.form.phone} onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })} /></Field>
              <Field label="الترخيص"><input className="form-control" value={modal.form.license} onChange={(e) => setModal({ ...modal, form: { ...modal.form, license: e.target.value } })} /></Field>
            </>)}
            {modal.kind === 'package' && (<>
              <Field label="عنوان الحزمة"><input className="form-control" required value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} /></Field>
              <div className="form-row">
                <Field label="الوجهة"><input className="form-control" value={modal.form.destination} onChange={(e) => setModal({ ...modal, form: { ...modal.form, destination: e.target.value } })} /></Field>
                <Field label="الليالي"><input className="form-control" type="number" min={1} value={modal.form.nights} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nights: e.target.value } })} /></Field>
              </div>
              <div className="form-row">
                <Field label="السعر دج"><input className="form-control" type="number" value={modal.form.price} onChange={(e) => setModal({ ...modal, form: { ...modal.form, price: e.target.value } })} /></Field>
                <Field label="التشخيصات"><input className="form-control" value={modal.form.treatments} onChange={(e) => setModal({ ...modal, form: { ...modal.form, treatments: e.target.value } })} /></Field>
              </div>
              <Field label="المشمولات"><textarea className="form-control" rows={2} value={modal.form.includes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, includes: e.target.value } })} /></Field>
            </>)}
          </form>
        </Modal>
      )}

      {link && (
        <Modal title="ربط إحالة بحزمة علاجية" icon="🔗" onClose={() => setLink(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setLink(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={doLink}>ربط وإدراج في الملف</button>
          </>}>
          <form onSubmit={doLink}>
            <Field label="الإحالة">
              <select className="form-control" required value={link.ref} onChange={(e) => setLink({ ...link, ref: e.target.value })}>
                <option value="">— اختر —</option>
                {(pendingRefs.data || []).map((r) => <option key={r.id} value={r.id}>#{r.id} — {r.patient_name}</option>)}
              </select>
            </Field>
            <Field label="الحزمة">
              <select className="form-control" required value={link.pkg} onChange={(e) => setLink({ ...link, pkg: e.target.value })}>
                <option value="">— اختر —</option>
                {mine.packages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}