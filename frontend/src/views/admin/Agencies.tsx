import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { Agency, HealthPackage, Referral } from '../../types'
import { Field, Modal, toast } from '../../ui'

export function Agencies() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<Agency[]>('/agencies', refresh)
  const refs = useApiData<Referral[]>('/agencies/link/referrals', refresh)
  const [modal, setModal] = useState<null | { ag: number; kind: 'fleet' | 'guide' | 'package'; form: any }>(null)
  const [linkModal, setLinkModal] = useState<null | { ref: string; pkg: string; ag: number }>(null)
  const [busy, setBusy] = useState(false)

  const agencies = data || []

  const addItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal) return
    setBusy(true)
    try {
      const map = modal.kind === 'fleet' ? { kind: modal.form.kind, plate: modal.form.plate, seats: Number(modal.form.seats), medical: modal.form.medical }
        : modal.kind === 'guide' ? { name: modal.form.name, langs: modal.form.langs, phone: modal.form.phone, license: modal.form.license }
        : { title: modal.form.title, destination: modal.form.destination, nights: Number(modal.form.nights), price: Number(modal.form.price), includes: modal.form.includes, treatments: modal.form.treatments, station_id: modal.form.station_id ? Number(modal.form.station_id) : null }
      const url = modal.kind === 'package' ? `/agencies/${modal.ag}/packages` : modal.kind === 'fleet' ? `/agencies/${modal.ag}/fleet` : `/agencies/${modal.ag}/guides`
      await api(url, { method: 'POST', body: JSON.stringify(map) })
      toast('أُضيف بنجاح', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const delPkg = async (p: HealthPackage) => {
    if (!window.confirm('حذف الحزمة؟')) return
    try {
      await api(`/agencies/packages/${p.id}`, { method: 'DELETE' })
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const doLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!linkModal) return
    try {
      await api(`/agencies/link/${Number(linkModal.ref)}/package/${Number(linkModal.pkg)}`, { method: 'POST' })
      toast('رُبطت الإحالة بالحزمة — أُدرجت في التقارير الطبية', 'success')
      setLinkModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>وكالات السياحة والأسفار</h2>
          <span className="muted small">معلومات الوكالات + الأسطول الطبي + المرشدون + حزم الرعاية، وربطها بالإحالات</span>
        </div>
        <button className="btn btn-gold" onClick={() => setLinkModal({ ref: '', pkg: '', ag: 0 })}>🔗 ربط إحالة بحزمة</button>
      </div>

      {!agencies.length && <div className="empty-state"><div className="big">🧭</div>لا وكالات بعد</div>}

      <div className="grid grid-2">
        {agencies.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between gap-8 mb-8">
              <div>
                <b style={{ fontSize: 16 }}>{a.name}</b>
                <div className="small muted">{a.city || '—'} · {a.license_no ? `ترخيص ${a.license_no}` : 'بدون ترخيص'}</div>
              </div>
              <span className="badge badge-purple">🧭 وكالة</span>
            </div>
            {a.desc && <div className="small muted mb-8">{a.desc}</div>}

            <div className="card-title"><span className="ico">🚑</span> الأسطول الطبي ({a.fleet.length})</div>
            <div className="flex gap-4 flex-wrap mb-8">
              {a.fleet.map((v) => <span key={v.id} className="badge badge-white">{v.kind === 'ambulance' ? '🚑' : v.kind === 'medical_bus' ? '🚌' : '🚐'} {v.plate} · {v.seats} مقعد{v.medical ? ' · مرافق طبي' : ''}</span>)}
            </div>

            <div className="card-title"><span className="ico">🧑‍🤝‍🧑</span> المرشدون ({a.guides.length})</div>
            <div className="flex gap-4 flex-wrap mb-8">
              {a.guides.map((g) => <span key={g.id} className="badge badge-line">🧑‍✈️ {g.name} — {g.langs}</span>)}
            </div>

            <div className="card-title"><span className="ico">🎁</span> الحزم ({a.packages.length})</div>
            {(a.packages || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-8" style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
                <div>
                  <b style={{ fontSize: 13 }}>{p.title}</b>
                  <div className="small muted">{p.destination} · {p.nights} ليالٍ · {p.price.toLocaleString('ar-DZ')} دج{p.treatments ? ` · 📋 ${p.treatments}` : ''}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => delPkg(p)}>🗑️</button>
              </div>
            ))}

            <div className="flex gap-8 mt-12 flex-wrap">
              <button className="btn btn-soft btn-sm" onClick={() => setModal({ ag: a.id, kind: 'fleet', form: { kind: 'ambulance', plate: '', seats: 4, medical: true } })}>🚑 إضافة وسيلة</button>
              <button className="btn btn-soft btn-sm" onClick={() => setModal({ ag: a.id, kind: 'guide', form: { name: '', langs: '', phone: '', license: '' } })}>🧑‍✈️ مرشد</button>
              <button className="btn btn-soft btn-sm" onClick={() => setModal({ ag: a.id, kind: 'package', form: { title: '', destination: '', nights: 7, price: 0, includes: '', treatments: '', station_id: '' } })}>🎁 حزمة</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal.kind === 'fleet' ? 'إضافة وسيلة أسطول' : modal.kind === 'guide' ? 'إضافة مرشد' : 'إضافة حزمة'} icon="➕"
          onClose={() => setModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={addItem} disabled={busy}>حفظ</button>
          </>}>
          <form onSubmit={addItem}>
            {modal.kind === 'fleet' && (<>
              <div className="form-row">
                <Field label="النوع">
                  <select className="form-control" value={modal.form.kind} onChange={(e) => setModal({ ...modal, form: { ...modal.form, kind: e.target.value } })}>
                    <option value="ambulance">سيارة إسعاف</option>
                    <option value="medical_bus">حافلة طبية</option>
                    <option value="minibus">حافلة صغيرة</option>
                  </select>
                </Field>
                <Field label="رقم اللوحة"><input className="form-control" required value={modal.form.plate} onChange={(e) => setModal({ ...modal, form: { ...modal.form, plate: e.target.value } })} /></Field>
              </div>
              <div className="form-row">
                <Field label="المقاعد"><input className="form-control" type="number" min={1} value={modal.form.seats} onChange={(e) => setModal({ ...modal, form: { ...modal.form, seats: e.target.value } })} /></Field>
                <label className="flex gap-8 items-center" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                  <input type="checkbox" checked={modal.form.medical} onChange={(e) => setModal({ ...modal, form: { ...modal.form, medical: e.target.checked } })} />
                  <span>مرافق طبي على متنها</span>
                </label>
              </div>
            </>)}
            {modal.kind === 'guide' && (<>
              <div className="form-row">
                <Field label="الاسم الكامل"><input className="form-control" required value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} /></Field>
                <Field label="اللغات"><input className="form-control" value={modal.form.langs} onChange={(e) => setModal({ ...modal, form: { ...modal.form, langs: e.target.value } })} /></Field>
              </div>
              <div className="form-row">
                <Field label="الهاتف"><input className="form-control" dir="ltr" value={modal.form.phone} onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })} /></Field>
                <Field label="الترخيص"><input className="form-control" value={modal.form.license} onChange={(e) => setModal({ ...modal, form: { ...modal.form, license: e.target.value } })} /></Field>
              </div>
            </>)}
            {modal.kind === 'package' && (<>
              <div className="form-row">
                <Field label="عنوان الحزمة"><input className="form-control" required value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} /></Field>
                <Field label="الوجهة"><input className="form-control" value={modal.form.destination} onChange={(e) => setModal({ ...modal, form: { ...modal.form, destination: e.target.value } })} /></Field>
              </div>
              <div className="form-row">
                <Field label="عدد الليالي"><input className="form-control" type="number" min={1} value={modal.form.nights} onChange={(e) => setModal({ ...modal, form: { ...modal.form, nights: e.target.value } })} /></Field>
                <Field label="السعر (دج)"><input className="form-control" type="number" min={0} value={modal.form.price} onChange={(e) => setModal({ ...modal, form: { ...modal.form, price: e.target.value } })} /></Field>
              </div>
              <Field label="التشخيصات المستهدفة"><input className="form-control" placeholder="مثال: أمراض المفاصل، الروماتيزم" value={modal.form.treatments} onChange={(e) => setModal({ ...modal, form: { ...modal.form, treatments: e.target.value } })} /></Field>
              <Field label="مشمولات"><textarea className="form-control" rows={2} value={modal.form.includes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, includes: e.target.value } })} /></Field>
            </>)}
          </form>
        </Modal>
      )}

      {linkModal && (
        <Modal title="ربط إحالة طبية بحزمة سياحة علاجية" icon="🔗" onClose={() => setLinkModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setLinkModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={doLink}>ربط</button>
          </>}>
          <form onSubmit={doLink}>
            <Field label="الإحالة (في انتظار القرار)">
              <select className="form-control" required value={linkModal.ref} onChange={(e) => setLinkModal({ ...linkModal, ref: e.target.value })}>
                <option value="">— اختر —</option>
                {(refs.data || []).map((r) => <option key={r.id} value={r.id}>#{r.id} — {r.patient_name}</option>)}
              </select>
            </Field>
            <Field label="الحزمة">
              <select className="form-control" required value={linkModal.pkg} onChange={(e) => setLinkModal({ ...linkModal, pkg: e.target.value })}>
                <option value="">— اختر —</option>
                {agencies.flatMap((a) => (a.packages || [])).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}