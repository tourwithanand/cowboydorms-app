import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, diffDays, fmtDow, fmtMonth, parse, parseRange, errMsg } from '../util.js'

const CELL = 65 // 64px + 1px border

export default function Calendar() {
  const { master, ver, say, channel, openBooking, newBooking } = useApp()
  const T = today()
  const [from, setFrom] = useState(addDays(T, -1))
  const [days, setDays] = useState(window.innerWidth > 1100 ? 21 : 14)
  const [data, setData] = useState(null)
  const to = addDays(from, days)

  useEffect(() => {
    setData(null)
    Promise.all([api.allocations(from, to), api.availability(from, to)])
      .then(([al, av]) => setData({ al, av })).catch((e) => say(errMsg(e), true))
  }, [from, days, ver])

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const dorms = master.dorms.filter((d) => d.active)
  const usedChannels = data ? [...new Set(data.al.map((a) => a.booking?.channel_id))].map(channel).filter(Boolean) : []

  return (
    <div className="stack">
      <div className="pagehead">
        <div><h1>Calendar</h1><p>{fmtMonth(from)} · tap a free cell to book that bed</p></div>
        <div className="row right wrap" style={{ gap: 6 }}>
          <button className="btn icon-btn" onClick={() => setFrom(addDays(from, -7))} aria-label="Back a week"><Icon name="left" /></button>
          <button className="btn" onClick={() => setFrom(addDays(T, -1))}>Today</button>
          <button className="btn icon-btn" onClick={() => setFrom(addDays(from, 7))} aria-label="Forward a week"><Icon name="right" /></button>
          <input className="inp" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} style={{ width: 150, height: 40 }} />
          <select className="inp" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 100, height: 40 }}>
            <option value={7}>7 days</option><option value={14}>14 days</option><option value={21}>21 days</option><option value={30}>30 days</option>
          </select>
        </div>
      </div>

      <div className="card cal">
        {!data ? <Loading /> : (
          <table>
            <thead>
              <tr>
                <th className="bedcol">Bed</th>
                {dates.map((d) => {
                  const wk = [0, 6].includes(parse(d).getDay())
                  return <th key={d} className={(d === T ? 'today ' : '') + (wk ? 'wk' : '')}>{fmtDow(d)}<b>{parse(d).getDate()}</b></th>
                })}
              </tr>
            </thead>
            <tbody>
              {dorms.map((dorm) => {
                const dbeds = master.beds.filter((b) => b.dorm_id === dorm.id && b.active)
                return [
                  <tr key={'d' + dorm.id} className="dormrow">
                    <td className="bedcol">{dorm.name}</td>
                    {dates.map((d) => {
                      const r = data.av.find((a) => a.dorm_id === dorm.id && a.night === d)
                      const f = r ? r.free : 0
                      return <td key={d} className={f <= 0 ? 'full' : f <= 2 ? 'low' : ''} title={`${f} free`}>{f <= 0 ? 'FULL' : `${f} free`}</td>
                    })}
                  </tr>,
                  ...dbeds.map((bed) => {
                    const mine = data.al.filter((a) => a.bed_id === bed.id && a.booking)
                    return (
                      <tr key={bed.id}>
                        <td className="bedcol">{bed.label}</td>
                        {dates.map((d, i) => {
                          const starts = mine.filter((a) => { const [s] = parseRange(a.stay); return s === d || (i === 0 && s < d) })
                          const busy = mine.some((a) => { const [s, e] = parseRange(a.stay); return s <= d && d < e })
                          return (
                            <td key={d} className={'cell' + (d === T ? ' today' : '')}
                              onClick={() => !busy && newBooking({ check_in: d, check_out: addDays(d, 1), dorm_id: dorm.id, bed_ids: [bed.id] })}>
                              {starts.map((a) => {
                                const [s, e] = parseRange(a.stay)
                                const span = Math.min(days, diffDays(from, e)) - Math.max(0, diffDays(from, s))
                                const b = a.booking, ch = channel(b.channel_id)
                                return (
                                  <div key={a.id} className={'bk' + (b.status === 'checked_in' ? ' in' : '') + (b.status === 'checked_out' ? ' out' : '') + (s < from ? ' cutl' : '')}
                                    style={{ width: span * CELL - (s < from ? 3 : 6), background: ch?.color || '#6B5646' }}
                                    title={`${b.guest_name} · ${ch?.name} · ${b.ref}`}
                                    onClick={(ev) => { ev.stopPropagation(); openBooking(b.id) }}>
                                    {b.guest_name}{b.beds_count > 1 && <span style={{ opacity: .8 }}>×{b.beds_count}</span>}
                                  </div>
                                )
                              })}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }),
                ]
              })}
              {!dorms.length && <tr><td className="empty" colSpan={days + 1}>No dorms yet – the owner can add them in Settings.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div className="legend">
        {usedChannels.map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}</span>)}
        <span><i style={{ background: '#999', boxShadow: 'inset 3px 0 0 #fff' }} />white edge = checked in</span>
        <span><i style={{ background: '#ccc' }} />faded = checked out</span>
      </div>
    </div>
  )
}
