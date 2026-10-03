export function today(): string {
  return new Date().toLocaleString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function stamp(): string {
  return new Date().toLocaleString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* QR رمز تحقق رقمي (شبه QR حتمي من النص) — بدون مكتبات */
export function qrSvg(text: string, size = 92): string {
  const N = 25
  const cell = size / N
  const seed = (i: number, j: number, k: number) => {
    let x = (i * 73856093) ^ (j * 19349663) ^ (text.length * 83492791) ^ k
    x = ((x >> 16) ^ x) * 0x45d9f3b
    x = ((x >> 16) ^ x) * 0x45d9f3b
    x = (x >> 16) ^ x
    return (x & 1) === 1
  }
  const hash = text.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
  let rects = ''
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const inF = (fx: number, fy: number) => i >= fx && i < fx + 7 && j >= fy && j < fy + 7
      const border = (fx: number, fy: number) =>
        (i >= fx && i < fx + 7 && (j === fy || j === fy + 6)) ||
        (j >= fy && j < fy + 7 && (i === fx || i === fx + 6)) ||
        (i >= fx + 2 && i < fx + 5 && j >= fy + 2 && j < fy + 5)
      let fill = false
      if (inF(0, 0) || inF(0, N - 7) || inF(N - 7, 0)) fill = border(0, 0) || (inF(0, N - 7) ? border(0, N - 7) : false) || (inF(N - 7, 0) ? border(N - 7, 0) : false)
      else fill = seed(i, j, Math.abs(hash))
      if (fill) rects += `<rect x="${(j * cell).toFixed(1)}" y="${(i * cell).toFixed(1)}" width="${(cell).toFixed(1)}" height="${(cell).toFixed(1)}"/>`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects}</svg>`
}

export function emblemSvg(size = 96): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="47" fill="none" stroke="#0F172A" stroke-width="2"/>
  <circle cx="50" cy="50" r="43" fill="#F8FAFC"/>
  <path d="M35 26 A26 26 0 0 1 65 26 A26 26 0 0 0 35 74 A26 26 0 0 1 35 26Z" fill="#0F172A"/>
  <path d="M55 42 L57.8 48.5 L65 49 L59.5 53.5 L61.5 60.5 L55 56.8 L48.5 60.5 L50.5 53.5 L45 49 L52.2 48.5Z" fill="#0F172A"/>
  <text x="50" y="88" font-size="8.5" text-anchor="middle" font-family="Tajawal, Inter, sans-serif" font-weight="700" fill="#0F172A">الجمهورية الجزائرية الديمقراطية الشعبية</text>
</svg>`
}

/* تنزيل CSV (متوافق مع Excel عبر BOM) */
export function exportCSV(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const body = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/* قالب المستند الرسمي — رأس الجمهورية + QR + توقيعات + تذييل التوثيق */
export interface DocOpts {
  title: string
  number?: string
  body: string
  qr?: string
  sigs?: { label: string; sub?: string }[]
}

const DOC_CSS = `
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Readex Pro','Segoe UI',Tahoma,sans-serif; color:#0F172A; line-height:1.7; padding:22px 26px; background:#fff; }
  .d-head { display:grid; grid-template-columns:110px 1fr 110px; gap:12px; align-items:center; padding-bottom:14px; border-bottom:3px double #0F172A; }
  .d-side { text-align:center; font-size:11px; }
  .d-mid { text-align:center; }
  .d-mid .org { font-size:16px; font-weight:700; letter-spacing:1px; }
  .d-mid .sys { font-size:13px; font-weight:600; color:#7C3AED; margin:2px 0; }
  .d-mid .t { display:inline-block; margin-top:8px; padding:7px 24px; border:2px solid #0F172A; border-radius:6px; font-size:21px; font-weight:700; }
  .d-body { padding:20px 4px; }
  table { width:100%; border-collapse:collapse; font-size:13px; margin:10px 0; }
  th, td { border:1px solid #334155; padding:8px 10px; text-align:right; }
  th { background:#F1F5F9; font-weight:700; }
  .kv { display:grid; grid-template-columns:220px 1fr; gap:8px; margin-bottom:8px; font-size:14px; }
  .kv b { font-weight:700; }
  .kv span { color:#33415C; }
  .d-foot { margin-top:34px; display:grid; grid-template-columns:1fr 110px 1fr; gap:14px; align-items:end; }
  .sig { text-align:center; font-size:12px; color:#33415C; }
  .sig .line { border-top:1.6px dotted #33415C; width:170px; margin:64px auto 6px; }
  .sig b { font-size:12px; color:#0F172A; }
  .qr { text-align:center; font-size:9px; color:#64748B; }
  .qr svg { margin:0 auto 5px; display:block; }
  .auth { margin-top:16px; padding-top:10px; border-top:1px solid #CBD5E1; text-align:center; font-size:10.5px; color:#64748B; }
  .auth b { color:#7C3AED; font-weight:700; }
  .stamp-note { text-align:center; font-size:10px; color:#64748B; margin-top:6px; }
`

export function printDoc(opts: DocOpts) {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return
  const qr = opts.qr || 'RIAYATI-DZ'
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${opts.title}</title><style>${DOC_CSS}</style></head>
  <body>
    <div class="d-head">
      <div class="d-side">${emblemSvg(104)}</div>
      <div class="d-mid">
        <div class="org">الجمهورية الجزائرية الديمقراطية الشعبية</div>
        <div class="sys">رعايتي DZ — نبض الرعاية المتصل</div>
        ${opts.number ? `<div class="stamp-note">رقم الوثيقة: ${opts.number}</div>` : ''}
        <div class="t">${opts.title}</div>
      </div>
      <div class="d-side">${emblemSvg(104)}</div>
    </div>
    <div class="d-body">${opts.body}</div>
    <div class="d-foot">
      <div class="sig">${(opts.sigs || []).slice(0, 2).map((s) => `<div class="line"><b>${s.label}</b></div>`).join('')}</div>
      <div class="qr">${qrSvg(qr, 92)}<br/>تحقق رقمي عبر المنظومة</div>
      <div class="sig">${(opts.sigs || []).slice(2).map((s) => `<div class="line"><b>${s.label}</b></div>`).join('')}</div>
    </div>
    <div class="auth">موثق رقمياً عبر منظومة <b>رعايتي DZ</b> — تاريخ الإصدار: ${stamp()}</div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
    w.close()
  }, 450)
}

export function docNumber(prefix: string, id: number): string {
  return `RYT-${prefix}-${String(id).padStart(4, '0')}-${new Date().getFullYear()}`
}