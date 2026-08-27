// Event Gallery — shared helpers for validating external media links and
// labelling them. No files are stored; we only keep the link, so the main job
// is (a) accept only well-formed https links and (b) recognise common providers
// so the UI can show a sensible source label + icon.

export const GALLERY_CATEGORIES = [
  { key: 'fixture', en: 'Sports Fixture', vn: 'Thi Đấu' },
  { key: 'dinner',  en: 'Dinner',         vn: 'Bữa Tối' },
  { key: 'tasting', en: 'Tasting',        vn: 'Nếm Thử' },
  { key: 'social',  en: 'Social',         vn: 'Giao Lưu' },
  { key: 'event',   en: 'Event',          vn: 'Sự Kiện' },
  { key: 'other',   en: 'Other',          vn: 'Khác' },
] as const

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]['key']

export const isGalleryCategory = (v: unknown): v is GalleryCategory =>
  typeof v === 'string' && GALLERY_CATEGORIES.some(c => c.key === v)

// Recognised providers → a friendly label. Anything else valid still passes
// (labelled "Link"), so we never block a legitimate share URL.
const PROVIDERS: { test: RegExp; label: string }[] = [
  { test: /(^|\.)drive\.google\.com$/i,        label: 'Google Drive' },
  { test: /(^|\.)photos\.google\.com$/i,       label: 'Google Photos' },
  { test: /(^|\.)photos\.app\.goo\.gl$/i,      label: 'Google Photos' },
  { test: /(^|\.)goo\.gl$/i,                   label: 'Google' },
  { test: /(^|\.)youtube\.com$/i,              label: 'YouTube' },
  { test: /(^|\.)youtu\.be$/i,                 label: 'YouTube' },
  { test: /(^|\.)vimeo\.com$/i,                label: 'Vimeo' },
  { test: /(^|\.)dropbox\.com$/i,              label: 'Dropbox' },
  { test: /(^|\.)icloud\.com$/i,               label: 'iCloud' },
  { test: /(^|\.)1drv\.ms$/i,                  label: 'OneDrive' },
  { test: /(^|\.)onedrive\.live\.com$/i,       label: 'OneDrive' },
  { test: /(^|\.)flickr\.com$/i,               label: 'Flickr' },
  { test: /(^|\.)wetransfer\.com$/i,           label: 'WeTransfer' },
]

// Validate + normalise. Returns the cleaned URL and a provider label, or an
// error string. Requires https (http/other schemes rejected).
export function parseMediaUrl(raw: unknown): { url: string; provider: string } | { error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { error: 'Paste a link to the photos or video.' }
  let u: URL
  try { u = new URL(raw.trim()) } catch { return { error: 'That doesn’t look like a valid link.' } }
  if (u.protocol !== 'https:') return { error: 'The link must start with https://' }
  if (!u.hostname) return { error: 'That doesn’t look like a valid link.' }
  const match = PROVIDERS.find(p => p.test.test(u.hostname))
  return { url: u.toString(), provider: match ? match.label : 'Link' }
}

// Best-effort provider label for an already-stored URL (display only).
export function providerLabel(url: string): string {
  try {
    const host = new URL(url).hostname
    return PROVIDERS.find(p => p.test.test(host))?.label || 'Link'
  } catch { return 'Link' }
}

export const categoryLabel = (key: string, vi = false): string => {
  const c = GALLERY_CATEGORIES.find(x => x.key === key)
  return c ? (vi ? c.vn : c.en) : key
}
