'use client'

import { useState } from 'react'

const SPORTS = [
  { id: 'golf',   label: 'Golf' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'padel',  label: 'Padel' },
  { id: 'hash',   label: 'Hash (running)' },
  { id: 'darts',  label: 'Darts' },
  { id: 'chess',  label: 'Chess' },
  { id: 'other',  label: 'Other (tell us in the note)' },
]

export default function ExpressInterest() {
  const [sport, setSport] = useState('golf')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await fetch('/api/sports/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, email, name, note }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error || 'Something went wrong'); setBusy(false); return }
      setDone(true); setBusy(false)
    } catch {
      setError('Network error')
      setBusy(false)
    }
  }

  return (
    <>
      <style>{`
        /* Two columns: the ask set large on the left, the form on the right as
           underlined fields — the /studio way of drawing a line, not a box. */
        .interest-section {
          max-width: 1180px; margin: 0 auto;
          padding: 110px 24px 140px;
          color: #E5D4C2;
          display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: start;
        }
        .interest-eyebrow {
          font-family: 'Google Sans Code', monospace; font-size: 10.5px;
          color: #D4B85A; letter-spacing: .22em; text-transform: uppercase;
          padding-top: 26px; border-top: 1px solid rgba(229,212,194,.15);
        }
        .interest-title {
          font-family: 'Rampant Sans', serif; font-weight: 400;
          font-size: clamp(34px, 5.6vw, 68px); line-height: 1;
          margin: 16px 0 0;
        }
        .interest-sub {
          font-family: 'Google Sans Code', monospace; font-size: 13px;
          line-height: 2; opacity: .75; max-width: 460px; margin: 24px 0 0;
        }
        .interest-form { display: grid; gap: 22px; padding-top: 26px; }
        .interest-input, .interest-select, .interest-textarea {
          background: transparent; color: #E5D4C2;
          border: none; border-bottom: 1px solid rgba(229,212,194,.28); border-radius: 0;
          padding: 12px 0;
          font-family: 'Google Sans Code', monospace; font-size: 13px;
          width: 100%; box-sizing: border-box;
          transition: border-color .25s;
        }
        .interest-input::placeholder, .interest-textarea::placeholder { color: rgba(229,212,194,.45); }
        .interest-input:focus, .interest-select:focus, .interest-textarea:focus {
          outline: none; border-bottom-color: #D4B85A;
        }
        .interest-select { appearance: none; -webkit-appearance: none; cursor: pointer;
          background-image: linear-gradient(45deg, transparent 50%, #E5D4C2 50%), linear-gradient(135deg, #E5D4C2 50%, transparent 50%);
          background-position: calc(100% - 10px) 50%, calc(100% - 5px) 50%;
          background-size: 5px 5px; background-repeat: no-repeat; }
        .interest-select option { background: #052E20; }
        .interest-textarea { resize: vertical; min-height: 84px; }
        .interest-submit {
          justify-self: start; margin-top: 8px;
          background: none; color: #D4B85A; border: none;
          border-bottom: 1px solid #D4B85A; border-radius: 0;
          padding: 0 0 6px;
          font-family: 'Google Sans Code', monospace; font-size: 12px;
          letter-spacing: .12em; text-transform: uppercase; cursor: pointer;
        }
        .interest-submit span { display: inline-block; transition: transform .35s ease; }
        .interest-submit:hover:not(:disabled) span { transform: translateX(7px); }
        .interest-submit:disabled { opacity: 0.45; cursor: not-allowed; }
        @media (max-width: 900px) {
          .interest-section { grid-template-columns: 1fr; gap: 20px; padding: 84px 20px 110px; }
        }
        .interest-error {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: #E89B9B;
          letter-spacing: 0.04em;
        }
        .interest-thanks {
          padding: 24px;
          background: rgba(212,184,90,0.08);
          border: 1px solid rgba(212,184,90,0.3);
          border-radius: 8px;
          font-family: 'Rampant Sans', serif;
          font-size: 16px;
          font-style: italic;
          color: #E5D4C2;
          line-height: 1.6;
          max-width: 460px;
          margin-top: 26px;
          text-align: left;
        }
      `}</style>

      <div className="interest-section">
        <div>
          <div className="interest-eyebrow">Make Yourself Known</div>
          <h2 className="interest-title">Have a word with the Captain.</h2>
          <p className="interest-sub">
            Want in on a fixture, suggest a new sport, or simply tell the Captain you exist?
            Drop a line below — anonymously or otherwise.
          </p>
        </div>

        {done ? (
          <div className="interest-thanks">
            “Noted. The Captain will be in touch when convenient.”
            <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontStyle: 'normal' }}>
              — The Sports Secretary
            </div>
          </div>
        ) : (
          <form className="interest-form" onSubmit={submit}>
            <select className="interest-select" aria-label="Sport" value={sport} onChange={e => setSport(e.target.value)}>
              {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="email" required placeholder="your@email.com" aria-label="Email"
              className="interest-input"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <input
              placeholder="Your name (optional)" aria-label="Name"
              className="interest-input"
              value={name} onChange={e => setName(e.target.value)}
            />
            <textarea
              placeholder="A note for the Captain (optional)" aria-label="Note"
              className="interest-textarea"
              value={note} onChange={e => setNote(e.target.value)}
            />
            {error && <div className="interest-error">{error}</div>}
            <button type="submit" className="interest-submit" disabled={busy || !email}>
              {busy ? 'Sending…' : <>Tell the Captain <span>→</span></>}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
