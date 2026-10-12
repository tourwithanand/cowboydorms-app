import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useApp, Sheet, Status, ChannelChip, Prompt, Loading } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'
import { diffDays, fmtDateY, fmtDow, inr, errMsg, waLink, today } from '../util.js'
import { PROPERTY } from '../config.js'

export default function BookingDetail({ id, onClose }) {
  const { ver, say, refresh, channel, bed, dorm, isOwner, editBooking } = useApp()
  const [b, setB] = useState(null)
  const [busy, setBusy] = useState('')
  const [ask, setAsk] = useState(null)

  useEffect(() => { api.booking(id).then(setB).catch((e) => say(errMsg(e), true)) }, [id, ver])

  const run = async (key, fn, msg) => {
    setBusy(key)
    try { await fn(); say(msg); refresh() } catch (e) { say(errMsg(e), true) } finally { setBusy('') }
  }

  if (!b) return <Sheet title="Booking" onClose={onClose}><Loading /></Sheet>
  const ch = channel(b.channel_id)
  const nights = diffDays(b.check_in, b.check_out)
  const due = Number(b.total_amount) - Number(b.paid_amount)
  const dead = ['cancelled', 'no_show'].includes(b.status)
  const beds = (b.allocations || []).map((a) => bed(a.bed_id)).filter(Boolean)
  const T = today()

  const markPaid = () => run('paid', () => api.saveBooking({ ...b, allocations: undefined, paid_amount: b.total_amount, payment_mode: b.payment_mode || 'Cash', bed_ids: undefined }), 'Marked fully paid')
  const waText = `Hi ${b.guest_name.split(' ')[0]}, this is ${PROPERTY.name}. Your booking ${b.ref} is confirmed: ${b.beds_count} AC dorm bed${b.beds_count > 1 ? 's' : ''}, ${fmtDateY(b.check_in)} to ${fmtDateY(b.check_out)} (${nights} night${nights > 1 ? 's' : ''}). Check-in from ${PROPERTY.checkIn}. Location: https://www.google.com/maps/search/?api=1&query=Cowboy+Dorms+Neduvannoor+Aluva. See you soon!`

  return (
    <>
      <Sheet title={b.guest_name} sub={<span className="row wrap" style={{ gap: 6 }}><b>{b.ref}</b><ChannelChip ch={ch} /><Status s={b.status} /></span>} onClose={onClose}
        footer={!dead ? <>
          <button className="btn" onClick={() => editBooking(b)}><Icon name="edit" />Edit</button>
          {b.status === 'confirmed' && <button className="btn green grow" disabled={!!busy} onClick={() => run('in', () => api.setStatus(b.id, 'checked_in'), 'Checked in')}>{b.check_in > T ? 'Check in early' : 'Check in'}</button>}
          {b.status === 'checked_in' && <button className="btn dark grow" disabled={!!busy} onClick={() => run('out', () => api.setStatus(b.id, 'checked_out'), 'Checked out')}>Check out</button>}
          {b.status === 'checked_out' && <a className="btn dark grow" href={`#/bill/${b.id}`} ><Icon name="print" />Bill / receipt</a>}
        </> : isOwner ? <>
          <button className="btn danger grow" onClick={() => setAsk('delete')}><Icon name="trash" />Delete booking</button>
        </> : null}>
        <div className="stack">
          <div className="money">
            <div><div className="lab">Total</div><div className="v">{inr(b.total_amount)}</div></div>
            <div><div className="lab">Paid</div><div className="v" style={{ color: 'var(--green)' }}>{inr(b.paid_amount)}</div></div>
            <div><div className="lab">{due > 0 ? 'To collect' : 'Balance'}</div><div className="v" style={{ color: due > 0 ? 'var(--amber)' : 'var(--soft)' }}>{inr(Math.max(0, due))}</div></div>
          </div>
          {due > 0 && !dead && <button className="btn block" disabled={!!busy} onClick={markPaid}><Icon name="check" />Mark {inr(due)} received</button>}

          <div className="card pad">
            <dl className="dl">
              <dt>Stay</dt><dd>{fmtDow(b.check_in)} {fmtDateY(b.check_in)} → {fmtDow(b.check_out)} {fmtDateY(b.check_out)}<div className="muted small">{nights} night{nights > 1 ? 's' : ''}</div></dd>
              <dt>Beds</dt><dd>
                <div className="bedtags">{beds.map((x) => <span key={x.id} className="bedtag">{x.label}</span>)}{!beds.length && <span className="muted">{b.beds_count} (released)</span>}</div>
                {beds.length > 0 && <div className="muted small" style={{ marginTop: 4 }}>{[...new Set(beds.map((x) => dorm(x.dorm_id)?.name))].join(', ')}</div>}
              </dd>
              {b.phone && <><dt>Phone</dt><dd className="row wrap" style={{ gap: 6 }}>{b.phone}
                <a className="btn sm" href={`tel:${b.phone}`}><Icon name="phone" />Call</a>
                <a className="btn sm" href={waLink(b.phone, waText)} target="_blank" rel="noreferrer"><Icon name="chat" />WhatsApp</a></dd></>}
              {b.email && <><dt>Email</dt><dd>{b.email}</dd></>}
              {b.country && <><dt>Country</dt><dd>{b.country}</dd></>}
              {b.ota_ref && <><dt>{ch?.name} ref</dt><dd>{b.ota_ref}</dd></>}
              <dt>Rate</dt><dd>{inr(b.total_amount / Math.max(1, b.beds_count * nights))} / bed / night</dd>
              {Number(b.commission_amount) > 0 && <><dt>Commission</dt><dd>{inr(b.commission_amount)} <span className="muted small">· you keep {inr(b.total_amount - b.commission_amount)}</span></dd></>}
              {b.payment_mode && <><dt>Payment</dt><dd>{b.payment_mode}</dd></>}
              {b.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{b.notes}</dd></>}
              {b.cancel_reason && <><dt>Reason</dt><dd style={{ color: 'var(--red)' }}>{b.cancel_reason}</dd></>}
              <dt>Created</dt><dd className="muted small">{new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </dl>
          </div>

          {!dead && (
            <div className="actions">
              {b.status !== 'checked_out' && <a className="btn" href={`#/bill/${b.id}`} ><Icon name="print" />Bill / receipt</a>}
              {b.status === 'confirmed' && <button className="btn" onClick={() => setAsk('noshow')}>No-show</button>}
              {b.status !== 'checked_out' && <button className="btn danger" onClick={() => setAsk('cancel')}><Icon name="x" />Cancel booking</button>}
              {isOwner && <button className="btn danger" onClick={() => setAsk('delete')}><Icon name="trash" />Delete</button>}
            </div>
          )}
        </div>
      </Sheet>

      {ask === 'cancel' && <Prompt title={`Cancel ${b.ref}?`} label="Reason (e.g. guest cancelled on Booking.com)" confirm="Cancel booking & free beds" danger
        onClose={() => setAsk(null)} onSubmit={(r) => run('c', () => api.setStatus(b.id, 'cancelled', r), 'Booking cancelled – OTA updates added').then(() => setAsk(null))} />}
      {ask === 'noshow' && <Prompt title="Mark as no-show?" label="Note (optional)" confirm="Mark no-show & free beds" danger required={false}
        onClose={() => setAsk(null)} onSubmit={(r) => run('n', () => api.setStatus(b.id, 'no_show', r || 'Guest did not arrive'), 'Marked no-show').then(() => setAsk(null))} />}
      {ask === 'delete' && <Prompt title={`Delete ${b.ref} permanently?`} label='Type DELETE to confirm. Use "Cancel" instead if you want to keep a record.' confirm="Delete for ever" danger
        onClose={() => setAsk(null)} onSubmit={async (v) => {
          if (v.trim().toUpperCase() !== 'DELETE') return say('Type DELETE to confirm', true)
          await run('d', () => api.deleteBooking(b.id), 'Booking deleted'); setAsk(null); onClose()
        }} />}
    </>
  )
}
