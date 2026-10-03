import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { Staff, Wilaya } from '../../types'
import { Avatar, Modal, Field, toast } from '../../ui'
import { docNumber, exportCSV, printDoc, today } from '../../printutil'

const EMPTY = {
  full_name: '',
  kind: 'doctor',
  specialty: '',
  institution_id: '',
  wilaya_id: '',
  phone: '',
  patients_count: 0,
}

export function StaffAdmin() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<Staff[]>('/staff', refresh)
  const wil = useApiData<Wilaya[]>('/wilayas', 0)
  const [modal, setModal] = useState<null | { id?: number; form: any }>(null)
  const [busy, setBusy] = useState(false)

  const openNew = () => setModal({ form: { ...EMPTY } })
  const openEdit = (s: Staff) =>
    setModal({
      id: s.id,
      form: {
        full_name: s.full_name,
        kind: s.kind,
        specialty: s.specialty,
        institution_id: s.institution_id != null ? String(s.institution_id) : '',
        wilaya_id: s.wilaya_id != null ? String(s.wilaya_id) : '',
        phone: s.phone,
        patients_count: s.patients_count,
      },
    })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal) return
    setBusy(true)
    const body = {
      ...modal.form,
      institution_id: modal.form.institution_id ? Number(modal.form.institution_id) : null,
      wilaya_id: modal.form.wilaya_id ? Number(modal.form.wilaya_id) : null,
      patients_count: Number(modal.form.patients_count) || 0,
    }
    try {
      if (modal.id) await api(`/staff/${modal.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/staff', { method: 'POST', body: JSON.stringify(body) })
      toast(modal.id ? 'تم حفظ التعديلات' : 'تمت إضافة المتعاقد بنجاح', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (s: Staff) => {
    if (!window.confirm(`حذف «${s.full_name}»؟`)) return
    try {
      await api(`/staff/${s.id}`, { method: 'DELETE' })
      toast('تم الحذف', 'success')
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const staff = data || []

  const exportStaffCSV = () =>
    exportCSV(
      'staff_contracts.csv',
      ['رقم', 'الاسم الكامل', 'الصفة', 'التخصص', 'المؤسسة / الوحدة', 'الولاية', 'الهاتف', 'المرضى المتابَعون', 'المسجل'],
      staff.map((s) => [s.id, s.full_name, s.kind === 'doctor' ? 'طبيب' : 'ممرض', s.specialty, s.institution_name || '', s.wilaya_ar || '', s.phone, s.patients_count, s.created_at || '']),
    )

  const printStaffDoc = (s: Staff) =>
    printDoc({
      title: s.kind === 'doctor' ? 'بطاقة طبيب متعاقد' : 'بطاقة ممرض متعاقد',
      number: docNumber(s.kind === 'doctor' ? 'DR' : 'NR', s.id),
      qr: `VLK-STF:${s.id}:${s.full_name}`,
      sigs: [{ label: 'أمين الصحة' }, { label: 'المدير' }, { label: 'ختم المؤسسة' }],
      body: `
        <div class="kv"><span>الرقم التعريفي</span><b>${s.id}</b></div>
        <div class="kv"><span>الاسم الكامل</span><b>${s.full_name}</b></div>
        <div class="kv"><span>الصفة</span><b>${s.kind === 'doctor' ? 'طبيب متعاقد' : 'ممرض متعاقد'}</b></div>
        <div class="kv"><span>التخصص</span><b>${s.specialty || '—'}</b></div>
        <div class="kv"><span>المؤسسة / الوحدة</span><b>${s.institution_name || '—'}</b></div>
        <div class="kv"><span>الولاية</span><b>${s.wilaya_ar ? `${s.wilaya_ar} — ${s.wilaya_fr}` : '—'}</b></div>
        <div class="kv"><span>الهاتف</span><b>${s.phone || '—'}</b></div>
        <div class="kv"><span>المرضى المتابَعون</span><b>${s.patients_count}</b></div>
        <div class="kv"><span>تاريخ التسجيل</span><b>${s.created_at ? new Date(s.created_at).toLocaleString('ar-DZ') : '—'}</b></div>
        <div class="kv"><span>صادرة بموجب عقد العمل المحدّد</span><b>وزارة الصحة — ${today()}</b></div>`,
    })

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>إدارة الأطباء والممرضين المتعاقدين</h2>
          <span className="muted small">الوحدات الميدانية للرعاية المنزلية عبر الولايات — غرداية، الأغواط، الجزائر، ورقلة، تقرت، الوادي، المنيعة</span>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-line" onClick={exportStaffCSV}>⬇️ تصدير CSV</button>
          <button className="btn btn-gold" onClick={openNew}>➕ إضافة طبيب / ممرض متعاقد جديد</button>
        </div>
      </div>

      {!staff.length && <div className="empty-state"><div className="big">🩺</div>لا متعاقدون بعد</div>}

      <div className="grid grid-3">
        {staff.map((s) => (
          <div key={s.id} className="card staff-card">
            <div className="sc-top">
              <Avatar name={s.full_name} size={52} cls={s.kind === 'doctor' ? 'avatar-2' : 'avatar-4'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{s.full_name}</b>
                <div className="mt-8 flex gap-8 flex-wrap">
                  {s.kind === 'doctor' ? (
                    <span className="badge badge-green">🩺 طبيب متعاقد</span>
                  ) : (
                    <span className="badge badge-blue">💓 ممرض متعاقد</span>
                  )}
                  <span className={`badge ${s.license_status === 'verified' ? 'badge-green' : s.license_status === 'rejected' ? 'badge-red' : 'badge-orange'}`}>
                    {s.license_status === 'verified' ? '✔ ترخيص موثّق' : s.license_status === 'rejected' ? '✖ ترخيص مرفوض' : '⏳ ترخيص قيد التدقيق'}
                  </span>
                </div>
                {s.license_status !== 'verified' && (
                  <div className="flex gap-8 mt-8">
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={async () => {
                        try {
                          await api(`/staff/${s.id}/verify`, { method: 'POST', body: JSON.stringify({ license_status: 'verified' }) })
                          toast('تم توثيق الترخيص رسمياً', 'success')
                          setRefresh((x) => x + 1)
                        } catch (err: any) { toast(err.message, 'error') }
                      }}
                    >✔ توثيق الترخيص</button>
                    {s.license_status !== 'rejected' && (
                      <button
                        className="btn btn-line btn-sm"
                        onClick={async () => {
                          try {
                            await api(`/staff/${s.id}/verify`, { method: 'POST', body: JSON.stringify({ license_status: 'rejected' }) })
                            toast('سُجّل رفض الترخيص', 'warning')
                            setRefresh((x) => x + 1)
                          } catch (err: any) { toast(err.message, 'error') }
                        }}
                      >✖ رفض</button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="sc-body">
              <div className="kv-row"><span>التخصص</span><b>{s.specialty || '—'}</b></div>
              <div className="kv-row"><span>المؤسسة / الوحدة</span><b>{s.institution_name || '—'}</b></div>
              <div className="kv-row">
                <span>الولاية</span>
                <b>{s.wilaya_ar ? `${s.wilaya_ar} — ${s.wilaya_fr}` : '—'}</b>
              </div>
              <div className="kv-row"><span>الهاتف</span><b dir="ltr">{s.phone || '—'}</b></div>
              <div className="kv-row">
                <span>المرضى المتابَعون</span>
                <b><span className="badge badge-purple">{s.patients_count} مريض</span></b>
              </div>
            </div>
            <div className="flex gap-8 mt-8">
              <button className="btn btn-soft btn-sm" style={{ flex: 1 }} onClick={() => openEdit(s)}>✏️ تعديل</button>
              <button className="btn btn-line btn-sm" onClick={() => printStaffDoc(s)}>🖨️ طباعة</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal
          title={modal.id ? 'تعديل المتعاقد' : 'إضافة طبيب / ممرض متعاقد جديد'}
          icon="🩺"
          onClose={() => setModal(null)}
          foot={
            <>
              <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
              <button className="btn btn-success" onClick={save} disabled={busy}>
                {busy ? 'جارٍ الحفظ…' : modal.id ? 'حفظ التعديلات' : 'إضافة'}
              </button>
            </>
          }
        >
          <form onSubmit={save}>
            <Field label="الاسم الكامل">
              <input className="form-control" required value={modal.form.full_name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, full_name: e.target.value } })} />
            </Field>
            <div className="form-row">
              <Field label="الصفة">
                <select className="form-control" value={modal.form.kind} onChange={(e) => setModal({ ...modal, form: { ...modal.form, kind: e.target.value } })}>
                  <option value="doctor">طبيب متعاقد</option>
                  <option value="nurse">ممرض متعاقد</option>
                </select>
              </Field>
              <Field label="التخصص">
                <input className="form-control" value={modal.form.specialty} onChange={(e) => setModal({ ...modal, form: { ...modal.form, specialty: e.target.value } })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="الولاية">
                <select className="form-control" value={modal.form.wilaya_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, wilaya_id: e.target.value } })}>
                  <option value="">— اختر الولاية —</option>
                  {(wil.data || []).map((w) => (
                    <option key={w.code} value={w.code}>{w.code} — {w.name_ar} ({w.name_fr})</option>
                  ))}
                </select>
              </Field>
              <Field label="الهاتف">
                <input className="form-control" dir="ltr" value={modal.form.phone} onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })} />
              </Field>
            </div>
            <Field label="عدد المرضى المتابَعين">
              <input className="form-control" type="number" min={0} value={modal.form.patients_count} onChange={(e) => setModal({ ...modal, form: { ...modal.form, patients_count: e.target.value } })} />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}