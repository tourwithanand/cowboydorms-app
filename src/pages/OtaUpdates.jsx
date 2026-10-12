import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, fmtDate, errMsg } from '../util.js'

function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' h ago'
  return Math.floor(s / 86400) + ' d ago'
}

export default function OtaUpdates() {
  const { master, ver, say, refresh, channel } = useApp()
  const T = today()
  const [view, setView] = useState('open')
  const [tasks, setTasks] = useState(null)
  const [av, setAv] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTasks(null)
    api.tasks(view === 'open' ? { open: true } : { open: false, since: addDays(T, -7) }).then(async (ts) => {
      const live = ts.filter((t) => t.date_to > T)
      if (live.length) {
        const from = live.reduce((m, t) => (t.date_from < m ? t.date_from : m), live[0].date_from)
        const to = live.reduce((m, t) => (t.date_to > m ? t.date_to : m), live[0].date_to)
        setAv(await api.availability(from > T ? from : T, to))
      } else setAv([])
      setTasks(ts)
    }).catch((e) => say(errMsg(e), true))
  }, [ver, view])

  const done = async (ids, msg) => {
    setBusy(true)
    try { await api.markDone(ids); say(msg); refresh() } catch (e) { say(errMsg(e), true) } finally { setBusy(false) }
  }

  const dorms = master.dorms.filter((d) => d.active)
  // nights in the task's range grouped into runs with identical free-bed numbers
  const runs = (t) => {
    const out = []
    for (let d = t.date_from > T ? t.date_from : T; d < t.date_to; d = addDays(d, 1)) {
      const vals = dorms.map((dm) => av.find((a) => a.dorm_id === dm.id && a.night === d)?.free ?? 0)
      const last = out[out.length - 1]
      if (last && last.vals.join() === vals.join() && addDays(last.to, 1) === d) last.to = d
      else out.push({ from: d, to: d, vals })
    }
    return out
  }

  const groups = tasks ? master.channels.map((c) => ({ c, items: tasks.filter((t) => t.channel_id === c.id) })).filter((g) => g.items.length) : []

  return (
    <div className="stack">
      <div className="pagehead">
        <div><h1>OTA updates</h1><p>Keep every OTA in step so nobody gets overbooked</p></div>
        <div className="tabs right">
          <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>To do</button>
          <button className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Done (7 days)</button>
        </div>
      </div>

      {view === 'open' && <div className="note info">
        <b>How it works:</b> every new booking, change or cancellation adds a task for each of the other OTAs. Open that OTA's extranet, set the free beds shown below for those dates (0 = close the date), then tick the task.
      </div>}

      {!tasks ? <Loading /> : !groups.length ? (
        <div className="card empty" style={{ padding: 40 }}>
          <div style={{ fontSize: 34 }}>✓</div>
          <h3 style={{ marginTop: 6 }}>{view === 'open' ? 'All OTAs are up to date' : 'Nothing marked done in the last 7 days'}</h3>
        </div>
      ) : groups.map(({ c, items }) => (
        <div key={c.id} className="card">
          <div className="cardhead">
            <span style={{ width: 12, height: 12, borderRadius: 4, background: c.color }} />
            <h3>{c.name}</h3>
            <span className="chip">{items.length}</span>
            <div className="row right" style={{ gap: 6 }}>
              {c.extranet_url && <a className="btn sm" href={c.extranet_url} target="_blank" rel="noreferrer"><Icon name="external" />Extranet</a>}
              {view === 'open' && <button className="btn sm green" disabled={busy} onClick={() => done(items.map((t) => t.id), `${c.name} marked up to date`)}><Icon name="check" />All done</button>}
            </div>
          </div>
          {items.map((t) => {
            const past = t.date_to <= T
            return (
              <div key={t.id} className="task">
                {view === 'open'
                  ? <button className="check" title="Mark done" disabled={busy} onClick={() => done([t.id], 'Done')}><Icon name="check" /></button>
                  : <span className="check" style={{ borderColor: 'var(--green)', background: 'var(--green-t)' }}><Icon name="check" style={{ opacity: 1 }} /></span>}
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{t.reason}</div>
                  <div className="muted small">{t.booking?.guest_name ? t.booking.guest_name + ' · ' : ''}{fmtDate(t.date_from)} → {fmtDate(t.date_to)} · {view === 'open' ? ago(t.created_at) : 'done ' + ago(t.done_at)}</div>
                  {past ? <div className="muted small" style={{ marginTop: 6 }}>These dates have passed – nothing to update, just tick it.</div>
                    : view === 'open' && (
                      <div className="setto">
                        {runs(t).map((r) => (
                          <div key={r.from} className="d">
                            <span className="muted">{r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)}–${fmtDate(r.to)}`}: </span>
                            {dorms.map((dm, i) => (
                              <span key={dm.id}>{i > 0 && ' · '}{dorms.length > 1 && dm.name.replace(/ dorm$/i, '') + ' '}
                                {r.vals[i] <= 0 ? <span className="z">CLOSE</span> : <b>{r.vals[i]}</b>}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
