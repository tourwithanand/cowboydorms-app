import { addDays, fmtDow, parse, today } from '../util.js'

export default function AvailStrip({ rows, from, days, onPick }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const dorms = [...new Map(rows.map((r) => [r.dorm_id, r.dorm_name])).entries()]
  const get = (d, n) => rows.find((r) => r.dorm_id === d && r.night === n)
  const T = today()
  const pill = (free, total) => {
    const cls = free <= 0 ? 'zero' : free <= Math.max(1, Math.round(total * 0.25)) ? 'low' : ''
    return <span className={'pill ' + cls}>{free}</span>
  }
  return (
    <div className="strip">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingLeft: 16 }}>Free beds</th>
            {dates.map((d) => <th key={d} style={d === T ? { color: 'var(--red)' } : null}>{fmtDow(d)}<b style={d === T ? { color: 'var(--red)' } : null}>{parse(d).getDate()}</b></th>)}
          </tr>
        </thead>
        <tbody>
          {dorms.map(([id, name]) => (
            <tr key={id}>
              <td className="l">{name}</td>
              {dates.map((d) => { const r = get(id, d); return (
                <td key={d} style={{ cursor: onPick ? 'pointer' : 'default' }} onClick={() => onPick && r?.free > 0 && onPick(d, id)}>
                  {r ? pill(r.free, r.total) : '–'}
                </td>) })}
            </tr>
          ))}
          {dorms.length > 1 && (
            <tr>
              <td className="l muted">All dorms</td>
              {dates.map((d) => {
                const rs = rows.filter((r) => r.night === d)
                const f = rs.reduce((s, r) => s + r.free, 0), t = rs.reduce((s, r) => s + r.total, 0)
                return <td key={d}>{pill(f, t)}</td>
              })}
            </tr>
          )}
          {!dorms.length && <tr><td className="empty" colSpan={days + 1}>Add your dorms in Settings first</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
