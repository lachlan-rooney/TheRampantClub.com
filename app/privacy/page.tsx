'use client'

import LegalPage, { Section, P } from '@/components/LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="Chính sách bảo mật"
      lastUpdated="March 2026"
    >
      <Section title="What We Collect">
        <P>
          The Club collects only what is necessary to maintain its register of members. When you sign in or apply for membership, we may collect your name, email address, and any information you voluntarily provide on your application &mdash; including, but not limited to, your preferred dram.
        </P>
        <P>
          When you use the members&rsquo; area of the website, we collect standard technical data such as your IP address, browser type, and pages visited. This is handled by our authentication provider and is used solely to keep the site running and secure.
        </P>
      </Section>

      <Section title="How We Use Your Information">
        <P>
          Your information is used for the following purposes: to authenticate your access to the members&rsquo; area, to communicate with you about Club events and matters, to manage event RSVPs and member records, and to improve the functioning of this website.
        </P>
        <P>
          We do not use your information for marketing purposes, nor do we send unsolicited correspondence. The Club&rsquo;s communications are infrequent and, we hope, worth reading.
        </P>
      </Section>

      <Section title="What We Do Not Do">
        <P>
          We do not sell, rent, trade, or otherwise share your personal information with third parties. We do not run third-party advertising on this website. We do not track your browsing behaviour across other websites. The Club has no interest in what you do when you are not at the Club.
        </P>
      </Section>

      <Section title="Data Storage & Security">
        <P>
          Your data is stored securely via our authentication and hosting providers. We use industry-standard encryption for data in transit and at rest. Access to member data is restricted to authorised Club staff &mdash; which is to say, very few people.
        </P>
      </Section>

      <Section title="Data Retention">
        <P>
          We retain your personal data for as long as your membership is active. Upon termination of membership &mdash; whether voluntary or by Committee decision &mdash; your data will be removed from our active systems within a reasonable period. &ldquo;Reasonable&rdquo; in this context means promptly, not at the Committee&rsquo;s leisure.
        </P>
      </Section>

      <Section title="Your Rights">
        <P>
          You have the right to access, correct, or request deletion of your personal data at any time. You may also request a copy of the data we hold about you. To exercise any of these rights, please contact us at hello@therampantclub.com.
        </P>
        <P>
          We will respond to all data requests within thirty (30) days. If we require additional time, we will let you know &mdash; and we will feel appropriately guilty about the delay.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          For any questions or concerns regarding this policy, please write to hello@therampantclub.com or speak with a member of staff at the bar. The latter is often more pleasant.
        </P>
      </Section>
    </LegalPage>
  )
}
