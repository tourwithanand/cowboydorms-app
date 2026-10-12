import { createContext, useContext, useEffect, useState } from 'react'
import Icon from './Icons.jsx'
import { STATUS } from '../util.js'

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function Sheet({ title, sub, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <header>
          <div className="grow">
            <h2>{title}</h2>
            {sub && <div className="muted small" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, children, className = '' }) {
  return <label className={'f ' + className}><span>{label}</span>{children}</label>
}

export function Status({ s }) {
  const x = STATUS[s] || { label: s, cls: '' }
  return <span className={'chip ' + x.cls}>{x.label}</span>
}

export function ChannelChip({ ch }) {
  if (!ch) return null
  return <span className="chip"><i style={{ background: ch.color }} />{ch.name}</span>
}

export function Avatar({ name, color }) {
  const ini = (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return <div className="avatar" style={{ background: color || 'var(--soft)' }}>{ini}</div>
}

// Small prompt dialog (used for cancel reason, passwords …)
export function Prompt({ title, label, placeholder, confirm = 'OK', danger, type = 'text', onSubmit, onClose, required = true }) {
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => { if (required && !v.trim()) return; setBusy(true); try { await onSubmit(v) } finally { setBusy(false) } }
  return (
    <Sheet title={title} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Back</button>
        <button className={'btn grow ' + (danger ? 'primary' : 'dark')} disabled={busy || (required && !v.trim())} onClick={go}>{confirm}</button></>}>
      <Field label={label}>
        <input className="inp" autoFocus type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()} />
      </Field>
    </Sheet>
  )
}

export function Loading() { return <div className="empty">Loading…</div> }
