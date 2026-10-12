import { useState } from 'react'
import { api } from '../api.js'
import { runSetup, guessLogin } from '../github.js'
import { errMsg } from '../util.js'
import Icon from '../components/Icons.jsx'

export default function Setup({ cfg, onDone }) {
  const [f, setF] = useState({ token: '', dataRepo: cfg?.data_repo || '', appRepo: cfg?.app_repo || '', username: 'ali', full_name: 'Ali', password: '', password2: '' })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const check = async () => {
    setErr(''); setBusy('check')
    try {
      const login = await guessLogin(f.token)
      setF((x) => ({ ...x, dataRepo: x.dataRepo || `${login}/cowboydorms-data`, appRepo: x.appRepo || `${login}/cowboydorms-app` }))
    } catch { setErr('That key did not work – copy the whole key (it starts with github_pat_)') }
    finally { setBusy('') }
  }
  const go = async () => {
    setErr('')
    if (!/^[a-z0-9._-]{3,30}$/.test(f.username)) return setErr('User ID: 3–30 small letters/numbers, no spaces')
    if (f.password.length < 8) return setErr('Password must be at least 8 characters')
    if (f.password !== f.password2) return setErr('The two passwords are different')
    if (!/^[\w.-]+\/[\w.-]+$/.test(f.dataRepo) || !/^[\w.-]+\/[\w.-]+$/.test(f.appRepo)) return setErr('Repos must look like owner/name')
    setBusy('setup')
    try {
      await runSetup(f)
      await api.signIn(f.username, f.password, f.appRepo)
      onDone()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy('') }
  }

  return (
    <div className="login">
      <div className="card stack" style={{ maxWidth: 520 }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.svg" alt="cowboy dorms." />
          <h2 style={{ marginTop: 8 }}>First-time setup</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Connect the app to your GitHub and create the owner login. You only do this once.</p>
        </div>

        <label className="f"><span>1. GitHub key (fine-grained token)</span>
          <div className="row" style={{ gap: 8 }}>
            <input className="inp" type="password" value={f.token} onChange={(e) => set('token', e.target.value)} placeholder="github_pat_…" autoComplete="off" />
            <button className="btn" onClick={check} disabled={!f.token || !!busy}>{busy === 'check' ? '…' : 'Check'}</button>
          </div>
        </label>
        <div className="fgrid">
          <label className="f"><span>Private data repo</span><input className="inp" value={f.dataRepo} onChange={(e) => set('dataRepo', e.target.value.trim())} placeholder="you/cowboydorms-data" /></label>
          <label className="f"><span>App repo (this site)</span><input className="inp" value={f.appRepo} onChange={(e) => set('appRepo', e.target.value.trim())} placeholder="you/cowboydorms-app" /></label>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }} className="fgrid">
          <label className="f"><span>2. Owner user ID</span><input className="inp" autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} /></label>
          <label className="f"><span>Your name</span><input className="inp" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></label>
          <label className="f"><span>Password (min 8)</span><input className="inp" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" /></label>
          <label className="f"><span>Password again</span><input className="inp" type="password" value={f.password2} onChange={(e) => set('password2', e.target.value)} autoComplete="new-password" /></label>
        </div>

        {err && <div className="note bad">{err}</div>}
        <button className="btn primary block" style={{ height: 48 }} disabled={!!busy || !f.token} onClick={go}><Icon name="check" />{busy === 'setup' ? 'Setting up…' : 'Finish setup & sign in'}</button>
        <p className="muted tiny" style={{ margin: 0 }}>The key is stored only in encrypted form, locked with each person's password. Bookings are saved in your private data repo. <a href="/?demo">Try the demo first</a></p>
      </div>
    </div>
  )
}
