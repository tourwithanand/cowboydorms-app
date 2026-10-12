import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useApp, Sheet, Field } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { today, addDays, diffDays, fmtDate, inr, errMsg, PAYMENT_MODES } from '../util.js'
import { PROPERTY } from '../config.js'

export default function BookingForm({ booking, prefill = {}, onClose, onSaved }) {
  const { master, say, channel } = useApp()
  const T = today()
  const edit = !!booking
  const chans = master.channels.filter((c) => c.active || c.id === booking?.channel_id)
  const dorms = master.dorms.filter((d) => d.active)

  const init = () => {
    if (edit) {
      const n = diffDays(booking.check_in, booking.check_out)
      return {
        ...booking, dorm_id: booking.dorm_id || '', commission_amount: String(booking.commission_amount),
        rate: Math.round(booking.total_amount / Math.max(1, booking.beds_count * n)),
        total_amount: String(booking.total_amount), paid_amount: String(booking.paid_amount || ''),
        bed_ids: [], phone: booking.phone || '', email: booking.email || '', country: booking.country || '', ota_ref: booking.ota_ref || '', notes: booking.notes || '', payment_mode: booking.payment_mode || '',
      }
    }
    const ci = prefill.check_in || T
    return {
      channel_id: chans[0]?.id, ota_ref: '', guest_name: '', phone: '', email: '', country: 'India',
      check_in: ci, check_out: prefill.check_out || addDays(ci, 1), beds_count: 1, dorm_id: prefill.dorm_id || '',
      rate: PROPERTY.defaultRate, total_amount: '', commission_amount: '', paid_amount: '', payment_mode: '', notes: '',
      bed_ids: prefill.bed_ids || [],
    }
  }
  const [f, setF] = useState(init)
  const [touched, setTouched] = useState({ total: edit, comm: edit })
  const [pickBeds, setPickBeds] = useState(!!prefill.bed_ids?.length)
  const [avail, setAvail] = useState(null)
  const [busyBeds, setBusyBeds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const nights = f.check_in && f.check_out && f.check_out > f.check_in ? diffDays(f.check_in, f.check_out) : 0
  const ch = channel(Number(f.channel_id))
  const n = Math.max(1, Number(f.beds_count) || 1)

  // auto totals
  const autoTotal = Math.round(Number(f.rate || 0) * n * nights)
  const total = touched.total ? Number(f.total_amount || 0) : autoTotal
  const autoComm = Math.round(total * (ch?.commission_pct || 0)) / 100
  const comm = touched.comm ? Number(f.commission_amount || 0) : autoComm

  // availability for chosen dates
  useEffect(() => {
    if (!nights) { setAvail(null); return }
    let live = true
    Promise.all([api.availability(f.check_in, f.check_out), api.allocations(f.check_in, f.check_out)]).then(([av, al]) => {
      if (!live) return
      // free beds for the WHOLE stay, per dorm (ignoring this booking's own beds)
      const busy = new Set(al.filter((a) => a.booking_id !== booking?.id).map((a) => a.bed_id))
      setBusyBeds([...busy])
      const per = dorms.map((d) => ({ ...d, free: master.beds.filter((b) => b.dorm_id === d.id && b.active && !busy.has(b.id)).length,
        minNight: Math.min(...av.filter((r) => r.dorm_id === d.id).map((r) => r.free + (edit ? 0 : 0))) }))
      setAvail(per)
    }).catch(() => {})
    return () => { live = false }
  }, [f.check_in, f.check_out])

  const freeFor = (dormId) => {
    if (!avail) return null
    return dormId ? avail.find((d) => d.id === Number(dormId))?.free ?? 0 : avail.reduce((s, d) => s + d.free, 0)
  }
  const free = freeFor(f.dorm_id)
  const enough = free == null || free >= n

  // keep picked beds valid
  useEffect(() => { if (f.bed_ids.length > n) set('bed_ids', f.bed_ids.slice(0, n)) }, [n])

  const toggleBed = (id) => setF((x) => {
    const has = x.bed_ids.includes(id)
    if (has) return { ...x, bed_ids: x.bed_ids.filter((b) => b !== id) }
    if (x.bed_ids.length >= n) return { ...x, bed_ids: [...x.bed_ids.slice(1), id] }
    return { ...x, bed_ids: [...x.bed_ids, id] }
  })

  const save = async () => {
    setError('')
    if (!f.guest_name.trim()) return setError('Enter the guest name')
    if (!nights) return setError('Check-out must be after check-in')
    if (pickBeds && f.bed_ids.length && f.bed_ids.length !== n) return setError(`Pick ${n} bed${n > 1 ? 's' : ''} or switch off “choose beds”`)
    setSaving(true)
    try {
      const p = {
        id: booking?.id, channel_id: Number(f.channel_id), ota_ref: f.ota_ref, guest_name: f.guest_name, phone: f.phone, email: f.email,
        country: f.country, dorm_id: f.dorm_id ? Number(f.dorm_id) : null, beds_count: n, check_in: f.check_in, check_out: f.check_out,
        total_amount: total, commission_amount: comm, paid_amount: Number(f.paid_amount || 0), payment_mode: f.payment_mode, notes: f.notes,
        bed_ids: pickBeds && f.bed_ids.length ? f.bed_ids : undefined,
      }
      const b = await api.saveBooking(p)
      say(edit ? 'Booking updated' : `Booking ${b.ref} saved – OTA updates added`)
      onSaved(b)
    } catch (e) { setError(errMsg(e)) } finally { setSaving(false) }
  }

  const bedsToShow = master.beds.filter((b) => b.active && (!f.dorm_id || b.dorm_id === Number(f.dorm_id)) && dorms.some((d) => d.id === b.dorm_id))

  return (
    <Sheet title={edit ? `Edit ${booking.ref}` : 'New booking'} sub={edit ? booking.guest_name : 'Record a booking from any channel'} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary grow" disabled={saving || !enough || !nights} onClick={save}><Icon name="check" />{!enough ? 'Not enough free beds' : saving ? 'Saving…' : edit ? 'Save changes' : `Save booking · ${inr(total)}`}</button>
      </>}>
      <div className="stack">
        <Field label="Booked through">
          <div className="seg">
            {chans.map((c) => (
              <button type="button" key={c.id} className={Number(f.channel_id) === c.id ? 'on' : ''} onClick={() => { set('channel_id', c.id); setTouched((t) => ({ ...t, comm: false })) }}>
                <i style={{ background: c.color }} />{c.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="fgrid">
          <Field label="Guest name *" className="full"><input className="inp" value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} placeholder="Full name" autoFocus={!edit} /></Field>
          <Field label="Phone / WhatsApp"><input className="inp" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" /></Field>
          <Field label="Country"><input className="inp" list="countries" value={f.country} onChange={(e) => set('country', e.target.value)} /></Field>
          {ch?.is_ota && <Field label={`${ch.name} booking number`} className="full"><input className="inp" value={f.ota_ref} onChange={(e) => set('ota_ref', e.target.value)} placeholder="From the OTA confirmation" /></Field>}
        </div>
        <datalist id="countries">{['India', 'Germany', 'France', 'United Kingdom', 'USA', 'Netherlands', 'Israel', 'Russia', 'Australia', 'Spain', 'Italy', 'Canada', 'UAE', 'Saudi Arabia', 'Brazil', 'Denmark', 'Sweden', 'Japan', 'China', 'Sri Lanka', 'Nepal', 'Bangladesh', 'Malaysia'].map((c) => <option key={c} value={c} />)}</datalist>

        <div className="fgrid">
          <Field label="Check-in"><input className="inp" type="date" value={f.check_in} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, check_in: v, check_out: x.check_out <= v ? addDays(v, 1) : x.check_out })) }} /></Field>
          <Field label={`Check-out${nights ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''}`}><input className="inp" type="date" min={f.check_in ? addDays(f.check_in, 1) : undefined} value={f.check_out} onChange={(e) => set('check_out', e.target.value)} /></Field>
          <Field label="Beds">
            <div className="stepper">
              <button type="button" onClick={() => set('beds_count', Math.max(1, n - 1))}>−</button>
              <input inputMode="numeric" value={f.beds_count} onChange={(e) => set('beds_count', e.target.value.replace(/\D/g, '').slice(0, 3))} onBlur={() => set('beds_count', n)} />
              <button type="button" onClick={() => set('beds_count', n + 1)}>+</button>
            </div>
          </Field>
          <Field label="Dorm">
            <select className="inp" value={f.dorm_id} onChange={(e) => { set('dorm_id', e.target.value); set('bed_ids', []) }}>
              <option value="">Any dorm{avail ? ` (${freeFor('')} free)` : ''}</option>
              {dorms.map((d) => <option key={d.id} value={d.id}>{d.name}{avail ? ` (${freeFor(d.id)} free)` : ''}</option>)}
            </select>
          </Field>
        </div>

        {nights > 0 && avail && (
          <div className={'note ' + (enough ? 'ok' : 'bad')}>
            {enough
              ? <>✓ {free} bed{free !== 1 ? 's' : ''} free {f.dorm_id ? 'in ' + dorms.find((d) => d.id === Number(f.dorm_id))?.name : 'across dorms'} for all {nights} night{nights > 1 ? 's' : ''} ({fmtDate(f.check_in)} → {fmtDate(f.check_out)})</>
              : <>✗ Only {free} bed{free !== 1 ? 's' : ''} free for the whole stay {f.dorm_id ? 'in this dorm' : ''} – reduce beds{f.dorm_id ? ', pick another dorm' : ''} or change dates.</>}
          </div>
        )}

        <div>
          <label className="row small" style={{ gap: 8, cursor: 'pointer', fontWeight: 600, color: 'var(--soft)' }}>
            <input type="checkbox" checked={pickBeds} onChange={(e) => { setPickBeds(e.target.checked); if (!e.target.checked) set('bed_ids', []) }} />
            Choose beds myself <span className="muted" style={{ fontWeight: 400 }}>(otherwise the app picks free beds{edit ? ' and keeps the current ones' : ''})</span>
          </label>
          {pickBeds && (
            <div className="bedpick" style={{ marginTop: 10 }}>
              {bedsToShow.map((b) => (
                <button type="button" key={b.id} className={f.bed_ids.includes(b.id) ? 'on' : ''} disabled={busyBeds.includes(b.id)} onClick={() => toggleBed(b.id)}>{b.label}</button>
              ))}
              <div className="muted small" style={{ width: '100%' }}>{f.bed_ids.length} of {n} picked{edit && booking.allocations?.length ? ` · now: ${booking.allocations.map((a) => master.beds.find((b) => b.id === a.bed_id)?.label).join(', ')}` : ''}</div>
            </div>
          )}
        </div>

        <div className="card pad stack" style={{ boxShadow: 'none' }}>
          <div className="fgrid c3">
            <Field label="Rate / bed / night (₹)"><input className="inp num" inputMode="decimal" value={f.rate} onChange={(e) => { set('rate', e.target.value.replace(/[^\d.]/g, '')); setTouched((t) => ({ ...t, total: false })) }} /></Field>
            <Field label={`Total (₹)${touched.total ? '' : ' · auto'}`}><input className="inp num" inputMode="decimal" value={touched.total ? f.total_amount : autoTotal} onChange={(e) => { set('total_amount', e.target.value.replace(/[^\d.]/g, '')); setTouched((t) => ({ ...t, total: true })) }} /></Field>
            <Field label={`OTA commission (₹)${ch?.commission_pct ? ` · ${ch.commission_pct}%` : ''}`}><input className="inp num" inputMode="decimal" value={touched.comm ? f.commission_amount : autoComm} onChange={(e) => { set('commission_amount', e.target.value.replace(/[^\d.]/g, '')); setTouched((t) => ({ ...t, comm: true })) }} /></Field>
            <Field label="Paid so far (₹)"><input className="inp num" inputMode="decimal" value={f.paid_amount} placeholder="0" onChange={(e) => set('paid_amount', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
            <Field label="Payment mode">
              <select className="inp" value={f.payment_mode} onChange={(e) => set('payment_mode', e.target.value)}>
                <option value="">—</option>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <div className="f"><span className="small muted" style={{ fontWeight: 600, display: 'block', marginBottom: 5 }}>You keep</span>
              <div style={{ font: '800 22px/44px var(--head)' }}>{inr(total - comm)}</div></div>
          </div>
          {total - Number(f.paid_amount || 0) > 0 && <div className="note info">Balance to collect: <b>{inr(total - Number(f.paid_amount || 0))}</b></div>}
        </div>

        <Field label="Notes"><textarea className="inp" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Arrival time, airport pickup, ID checked, special requests…" /></Field>
        {error && <div className="note bad">{error}</div>}
      </div>
    </Sheet>
  )
}
