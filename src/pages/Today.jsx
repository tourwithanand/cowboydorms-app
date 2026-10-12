import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Avatar, ChannelChip, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, fmtDate, fmtDow, fmtDateY, inr, errMsg, diffDays } from '../util.js'
import AvailStrip from '../components/AvailStrip.jsx'

export default function Today() {
  const { ver, say, channel, openBooking, refresh, go, newBooking } = useApp()
  const T = today()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [tasks, setTasks] = useState(0)

  useEffect(() => {
    Promise.all([
      api.bookings({ from: addDays(T, -60), to: addDays(T, 1), status: ['confirmed', 'checked_in'] }),
      api.availability(T, addDays(T, 14)),
      api.openTaskCount(),
    ]).then(([bk, av, tc]) => { setData({ bk, av }); setTasks(tc) }).catch((e) => say(errMsg(e), true))
  }, [ver])

  if (!data) return <Loading />
  const { bk, av } = data
  const arrivals = bk.filter((b) => b.status === 'confirmed' && b.check_in === T)
  const late = bk.filter((b) => b.status === 'confirmed' && b.check_in < T)
  const departures = bk.filter((b) => b.status === 'checked_in' && b.check_out <= T)
  const inHouse = bk.filter((b) => b.status === 'checked_in' && b.check_out > T)
  const tonight = av.filter((a) => a.night === T)
  const total = tonight.reduce((s, a) => s + a.total, 0)
  const booked = tonight.reduce((s, a) => s + a.booked, 0)
  const occ = total ? Math.round((booked / total) * 100) : 0

  const act = async (b, status) => {
    setBusy(b.id + status)
    try { await api.setStatus(b.id, status); say(status === 'checked_in' ? `${b.guest_name} checked in` : status === 'checked_out' ? `${b.guest_name} checked out` : 'Marked no-show'); refresh() }
    catch (e) { say(errMsg(e), true) } finally { setBusy(null) }
  }

  const Row = ({ b, action, label, tone }) => {
    const ch = channel(b.channel_id)
    const due = Number(b.total_amount) - Number(b.paid_amount)
    return (
      <div className="item" onClick={() => openBooking(b.id)}>
        <Avatar name={b.guest_name} color={ch?.color} />
        <div className="grow">
          <div style={{ fontWeight: 600 }} className="ellipsis">{b.guest_name}</div>
          <div className="row wrap small muted" style={{ gap: 6, marginTop: 2 }}>
            <span>{b.beds_count} bed{b.beds_count > 1 ? 's' : ''} · {diffDays(b.check_in, b.check_out)}n · {fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
            <ChannelChip ch={ch} />
            {due > 0 && <span className="chip due">{inr(due)} due</span>}
          </div>
        </div>
        {action && <button className={'btn sm ' + tone} disabled={busy === b.id + action}
          onClick={(e) => { e.stopPropagation(); act(b, action) }}>{label}</button>}
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Today</h1>
          <p>{fmtDow(T)}, {fmtDateY(T)}</p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="lab">Beds sold tonight</div>
          <div className="val">{booked}<span className="muted" style={{ fontSize: 18 }}> / {total}</span></div>
          <div className="bar"><i style={{ width: occ + '%' }} /></div>
          <div className="sub">{occ}% occupied · {total - booked} free</div>
        </div>
        <div className="card kpi"><div className="lab">Arrivals today</div><div className="val">{arrivals.length}</div>
          <div className="sub">{arrivals.reduce((s, b) => s + b.beds_count, 0)} beds{late.length ? ` · ${late.length} late` : ''}</div></div>
        <div className="card kpi"><div className="lab">Check-outs today</div><div className="val">{departures.length}</div>
          <div className="sub">{inHouse.length} staying on</div></div>
        <div className={'card kpi' + (tasks ? ' alert' : '')} onClick={() => go('ota')} style={{ cursor: 'pointer' }}>
          <div className="lab">OTA updates to do</div><div className="val">{tasks}</div>
          <div className="sub">{tasks ? 'Tap to update extranets →' : 'All OTAs up to date ✓'}</div>
        </div>
      </div>

      <div className="card">
        <div className="cardhead"><h3>Free beds – next 14 days</h3><button className="btn sm right" onClick={() => go('calendar')}><Icon name="calendar" />Calendar</button></div>
        <AvailStrip rows={av} from={T} days={14} onPick={(d, dorm) => newBooking({ check_in: d, check_out: addDays(d, 1), dorm_id: dorm })} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="cardhead"><h3>Arrivals</h3><span className="chip right">{arrivals.length + late.length}</span></div>
          <div className="list">
            {late.map((b) => <Row key={b.id} b={b} action="checked_in" label="Check in" tone="green" />)}
            {arrivals.map((b) => <Row key={b.id} b={b} action="checked_in" label="Check in" tone="green" />)}
            {!arrivals.length && !late.length && <div className="empty">No arrivals today</div>}
          </div>
          {late.length > 0 && <div className="note bad" style={{ margin: '0 16px 14px' }}>
            {late.length} guest{late.length > 1 ? 's' : ''} should have arrived earlier – check in, or open the booking to mark a no-show.</div>}
        </div>
        <div className="card">
          <div className="cardhead"><h3>Check-outs</h3><span className="chip right">{departures.length}</span></div>
          <div className="list">
            {departures.map((b) => <Row key={b.id} b={b} action="checked_out" label="Check out" tone="dark" />)}
            {!departures.length && <div className="empty">No check-outs due</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardhead"><h3>In the house</h3><span className="chip right">{inHouse.reduce((s, b) => s + b.beds_count, 0)} beds</span></div>
        <div className="list">
          {inHouse.map((b) => <Row key={b.id} b={b} />)}
          {!inHouse.length && <div className="empty">Nobody checked in</div>}
        </div>
      </div>
    </div>
  )
}
