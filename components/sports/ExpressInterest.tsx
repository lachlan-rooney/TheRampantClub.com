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
        .interest-section {
          background: #052E20;
          color: #E5D4C2;
          padding: 80px 24px;
          text-align: center;
        }
        .interest-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: #D4B85A;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .interest-title {
          font-family: 'Rampant Sans', serif;
          font-size: 32px;
          font-weight: 500;
          letter-spacing: 0.02em;
          margin: 0 0 12px;
        }
        .interest-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: #B2AA98;
          line-height: 1.8;
          max-width: 480px;
          margin: 0 auto 36px;
          letter-spacing: 0.04em;
        }
        .interest-form {
          max-width: 460px;
          margin: 0 auto;
          display: grid;
          gap: 12px;
          text-align: left;
        }
        .interest-input, .interest-select, .interest-textarea {
          background: rgba(229,212,194,0.06);
          color: #E5D4C2;
          border: 1px solid rgba(229,212,194,0.15);
          border-radius: 8px;
          padding: 12px 14px;
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          width: 100%;
          box-sizing: border-box;
          letter-spacing: 0.02em;
          transition: border-color 0.2s, background 0.2s;
        }
        .interest-input:focus, .interest-select:focus, .interest-textarea:focus {
          outline: none;
          border-color: #D4B85A;
          background: rgba(229,212,194,0.10);
        }
        .interest-select option { background: #052E20; }
        .interest-textarea { resize: vertical; min-height: 84px; font-family: inherit; }
        .interest-submit {
          background: #D4B85A;
          color: #052E20;
          border: none;
          border-radius: 8px;
          padding: 14px 20px;
          font-family: 'Rampant Sans', serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }
        .interest-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .interest-submit:hover:not(:disabled) {
          background: #E0C76D;
          transform: translateY(-1px);
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
          margin: 0 auto;
        }
      `}</style>

      <div className="interest-section">
        <div className="interest-eyebrow">Make Yourself Known</div>
        <h2 className="interest-title">Have a word with the Captain.</h2>
        <p className="interest-sub">
          Want in on a fixture, suggest a new sport, or simply tell the Captain you exist?
          Drop a line below — anonymously or otherwise.
        </p>

        {done ? (
          <div className="interest-thanks">
            “Noted. The Captain will be in touch when convenient.”
            <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontStyle: 'normal' }}>
              — The Sports Secretary
            </div>
          </div>
        ) : (
          <form className="interest-form" onSubmit={submit}>
            <select className="interest-select" value={sport} onChange={e => setSport(e.target.value)}>
              {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="email" required placeholder="your@email.com"
              className="interest-input"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <input
              placeholder="Your name (optional)"
              className="interest-input"
              value={name} onChange={e => setName(e.target.value)}
            />
            <textarea
              placeholder="A note for the Captain (optional)"
              className="interest-textarea"
              value={note} onChange={e => setNote(e.target.value)}
            />
            {error && <div className="interest-error">{error}</div>}
            <button type="submit" className="interest-submit" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Tell the Captain'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
