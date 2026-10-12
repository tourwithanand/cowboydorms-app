import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Loading, Field } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, monthStart, nextMonth, fmtMonth, fmtDate, parse, inr, errMsg, diffDays } from '../util.js'

export default function Reports() {
  const { ver, say, master } = useApp()
  const T = today()
  const presets = {
    this: [monthStart(T), nextMonth(monthStart(T))],
    last: [monthStart(addDays(monthStart(T), -1)), monthStart(T)],
    next30: [T, addDays(T, 30)],
  }
  const [p, setP] = useState('this')
  const [range, setRange] = useState(presets.this)
  const [r, setR] = useState(null)

  useEffect(() => { if (p !== 'custom') setRange(presets[p]) }, [p])
  useEffect(() => {
    if (!range[0] || !range[1] || range[1] <= range[0]) return
    setR(null)
    api.report(range[0], range[1]).then(setR).catch((e) => say(errMsg(e), true))
  }, [range, ver])

  const exportCsv = async () => {
    try {
      const rows = await api.bookings({ from: range[0], to: range[1], limit: 5000 })
      const head = ['Ref', 'Channel', 'OTA ref', 'Guest', 'Phone', 'Country', 'Check-in', 'Check-out', 'Nights', 'Beds', 'Total', 'Commission', 'Paid', 'Due', 'Payment mode', 'Status', 'Notes']
      const lines = rows.map((b) => [b.ref, master.channels.find((c) => c.id === b.channel_id)?.name, b.ota_ref, b.guest_name, b.phone, b.country, b.check_in, b.check_out,
        diffDays(b.check_in, b.check_out), b.beds_count, b.total_amount, b.commission_amount, b.paid_amount, b.total_amount - b.paid_amount, b.payment_mode, b.status, b.notes])
      const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
      a.download = `cowboy-dorms-bookings-${range[0]}-to-${range[1]}.csv`
      a.click()
    } catch (e) { say(errMsg(e), true) }
  }

  const cap = r ? r.capacity_per_night * r.nights_in_period : 0
  const occ = cap ? Math.round((r.bed_nights_sold / cap) * 100) : 0
  const net = r ? r.revenue - r.commission : 0
  const adr = r && r.bed_nights_sold ? r.revenue / r.bed_nights_sold : 0
  const maxSold = r ? Math.max(1, r.capacity_per_night, ...r.daily.map((d) => d.sold)) : 1

  return (
    <div className="stack">
      <div className="pagehead">
        <div><h1>Reports</h1><p>{p === 'this' || p === 'last' ? fmtMonth(range[0]) : `${fmtDate(range[0])} → ${fmtDate(addDays(range[1], -1))}`} · owner only</p></div>
        <button className="btn right" onClick={exportCsv}><Icon name="download" />Export bookings (Excel CSV)</button>
      </div>
      <div className="row wrap">
        <div className="tabs">
          {[['this', 'This month'], ['last', 'Last month'], ['next30', 'Next 30 days'], ['custom', 'Custom']].map(([k, l]) =>
            <button key={k} className={p === k ? 'on' : ''} onClick={() => setP(k)}>{l}</button>)}
        </div>
        {p === 'custom' && <div className="row" style={{ gap: 8 }}>
          <input className="inp" type="date" style={{ width: 150, height: 38 }} value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} />
          <span className="muted">to</span>
          <input className="inp" type="date" style={{ width: 150, height: 38 }} value={addDays(range[1], -1)} onChange={(e) => setRange([range[0], addDays(e.target.value, 1)])} />
        </div>}
      </div>

      {!r ? <Loading /> : (
        <>
          <div className="kpis">
            <div className="card kpi"><div className="lab">Occupancy</div><div className="val">{occ}%</div><div className="bar"><i style={{ width: occ + '%' }} /></div><div className="sub">{r.bed_nights_sold} of {cap} bed-nights</div></div>
            <div className="card kpi"><div className="lab">Room revenue</div><div className="val">{inr(r.revenue)}</div><div className="sub">avg {inr(adr)} / bed-night</div></div>
            <div className="card kpi"><div className="lab">OTA commission</div><div className="val">{inr(r.commission)}</div><div className="sub">{r.revenue ? Math.round((r.commission / r.revenue) * 100) : 0}% of revenue</div></div>
            <div className="card kpi"><div className="lab">You keep</div><div className="val" style={{ color: 'var(--green)' }}>{inr(net)}</div><div className="sub">{r.bookings} bookings · {r.cancellations} cancelled</div></div>
          </div>
          {r.outstanding > 0 && <div className="note bad">Unpaid balance on bookings in this period: <b>{inr(r.outstanding)}</b> – see Bookings to collect.</div>}

          <div className="card">
            <div className="cardhead"><h3>Beds sold per night</h3><span className="muted small right">capacity {r.capacity_per_night}</span></div>
            <div className="pad">
              <div className="bars">
                {r.daily.map((d) => { const wk = [0, 6].includes(parse(d.night).getDay()); return (
                  <div key={d.night} className={wk ? 'wk' : ''} style={{ height: `${(d.sold / maxSold) * 100}%` }} title={`${fmtDate(d.night)}: ${d.sold} beds · ${inr(d.revenue)}`} />) })}
              </div>
              <div className="bars-x">
                {r.daily.map((d, i) => <span key={d.night}>{r.daily.length <= 16 || i % Math.ceil(r.daily.length / 10) === 0 ? parse(d.night).getDate() : ''}</span>)}
              </div>
            </div>
          </div>

          <div className="card scrollx">
            <div className="cardhead"><h3>By channel</h3></div>
            <table className="tbl">
              <thead><tr><th>Channel</th><th className="r">Bookings</th><th className="r">Bed-nights</th><th className="r">Revenue</th><th className="r">Commission</th><th className="r">You keep</th><th>Share</th></tr></thead>
              <tbody>
                {r.by_channel.map((c) => (
                  <tr key={c.channel}>
                    <td><span className="chip"><i style={{ background: c.color }} />{c.channel}</span></td>
                    <td className="r num">{c.bookings}</td><td className="r num">{c.bed_nights}</td>
                    <td className="r num"><b>{inr(c.revenue)}</b></td><td className="r num">{inr(c.commission)}</td>
                    <td className="r num">{inr(c.revenue - c.commission)}</td>
                    <td><div className="share"><i style={{ width: `${r.revenue ? (c.revenue / r.revenue) * 100 : 0}%`, background: c.color }} /></div></td>
                  </tr>
                ))}
                {!r.by_channel.length && <tr><td colSpan={7} className="empty">No stays in this period</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted small">Revenue is spread evenly over each night of a stay, so a booking crossing two months is split between them.</p>
        </>
      )}
    </div>
  )
}
