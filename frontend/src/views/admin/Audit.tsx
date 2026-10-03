import { useApiData } from '../../auth'

export interface AuditEvent {
  id: number
  actor: string
  action: string
  action_ico: string
  entity: string
  entity_id: number
  detail: string
  old_value: string
  new_value: string
  created_at: string | null
}

const ENTITY_LABEL: Record<string, string> = {
  staff: 'المتعاقد', referral: 'إحالة', association: 'جمعية', link: 'ربط مؤسسات',
}

export function Audit() {
  const { data, error, loading } = useApiData<AuditEvent[]>('/audit', 0)
  if (loading) return <p className="muted">جارٍ تحميل السجل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const events = data || []

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>سجل العمليات (Audit Log)</h2>
          <span className="muted small">شفافية كاملة — من قام بالتعديل، متى، والقيمة القديمة والجديدة</span>
        </div>
        <span className="badge badge-purple">🕓 {events.length} حدثاً</span>
      </div>

      {!events.length && <div className="empty-state"><div className="big">🕓</div>لا أحداث بعد</div>}

      <div className="card">
        <div className="timeline">
          {events.map((e, i) => (
            <div key={e.id} className={`tl-item ${i % 2 ? 'alt' : ''}`}>
              <div className="tl-head">
                <span className="badge badge-gold">{e.action_ico} {ENTITY_LABEL[e.entity] || e.entity}</span>
                <b>{e.detail}</b>
              </div>
              <div className="tl-meta mt-8">
                بواسطة <b>{e.actor || '—'}</b> — {e.created_at ? new Date(e.created_at).toLocaleString('ar-DZ') : ''}
              </div>
              {(e.old_value || e.new_value) && (
                <div className="tl-diff">
                  {e.old_value && <span className="old">{e.old_value}</span>}
                  {e.old_value && e.new_value && <span className="arr">→</span>}
                  {e.new_value && <span className="new">{e.new_value}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="auth-note">
        <span>سجل مراجعة كامل غير قابل للتعديل — مؤشرات كل تعديل على البيانات الوطنية.</span>
      </div>
    </div>
  )
}