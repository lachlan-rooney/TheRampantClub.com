-- SECURITY HARDENING for the event-media Storage bucket + event_media table.
--
-- 1. The bucket was created with no size/MIME limits, and the upload RLS policy
--    checks only bucket_id — so an authenticated member could upload arbitrary,
--    oversized, non-image files directly (cost/DoS + arbitrary content on the
--    club's public storage domain). Cap size + restrict to image MIME types;
--    Supabase enforces both at the Storage layer, before the object lands.
update storage.buckets
   set file_size_limit = 15728640,   -- 15 MB per object
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
 where id = 'event-media';

-- 2. Backstop the per-uploader path binding: a storage object may be referenced
--    by at most one event_media row, so nobody can register a second row over
--    another member's object. (Safe: each upload gets a fresh uuid path.)
create unique index if not exists uq_event_media_storage_path
  on event_media (storage_path) where storage_path is not null;
