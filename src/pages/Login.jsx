import { useState } from 'react'
import { api } from '../api.js'
import { errMsg } from '../util.js'
import Icon from '../components/Icons.jsx'

export default function Login() {
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api.signIn(user, pw) }
    catch (x) { const m = errMsg(x); setErr(/invalid/i.test(m) ? 'Wrong user ID or password' : m) }
    finally { setBusy(false) }
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.svg" alt="cowboy dorms." />
          <div className="muted small" style={{ letterSpacing: '.14em', fontWeight: 600 }}>CHANNEL MANAGER</div>
        </div>
        <label className="f"><span>User ID</span>
          <input className="inp" autoFocus autoCapitalize="none" autoCorrect="off" autoComplete="username" value={user}
            onChange={(e) => setUser(e.target.value)} placeholder="e.g. ali" required />
        </label>
        <label className="f"><span>Password</span>
          <input className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </label>
        {err && <div className="note bad">{err}</div>}
        <button className="btn primary block" style={{ height: 48 }} disabled={busy}><Icon name="login" />{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted tiny" style={{ textAlign: 'center', margin: '6px 0 0' }}>Forgot your password? Ask the owner to reset it.</p>
      </form>
    </div>
  )
}
