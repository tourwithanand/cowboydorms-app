// Demo mode: sample data in memory (open the app with ?demo). Nothing is saved.
import { engine, emptyState, seedDemo } from './engine.js'

export function demoApi() {
  const S = seedDemo(emptyState())
  const users = [
    { id: 'ali', username: 'ali', full_name: 'Ali', role: 'owner', active: true, created_at: '2026-01-01', pw: 'demo' },
    { id: 'staff', username: 'staff', full_name: 'Front desk', role: 'staff', active: true, created_at: '2026-01-02', pw: 'demo' },
  ]
  let me = null
  let authCb = () => {}
  const err = (m) => { throw new Error(m) }
  const E = () => { if (!me) err('Please sign in'); return engine(S, { username: me.username, role: me.role }) }
  const later = (fn) => new Promise((res, rej) => setTimeout(() => { try { res(structuredClone(fn())) } catch (e) { rej(e) } }, 120))
  const needOwner = () => { if (me?.role !== 'owner') err('Only the owner can do this') }

  return {
    demo: true,
    async needsSetup() { return null },
    async session() { return me ? { user: { id: me.id } } : null },
    onAuth(cb) { authCb = cb; return () => {} },
    async signIn(userId, password) {
      const u = users.find((x) => x.username === String(userId).trim().toLowerCase().split('@')[0])
      if (!u || u.pw !== password || !u.active) err('Wrong user ID or password')
      me = u; authCb({ user: { id: u.id } }); return {}
    },
    async signOut() { me = null; authCb(null) },
    async changeMyPassword(pw) { me.pw = pw },
    async me() { return me ? structuredClone(me) : null },

    channels: () => later(() => E().channels()),
    dorms: () => later(() => E().dorms()),
    beds: () => later(() => E().beds()),
    availability: (f, t) => later(() => E().availability(f, t)),
    allocations: (f, t) => later(() => E().allocations(f, t)),
    bookings: (q) => later(() => E().bookings(q)),
    booking: (id) => later(() => E().booking(id)),
    tasks: (q) => later(() => E().tasks(q)),
    openTaskCount: () => later(() => E().openTaskCount()),
    report: (f, t) => later(() => E().report(f, t)),
    saveBooking: (p) => later(() => E().saveBooking(p)),
    setStatus: (id, s, r) => later(() => E().setStatus(id, s, r)),
    deleteBooking: (id) => later(() => E().deleteBooking(id)),
    markDone: (ids) => later(() => E().markDone(ids)),
    saveDorm: (d) => later(() => E().saveDorm(d)),
    setDormActive: (id, a) => later(() => E().setDormActive(id, a)),
    saveChannel: (c) => later(() => E().saveChannel(c)),

    async profiles() { return users.map(({ pw, ...u }) => u) },
    async createUser({ username, full_name, password, role }) {
      needOwner()
      if (users.some((u) => u.username === username)) err('That user ID already exists')
      users.push({ id: username, username, full_name, role, active: true, created_at: new Date().toISOString(), pw: password })
    },
    async saveProfile(p) {
      needOwner()
      if (p.id === me.id && (p.role !== 'owner' || !p.active)) err('You cannot remove your own owner access')
      Object.assign(users.find((u) => u.id === p.id), { full_name: p.full_name, role: p.role, active: p.active })
    },
    async setPassword(id, pw) { needOwner(); const u = users.find((x) => x.id === id); u.pw = pw; u.active = true },
    connection: () => ({ data_repo: 'demo/cowboydorms-data', app_repo: 'demo/cowboydorms-app' }),
    async replaceKey() { err('Not available in demo mode') },
  }
}
