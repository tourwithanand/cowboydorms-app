import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, DEMO } from './api.js'
import { Ctx, Sheet, Prompt } from './components/ui.jsx'
import Icon from './components/Icons.jsx'
import { errMsg } from './util.js'
import Login from './pages/Login.jsx'
import Today from './pages/Today.jsx'
import Calendar from './pages/Calendar.jsx'
import Bookings from './pages/Bookings.jsx'
import OtaUpdates from './pages/OtaUpdates.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import BookingForm from './pages/BookingForm.jsx'
import BookingDetail from './pages/BookingDetail.jsx'
import Bill from './pages/Bill.jsx'
import Setup from './pages/Setup.jsx'

const NAV = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'bookings', label: 'Bookings', icon: 'list' },
  { id: 'ota', label: 'OTA updates', short: 'OTA', icon: 'sync' },
  { id: 'reports', label: 'Reports', icon: 'chart', owner: true },
  { id: 'settings', label: 'Settings', icon: 'settings', owner: true },
]

const readHash = () => (window.location.hash.replace(/^#\/?/, '') || 'today')

export default function App() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [master, setMaster] = useState(null)
  const [route, setRoute] = useState(readHash())
  const [ver, setVer] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(null)        // {booking} | {prefill}
  const [detail, setDetail] = useState(null)    // booking id
  const [more, setMore] = useState(false)
  const [pw, setPw] = useState(false)
  const [setup, setSetup] = useState(null)       // users file when the app is not set up yet

  // ---- auth ----
  useEffect(() => {
    api.session().then(async (s) => {
      if (!s) { const need = await api.needsSetup().catch(() => null); if (need) setSetup(need) }
      setSession(s)
    }).catch(() => setSession(null))
    return api.onAuth((s) => setSession(s))
  }, [])
  useEffect(() => {
    if (!session) { setMe(null); setMaster(null); return }
    api.me().then(setMe).catch(() => setMe(null))
  }, [session])

  const loadMaster = useCallback(async () => {
    const [channels, dorms, beds] = await Promise.all([api.channels(), api.dorms(), api.beds()])
    setMaster({ channels, dorms, beds })
  }, [])
  useEffect(() => { if (me?.active) loadMaster().catch((e) => say(errMsg(e), true)) }, [me, loadMaster])

  // ---- routing ----
  useEffect(() => {
    const f = () => { setRoute(readHash()); setMore(false) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const go = (r) => { window.location.hash = '/' + r; setMore(false); window.scrollTo(0, 0) }

  // ---- OTA task badge ----
  useEffect(() => {
    if (!me?.active) return
    const f = () => api.openTaskCount().then(setTaskCount).catch(() => {})
    f(); const t = setInterval(f, 60000)
    return () => clearInterval(t)
  }, [me, ver])

  const say = useCallback((msg, err) => {
    setToast({ msg, err }); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(null), err ? 5000 : 2600)
  }, [])
  const refresh = useCallback(() => setVer((v) => v + 1), [])

  const ctx = useMemo(() => ({
    me, master, ver, refresh, say, go, isOwner: me?.role === 'owner',
    channel: (id) => master?.channels.find((c) => c.id === id),
    dorm: (id) => master?.dorms.find((d) => d.id === id),
    bed: (id) => master?.beds.find((b) => b.id === id),
    reloadMaster: loadMaster,
    newBooking: (prefill = {}) => setForm({ prefill }),
    editBooking: (booking) => { setDetail(null); setForm({ booking }) },
    openBooking: (id) => setDetail(id),
  }), [me, master, ver, refresh, say, loadMaster])

  // ---- screens ----
  if (session === undefined) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>
  if (!session && setup) return <Setup cfg={setup} onDone={() => setSetup(null)} />
  if (!session) return <><DemoBanner /><Login /></>
  if (!me) return <div className="empty" style={{ paddingTop: 80 }}>Loading your profile…</div>
  if (!me.active) return (
    <div className="login"><div className="card" style={{ textAlign: 'center' }}>
      <img src="/logo.svg" alt="cowboy dorms." />
      <h2 style={{ marginTop: 14 }}>Waiting for approval</h2>
      <p className="muted">Your login ({me.username}) is created but not switched on yet. Ask the owner to activate it in Settings → Users.</p>
      <button className="btn" onClick={() => api.signOut()}>Sign out</button>
    </div></div>
  )
  if (!master) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  if (route.startsWith('bill/')) return <Ctx.Provider value={ctx}><DemoBanner /><Bill id={route.split('/')[1]} /></Ctx.Provider>

  const nav = NAV.filter((n) => !n.owner || ctx.isOwner)
  const page = nav.find((n) => n.id === route.split('/')[0])?.id || 'today'
  const Page = { today: Today, calendar: Calendar, bookings: Bookings, ota: OtaUpdates, reports: Reports, settings: Settings }[page]

  return (
    <Ctx.Provider value={ctx}>
      <DemoBanner />
      <div className="shell">
        <aside className="side">
          <img className="logo" src="/logo.svg" alt="cowboy dorms." />
          <button className="btn primary block newbtn" onClick={() => ctx.newBooking()}><Icon name="plus" /> New booking</button>
          <nav>
            {nav.map((n) => (
              <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => go(n.id)}>
                <Icon name={n.icon} />{n.label}
                {n.id === 'ota' && taskCount > 0 && <span className="count">{taskCount}</span>}
              </button>
            ))}
          </nav>
          <div className="who">
            <div style={{ fontWeight: 600 }}>{me.full_name || me.username}</div>
            <div className="muted small">{me.role === 'owner' ? 'Owner' : 'Staff'} · {me.username}</div>
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button className="btn sm" onClick={() => setPw(true)}>Password</button>
              <button className="btn sm" onClick={() => api.signOut()}><Icon name="logout" />Sign out</button>
            </div>
          </div>
        </aside>

        <div>
          <header className="top">
            <img src="/logo.svg" alt="cowboy dorms." />
            <div className="right muted small" style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <b style={{ color: 'var(--ink)' }}>{me.full_name || me.username}</b><br />{me.role === 'owner' ? 'Owner' : 'Staff'}
            </div>
          </header>
          <main className="main"><Page /></main>
        </div>
      </div>

      <nav className="tabbar">
        {NAV.slice(0, 4).map((n) => (
          <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => go(n.id)}>
            <Icon name={n.icon} />{n.short || n.label}
            {n.id === 'ota' && taskCount > 0 && <span className="dot">{taskCount}</span>}
          </button>
        ))}
        <button className={['reports', 'settings'].includes(page) ? 'on' : ''} onClick={() => setMore(true)}><Icon name="more" />More</button>
      </nav>
      {!form && !detail && <button className="fab" onClick={() => ctx.newBooking()}><Icon name="plus" />Booking</button>}

      {more && (
        <Sheet title="More" onClose={() => setMore(false)}>
          <div className="card list">
            {ctx.isOwner && <div className="item" onClick={() => go('reports')}><Icon name="chart" width="20" />Reports</div>}
            {ctx.isOwner && <div className="item" onClick={() => go('settings')}><Icon name="settings" width="20" />Settings – dorms, OTAs, users</div>}
            <div className="item" onClick={() => { setMore(false); setPw(true) }}><Icon name="user" width="20" />Change my password</div>
            <div className="item" onClick={() => api.signOut()}><Icon name="logout" width="20" />Sign out</div>
          </div>
          <p className="muted small" style={{ textAlign: 'center' }}>Signed in as {me.username} ({me.role})</p>
        </Sheet>
      )}
      {pw && <Prompt title="Change my password" label="New password (min 8 characters)" type="password" confirm="Save password"
        onClose={() => setPw(false)}
        onSubmit={async (v) => {
          if (v.length < 8) return say('Password must be at least 8 characters', true)
          try { await api.changeMyPassword(v); say('Password changed'); setPw(false) } catch (e) { say(errMsg(e), true) }
        }} />}

      {form && <BookingForm {...form} onClose={() => setForm(null)} onSaved={(b) => { setForm(null); refresh(); setDetail(b.id) }} />}
      {detail && <BookingDetail id={detail} onClose={() => setDetail(null)} />}
      {toast && <div className={'toast' + (toast.err ? ' err' : '')}>{toast.msg}</div>}
    </Ctx.Provider>
  )
}

function DemoBanner() {
  if (!DEMO) return null
  return <div className="demo-banner"><b>DEMO MODE</b> · sample data, nothing is saved · log in as <b>ali</b> / <b>demo</b> (owner) or <b>staff</b> / <b>demo</b> · <a href="/" style={{ color: '#fff', textDecoration: 'underline' }}>leave demo</a></div>
}
