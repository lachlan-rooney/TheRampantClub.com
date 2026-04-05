'use client'

import LegalPage, { Section, P } from '@/components/LegalPage'

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      subtitle="Điều khoản sử dụng"
      lastUpdated="March 2026"
    >
      <Section title="The Club">
        <P>
          The Rampant Club is a private members&rsquo; institution operated from 74A/2 Hai Bà Trưng, District 1, Ho Chi Minh City, Việt Nam. By accessing this website, you agree to be bound by these terms. If you do not agree, please close the door quietly on your way out.
        </P>
      </Section>

      <Section title="Membership">
        <P>
          Membership of The Rampant Club is by invitation only and is limited to ninety-nine (99) individuals at any given time. Membership is granted at the sole discretion of the Committee and may be revoked at any time, with or without cause, though the Committee endeavours to provide cause where it exists.
        </P>
        <P>
          Members are expected to conduct themselves with the decorum befitting a private institution. The Committee reserves the right to determine what constitutes decorum on a case-by-case basis.
        </P>
        <P>
          Membership is personal and non-transferable. A member may not lend, assign, or bequeath their membership to another individual, regardless of the quality of the individual in question.
        </P>
      </Section>

      <Section title="Use of the Website">
        <P>
          This website is provided for the benefit of Club members and prospective members. You may browse the public areas of the site freely. Access to the members&rsquo; area requires valid credentials issued by the Club.
        </P>
        <P>
          You agree not to use the site for any purpose that is unlawful, harmful, or otherwise objectionable. The Committee&rsquo;s definition of &ldquo;objectionable&rdquo; is broad and, regrettably, final.
        </P>
      </Section>

      <Section title="Intellectual Property">
        <P>
          All content on this website &mdash; including but not limited to text, images, the Rampant lion crest, brand materials, and the phrase &ldquo;sustained by its members, not for profit&rdquo; &mdash; is the property of The Rampant Club and is protected under applicable intellectual property laws.
        </P>
        <P>
          You may not reproduce, distribute, or otherwise use any content from this site without the prior written consent of the Club. Photographing the Library Bar for social media purposes is a separate matter and is addressed in the House Rules.
        </P>
      </Section>

      <Section title="Limitation of Liability">
        <P>
          The Rampant Club provides this website on an &ldquo;as is&rdquo; basis. We make no warranties, expressed or implied, regarding the accuracy, reliability, or availability of the site or its contents.
        </P>
        <P>
          The Club shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of this website. This includes, but is not limited to, any disappointment arising from the discovery that the 99-member cap has been reached.
        </P>
      </Section>

      <Section title="Governing Law">
        <P>
          These terms are governed by and construed in accordance with the laws of the Socialist Republic of Việt Nam. Any disputes arising from the use of this website shall be subject to the exclusive jurisdiction of the courts of Ho Chi Minh City.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          For enquiries regarding these terms, please write to hello@therampantclub.com or leave a note with the bar.
        </P>
      </Section>
    </LegalPage>
  )
}
