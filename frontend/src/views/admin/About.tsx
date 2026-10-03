import { useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { SiteContent } from '../../types'
import { Field, Modal, toast } from '../../ui'

export function AboutAdmin() {
  const [refresh, setRefresh] = useState(0)
  const about = useApiData<SiteContent>('/about/about', refresh)
  const researcher = useApiData<SiteContent>('/about/researcher', refresh)
  const [edit, setEdit] = useState<null | { key: string; title: string; sections: { h: string; p: string }[] }>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: any) => {
    e.preventDefault()
    if (!edit) return
    setBusy(true)
    try {
      await api(`/about/${edit.key}`, {
        method: 'PUT',
        body: JSON.stringify({ title: edit.title, sections: edit.sections.filter((s) => s.h || s.p) }),
      })
      toast('حُفظ المحتوى', 'success')
      setEdit(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const card = (c: SiteContent, color: string) =>
    c ? (
      <div className="card">
        <div className="flex items-center justify-between gap-8 mb-12">
          <h3 style={{ margin: 0 }}>{c.title}</h3>
          <button className="btn btn-soft btn-sm" onClick={() => setEdit({ key: c.key, title: c.title, sections: c.sections || [] })}>✏️ تعديل</button>
        </div>
        <div style={{ marginTop: 8 }}>
          {(c.sections || []).map((s, i) => (
            <div key={i} className="kv-row"><span>{s.h}</span><b style={{ whiteSpace: 'normal' }}>{s.p}</b></div>
          ))}
        </div>
        <div className="small muted mt-12">آخر تعديل: {c.updated_at ? new Date(c.updated_at).toLocaleString('ar-DZ') : '—'} · بواسطة: {c.updated_by || '—'}</div>
      </div>
    ) : <div className="empty-state"><div className="big">📄</div>لا محتوى</div>

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>من نحن والسيرة الذاتية للباحثة</h2>
          <span className="muted small">صفحات عامة قابلة للتعديل — تُنشر على الموقع بدون تسجيل دخول</span>
        </div>
      </div>
      <div className="grid grid-2">
        {card(about.data || ({ key: 'about', title: 'من نحن', sections: [] } as SiteContent), '')}
        {card(researcher.data || ({ key: 'researcher', title: 'السيرة الذاتية', sections: [] } as SiteContent), '')}
      </div>
      <div className="mt-16">
        <a className="btn btn-line btn-sm" href="/about" target="_blank">👁️ معاينة صفحة «من نحن» العامة</a>
        {' '}
        <a className="btn btn-line btn-sm" href="/portal/researcher" target="_blank">🎓 صفحة الباحثة</a>
      </div>

      {edit && (
        <Modal title={`تعديل: ${edit.key === 'about' ? 'من نحن' : 'السيرة الذاتية'}`} icon="📄"
          onClose={() => setEdit(null)} size="modal-lg"
          foot={<>
            <button className="btn btn-line" onClick={() => setEdit(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ ونشر'}</button>
          </>}>
          <form onSubmit={save}>
            <Field label="العنوان">
              <input className="form-control" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <div className="card-title mt-12"><span className="ico">📝</span> الأقسام (عنوان + فقرة)</div>
            {edit.sections.map((s, i) => (
              <div key={i} className="form-row mb-8">
                <Field label={`عنوان القسم ${i + 1}`}>
                  <input className="form-control" value={s.h} onChange={(e) => { const sections = [...edit.sections]; sections[i] = { ...sections[i], h: e.target.value }; setEdit({ ...edit, sections }) }} />
                </Field>
                <Field label="الفقرتان">
                  <textarea className="form-control" rows={2} value={s.p} onChange={(e) => { const sections = [...edit.sections]; sections[i] = { ...sections[i], p: e.target.value }; setEdit({ ...edit, sections }) }} />
                </Field>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setEdit({ ...edit, sections: edit.sections.filter((_, x) => x !== i) })}>🗑️</button>
              </div>
            ))}
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setEdit({ ...edit, sections: [...edit.sections, { h: '', p: '' }] })}>➕ إضافة قسم</button>
          </form>
        </Modal>
      )}
    </div>
  )
}