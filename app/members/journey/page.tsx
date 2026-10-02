import { redirect } from 'next/navigation'

// Your Journey merged into Your Palate on 2026-10-02. It drew the same radar
// from the same flavour vector as Your Palate did, and listed the same notes as
// Your Notes — one subject wearing three nav entries.
//
// A REDIRECT, NOT A DELETION: see the note in app/members/notes/page.tsx.
export default function JourneyMoved() {
  redirect('/members/taste#journey')
}
