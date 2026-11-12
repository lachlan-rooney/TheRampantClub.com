'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TouchFinder from '@/components/whisky/TouchFinder'
import { matchWhiskies, type IndexRow, type SetSpokes } from '@/lib/whisky/flavour-match'
import type { Cat } from '@/components/whisky/flavour-data'

// ═══════════════════════════════════════════════════════════════════════════
// THE OFFLINE FINDER, ON THE TABLET.
// ───────────────────────────────────────────────────────────────────────────
// The index arrived inside the HTML. Matching happens here, with the SAME
// matchWhiskies() the server route calls — imported, not reimplemented.
//
// ⚠ `in_stock_only` IS NOT APPLIED, deliberately, and this is the only place
// the two finders are asked a different QUESTION rather than given a different
// answer. The club's public finder filters to what the bar can pour; the
// pop-up's index IS what is on the table, chosen by hand, so filtering again
// would drop a bottle standing in front of the guest because the club's
// inventory says it is out of stock back at the bar.
// The parity harness compares the two over the SAME index for this reason.
// ═══════════════════════════════════════════════════════════════════════════

const READY_KEY = 'trc_popup_finder_ready_v1'
// Its own cache, named for what it is. The service worker's lookups search
// every cache, so this is found and served without touching sw.js further.
const CACHE_NAME = 'trc-popup-finder-v1'

export default function OfflineFinderClient({ index, cats, title, builtAt }: {
  index: IndexRow[]; cats: Cat[]; title: string; builtAt: string
}) {
  const [ready, setReady] = useState<'checking' | 'ready' | 'partial' | 'none'>('checking')
  const [cached, setCached] = useState(0)

  // The matcher, handed to the shared component. A thin wrapper and nothing
  // more — no re-ranking, no extra filter, no second opinion.
  const match = useCallback((set: SetSpokes) => matchWhiskies(set, index, 3), [index])

  // ── "READY OFFLINE", FOR STAFF, BEFORE THE TABLET LEAVES THE CLUB ──────
  // ⚠ IT ASKS THE CACHE, it does not assume. A tablet that says it is ready
  // because the page rendered would be a tablet that says it is ready because
  // it is online, which is the one condition it is meant to be checking for.
  const check = useCallback(async () => {
    if (!('caches' in window)) { setReady('none'); return }
    try {
      // What this page needs to come back from nothing: itself, and every
      // same-origin script, stylesheet and font it loaded.
      // ⚠ THE ILLUSTRATIONS SHOWN WITH A RESULT ARE NAMED EXPLICITLY. They are
      // not in performance.getEntriesByType() on a fresh page, because nothing
      // has asked for a dram yet — so the first offline search fetched
      // /images/ink/glass.webp over a network that was not there. A missing
      // picture is survivable; a request that should not exist is not, because
      // the promise this page makes is that it needs NOTHING after it loads.
      //
      // Named, not globbed: these are the two the finder can show
      // (components/whisky/TouchFinder.tsx — CreamInk "glass" and "lion-suit").
      // A third added later needs a line here, and will be caught by the
      // offline harness the moment it is not.
      const ALWAYS = ['/images/ink/glass.webp', '/images/ink/lion-suit.webp']
      const want = [location.pathname, ...ALWAYS, ...performance.getEntriesByType('resource')
        .map(r => { try { return new URL((r as PerformanceResourceTiming).name, location.href) } catch { return null } })
        // images too — the lion is part of the page, not decoration that can
        // be allowed to fail.
        .filter((u): u is URL => !!u && u.origin === location.origin && /\.(js|css|woff2?|webp|png|svg|jpe?g)$/.test(u.pathname))
        .map(u => u.pathname + u.search)]
      const unique = [...new Set(want)]

      // ── WARM IT, DO NOT JUST HOPE ──────────────────────────────────────
      // ⚠ THE SERVICE WORKER CANNOT DO THIS ON ITS OWN, and assuming it had
      // was the bug: a newly-installed worker does not control the page that
      // registered it until it has activated and claimed, by which time this
      // page's scripts have ALREADY been fetched straight from the network,
      // bypassing the worker entirely. They were therefore never stored, and
      // an offline reload returned the cached HTML with no JavaScript behind
      // it — a blank page that had passed every check for "it reloads".
      //
      // So the page stores its own files. It is the one page allowed to, it
      // knows exactly which files are its own, and it needs no message
      // channel to a worker that may not be listening yet.
      //
      // The worker's own `caches.match(request)` searches EVERY cache, so a
      // cache of our own name is found and served by it without any change
      // to the worker's logic.
      const cache = await caches.open(CACHE_NAME)
      const here = location.pathname
      for (const path of unique) {
        try {
          // ⚠ THE PAGE ITSELF IS ALWAYS RE-FETCHED; everything else is only
          // fetched if missing.
          //
          // The bottle list travels INSIDE this page's HTML. Skipping it
          // because a copy was already stored is how a tablet keeps serving
          // last week's forty after the owner has changed them — and the
          // staff indicator would cheerfully say "Ready offline" about the
          // wrong list. Static chunks carry a content hash in their filename,
          // so a changed one is a different URL and re-fetching them would be
          // pure waste.
          if (path === here) { await cache.add(path); continue }
          if (!(await cache.match(path))) await cache.add(path)
        } catch { /* one file failing is not the end; `found` below will say so */ }
      }

      let found = 0
      for (const path of unique) if (await caches.match(path)) found++
      setCached(found)
      setReady(found >= unique.length ? 'ready' : found > 0 ? 'partial' : 'none')
      if (found >= unique.length) { try { localStorage.setItem(READY_KEY, new Date().toISOString()) } catch {} }
    } catch { setReady('none') }
  }, [])

  useEffect(() => {
    // Once on load, once after the page has finished settling. The second
    // pass catches anything lazily fetched after the first.
    const t = setTimeout(check, 900)
    const t2 = setTimeout(check, 4000)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [check])

  const n = index.length
  // ⚠ THE COUNT IS ON EVERY STATE, not only the good one. Staff checking a
  // tablet before it goes in the car need to know how many bottles it is
  // holding whether or not it has finished storing itself — and a label that
  // drops the number when something is wrong is a label that tells you least
  // exactly when you need it most.
  const label = ready === 'ready' ? `Ready offline · ${n} whiskies`
    : ready === 'partial' ? `Storing… ${cached} files · ${n} whiskies`
    : ready === 'checking' ? `Checking… · ${n} whiskies`
    : `NOT ready offline · ${n} whiskies · stay on wifi`

  if (n === 0) {
    return (
      <main style={empty}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 30, margin: '0 0 10px' }}>
          No bottles have been chosen yet.
        </h1>
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 15, lineHeight: 1.7, opacity: .8 }}>
          Pick the bottles for the table in the admin, under the pop-up, then reload this tablet
          <strong> while it is still on the club&rsquo;s wifi.</strong>
        </p>
      </main>
    )
  }

  return (
    <>
      <TouchFinder eyebrow={title} offline={useMemo(() => ({ cats, match }), [cats, match])} />
      {/* ── THE STAFF INDICATOR ──────────────────────────────────────────
          Small, plain, and in the corner. It is for the person checking the
          tablet before it goes in the car, not for a guest. */}
      {/* ⚠ NO toLocaleString IN THE RENDER. The server formats a date in its
          locale and timezone, the browser in the tablet's, the two strings
          differ, and React throws a hydration error on a page whose whole job
          is to be reliable. The raw ISO stamp is stable in both. */}
      <div className={`pf-ready is-${ready}`} title={`built ${builtAt}`}>
        <span className="pf-dot" />{label}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .pf-ready { position: fixed; left: 10px; bottom: 10px; z-index: 40;
          display: flex; align-items: center; gap: 7px;
          padding: 6px 10px; border-radius: 4px;
          background: rgba(5,46,32,.86); border: 1px solid rgba(229,212,194,.22);
          font-family: 'Google Sans Code','DM Mono',monospace; font-size: 11px;
          letter-spacing: .04em; color: #E5D4C2; opacity: .82; pointer-events: none; }
        .pf-dot { width: 7px; height: 7px; border-radius: 50%; background: #B2AA98; }
        .pf-ready.is-ready .pf-dot { background: #7FA86B; }
        .pf-ready.is-partial .pf-dot { background: #D4B85A; }
        .pf-ready.is-none { border-color: #C27070; color: #E8C3C3; opacity: 1; }
        .pf-ready.is-none .pf-dot { background: #C27070; }
      ` }} />
    </>
  )
}

const empty: React.CSSProperties = {
  minHeight: '100dvh', background: '#052E20', color: '#E5D4C2',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', padding: '40px 24px',
}
