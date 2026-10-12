import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Sheet, Field, Prompt, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { errMsg } from '../util.js'

export default function Settings() {
  const [tab, setTab] = useState('dorms')
  return (
    <div className="stack">
      <div className="pagehead"><div><h1>Settings</h1><p>Dorms, booking channels and staff logins</p></div></div>
      <div className="tabs">
        {[['dorms', 'Dorms & beds'], ['channels', 'Channels / OTAs'], ['users', 'Users'], ['github', 'GitHub']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'dorms' && <Dorms />}
      {tab === 'channels' && <Channels />}
      {tab === 'users' && <Users />}
      {tab === 'github' && <GitHub />}
    </div>
  )
}

function Dorms() {
  const { master, say, reloadMaster, refresh } = useApp()
  const [edit, setEdit] = useState(null)
  const bedsOf = (id) => master.beds.filter((b) => b.dorm_id === id && b.active)
  const toggle = async (d) => {
    try { await api.setDormActive(d.id, !d.active); await reloadMaster(); refresh(); say(d.active ? 'Dorm hidden' : 'Dorm active again') } catch (e) { say(errMsg(e), true) }
  }
  return (
    <>
      <div className="card list">
        {master.dorms.map((d) => (
          <div key={d.id} className="item" style={{ cursor: 'default', opacity: d.active ? 1 : .55 }}>
            <div className="avatar" style={{ background: 'var(--ink)' }}><Icon name="bed" width="20" /></div>
            <div className="grow">
              <b>{d.name}</b> <span className="chip">{bedsOf(d.id).length} beds</span>{!d.active && <span className="chip st-cancel" style={{ marginLeft: 6 }}>Hidden</span>}
              <div className="muted small">{d.description || '—'} · {bedsOf(d.id).map((b) => b.label).join(', ')}</div>
            </div>
            <button className="btn sm" onClick={() => setEdit({ ...d, beds: bedsOf(d.id).length, prefix: bedsOf(d.id)[0]?.label.replace(/\d+$/, '') || '' })}><Icon name="edit" />Edit</button>
            <button className="btn sm ghost" onClick={() => toggle(d)}>{d.active ? 'Hide' : 'Show'}</button>
          </div>
        ))}
        {!master.dorms.length && <div className="empty">No dorms yet – add your first one.</div>}
      </div>
      <button className="btn dark" onClick={() => setEdit({ name: '', beds: 6, description: '', sort: master.dorms.length + 1, prefix: '' })}><Icon name="plus" />Add dorm</button>
      <div className="note info">Bed labels are made from the prefix + number (e.g. P1…P8). Lowering the bed count switches off the highest free beds; beds with upcoming bookings are never removed.</div>
      {edit && <DormForm d={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await reloadMaster(); refresh(); say('Dorm saved') }} />}
    </>
  )
}

function DormForm({ d, onClose, onSaved }) {
  const [f, setF] = useState(d)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setErr(''); setBusy(true)
    try { await api.saveDorm(f); await onSaved() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Sheet title={d.id ? 'Edit dorm' : 'Add dorm'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary grow" disabled={busy} onClick={save}>Save dorm</button></>}>
      <div className="fgrid">
        <Field label="Dorm name" className="full"><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Purple Dorm" autoFocus /></Field>
        <Field label="Number of beds"><input className="inp" inputMode="numeric" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Bed label prefix"><input className="inp" value={f.prefix} maxLength={4} placeholder="auto (first letter)" onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })} /></Field>
        <Field label="Description" className="full"><input className="inp" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 8-bed mixed AC dorm" /></Field>
        <Field label="Order in lists"><input className="inp" inputMode="numeric" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      {err && <div className="note bad" style={{ marginTop: 12 }}>{err}</div>}
    </Sheet>
  )
}

function Channels() {
  const { master, say, reloadMaster } = useApp()
  const [edit, setEdit] = useState(null)
  return (
    <>
      <div className="card scrollx">
        <table className="tbl">
          <thead><tr><th>Channel</th><th>Type</th><th className="r">Commission</th><th>Extranet</th><th></th></tr></thead>
          <tbody>
            {master.channels.map((c) => (
              <tr key={c.id} style={{ opacity: c.active ? 1 : .5 }}>
                <td><span className="chip"><i style={{ background: c.color }} />{c.name}</span>{!c.active && <span className="muted small"> (off)</span>}</td>
                <td className="small">{c.is_ota ? 'OTA – gets update tasks' : 'Direct'}</td>
                <td className="r num">{Number(c.commission_pct)}%</td>
                <td className="small ellipsis" style={{ maxWidth: 220 }}>{c.extranet_url ? <a href={c.extranet_url} target="_blank" rel="noreferrer">{c.extranet_url.replace(/^https?:\/\//, '')}</a> : <span className="muted">—</span>}</td>
                <td className="r"><button className="btn sm" onClick={() => setEdit(c)}><Icon name="edit" />Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn dark" onClick={() => setEdit({ name: '', is_ota: true, commission_pct: 15, extranet_url: '', color: '#6B5646', active: true, sort: 99 })}><Icon name="plus" />Add channel</button>
      <div className="note info">Set each OTA's real commission so reports show what you actually keep. Turning a channel off hides it from new bookings and stops its update tasks.</div>
      {edit && <ChannelForm c={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await reloadMaster(); say('Channel saved') }} />}
    </>
  )
}

function ChannelForm({ c, onClose, onSaved }) {
  const [f, setF] = useState(c)
  const [err, setErr] = useState('')
  const save = async () => { setErr(''); try { await api.saveChannel(f); await onSaved() } catch (e) { setErr(errMsg(e)) } }
  return (
    <Sheet title={c.id ? `Edit ${c.name}` : 'Add channel'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary grow" onClick={save}>Save</button></>}>
      <div className="fgrid">
        <Field label="Name" className="full"><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Commission %"><input className="inp" inputMode="decimal" value={f.commission_pct} onChange={(e) => setF({ ...f, commission_pct: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
        <Field label="Colour"><input className="inp" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ padding: 4 }} /></Field>
        <Field label="Extranet / login page link" className="full"><input className="inp" value={f.extranet_url || ''} onChange={(e) => setF({ ...f, extranet_url: e.target.value })} placeholder="https://" /></Field>
        <label className="row full" style={{ gap: 8 }}><input type="checkbox" checked={f.is_ota} onChange={(e) => setF({ ...f, is_ota: e.target.checked })} />It's an OTA (create availability-update tasks for it)</label>
        <label className="row full" style={{ gap: 8 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Active</label>
      </div>
      {err && <div className="note bad" style={{ marginTop: 12 }}>{err}</div>}
    </Sheet>
  )
}

function Users() {
  const { me, say } = useApp()
  const [list, setList] = useState(null)
  const [add, setAdd] = useState(false)
  const [pwFor, setPwFor] = useState(null)
  const load = () => api.profiles().then(setList).catch((e) => say(errMsg(e), true))
  useEffect(() => { load() }, [])

  const update = async (u, patch, msg) => {
    try { await api.saveProfile({ ...u, ...patch }); say(msg); load() } catch (e) { say(errMsg(e), true) }
  }
  if (!list) return <Loading />
  return (
    <>
      <div className="card list">
        {list.map((u) => (
          <div key={u.id} className="item" style={{ cursor: 'default', flexWrap: 'wrap' }}>
            <div className="avatar" style={{ background: u.role === 'owner' ? 'var(--red)' : 'var(--soft)' }}>{(u.full_name || u.username || '?')[0].toUpperCase()}</div>
            <div className="grow" style={{ minWidth: 160 }}>
              <b>{u.full_name || u.username}</b>{u.id === me.id && <span className="muted small"> (you)</span>}
              <div className="muted small">User ID: <b>{u.username}</b> · {u.role === 'owner' ? 'Owner – everything' : 'Staff – bookings, no reports/settings'}</div>
            </div>
            {!u.active && <span className="chip st-cancel">Not active</span>}
            <div className="row" style={{ gap: 6 }}>
              {u.id !== me.id && <>
                <select className="inp" style={{ height: 32, width: 'auto', fontSize: 13 }} value={u.role} onChange={(e) => update(u, { role: e.target.value }, 'Role changed')}>
                  <option value="staff">Staff</option><option value="owner">Owner</option>
                </select>
                {u.active ? <button className="btn sm" onClick={() => update(u, { active: false }, 'Login switched off')}>Switch off</button>
                  : <button className="btn sm green" onClick={() => setPwFor(u)}>Activate</button>}
              </>}
              {u.active && <button className="btn sm" onClick={() => setPwFor(u)}>Reset password</button>}
            </div>
          </div>
        ))}
      </div>
      <button className="btn dark" onClick={() => setAdd(true)}><Icon name="plus" />Add staff login</button>
      <div className="note info">Staff can add, edit, check in/out and cancel bookings and tick OTA updates. Only owners see Reports and Settings or delete bookings. “Switch off” removes that person's access straight away; to let them back in, click Activate and give a new password.</div>
      {add && <AddUser onClose={() => setAdd(false)} onSaved={() => { setAdd(false); load(); say('Login created') }} />}
      {pwFor && <Prompt title={`New password for ${pwFor.username}`} label="Password (min 8 characters)" type="password" confirm="Set password"
        onClose={() => setPwFor(null)} onSubmit={async (v) => { try { await api.setPassword(pwFor.id, v); say('Password set – works in about a minute'); setPwFor(null); load() } catch (e) { say(errMsg(e), true) } }} />}
    </>
  )
}

function AddUser({ onClose, onSaved }) {
  const [f, setF] = useState({ username: '', full_name: '', password: '', role: 'staff' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setErr('')
    if (!/^[a-z0-9._-]{3,30}$/.test(f.username)) return setErr('User ID: 3–30 letters/numbers, no spaces (e.g. reception1)')
    if (f.password.length < 8) return setErr('Password must be at least 8 characters')
    setBusy(true)
    try { await api.createUser(f); onSaved() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Sheet title="Add staff login" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary grow" disabled={busy} onClick={save}>Create login</button></>}>
      <div className="fgrid">
        <Field label="User ID (used to log in)"><input className="inp" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="e.g. reception1" autoFocus /></Field>
        <Field label="Name"><input className="inp" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="e.g. Rahul" /></Field>
        <Field label="Password"><input className="inp" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="min 8 characters" /></Field>
        <Field label="Role"><select className="inp" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="staff">Staff</option><option value="owner">Owner</option></select></Field>
      </div>
      <p className="muted small">Give the person their user ID and password. They can change the password later from their own login.</p>
      {err && <div className="note bad" style={{ marginTop: 12 }}>{err}</div>}
    </Sheet>
  )
}

function GitHub() {
  const { say } = useApp()
  const c = api.connection()
  const [tok, setTok] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const replace = async () => {
    setBusy(true)
    try { await api.replaceKey(tok, pw); setTok(''); setPw(''); say('New key saved – now reset each staff password in Users') }
    catch (e) { say(errMsg(e), true) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="card pad">
        <dl className="dl">
          <dt>Bookings stored in</dt><dd><a href={`https://github.com/${c.data_repo}/commits`} target="_blank" rel="noreferrer">{c.data_repo}</a> <span className="muted small">(private · every change is a commit)</span></dd>
          <dt>App & logins</dt><dd><a href={`https://github.com/${c.app_repo}`} target="_blank" rel="noreferrer">{c.app_repo}</a></dd>
        </dl>
      </div>
      <div className="card pad stack">
        <h3>Replace the GitHub key</h3>
        <p className="muted small" style={{ margin: 0 }}>Do this when the key expires, or if a staff member leaves on bad terms. Create a new fine-grained key on GitHub with access to both repos (Contents: Read and write), paste it here and confirm with your own password. Afterwards every staff login is switched off until you reset its password in Users.</p>
        <div className="fgrid">
          <label className="f"><span>New key</span><input className="inp" type="password" autoComplete="off" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="github_pat_…" /></label>
          <label className="f"><span>Your password</span><input className="inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        </div>
        <button className="btn dark" disabled={busy || !tok || pw.length < 8} onClick={replace}>{busy ? 'Saving…' : 'Save new key'}</button>
      </div>
    </div>
  )
}
