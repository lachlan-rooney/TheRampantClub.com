# Known gap: the Event Gallery's upload path

**Status:** the two content problems are FIXED (2026-09-09). Uploads now go
through `/api/members/events/[id]/media/upload`, which re-encodes with sharp —
stripping EXIF and proving the bytes decode as an image — and sets
`Content-Type` from what the bytes are.

Verified end to end: a photo carrying 238 bytes of EXIF including GPS uploads
and the stored file carries none; HTML declared `image/jpeg` is refused 400.

**Still to run:** `db/gallery_upload_server_side.sql`, which drops the member
INSERT policy on the bucket. Until that lands the old unchecked path is still
reachable by any client holding the anon key — the code no longer uses it, but
nothing yet prevents it.

The bucket remains PUBLIC, deliberately — see the last section.

## What it is

`app/members/gallery/[id]/page.tsx` uploads a member's file **straight from the
browser to storage**:

```ts
const up = await supabase.storage.from('event-media').upload(path, file, { contentType: file.type })
```

Four things follow from that one line:

- **`contentType` comes from the browser.** It is whatever the uploading client
  says it is. Nothing checks it.
- **No content check.** The file's actual bytes are never inspected, so a file
  named `photo.jpg` that is really HTML is stored as an image.
- **No EXIF strip.** A phone photo keeps its GPS coordinates and timestamp. A
  member posting a picture from home publishes where home is.
- **`event-media` is a PUBLIC bucket**, so every object is world-readable by URL
  to anyone who has or guesses the link.

The bucket's MIME allowlist (`image/*` only) is the sole protection, and it
checks the *declared* type, not the bytes.

## Why it isn't a fire

Uploads are gated on a signed-in member, the path is bound to
`${eventId}/${actorId}/` so one member cannot overwrite another's object, and
there is a rate limit. The exposure is a member uploading something hostile or
personal, not an anonymous one.

## What the fix looks like

The pattern already exists in this codebase — `app/api/social/posts/route.ts`
and `app/api/social/tasting-notes/route.ts` route uploads **through the server**
and re-encode with `sharp`, which strips EXIF and refuses anything that is not
really an image. `lib/attachments/verify.ts` adds magic-byte sniffing.

Moving the gallery to that path is mostly deletion: drop the client-direct
upload, post the file to a route, reuse `sniff()` + the sharp re-encode, and set
`contentType` from what the bytes proved.

Whether `event-media` should also stop being public is a separate question —
gallery images are shared between members by design, so public may be the right
answer there even though it is the wrong one for entry attachments.
