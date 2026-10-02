import { redirect } from 'next/navigation'

// Your Notes merged into Your Palate on 2026-10-02 — the notes are the third
// section of it, and the journey page above them was already listing the same
// notes a second time.
//
// A REDIRECT, NOT A DELETION. The surface is in lib/members/surfaces, it has
// been linked from the dashboard and from the whisky pages, and members have
// had months to bookmark it. Removing the route would turn all of that into a
// 404; this lands them on the section they asked for.
export default function NotesMoved() {
  redirect('/members/taste#notes')
}
