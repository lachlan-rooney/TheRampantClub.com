import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { renderDocument } from '@/lib/documents/render'

// Agree to ONE document. One doc_key per call — there is deliberately no
// "I agree to all", because three documents agreed by one control is one consent
// wearing three hats.
//
// ORDER MATTERS. The copy is attempted FIRST and the consent recorded ONCE, with
// the outcome in its evidence. Recording first and annotating afterwards would
// mean either a second row per agreement — which breaks one-row-per-agreement —
// or mutating a record that is deliberately append-only. Emailing first costs
// nothing: if the send fails the consent is still recorded, carrying
// copy_emailed:false so the admin view can show it rather than nobody knowing.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const { doc_key, granted, language, scrolled_to_end } = await req.json().catch(() => ({}))
  if (typeof doc_key !== 'string') return NextResponse.json({ error: 'Which document?' }, { status: 400 })
  const vn = language === 'vn'

  // The version they are agreeing to, read before anything is written.
  const { data: st } = await sb.rpc('my_consent_state')
  const row = ((st || []) as Array<Record<string, unknown>>).find(r => r.doc_key === doc_key)
  const { data: v } = row?.current_version_id
    ? await sb.from('terms_versions')
        .select('version, title_en, title_vn, body, body_vn')
        .eq('id', row.current_version_id as string).maybeSingle()
    : { data: null }

  let emailed = false
  if (v && granted !== false && process.env.RESEND_API_KEY && user.email) {
    try {
      const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
      const title = (vn ? v.title_vn : v.title_en) || (vn ? row?.name_vn : row?.name_en) || 'Document'
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'The Rampant Club <no-reply@therampantclub.com>',
        to: [user.email],
        // The version is in the subject deliberately: without it the email proves
        // nothing once the terms change.
        subject: `${title} — version ${v.version}`,
        html: `<div style="font-family:Georgia,serif;color:#052E20;line-height:1.7;max-width:640px">
          <p style="font-family:monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">
            ${title} · version ${v.version} · agreed ${new Date().toLocaleDateString('en-GB')}${prof?.member_no ? ` · ${prof.member_no}` : ''}
          </p>
          <hr style="border:none;border-top:1px solid rgba(5,46,32,.15);margin:18px 0" />
          ${renderDocument(vn ? v.body_vn : v.body)}
        </div>`,
      })
      emailed = true
    } catch { /* the consent below is the record; this was the courtesy */ }
  }

  const { error } = await sb.rpc('record_my_consent', {
    p_doc_key: doc_key,
    p_granted: granted !== false,
    p_user_agent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
    p_evidence: {
      scrolled_to_end: scrolled_to_end === true,
      language: vn ? 'vn' : 'en',
      version_agreed: v?.version ?? null,
      copy_emailed: emailed,
    },
  })
  if (error) {
    const m = error.message
    return NextResponse.json({
      error: /by signature/i.test(m) ? 'That document is signed, not agreed here.'
           : /no current version/i.test(m) ? 'That document has not been published yet.'
           : /no member linked/i.test(m) ? 'Your account is not linked to a membership yet.'
           : 'Could not record that.',
    }, { status: 400 })
  }
  return NextResponse.json({ ok: true, emailed })
}
