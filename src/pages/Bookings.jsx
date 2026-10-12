import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Avatar, ChannelChip, Status, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, diffDays, fmtDate, inr, errMsg } from '../util.js'

const TABS = [
  { id: 'upcoming', label: 'Upcoming', q: (T) => ({ status: ['confirmed'], from: addDays(T, -60) }) },
  { id: 'inhouse', label: 'In house', q: () => ({ status: ['checked_in'] }) },
  { id: 'past', label: 'Checked out', q: () => ({ status: ['checked_out'] }) },
  { id: 'cancelled', label: 'Cancelled', q: () => ({ status: ['cancelled', 'no_show'] }) },
  { id: 'all', label: 'All', q: () => ({}) },
]

export default function Bookings() {
  const { master, ver, say, channel, openBooking } = useApp()
  const T = today()
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [ch, setCh] = useState('')
  const [rows, setRows] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const q = TABS.find((x) => x.id === tab).q(T)
      api.bookings({ ...q, search: search.trim() || undefined, channel: ch || undefined, limit: 500 })
        .then((r) => setRows(['past', 'cancelled', 'all'].includes(tab) ? r.reverse() : r))
        .catch((e) => say(errMsg(e), true))
    }, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [tab, search, ch, ver])

  const totals = rows ? rows.reduce((s, b) => ({ beds: s.beds + b.beds_count * diffDays(b.check_in, b.check_out), amt: s.amt + Number(b.total_amount), due: s.due + Math.max(0, b.total_amount - b.paid_amount) }), { beds: 0, amt: 0, due: 0 }) : null

  return (
    <div className="stack">
      <div className="pagehead"><div><h1>Bookings</h1><p>Every booking from every channel, in one place</p></div></div>

      <div className="tabs">{TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setRows(null); setTab(t.id) }}>{t.label}</button>)}</div>

      <div className="row wrap">
        <div className="grow" style={{ position: 'relative', minWidth: 200 }}>
          <Icon name="search" width="18" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--mute)' }} />
          <input className="inp" style={{ paddingLeft: 38 }} placeholder="Search guest, phone, CD- ref or OTA ref" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="inp" style={{ width: 'auto', minWidth: 160 }} value={ch} onChange={(e) => setCh(e.target.value)}>
          <option value="">All channels</option>
          {master.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!rows ? <Loading /> : (
        <>
          <div className="muted small">{rows.length} booking{rows.length !== 1 ? 's' : ''} · {totals.beds} bed-nights · {inr(totals.amt)}{totals.due > 0 && <> · <b style={{ color: 'var(--amber)' }}>{inr(totals.due)} unpaid</b></>}</div>

          <div className="card only-m list">
            {rows.map((b) => {
              const c = channel(b.channel_id); const due = b.total_amount - b.paid_amount
              return (
                <div key={b.id} className="item" onClick={() => openBooking(b.id)}>
                  <Avatar name={b.guest_name} color={c?.color} />
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}><b className="ellipsis grow">{b.guest_name}</b><span className="num" style={{ fontWeight: 700 }}>{inr(b.total_amount)}</span></div>
                    <div className="small muted" style={{ marginTop: 1 }}>{fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {diffDays(b.check_in, b.check_out)}n · {b.beds_count} bed{b.beds_count > 1 ? 's' : ''}</div>
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}><ChannelChip ch={c} /><Status s={b.status} />{due > 0 && !['cancelled', 'no_show'].includes(b.status) && <span className="chip due">{inr(due)} due</span>}</div>
                  </div>
                </div>
              )
            })}
            {!rows.length && <div className="empty">No bookings here</div>}
          </div>

          <div className="card only-d scrollx">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Guest</th><th>Channel</th><th>Stay</th><th className="r">Beds</th><th className="r">Amount</th><th className="r">Due</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const c = channel(b.channel_id); const due = b.total_amount - b.paid_amount
                  return (
                    <tr key={b.id} className="click" onClick={() => openBooking(b.id)}>
                      <td className="small"><b>{b.ref}</b>{b.ota_ref && <div className="muted tiny">{b.ota_ref}</div>}</td>
                      <td><b>{b.guest_name}</b><div className="muted tiny">{b.phone}{b.country ? ' · ' + b.country : ''}</div></td>
                      <td><ChannelChip ch={c} /></td>
                      <td className="num">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}<div className="muted tiny">{diffDays(b.check_in, b.check_out)} night{diffDays(b.check_in, b.check_out) > 1 ? 's' : ''}{b.check_in === T ? ' · arrives today' : ''}</div></td>
                      <td className="r num">{b.beds_count}</td>
                      <td className="r num"><b>{inr(b.total_amount)}</b></td>
                      <td className="r num">{due > 0 && !['cancelled', 'no_show'].includes(b.status) ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{inr(due)}</span> : <span className="muted">–</span>}</td>
                      <td><Status s={b.status} /></td>
                    </tr>
                  )
                })}
                {!rows.length && <tr><td colSpan={8} className="empty">No bookings here</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
