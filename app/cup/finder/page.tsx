'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// THE RAMPANT CUP — a miniature flavour finder for the event.
// A ONE-OFF, self-contained feature (not the members' system). A guest answers a
// couple of quick questions and is paired with a whisky we actually have on the
// night, chosen from the six flavour worlds on the table. No login, no database.
// ─────────────────────────────────────────────────────────────────────────────

interface Dram { name: string; region: string }
interface World { id: string; name: string; tagline: string; note: string; drams: Dram[] }

const WORLDS: World[] = [
  {
    id: 'fruity',
    name: 'Bright & Fruity',
    tagline: 'Orchard fruit, wine-cask sweetness, a light and easy touch.',
    note: 'Start here if you like it approachable, fragrant and just a little sweet.',
    drams: [
      { name: 'Aberfeldy 12 Year Old', region: 'Highland' },
      { name: 'Tomintoul 15YO Madeira Cask Finish', region: 'Speyside' },
      { name: 'Glencadam 13YO Sauternes Cask Finish', region: 'Highland' },
      { name: 'Glenfiddich Orchard Experiment', region: 'Speyside' },
      { name: 'Tomintoul 14YO White Port Cask Finish', region: 'Speyside' },
      { name: "Roseisle 12yo Special Release '24", region: 'Speyside' },
      { name: 'Glenmorangie Quinta Ruban 14yo', region: 'Highland' },
      { name: 'Duncan Taylor Octave Invergordon 2011 13yo Single Grain', region: 'Lowland' },
      { name: 'Cragganmore Distillers Edition (Port)', region: 'Speyside' },
      { name: 'Tipperary 2017 Home Grown Barley, Sake Cask Finish', region: 'Ireland' },
    ],
  },
  {
    id: 'sherry',
    name: 'Rich & Sherried',
    tagline: 'Dried fruit, warm spice, oloroso depth. For the sherry lovers.',
    note: 'Raisins, dark sugar and Christmas-cake richness.',
    drams: [
      { name: 'Gordon & MacPhail Glenesk 1984', region: 'Highland' },
      { name: 'Duncan Taylor DTSC GlenAllachie 2008 14yo', region: 'Speyside' },
      { name: 'GlenAllachie 15yo', region: 'Speyside' },
      { name: 'Bladnoch 2018 Select Casks, Oloroso Quaich', region: 'Lowland' },
      { name: 'Duncan Taylor Black Bull 18YO Blended', region: 'Highland' },
      { name: 'Duncan Taylor Octave Mannochmore 2015 10yo', region: 'Speyside' },
      { name: 'Nagahama Single Malt', region: 'Japan' },
      { name: 'Kilkerran 8YO Bourbon Cask Matured', region: 'Campbeltown' },
      { name: 'Hazelburn Oloroso Cask 8YO', region: 'Campbeltown' },
      { name: 'Cadenhead OC8 Tullibardine 12YO', region: 'Highland' },
    ],
  },
  {
    id: 'bourbon',
    name: 'Vanilla & Oak',
    tagline: 'Honey, vanilla and gentle bourbon-cask warmth.',
    note: 'Soft, sweet oak — the classic, comforting profile.',
    drams: [
      { name: 'Cadenhead OC13 Macduff 13YO Bourbon', region: 'Highland' },
      { name: 'Deanston 12YO 2006 Fino Cask Finish', region: 'Highland' },
      { name: 'Lochlea Cask Strength Batch 1 2023', region: 'Lowland' },
      { name: 'Duncan Taylor DTSC Caledonian 34yo Single Grain', region: 'Lowland' },
      { name: 'Duncan Taylor DTSC Glen Moray 2007 15yo', region: 'Speyside' },
      { name: 'Gordon & MacPhail 1994', region: 'Highland' },
    ],
  },
  {
    id: 'peated',
    name: 'Smoke & Peat',
    tagline: 'Bonfire, brine and gentle embers.',
    note: 'From a wisp of smoke to a proper bonfire.',
    drams: [
      { name: 'Hellyers Road Peated 7Y Tasmanian', region: 'Australia' },
      { name: 'Arran Signature Series Ed. 2 — Barrel Bonfire', region: 'Islands' },
      { name: 'Longrow 100 Proof Batch 1', region: 'Campbeltown' },
      { name: 'Duncan Taylor Laphroaig 2005 16yo', region: 'Islay' },
      { name: 'Talisker Distillers Edition', region: 'Islands' },
      { name: 'Isle of Raasay — Friends of Quaich', region: 'Islands' },
      { name: 'Kyloe 100 Proof, Peated Finish', region: 'Highland' },
    ],
  },
  {
    id: 'rare',
    name: 'Rare & Remarkable',
    tagline: 'Old, unusual, and hard to find twice.',
    note: 'For the collector, or anyone chasing something special.',
    drams: [
      { name: 'Duncan Taylor 18YO Special Edition Blended', region: 'Highland' },
      { name: 'Frank McHardy Ardmore 11YO (Distilled 2009)', region: 'Highland' },
      { name: 'Duncan Taylor Whiskies of Scotland — Strathmill 1990', region: 'Speyside' },
      { name: 'Frank McHardy Teaninich 14YO', region: 'Highland' },
    ],
  },
  {
    id: 'conversation',
    name: 'Conversation Pieces',
    tagline: 'The curious, the unexpected, the talking points.',
    note: 'Pours that come with a story.',
    drams: [
      { name: "The Lakes Whiskymaker's Editions — Kairos", region: 'England' },
      { name: 'The Octave — Auchentoshan 14YO x QAL', region: 'Scotland' },
      { name: 'Glenglassaugh Rare Cask 10yo UK Exclusive', region: 'Highland' },
    ],
  },
]
const worldById = (id: string) => WORLDS.find(w => w.id === id)!

const GREEN = '#052E20', CREAM = '#E5D4C2', SAGE = '#5E6650', GOLD = '#C9A84C'
const SERIF = "'Rampant Sans', 'Playfair Display', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function CupFinder() {
  const [step, setStep] = useState<'smoke' | 'sweet' | 'reveal'>('smoke')
  const [world, setWorld] = useState<World | null>(null)

  const reveal = (id: string) => { setWorld(worldById(id)); setStep('reveal') }
  const reset = () => { setWorld(null); setStep('smoke') }

  return (
    <div style={wrap}>
      <div style={grain} />
      <div style={{ position: 'relative', width: 'min(560px, 92vw)', margin: '0 auto', textAlign: 'center' }}>

        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <div style={eyebrow}>The Rampant Cup</div>
          <h1 style={title}>The Whisky Finder</h1>
          <div style={sub}>Two taps. One perfect pour, poured tonight.</div>
        </div>

        <div style={diamond} />

        {step === 'smoke' && (
          <Panel key="smoke" q="First — how do you feel about smoke?">
            <Choice label="None for me" hint="Clean, unpeated" onClick={() => setStep('sweet')} />
            <Choice label="Just a whisper" hint="A gentle wisp" onClick={() => setStep('sweet')} />
            <Choice label="Bring the bonfire" hint="Big, smoky, coastal" onClick={() => reveal('peated')} />
          </Panel>
        )}

        {step === 'sweet' && (
          <Panel key="sweet" q="And your sweet spot?">
            <Choice label="Sherry & dried fruit" hint="Rich, spiced, oloroso" onClick={() => reveal('sherry')} />
            <Choice label="Orchard & citrus" hint="Bright, fragrant, light" onClick={() => reveal('fruity')} />
            <Choice label="Vanilla & honeyed oak" hint="Soft, sweet, classic" onClick={() => reveal('bourbon')} />
            <Choice label="Show me something rare" hint="Old & unusual" onClick={() => reveal('rare')} />
            <button onClick={() => reveal('conversation')} style={adventurous}>or… feeling adventurous? →</button>
          </Panel>
        )}

        {step === 'reveal' && world && (
          <div style={{ animation: 'cf-rise 0.5s cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={worldName}>{world.name}</div>
            <div style={worldTag}>{world.tagline}</div>

            {/* The pour */}
            <div style={pourCard}>
              <div style={pourLabel}>Start with</div>
              <div style={pourName}>{world.drams[0].name}</div>
              <div style={pourRegion}>{world.drams[0].region}</div>
            </div>

            {world.drams.length > 1 && (
              <>
                <div style={alsoLabel}>Also on the table tonight</div>
                <div style={{ textAlign: 'left' }}>
                  {world.drams.slice(1).map((d, i) => (
                    <div key={i} style={dramRow}>
                      <span style={{ fontFamily: SERIF, fontSize: 14, color: GREEN }}>{d.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: SAGE, whiteSpace: 'nowrap', marginLeft: 12 }}>{d.region}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={reset} style={startOver}>Find another →</button>
          </div>
        )}

        <div style={footer}>Ask any of our team to pour you a taste.</div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cf-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .cf-choice:active { transform: scale(0.98) }
      ` }} />
    </div>
  )
}

function Panel({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div style={{ animation: 'cf-rise 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
      <div style={question}>{q}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>{children}</div>
    </div>
  )
}

function Choice({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button className="cf-choice" onClick={onClick} style={choice}>
      <span style={{ fontFamily: SERIF, fontSize: 18, color: CREAM }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(229,212,194,0.6)', letterSpacing: '0.04em', marginTop: 3 }}>{hint}</span>
    </button>
  )
}

const wrap: React.CSSProperties = { minHeight: '100vh', background: CREAM, padding: '56px 20px 72px', position: 'relative', overflow: 'hidden' }
const grain: React.CSSProperties = { position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.05, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")", backgroundSize: '300px' }
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }
const title: React.CSSProperties = { fontFamily: SERIF, fontSize: 34, fontWeight: 600, color: GREEN, letterSpacing: '0.02em', margin: '10px 0 6px' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: SAGE, letterSpacing: '0.02em' }
const diamond: React.CSSProperties = { width: 8, height: 8, background: SAGE, transform: 'rotate(45deg)', opacity: 0.4, margin: '28px auto 30px' }
const question: React.CSSProperties = { fontFamily: SERIF, fontSize: 22, fontStyle: 'italic', color: GREEN }
const choice: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, background: GREEN, border: 'none', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', boxShadow: '0 14px 34px rgba(5,46,32,0.18)', transition: 'transform 0.12s ease' }
const adventurous: React.CSSProperties = { background: 'transparent', border: 'none', fontFamily: MONO, fontSize: 12, color: SAGE, cursor: 'pointer', marginTop: 6, textDecoration: 'underline', textUnderlineOffset: 3 }
const worldName: React.CSSProperties = { fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: GREEN }
const worldTag: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: SAGE, lineHeight: 1.6, maxWidth: 380, margin: '8px auto 26px' }
const pourCard: React.CSSProperties = { background: GREEN, borderRadius: 14, padding: '26px 24px', boxShadow: '0 20px 50px rgba(5,46,32,0.24)' }
const pourLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }
const pourName: React.CSSProperties = { fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: CREAM, lineHeight: 1.25, margin: '10px 0 8px' }
const pourRegion: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: 'rgba(229,212,194,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }
const alsoLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: SAGE, margin: '30px 0 10px' }
const dramRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid rgba(5,46,32,0.1)' }
const startOver: React.CSSProperties = { marginTop: 30, background: 'transparent', border: `1px solid ${SAGE}`, borderRadius: 22, padding: '11px 26px', fontFamily: MONO, fontSize: 12, color: GREEN, cursor: 'pointer', letterSpacing: '0.04em' }
const footer: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: SAGE, opacity: 0.6, marginTop: 44, letterSpacing: '0.04em' }
