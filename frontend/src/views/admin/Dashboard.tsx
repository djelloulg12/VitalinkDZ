import { useApiData } from '../../auth'
import { Referral, WilayaReportRow } from '../../types'
import { Stat, Avatar, Stars } from '../../ui'
import { exportCSV } from '../../printutil'

interface Stats {
  staff: number
  doctors: number
  nurses: number
  patients: number
  referrals: number
  pending: number
  accepted: number
  red_alerts: number
  associations: number
  total_points: number
  units: number
  hospitals: number
  links: number
  users: number
  wilayas: number
  followups: number
  shifts: number
  zones: number
  agencies: number
  packages: number
  stations: number
  bookings: number
  reviews: number
  alerts: number
  alerts_open: number
  top_association?: { name: string; points: number; stars: number } | null
}

interface GpsData {
  staff: { kind: string; region: string }[]
  units: { region: string }[]
  associations: { region: string }[]
}

function statusBadge(s: string) {
  if (s === 'accepted') return <span className="badge badge-green">✔ مقبول</span>
  if (s === 'rejected') return <span className="badge badge-red">✖ مرفوض</span>
  if (s === 'done') return <span className="badge badge-blue">✅ أُنجزت</span>
  return <span className="badge badge-orange">⏳ قيد الانتظار</span>
}

function BarCol({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  const h = max > 0 ? Math.max(6, Math.round((value / max) * 160)) : 6
  return (
    <div className="bar-col">
      <div className="bar-val">{value}</div>
      <div className="bar-fill" style={{ height: h }} />
      <div className="bar-lab">{label}</div>
    </div>
  )
}

export function Dashboard() {
  const { data, error, loading } = useApiData<Stats>('/admin/stats', 0)
  const refs = useApiData<Referral[]>('/referrals', 0)
  const gps = useApiData<GpsData>('/gps/locations', 0)
  const wilaya = useApiData<{ items: WilayaReportRow[]; totals: Record<string, number> }>('/admin/wilaya-report', 0)

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const s = data!

  const st = {
    pending: s.pending,
    accepted: s.accepted,
    rejected: s.referrals - s.pending - s.accepted,
    max: Math.max(s.pending, s.accepted, s.referrals - s.pending - s.accepted),
  }
  const totalStaff = Math.max(s.doctors + s.nurses, 1)
  const docPct = Math.round((s.doctors / totalStaff) * 100)
  const nurPct = 100 - docPct
  const donutBg = `conic-gradient(var(--green) ${docPct}%, var(--blue) ${docPct}% 100%)`

  const regions = ['غرداية', 'الأغواط', 'ورقلة', 'تقرت', 'الوادي', 'المنيعة']
  const regionCount = (r: string) => {
    const g = gps.data
    if (!g) return 0
    const f = (x: string) => (x || '').includes(r)
    return g.staff.filter((x) => f(x.region)).length + g.units.filter((x) => f(x.region)).length + g.associations.filter((x) => f(x.region)).length
  }
  const rMax = Math.max(...regions.map(regionCount), 1)

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>لوحة المدير الوطني</h2>
          <span className="muted small">منظومة وطنية موحدة — 58 ولاية</span>
        </div>
        <div className="flex gap-8">
          <span className="badge badge-purple">🛡️ صلاحية Admin</span>
          <span className="badge badge-green">🟢 متصل</span>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        <Stat icon="🩺" num={s.staff} label="كادر متعاقد (أطباء/ممرضون)" bg="bg-purple-soft" />
        <Stat icon="🏥" num={`${s.hospitals} + ${s.units}`} label="مستشفيات + وحدات ميدانية" bg="bg-blue-soft" />
        <Stat icon="🔄" num={s.pending} label="إحالة معلقة" bg="bg-orange-soft" />
        <Stat icon="🏅" num={s.total_points} label={`نقطة جمعيات (${s.associations})`} bg="bg-green-soft" />
      </div>

      <div className="grid grid-6 mb-24">
        <div className="mini-stat"><b>{s.red_alerts}</b><span>🚨 إحالة طارئة معلقة</span></div>
        <div className="mini-stat"><b>{s.followups}</b><span>📁 ملفات متابعة</span></div>
        <div className="mini-stat"><b>{s.shifts}</b><span>🗓️ نوبات عمل</span></div>
        <div className="mini-stat"><b>{s.stations}</b><span>♨️ حمّام معدني</span></div>
        <div className="mini-stat" style={s.alerts_open > 0 ? { background: 'var(--red-050)', borderColor: 'var(--red)' } : {}}><b>{s.alerts_open}</b><span>⚡ إنذار تنبؤي مفتوح</span></div>
        <div className="mini-stat"><b>{s.bookings}</b><span>🧾 حجوزات علاجية</span></div>
        <div className="mini-stat"><b>{s.zones}</b><span>📍 أسوار جغرافية</span></div>
      </div>

      {s.top_association && (
        <div className="card card-gold mb-24" style={{ background: 'linear-gradient(140deg,#16233F,#1E3A8A 70%,#2A4AB6)', color: '#fff', borderColor: '#2A4AB6' }}>
          <div className="flex items-center justify-between flex-wrap gap-12">
            <div>
              <div className="small" style={{ opacity: .8 }}>🏅 أفضل جمعية هذا الشهر</div>
              <h3 style={{ fontSize: 22, marginTop: 4 }}>{s.top_association.name}</h3>
            </div>
            <div className="flex gap-16 items-center">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#F0D878' }}>{s.top_association.points}</div>
                <div className="small" style={{ opacity: .8 }}>نقطة</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700 }}>
                  <Stars value={s.top_association.stars} />
                </div>
                <div className="small" style={{ opacity: .8 }}>التقييم</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="grid grid-2">
            <div className="card chart-card">
              <div className="card-title"><span className="ico">📊</span> الإحالات حسب الحالة</div>
              <div className="bars">
                <BarCol label="قيد الانتظار" value={s.pending} max={st.max} cls="gold" />
                <BarCol label="مقبولة" value={s.accepted} max={st.max} cls="navy" />
                <BarCol label="مرفوضة" value={st.rejected} max={st.max} cls="gold" />
              </div>
            </div>
            <div className="card chart-card">
              <div className="card-title"><span className="ico">👥</span> الكادر المتعاقد</div>
              <div className="donut" style={{ background: donutBg }}>
                <div className="donut-center">
                  <b>{s.staff}</b>
                  <small>متعاقد</small>
                </div>
              </div>
              <div className="legend">
                <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--green)' }} />أطباء ({s.doctors})</div>
                <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--blue)' }} />ممرضون ({s.nurses})</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><span className="ico">🔄</span> أحدث الإحالات</div>
            {refs.data?.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-8" style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="pat-cell">
                  <Avatar name={r.patient_name} size={36} />
                  <div>
                    <b>{r.patient_name}</b>
                    <small>
                      {r.from?.name || '—'} ← {r.to?.name || '—'}
                    </small>
                  </div>
                </div>
                {statusBadge(r.status)}
              </div>
            ))}
            {!refs.data?.length && <div className="empty-state"><div className="big">🔄</div>لا إحالات بعد</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card">
            <div className="card-title"><span className="ico">⚡</span> تنبيهات ذكية</div>
            <div className="alerts-panel">
              <div className="alert-item">
                <div className="a-ico bg-orange-soft">🔄</div>
                <div className="a-body">
                  <b>{s.pending > 0 ? `${s.pending} إحالة قيد الانتظار — من بينها ${s.red_alerts} طارئة (تتطلب رداً خلال 6 ساعات وفريقاً مناوباً)` : 'لا إحالات معلقة — كل شيء على ما يرام'}</b>
                  <small>نظام الإحالة الإلكتروني + RED ALERT</small>
                </div>
              </div>
              <div className="alert-item">
                <div className="a-ico bg-purple-soft">📁</div>
                <div className="a-body">
                  <b>{s.followups > 0 ? `${s.followups} تدوينة متابعة مسجلة — إحداها بمؤشرات حيوية ومرفقات موقعة` : 'لم تسجَّل ملفات متابعة بعد'}</b>
                  <small>ملفات المتابعة Offline-First</small>
                </div>
              </div>
              <div className="alert-item">
                <div className="a-ico bg-red-soft">🧭</div>
                <div className="a-body">
                  <b>{s.bookings + s.reviews > 0 ? `${s.bookings} حجز علاجي نشط و${s.reviews} تقييم — السياحة العلاجية تعمل بسلاسة` : 'لا حجوزات سياحة علاجية بعد'}</b>
                  <small>حجز + اقتراح AI + موافقة الطبيب</small>
                </div>
              </div>
              <div className="alert-item">
                <div className="a-ico bg-gold-soft">🏅</div>
                <div className="a-body">
                  <b>{s.total_points > 0 ? `إجمالي نقاط الجمعيات: ${s.total_points} — راجع ترتيب الشهر` : 'لا توجد نقاط مسجلة للجمعيات بعد'}</b>
                  <small>نقاط الجمعيات النشطة</small>
                </div>
              </div>
              <div className="alert-item">
                <div className="a-ico bg-green-soft">⛓️</div>
                <div className="a-body">
                  <b>{s.links > 0 ? `${s.links} رِبط نشط بين المؤسسات` : 'لا روابط إحالة — قم بربط المؤسسات'}</b>
                  <small>ربط المؤسسات</small>
                </div>
              </div>
              <div className="alert-item">
                <div className="a-ico bg-blue-soft">🫂</div>
                <div className="a-body">
                  <b>{s.patients} مرضى يتابَعون عبر الوحدات الميدانية</b>
                  <small>الرعاية المنزلية</small>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><span className="ico">📍</span> التغطية الميدانية مناطق</div>
            {regions.map((r) => (
              <div key={r} className="mb-12">
                <div className="flex justify-between small mb-8">
                  <span>{r}</span>
                  <b>{regionCount(r)}</b>
                </div>
                <div className="prog"><div className="prog-fill" style={{ width: `${Math.round((regionCount(r) / rMax) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="flex items-center justify-between gap-8 mb-12 flex-wrap">
          <div className="card-title" style={{ margin: 0 }}><span className="ico">🗺️</span> تقرير الولايات — التغطية الوطنية (58)</div>
          <button
            className="btn btn-line btn-sm"
            onClick={() =>
              exportCSV(
                'wilaya-report.csv',
                ['الولاية', 'الكادر', 'أطباء', 'ممرضون', 'إحالات', 'معلقة', 'مقبولة', 'أنجزت', 'مستشفيات/وحدات', 'حمّامات', 'صيدليات', 'وكلات', 'حجوزات', 'متابعات'],
                (wilaya.data?.items || []).map((w) => [w.wilaya_ar, w.staff, w.doctors, w.nurses, w.referrals, w.pending, w.accepted, w.done, w.institutions, w.stations, w.pharmacies, w.agencies, w.bookings, w.followups]),
              )
            }
          >⬇️ تصدير CSV</button>
        </div>
        {wilaya.error ? (
          <p className="muted small">{wilaya.error}</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الولاية</th><th>الكادر</th><th>إحالات</th><th>معلقة</th><th>مقبولة</th><th>أنجزت</th>
                  <th>مؤسسات</th><th>حمّامات</th><th>صيدليات</th><th>وكلات</th><th>حجوزات</th>
                </tr>
              </thead>
              <tbody>
                {(wilaya.data?.items || [])
                  .filter((w) => w.staff + w.referrals + w.institutions + w.stations + w.pharmacies + w.agencies + w.bookings > 0)
                  .sort((a, b) => b.referrals - a.referrals)
                  .map((w) => (
                    <tr key={w.wilaya_code}>
                      <td><b>{w.wilaya_code}. {w.wilaya_ar}</b></td>
                      <td>{w.staff}</td>
                      <td>{w.referrals}</td>
                      <td><span className="badge badge-orange">{w.pending}</span></td>
                      <td><span className="badge badge-green">{w.accepted}</span></td>
                      <td><span className="badge badge-blue">{w.done}</span></td>
                      <td>{w.institutions}</td><td>{w.stations}</td><td>{w.pharmacies}</td><td>{w.agencies}</td><td>{w.bookings}</td>
                    </tr>
                  ))}
                {!wilaya.loading && (wilaya.data?.items || []).filter((w) => w.staff + w.referrals > 0).length === 0 && (
                  <tr><td colSpan={11} className="muted">لا نشاط بعد — ابدأ بإنشاء إحالات وربط المؤسسات.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {wilaya.data?.totals && (
          <p className="small muted mt-8">
            الإجمالي: {wilaya.data.totals.staff} كادر · {wilaya.data.totals.referrals} إحالة · {wilaya.data.totals.institutions} مؤسسة · {wilaya.data.totals.bookings} حجز علاجي
          </p>
        )}
      </div>
    </div>
  )
}