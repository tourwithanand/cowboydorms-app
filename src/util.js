// ---------- dates (all plain YYYY-MM-DD strings, local time) ----------
export const pad = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
export const daysBetween = (from, to) => { const out = []; for (let d = from; d < to; d = addDays(d, 1)) out.push(d); return out }
export const monthStart = (s = today()) => s.slice(0, 8) + '01'
export const nextMonth = (s) => { const d = parse(s); d.setMonth(d.getMonth() + 1, 1); return iso(d) }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const fmtDate = (s) => { if (!s) return ''; const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}` }
export const fmtDateY = (s) => { if (!s) return ''; const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` }
export const fmtDow = (s) => DOW[parse(s).getDay()]
export const fmtMonth = (s) => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getFullYear()}` }
export const fmtRange = (a, b) => `${fmtDate(a)} → ${fmtDate(b)}`

// ---------- money ----------
export const inr = (n) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN')

// ---------- Postgres daterange "[2026-11-01,2026-11-03)" ----------
export function parseRange(r) {
  if (!r) return [null, null]
  if (typeof r === 'object') return [r.from, r.to]
  const m = String(r).match(/[\[(]([\d-]+),([\d-]+)[\])]/)
  return m ? [m[1], m[2]] : [null, null]
}

export const STATUS = {
  confirmed:   { label: 'Confirmed',   cls: 'st-confirmed' },
  checked_in:  { label: 'Checked in',  cls: 'st-in' },
  checked_out: { label: 'Checked out', cls: 'st-out' },
  cancelled:   { label: 'Cancelled',   cls: 'st-cancel' },
  no_show:     { label: 'No-show',     cls: 'st-cancel' },
}

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Paid to OTA', 'Pay at property']

export const cleanPhone = (p) => (p || '').replace(/[^\d+]/g, '')
export const waLink = (phone, text = '') => {
  let p = cleanPhone(phone).replace(/^\+/, '')
  if (p.length === 10) p = '91' + p
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export function errMsg(e) {
  const m = e?.message || String(e)
  return m.replace(/^.*?ERROR:\s*/, '')
}
