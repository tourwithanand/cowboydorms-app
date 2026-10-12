// Booking rules, shared by GitHub storage and demo mode.
// Works on one plain "state" object (the contents of db.json).
import { today, addDays, diffDays, daysBetween } from './util.js'

export const DEFAULT_CHANNELS = [
  ['Booking.com', true, 15, 'https://admin.booking.com', '#003580'],
  ['Agoda', true, 15, 'https://ycs.agoda.com', '#5B2C83'],
  ['Hostelworld', true, 15, 'https://inbox.hostelworld.com', '#F25621'],
  ['MakeMyTrip', true, 18, 'https://connect.makemytrip.com', '#E8262D'],
  ['Goibibo', true, 18, 'https://connect.makemytrip.com', '#2276E3'],
  ['Direct / WhatsApp', false, 0, null, '#1E9E5A'],
  ['Walk-in', false, 0, null, '#B3202A'],
  ['Website', false, 0, null, '#22160E'],
].map(([name, is_ota, commission_pct, extranet_url, color], i) => ({ id: i + 1, name, is_ota, commission_pct, extranet_url, color, sort: i + 1, active: true }))

export function emptyState() {
  return {
    app: 'cowboy-dorms-channel-manager', version: 1, seq: 0,
    ids: { dorm: 0, bed: 0, channel: DEFAULT_CHANNELS.length, booking: 0, alloc: 0, task: 0 },
    dorms: [], beds: [], channels: structuredClone(DEFAULT_CHANNELS), bookings: [], allocations: [], tasks: [],
  }
}

const err = (m) => { throw new Error(m) }
const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2
const DEAD = ['cancelled', 'no_show']
const nowIso = () => new Date().toISOString()

export function engine(S, me) {
  const needOwner = () => { if (!me || me.role !== 'owner') err('Only the owner can do this') }
  const next = (k) => (S.ids[k] = (S.ids[k] || 0) + 1)
  const chan = (id) => S.channels.find((c) => c.id === Number(id))
  const dormOf = (id) => S.dorms.find((d) => d.id === id)
  const withAlloc = (b) => ({ ...b, allocations: S.allocations.filter((a) => a.booking_id === b.id).map((a) => ({ bed_id: a.bed_id, stay: `[${a.from},${a.to})` })) })

  function freeBeds(dorm, ci, co, exclude) {
    return S.beds.filter((b) => b.active && dormOf(b.dorm_id)?.active && (!dorm || b.dorm_id === dorm))
      .filter((b) => !S.allocations.some((a) => a.bed_id === b.id && a.booking_id !== exclude && overlap(a.from, a.to, ci, co)))
      .sort((x, y) => (dormOf(x.dorm_id).sort - dormOf(y.dorm_id).sort) || x.sort - y.sort || x.id - y.id)
  }
  function pick(n, dorm, ci, co, prefer, exclude) {
    const free = freeBeds(dorm, ci, co, exclude)
    const picked = free.filter((b) => prefer.includes(b.id)).slice(0, n).map((b) => b.id)
    if (picked.length >= n) return picked
    const rest = free.filter((b) => !picked.includes(b.id))
    for (const d of [...S.dorms].sort((a, b) => a.sort - b.sort || a.id - b.id)) {
      const inD = rest.filter((b) => b.dorm_id === d.id)
      if (inD.length >= n - picked.length) return picked.concat(inD.slice(0, n - picked.length).map((b) => b.id))
    }
    return picked.concat(rest.slice(0, n - picked.length).map((b) => b.id))
  }
  function raise(booking_id, reason, from, to, skip) {
    const T = today()
    if (from < T) from = T
    if (from >= to) return
    if (booking_id) S.tasks.forEach((t) => {
      if (!t.done_at && t.booking_id === booking_id && t.channel_id !== skip && (t.date_from > T ? t.date_from : T) >= from && t.date_to <= to) { t.done_at = nowIso(); t.done_by = 'auto' }
    })
    S.channels.filter((c) => c.active && c.is_ota && c.id !== skip).forEach((c) =>
      S.tasks.push({ id: next('task'), channel_id: c.id, booking_id, reason, date_from: from, date_to: to, created_at: nowIso(), done_at: null, done_by: null }))
  }
  function prune() {   // keep the data file small: drop ticked tasks older than 60 days
    const cut = new Date(Date.now() - 60 * 86400000).toISOString()
    S.tasks = S.tasks.filter((t) => !t.done_at || t.done_at > cut)
  }

  function saveBooking(p) {
    const id = p.id ? Number(p.id) : null
    const ci = p.check_in, co = p.check_out, n = Number(p.beds_count || 1), dorm = p.dorm_id ? Number(p.dorm_id) : null
    if (!String(p.guest_name || '').trim()) err('Guest name is required')
    if (!ci || !co) err('Check-in and check-out dates are required')
    if (co <= ci) err('Check-out must be after check-in')
    if (!(n >= 1 && n <= 200)) err('Number of beds must be at least 1')
    if (!chan(p.channel_id)) err('Choose where the booking came from')
    const total = Math.max(0, Number(p.total_amount || 0))
    const comm = p.commission_amount !== '' && p.commission_amount != null ? Number(p.commission_amount) : Math.round(total * chan(p.channel_id).commission_pct) / 100
    let old = null, prefer = []
    const chosen = Array.isArray(p.bed_ids) && p.bed_ids.length ? p.bed_ids.map(Number) : null
    if (id) {
      old = S.bookings.find((b) => b.id === id) || err('Booking not found – it may have been deleted')
      if (DEAD.includes(old.status)) err(`This booking is ${old.status.replace('_', '-')} – it cannot be edited`)
      prefer = S.allocations.filter((a) => a.booking_id === id).map((a) => a.bed_id)
    }
    let ids
    if (chosen) {
      if (chosen.length !== n) err(`Pick exactly ${n} bed(s)`)
      const free = freeBeds(null, ci, co, id).map((b) => b.id)
      if (chosen.some((b) => !free.includes(b))) err('One of the chosen beds is already booked on those dates')
      ids = chosen
    } else {
      ids = pick(n, dorm, ci, co, prefer, id)
      if (ids.length < n) err(`Not enough free beds: ${n} needed, only ${ids.length} free for the whole stay${dorm ? ' in ' + dormOf(dorm)?.name : ''}`)
    }
    const oldCi = old?.check_in, oldCo = old?.check_out
    const changed = !old || oldCi !== ci || oldCo !== co || old.beds_count !== n || (chosen && chosen.join() !== prefer.join())
    const fields = {
      channel_id: Number(p.channel_id), ota_ref: p.ota_ref || null, guest_name: String(p.guest_name).trim(), phone: p.phone || null,
      email: p.email || null, country: p.country || null, dorm_id: dorm, beds_count: n, check_in: ci, check_out: co,
      total_amount: total, commission_amount: comm, paid_amount: Math.max(0, Number(p.paid_amount || 0)), payment_mode: p.payment_mode || null,
      notes: p.notes || null, updated_at: nowIso(), updated_by: me.username,
    }
    let b
    if (old) { Object.assign(old, fields); b = old; S.allocations = S.allocations.filter((a) => a.booking_id !== id) }
    else {
      const d = new Date(); const ym = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0')
      S.seq += 1
      b = { id: next('booking'), ref: `CD-${ym}-${String(S.seq).padStart(4, '0')}`, status: 'confirmed', cancel_reason: null, created_at: nowIso(), created_by: me.username, ...fields }
      S.bookings.push(b)
    }
    ids.forEach((bed) => S.allocations.push({ id: next('alloc'), booking_id: b.id, bed_id: bed, from: ci, to: co }))
    const cn = chan(b.channel_id).name
    if (!old) raise(b.id, `New booking ${b.ref} · ${cn} · ${n} bed(s)`, ci, co, b.channel_id)
    else if (changed) raise(b.id, `Changed ${b.ref} · ${cn}`, ci < oldCi ? ci : oldCi, co > oldCo ? co : oldCo, b.channel_id)
    prune()
    return { ...b }
  }

  function setStatus(id, status, reason) {
    if (!['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'].includes(status)) err('Unknown status')
    const b = S.bookings.find((x) => x.id === Number(id)) || err('Booking not found')
    if (DEAD.includes(b.status)) err(`This booking is already ${b.status.replace('_', '-')}`)
    if (status === 'cancelled' && !String(reason || '').trim()) err('Give a reason for cancelling')
    b.status = status; b.updated_at = nowIso(); b.updated_by = me.username
    const T = today()
    if (status === 'checked_out' && b.check_out > T && T > b.check_in) {
      const oldOut = b.check_out
      b.check_out = T
      S.allocations.filter((a) => a.booking_id === b.id).forEach((a) => { a.to = T })
      raise(b.id, `Early check-out ${b.ref} · ${chan(b.channel_id).name} – beds free again`, T, oldOut, b.channel_id)
    }
    if (DEAD.includes(status)) {
      b.cancel_reason = String(reason || '').trim() || null
      S.allocations = S.allocations.filter((a) => a.booking_id !== b.id)
      raise(b.id, `${status === 'cancelled' ? 'Cancelled' : 'No-show'} ${b.ref} · ${chan(b.channel_id).name} – beds free again`, b.check_in, b.check_out, b.channel_id)
    }
    prune()
    return { ...b }
  }

  function deleteBooking(id) {
    needOwner()
    const b = S.bookings.find((x) => x.id === Number(id)) || err('Booking not found')
    if (!DEAD.includes(b.status)) raise(null, `Deleted ${b.ref} – beds free again`, b.check_in, b.check_out, b.channel_id)
    S.allocations = S.allocations.filter((a) => a.booking_id !== b.id)
    S.bookings = S.bookings.filter((x) => x.id !== b.id)
    S.tasks.forEach((t) => { if (t.booking_id === b.id) t.booking_id = null })
  }

  function availability(from, to) {
    const out = []
    S.dorms.filter((d) => d.active).sort((a, b) => a.sort - b.sort || a.id - b.id).forEach((d) => {
      const ds = S.beds.filter((b) => b.dorm_id === d.id && b.active).map((b) => b.id)
      daysBetween(from, to).forEach((night) => {
        const booked = new Set(S.allocations.filter((a) => ds.includes(a.bed_id) && a.from <= night && night < a.to).map((a) => a.bed_id)).size
        out.push({ dorm_id: d.id, dorm_name: d.name, night, total: ds.length, booked, free: ds.length - booked })
      })
    })
    return out
  }

  function report(from, to) {
    needOwner()
    const cap = S.beds.filter((b) => b.active && dormOf(b.dorm_id)?.active).length
    const live = S.bookings.filter((b) => !DEAD.includes(b.status) && b.check_in < to && b.check_out > from)
    const byCh = {}, daily = {}
    daysBetween(from, to).forEach((d) => (daily[d] = { night: d, sold: 0, revenue: 0 }))
    let bn = 0, rev = 0, com = 0
    live.forEach((b) => {
      const nights = diffDays(b.check_in, b.check_out)
      const c = chan(b.channel_id) || { name: 'Unknown', color: '#999' }
      daysBetween(b.check_in > from ? b.check_in : from, b.check_out < to ? b.check_out : to).forEach((d) => {
        const x = (byCh[c.name] ||= { channel: c.name, color: c.color, ids: new Set(), bed_nights: 0, revenue: 0, commission: 0 })
        x.ids.add(b.id); x.bed_nights += b.beds_count; x.revenue += b.total_amount / nights; x.commission += b.commission_amount / nights
        daily[d].sold += b.beds_count; daily[d].revenue += b.total_amount / nights
        bn += b.beds_count; rev += b.total_amount / nights; com += b.commission_amount / nights
      })
    })
    const inP = S.bookings.filter((b) => b.check_in >= from && b.check_in < to)
    return {
      capacity_per_night: cap, nights_in_period: diffDays(from, to), bed_nights_sold: bn, revenue: rev, commission: com,
      bookings: inP.filter((b) => !DEAD.includes(b.status)).length,
      cancellations: inP.filter((b) => DEAD.includes(b.status)).length,
      outstanding: live.reduce((s, b) => s + Math.max(0, b.total_amount - b.paid_amount), 0),
      by_channel: Object.values(byCh).map(({ ids, ...x }) => ({ ...x, bookings: ids.size })).sort((a, b) => b.revenue - a.revenue),
      daily: Object.values(daily),
    }
  }

  function saveDorm(d) {
    needOwner()
    if (!String(d.name || '').trim()) err('Dorm name is required')
    const want = Number(d.beds)
    if (!(want >= 0 && want <= 100)) err('Beds must be between 0 and 100')
    if (S.dorms.some((x) => x.name.toLowerCase() === d.name.trim().toLowerCase() && x.id !== d.id)) err('A dorm with that name already exists')
    let dorm = d.id ? dormOf(d.id) : null
    if (!dorm) { dorm = { id: next('dorm'), active: true }; S.dorms.push(dorm) }
    Object.assign(dorm, { name: d.name.trim(), description: d.description || null, sort: Number(d.sort || 0) })
    const pre = (d.prefix || '').trim().toUpperCase() || d.name.replace(/[^A-Za-z]/g, '')[0]?.toUpperCase() || 'B'
    const act = S.beds.filter((b) => b.dorm_id === dorm.id && b.active)
    for (let i = 1; act.length < want && i < 400; i++) {
      let b = S.beds.find((x) => x.dorm_id === dorm.id && x.label === pre + i)
      if (b && !b.active) { b.active = true; act.push(b) }
      else if (!b) { b = { id: next('bed'), dorm_id: dorm.id, label: pre + i, sort: i, active: true }; S.beds.push(b); act.push(b) }
    }
    while (act.length > want) {
      const T = today()
      const cand = act.filter((b) => !S.allocations.some((a) => a.bed_id === b.id && a.to > T)).sort((a, b) => b.sort - a.sort)[0]
      if (!cand) err('Cannot reduce beds: the remaining beds have upcoming bookings')
      cand.active = false; act.splice(act.indexOf(cand), 1)
    }
    return { ...dorm }
  }
  function setDormActive(id, active) {
    needOwner()
    const T = today()
    if (!active && S.allocations.some((a) => a.to > T && S.beds.find((b) => b.id === a.bed_id)?.dorm_id === id)) err('This dorm has upcoming bookings – move or cancel them first')
    dormOf(id).active = active
  }
  function saveChannel(c) {
    needOwner()
    if (!String(c.name || '').trim()) err('Channel name is required')
    let ch = c.id ? chan(c.id) : null
    if (!ch) { ch = { id: next('channel') }; S.channels.push(ch) }
    Object.assign(ch, {
      name: c.name.trim(), is_ota: !!c.is_ota, commission_pct: Number(c.commission_pct || 0), extranet_url: c.extranet_url || null,
      color: c.color || '#6B5646', sort: Number(c.sort ?? 99), active: c.active !== false,
    })
    return { ...ch }
  }
  function markDone(ids) {
    let n = 0
    S.tasks.forEach((t) => { if (ids.includes(t.id) && !t.done_at) { t.done_at = nowIso(); t.done_by = me.username; n++ } })
    return n
  }

  function bookings({ from, to, status, channel, search } = {}) {
    let r = S.bookings.slice()
    if (from) r = r.filter((b) => b.check_out > from)
    if (to) r = r.filter((b) => b.check_in < to)
    if (status?.length) r = r.filter((b) => status.includes(b.status))
    if (channel) r = r.filter((b) => b.channel_id === Number(channel))
    if (search) { const s = search.toLowerCase(); r = r.filter((b) => [b.guest_name, b.ref, b.ota_ref, b.phone].some((v) => (v || '').toLowerCase().includes(s))) }
    return r.sort((a, b) => a.check_in.localeCompare(b.check_in) || a.id - b.id).map(withAlloc)
  }

  return {
    channels: () => S.channels.slice().sort((a, b) => a.sort - b.sort || a.id - b.id),
    dorms: () => S.dorms.slice().sort((a, b) => a.sort - b.sort || a.id - b.id),
    beds: () => S.beds.slice().sort((a, b) => a.sort - b.sort || a.id - b.id),
    availability,
    allocations: (from, to) => S.allocations.filter((a) => overlap(a.from, a.to, from, to)).map((a) => ({
      id: a.id, bed_id: a.bed_id, booking_id: a.booking_id, stay: `[${a.from},${a.to})`, booking: S.bookings.find((x) => x.id === a.booking_id),
    })),
    bookings,
    booking: (id) => { const b = S.bookings.find((x) => x.id === Number(id)); if (!b) err('Booking not found'); return withAlloc(b) },
    saveBooking, setStatus, deleteBooking,
    tasks: ({ open = true, since } = {}) => {
      const r = S.tasks.filter((t) => (open ? !t.done_at : t.done_at && t.done_at >= since && t.done_by !== 'auto'))
        .map((t) => ({ ...t, booking: S.bookings.find((b) => b.id === t.booking_id) || null }))
      return open ? r : r.reverse()
    },
    openTaskCount: () => S.tasks.filter((t) => !t.done_at).length,
    markDone, report, saveDorm, setDormActive, saveChannel,
  }
}

// demo / test helper: seed a state with sample bookings around today
export function seedDemo(S) {
  const owner = { username: 'ali', role: 'owner' }
  const E = engine(S, owner)
  E.saveDorm({ name: 'Purple Dorm', beds: 8, description: '8-bed mixed AC dorm', sort: 1, prefix: 'P' })
  E.saveDorm({ name: 'Green Dorm', beds: 6, description: '6-bed AC dorm', sort: 2, prefix: 'G' })
  const T = today()
  const seed = [
    ['Rahul Menon', 1, 2, -1, 2, 'BK-88412', '+91 98470 12345', 'India', 1],
    ['Emma Larsen', 3, 1, 0, 3, 'HW-55120', '+45 2211 8899', 'Denmark', 1],
    ['Arjun & friends', 6, 3, 0, 1, '', '+91 99461 22334', 'India', 2],
    ['Lucas Silva', 2, 1, 1, 2, 'AG-30017', '+55 11 98888 1234', 'Brazil', 1],
    ['Sneha Pillai', 4, 2, 2, 1, 'MMT-71230', '+91 94470 55660', 'India', 2],
    ['Tom Becker', 1, 1, 3, 4, 'BK-88990', '+49 151 2233 4455', 'Germany', 1],
    ['Kerala riders group', 6, 5, 5, 2, '', '+91 98950 11122', 'India', 1],
    ['Meera Nair', 7, 1, -2, 2, '', '+91 90480 33445', 'India', 2],
  ]
  seed.forEach(([name, ch, n, start, nights, ref, phone, country, dorm]) => {
    const total = n * nights * 600
    const b = E.saveBooking({ channel_id: ch, guest_name: name, beds_count: n, check_in: addDays(T, start), check_out: addDays(T, start + nights), total_amount: total, ota_ref: ref, phone, country, dorm_id: dorm, paid_amount: start < 0 ? total : 0, payment_mode: start < 0 ? 'UPI' : '' })
    if (start < 0) S.bookings.find((x) => x.id === b.id).status = 'checked_in'
  })
  S.bookings.find((b) => b.guest_name === 'Meera Nair').status = 'checked_out'
  S.tasks.slice(0, 18).forEach((t) => { t.done_at = new Date().toISOString(); t.done_by = 'ali' })
  return S
}
