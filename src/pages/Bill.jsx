import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { diffDays, fmtDateY, inr, errMsg, today } from '../util.js'
import { PROPERTY } from '../config.js'

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function words(n) {
  n = Math.round(n)
  if (n === 0) return 'Zero'
  const two = (x) => (x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? ' ' + ONES[x % 10] : ''))
  const three = (x) => (x >= 100 ? ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x))
  const parts = []
  const cr = Math.floor(n / 1e7); n %= 1e7
  const lk = Math.floor(n / 1e5); n %= 1e5
  const th = Math.floor(n / 1e3); n %= 1e3
  if (cr) parts.push(three(cr) + ' Crore')
  if (lk) parts.push(two(lk) + ' Lakh')
  if (th) parts.push(two(th) + ' Thousand')
  if (n) parts.push(three(n))
  return parts.join(' ')
}

export default function Bill({ id }) {
  const { say, channel, bed } = useApp()
  const [b, setB] = useState(null)
  useEffect(() => { api.booking(id).then(setB).catch((e) => say(errMsg(e), true)) }, [id])
  useEffect(() => { if (b) document.title = `Bill ${b.ref} – ${b.guest_name}`; return () => { document.title = 'Cowboy Dorms · Channel Manager' } }, [b])
  if (!b) return <Loading />

  const nights = diffDays(b.check_in, b.check_out)
  const rate = b.total_amount / Math.max(1, b.beds_count * nights)
  const due = Math.max(0, b.total_amount - b.paid_amount)
  const beds = (b.allocations || []).map((a) => bed(a.bed_id)?.label).filter(Boolean)
  const ch = channel(b.channel_id)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="printbar">
        <button className="btn" onClick={() => window.history.back()}><Icon name="left" />Back</button>
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" />Print / Save as PDF</button>
      </div>
      <div className="bill card">
        <div className="bh">
          <div>
            <img src="/logo.svg" alt="cowboy dorms." />
            <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5 }}>
              <b>{PROPERTY.name}</b><br />{PROPERTY.address.map((l) => <span key={l}>{l}<br /></span>)}
              Ph: {PROPERTY.phone} · {PROPERTY.email}<br />
              <b style={{ color: 'var(--red)' }}>{PROPERTY.gstNote}</b>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1>INVOICE</h1>
            <div className="muted small">Bill of stay</div>
            <table style={{ marginTop: 10, width: 'auto', marginLeft: 'auto', fontSize: 13 }}>
              <tbody>
                <tr><td className="muted" style={{ border: 0, padding: '2px 10px' }}>Invoice No.</td><td style={{ border: 0, padding: 2 }}><b>{b.ref}</b></td></tr>
                <tr><td className="muted" style={{ border: 0, padding: '2px 10px' }}>Date</td><td style={{ border: 0, padding: 2 }}><b>{fmtDateY(today())}</b></td></tr>
                <tr><td className="muted" style={{ border: 0, padding: '2px 10px' }}>Status</td><td style={{ border: 0, padding: 2 }}><b>{due > 0 ? (b.paid_amount > 0 ? 'Partly paid' : 'Unpaid') : 'Paid'}</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 30, marginTop: 18, fontSize: 13.5, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em' }}>BILLED TO</div>
            <b style={{ fontSize: 15 }}>{b.guest_name}</b><br />{b.phone}{b.country ? <><br />{b.country}</> : null}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em' }}>STAY DETAILS</div>
            Check-in: <b>{fmtDateY(b.check_in)}</b><br />Check-out: <b>{fmtDateY(b.check_out)}</b><br />
            Nights: <b>{nights}</b> · Beds: <b>{b.beds_count}</b>{beds.length ? ` (${beds.join(', ')})` : ''}
            {b.ota_ref ? <><br />Booked via {ch?.name} · {b.ota_ref}</> : null}
          </div>
        </div>

        <table>
          <thead><tr><th>Description</th><th className="r">Beds</th><th className="r">Nights</th><th className="r">Rate (₹)</th><th className="r">Amount (₹)</th></tr></thead>
          <tbody>
            <tr><td>AC Dorm Bed (per bed per night)</td><td className="r">{b.beds_count}</td><td className="r">{nights}</td><td className="r">{inr(rate)}</td><td className="r"><b>{inr(b.total_amount)}</b></td></tr>
          </tbody>
        </table>
        <table className="tot" style={{ width: 320, marginLeft: 'auto', marginTop: 6 }}>
          <tbody>
            <tr><td className="r muted">Sub total</td><td className="r">{inr(b.total_amount)}</td></tr>
            <tr className="big"><td className="r">TOTAL</td><td className="r">{inr(b.total_amount)}</td></tr>
            <tr><td className="r muted">Amount paid{b.payment_mode ? ` (${b.payment_mode})` : ''}</td><td className="r">{inr(b.paid_amount)}</td></tr>
            <tr><td className="r"><b>Balance due</b></td><td className="r" style={{ color: 'var(--red)', fontWeight: 700 }}>{inr(due)}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 8 }}><span className="muted">Amount in words: </span><b>Rupees {words(b.total_amount)} Only</b></div>
        <div style={{ fontSize: 12, color: 'var(--soft)', marginTop: 14, lineHeight: 1.6 }}>
          • Cowboy Dorms is not registered under GST, so no GST is charged on this bill.<br />
          • Check-in {PROPERTY.checkIn} · Check-out {PROPERTY.checkOut}.<br />
          • Thank you for staying with us. Safe travels!
        </div>
        <div className="foot">This is a computer-generated invoice and does not require a signature or seal.</div>
      </div>
    </div>
  )
}
