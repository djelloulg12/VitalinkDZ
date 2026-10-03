import { useApiData } from '../../auth'
import { Wilaya } from '../../types'
import { exportCSV } from '../../printutil'

export function Wilayas() {
  const { data, error, loading } = useApiData<Wilaya[]>('/wilayas', 0)
  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const rows = data || []

  const exportWilayasCSV = () =>
    exportCSV(
      'wilayas_dz.csv',
      ['الرقم', 'الاسم بالعربية', 'الاسم بالفرنسية', 'خط العرض', 'خط الطول'],
      rows.map((w) => [w.code, w.name_ar, w.name_fr, w.lat.toFixed(3), w.lng.toFixed(3)]),
    )

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>الولايات (Wilayas DZ)</h2>
          <span className="muted small">58 ولاية رسمية مع المواقع الجغرافية</span>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-line" onClick={exportWilayasCSV}>⬇️ تصدير CSV</button>
          <span className="badge badge-purple">🗺️ {rows.length} ولاية</span>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم بالعربية</th>
                <th>الاسم بالفرنسية</th>
                <th>خط العرض</th>
                <th>خط الطول</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.code}>
                  <td><span className="badge badge-gray">{w.code}</span></td>
                  <td><b>{w.name_ar}</b></td>
                  <td className="muted">{w.name_fr}</td>
                  <td dir="ltr" className="muted">{w.lat.toFixed(3)}</td>
                  <td dir="ltr" className="muted">{w.lng.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}