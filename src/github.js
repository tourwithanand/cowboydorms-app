// Storage on GitHub only: bookings live in db.json inside a PRIVATE repo,
// logins live (encrypted) in public/users.json of the app repo.
import { engine, emptyState } from './engine.js'
import { lock, unlock, toB64, fromB64 } from './crypto.js'

const API = 'https://api.github.com'
const DB_PATH = 'db.json'
const USERS_PATH = 'public/users.json'
const SESSION_KEY = 'cd-session-v1'
const err = (m) => { throw new Error(m) }

export function dump(obj) {   // one record per line → small file, readable history on GitHub
  const parts = Object.entries(obj).map(([k, v]) => Array.isArray(v)
    ? `"${k}":[${v.length ? '\n' + v.map((x) => JSON.stringify(x)).join(',\n') + '\n' : ''}]`
    : `"${k}":${JSON.stringify(v)}`)
  return '{\n' + parts.join(',\n') + '\n}\n'
}

async function gh(token, path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
    cache: 'no-store',
  })
  if (res.status === 404 && opts.allow404) return null
  if (!res.ok) {
    let msg = ''
    try { msg = (await res.json()).message || '' } catch { /* ignore */ }
    const e = new Error(
      res.status === 401 ? 'GitHub key is expired or was removed – the owner must add a new key (Settings → GitHub).'
        : res.status === 403 && /rate limit/i.test(msg) ? 'GitHub is busy (rate limit). Try again in a few minutes.'
          : res.status === 403 || res.status === 404 ? `GitHub key has no access to this repo (${msg || res.status}).`
            : `GitHub error ${res.status}: ${msg}`)
    e.status = res.status
    throw e
  }
  return res.status === 204 ? null : res.json()
}

async function readFile(token, repo, path) {
  const meta = await gh(token, `/repos/${repo}/contents/${path}`, { allow404: true })
  if (!meta) return null
  let text
  if (meta.encoding === 'base64' && meta.content) text = fromB64(meta.content)
  else { const blob = await gh(token, `/repos/${repo}/git/blobs/${meta.sha}`); text = fromB64(blob.content) }   // files over 1 MB
  return { json: JSON.parse(text), sha: meta.sha }
}
async function writeFile(token, repo, path, text, sha, message) {
  const r = await gh(token, `/repos/${repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: toB64(text), ...(sha ? { sha } : {}) }) })
  return r.content.sha
}

// ---------- logins file ----------
const REPO_KEY = 'cd-app-repo'
const rememberedRepo = () => { try { return localStorage.getItem(REPO_KEY) } catch { return null } }
export async function loadUsersFile(appRepo) {
  appRepo = appRepo || rememberedRepo()
  // 1) the copy published with the site, 2) fresh copy straight from GitHub (new logins work immediately)
  let cfg = null
  try { const r = await fetch('/users.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) cfg = await r.json() } catch { /* ignore */ }
  const repo = appRepo || cfg?.app_repo
  if (repo) {
    try { const f = await readFile(null, repo, USERS_PATH); if (f) cfg = f.json } catch { /* public read may be rate limited */ }
  }
  if (cfg?.app_repo) { try { localStorage.setItem(REPO_KEY, cfg.app_repo) } catch { /* ignore */ } }
  return cfg || { users: [] }
}

export function githubApi() {
  let sess = null           // { username, token, cfg }
  let cache = null          // { S, sha, at }
  let authCb = () => {}
  try { sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { sess = null }
  const save = () => { try { sess ? localStorage.setItem(SESSION_KEY, JSON.stringify(sess)) : localStorage.removeItem(SESSION_KEY) } catch { /* private mode */ } }
  const meUser = () => sess?.cfg.users.find((u) => u.username === sess.username)
  const actor = () => ({ username: sess.username, role: meUser()?.role || 'staff' })

  async function state(force) {
    if (!sess) err('Please sign in')
    if (!force && cache && Date.now() - cache.at < 10000) return cache
    const f = await readFile(sess.token, sess.cfg.data_repo, DB_PATH)
    if (!f) err('Data file db.json not found in ' + sess.cfg.data_repo + ' – run setup again')
    cache = { S: f.json, sha: f.sha, at: Date.now() }
    return cache
  }
  const read = async (fn) => fn(engine((await state()).S, actor()))
  async function write(fn, message) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { S, sha } = await state(true)
      const res = fn(engine(S, actor()))             // validation errors stop here
      try {
        const newSha = await writeFile(sess.token, sess.cfg.data_repo, DB_PATH, dump(S), sha, `${message} – by ${sess.username}`)
        cache = { S, sha: newSha, at: Date.now() }
        return res
      } catch (e) {
        if (e.status === 409 || e.status === 422) { await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); continue }   // someone else saved first – redo on fresh data
        throw e
      }
    }
    err('Could not save – too many people saving at once. Try again.')
  }
  async function writeUsers(mutator, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = await readFile(sess.token, sess.cfg.app_repo, USERS_PATH)
      const cfg = f?.json || { ...sess.cfg, users: [] }
      mutator(cfg)
      try {
        await writeFile(sess.token, sess.cfg.app_repo, USERS_PATH, JSON.stringify(cfg, null, 2) + '\n', f?.sha, message)
        sess.cfg = cfg; save(); return
      } catch (e) { if (e.status === 409 || e.status === 422) continue; throw e }
    }
    err('Could not update logins – try again')
  }
  const needOwner = () => { if (actor().role !== 'owner') err('Only the owner can do this') }

  return {
    demo: false,
    async needsSetup() { const cfg = await loadUsersFile(); return !cfg.users?.length ? cfg : null },
    async session() {
      if (!sess) return null
      // refresh logins so a switched-off user is signed out
      try {
        const cfg = await loadUsersFile(sess.cfg.app_repo)
        if (cfg.users?.length) { sess.cfg = cfg; save() }
        const u = meUser()
        if (!u || !u.active || !u.key) { sess = null; save(); return null }
      } catch { /* offline: keep session */ }
      return { user: { id: sess.username } }
    },
    onAuth(cb) { authCb = cb; return () => {} },
    async signIn(userId, password, appRepo) {
      const id = String(userId || '').trim().toLowerCase().split('@')[0]
      const cfg = await loadUsersFile(appRepo)
      const u = cfg.users?.find((x) => x.username === id)
      if (!u) err('Wrong user ID or password')
      if (!u.active || !u.key) err('This login is switched off – ask the owner to set a new password for you')
      const token = await unlock(u.key, password)
      if (!token) err('Wrong user ID or password')
      sess = { username: id, token, cfg }
      await state(true)                        // checks the key still works
      save(); authCb({ user: { id } }); return {}
    },
    async signOut() { sess = null; cache = null; save(); authCb(null) },
    async me() {
      const u = meUser(); if (!u) return null
      return { id: u.username, username: u.username, full_name: u.full_name, role: u.role, active: true }
    },
    async changeMyPassword(pw) {
      if (String(pw).length < 8) err('Password must be at least 8 characters')
      const key = await lock(sess.token, pw)
      await writeUsers((cfg) => { const u = cfg.users.find((x) => x.username === sess.username); u.key = key }, `Password changed for ${sess.username}`)
    },

    channels: () => read((E) => E.channels()),
    dorms: () => read((E) => E.dorms()),
    beds: () => read((E) => E.beds()),
    availability: (f, t) => read((E) => E.availability(f, t)),
    allocations: (f, t) => read((E) => E.allocations(f, t)),
    bookings: (q) => read((E) => E.bookings(q)),
    booking: (id) => read((E) => E.booking(id)),
    tasks: (q) => read((E) => E.tasks(q)),
    openTaskCount: () => read((E) => E.openTaskCount()),
    report: (f, t) => read((E) => E.report(f, t)),

    saveBooking: (p) => write((E) => E.saveBooking(p), p.id ? `Booking edited (${p.guest_name})` : `New booking: ${p.guest_name}`),
    setStatus: (id, s, r) => write((E) => E.setStatus(id, s, r), `Booking ${id} → ${s}`),
    deleteBooking: (id) => write((E) => E.deleteBooking(id), `Booking ${id} deleted`),
    markDone: (ids) => write((E) => E.markDone(ids), `OTA updates ticked (${ids.length})`),
    saveDorm: (d) => write((E) => E.saveDorm(d), `Dorm saved: ${d.name}`),
    setDormActive: (id, a) => write((E) => E.setDormActive(id, a), `Dorm ${id} ${a ? 'shown' : 'hidden'}`),
    saveChannel: (c) => write((E) => E.saveChannel(c), `Channel saved: ${c.name}`),

    // ---- logins (owner) ----
    async profiles() {
      return sess.cfg.users.map((u) => ({ id: u.username, username: u.username, full_name: u.full_name, role: u.role, active: u.active && !!u.key, created_at: u.created_at }))
    },
    async createUser({ username, full_name, password, role }) {
      needOwner()
      if (String(password).length < 8) err('Password must be at least 8 characters')
      const key = await lock(sess.token, password)
      await writeUsers((cfg) => {
        if (cfg.users.some((u) => u.username === username)) err('That user ID already exists')
        cfg.users.push({ username, full_name, role: role || 'staff', active: true, created_at: new Date().toISOString(), key })
      }, `Login added: ${username}`)
    },
    async saveProfile(p) {
      needOwner()
      if (p.id === sess.username && (p.role !== 'owner' || !p.active)) err('You cannot remove your own owner access')
      await writeUsers((cfg) => {
        const u = cfg.users.find((x) => x.username === p.id) || err('User not found')
        if (p.active && !u.key) err('Use “Reset password” to switch this login back on')
        u.full_name = p.full_name || u.full_name; u.role = p.role; u.active = !!p.active
        if (!p.active) u.key = null          // removes their copy of the GitHub key
      }, `Login updated: ${p.id}`)
    },
    async setPassword(id, pw) {
      needOwner()
      if (String(pw).length < 8) err('Password must be at least 8 characters')
      const key = await lock(sess.token, pw)
      await writeUsers((cfg) => { const u = cfg.users.find((x) => x.username === id) || err('User not found'); u.key = key; u.active = true }, `Password reset: ${id}`)
    },
    connection: () => ({ data_repo: sess.cfg.data_repo, app_repo: sess.cfg.app_repo }),
    async replaceKey(newToken, ownerPassword) {
      needOwner()
      const t = newToken.trim()
      await gh(t, `/repos/${sess.cfg.data_repo}`)          // must reach both repos
      await gh(t, `/repos/${sess.cfg.app_repo}`)
      const old = sess.token
      sess.token = t
      const key = await lock(t, ownerPassword)
      try {
        await writeUsers((cfg) => cfg.users.forEach((u) => { u.key = u.username === sess.username ? key : null }), 'GitHub key replaced – staff need new passwords')
      } catch (e) { sess.token = old; throw e }
      save()
    },
  }
}

// ---------- first-time setup ----------
export async function runSetup({ token, dataRepo, appRepo, username, full_name, password }) {
  token = token.trim()
  const me = await gh(token, '/user').catch(() => err('That GitHub key is not valid'))
  const data = await gh(token, `/repos/${dataRepo}`).catch(() => err(`Can't open ${dataRepo} – create it (Private) and give the key access to it`))
  if (!data.private) err(`${dataRepo} is PUBLIC – make it Private first (Settings → Danger zone → Change visibility), guest data must not be public`)
  await gh(token, `/repos/${appRepo}`).catch(() => err(`Can't open ${appRepo} – check the name and that the key has access to it`))
  const existing = await readFile(token, dataRepo, DB_PATH)
  if (!existing) await writeFile(token, dataRepo, DB_PATH, dump(emptyState()), null, 'Create booking database')
  const key = await lock(token, password)
  const cfg = {
    app: 'cowboy-dorms-channel-manager', data_repo: dataRepo, app_repo: appRepo, created_by: me.login,
    users: [{ username, full_name, role: 'owner', active: true, created_at: new Date().toISOString(), key }],
  }
  const cur = await readFile(token, appRepo, USERS_PATH)
  if (cur?.json?.users?.length) err('This app is already set up – sign in instead')
  await writeFile(token, appRepo, USERS_PATH, JSON.stringify(cfg, null, 2) + '\n', cur?.sha, 'Set up owner login')
  return me.login
}
export async function guessLogin(token) { return (await gh(token.trim(), '/user')).login }
