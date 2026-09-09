// ═══════════════════════════════════════════════════════════════════════════
// SHARP, LOADED ONLY WHEN AN IMAGE IS ACTUALLY BEING PROCESSED.
// ───────────────────────────────────────────────────────────────────────────
// sharp is a NATIVE binary. Imported at module scope, a failure to load it is
// not a failed upload — it takes down every export in the file. That is exactly
// what happened: the attachment route's GET, which never touches an image, was
// returning 500 on the admin fixtures page for every event on the screen,
// because a sibling POST in the same file imported sharp at the top.
//
// Three other routes had the same shape and were equally dead in production.
//
// So it is loaded HERE, lazily, at the one moment it is needed. A route that
// only reads keeps working; a route that needs to re-encode gets a real answer
// it can put in front of a person. The result is cached, including the failure,
// so a broken install costs one attempt rather than one per request.
// sharp is CommonJS: under interop the callable arrives as `.default`, without
// it the namespace IS the callable. Accept both rather than betting on the build.
type Sharp = typeof import('sharp')

let cached: Sharp | null | undefined
let failure = ''

export async function getSharp(): Promise<{ sharp: Sharp | null; error: string }> {
  if (cached !== undefined) return { sharp: cached, error: failure }
  try {
    const mod = await import('sharp')
    cached = ((mod as unknown as { default?: Sharp }).default ?? mod) as Sharp
  } catch (e) {
    cached = null
    failure = e instanceof Error ? e.message : String(e)
  }
  return { sharp: cached, error: failure }
}

/** For an ADMIN screen: name the cause, because they are the one who can escalate it. */
export const imagePipelineDown = (detail: string) =>
  'Images cannot be processed on the server at the moment, so this file was not stored. ' +
  'A PDF will still upload. This needs a developer — the image library is not loading' +
  (detail ? `: ${detail}` : '') + '.'

/** For a MEMBER: no internals, just what to do. */
export const imagePipelineDownMember =
  'Photos cannot be processed at the moment. Please try again later — nothing was lost.'
