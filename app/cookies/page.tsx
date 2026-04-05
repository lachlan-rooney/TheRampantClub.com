'use client'

import LegalPage, { Section, P } from '@/components/LegalPage'

export default function CookiePage() {
  return (
    <LegalPage
      title="Cookie Policy"
      subtitle="Chính sách cookie"
      lastUpdated="March 2026"
    >
      <Section title="What Are Cookies">
        <P>
          Cookies are small text files placed on your device when you visit a website. They serve various purposes, from remembering your preferences to keeping you signed in. They are not, despite the name, edible.
        </P>
      </Section>

      <Section title="Cookies We Use">
        <P>
          This website uses a minimal number of cookies, all of which are necessary for the site to function. We do not use cookies for advertising, analytics, or tracking purposes.
        </P>
        <P>
          Authentication cookies: When you sign in to the members&rsquo; area, a session cookie is set by our authentication provider to keep you logged in. This cookie is essential &mdash; without it, you would need to sign in on every page, which would be tedious for everyone involved.
        </P>
        <P>
          Preference cookies: We may store a small cookie to remember your language or display preferences. These are set only when you make a choice, and persist until you clear your browser data.
        </P>
      </Section>

      <Section title="Third-Party Cookies">
        <P>
          We do not permit third-party cookies on this website. No advertising networks, social media trackers, or analytics platforms set cookies through our site. The Club serves whisky, not tracking pixels.
        </P>
      </Section>

      <Section title="Managing Cookies">
        <P>
          You may manage or delete cookies through your browser settings. Most browsers allow you to block cookies entirely, though doing so may prevent you from accessing the members&rsquo; area of the site. We would not recommend this.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          If you have questions about our use of cookies, please write to hello@therampantclub.com.
        </P>
      </Section>
    </LegalPage>
  )
}
