-- ═══════════════════════════════════════════════════════════════════════════
-- THE REAL TERMS AND CONDITIONS — membership_terms v2.0
-- ───────────────────────────────────────────────────────────────────────────
-- Source: "The Rampant Club TC V5 24.03.26 (1).docx" (Documents/TRC Web),
-- supplied by Lachlan 2026-09-13. Extracted MECHANICALLY from the .docx — the
-- document is 15 two-column tables, 165 rows, English in the left cell and
-- Vietnamese in the right — never retyped, because a contract transcribed by
-- hand is a contract with a typo in it.
--
-- What the extraction found, and what this file therefore contains:
--   * 24 articles in BOTH languages, no gaps, no duplicates
--   * Schedule Part 1 (Benefits) and Part 2 (Conduct & Etiquette), both languages
--   * Not one row where a side was empty — nothing is untranslated
--
-- This REPLACES what members read. v1.0 (the short "Membership Agreement",
-- effective 2026-04-11) is left exactly as it is: one person has signed it, and
-- a signed version is never edited under the signature. It stays in the register
-- as history; v2.0 becomes current from its effective date.
--
-- NOBODY IS GATED BY THIS. membership_terms is satisfied_by = 'signature', and
-- my_consent_state() returns needs_action = false for signature documents. No
-- member is asked to re-agree, and middleware.ts cannot redirect anyone over it.
--
-- ⚠ THE SIGNING FLOW DOES NOT READ THIS TABLE. components/MembershipSigning.tsx
-- renders data/membership-agreement-content.json. Publishing v2.0 changes what
-- members READ in the portal; it does not change what an applicant SIGNS. That
-- second copy has to move too, or the two drift apart.
--
-- Applied 2026-09-13. Safe to run again: it refuses rather than duplicating.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.terms_versions') is null then
    raise exception 'terms_versions does not exist here — wrong database?';
  end if;
  if exists (select 1 from terms_versions where doc_key = 'membership_terms' and version = '2.0') then
    raise exception 'membership_terms v2.0 is already published — edit it deliberately, do not re-run this';
  end if;
  if not exists (select 1 from terms_versions where doc_key = 'membership_terms' and version = '1.0') then
    raise exception 'v1.0 is missing — this file expects to sit AFTER it, not to be the first version';
  end if;
end $$;

-- The document names itself in both languages on its first page; these are its
-- own words, not a translation made here.
insert into terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
values (
  'membership_terms',
  '2.0',
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  'Terms and Conditions — Rules of Membership',
  'Điều Kiện và Điều Khoản — Quy Chế Thành Viên',
  $md$This document is prepared in both English and Vietnamese. In the event of any discrepancy or inconsistency between the English and Vietnamese versions, the English version shall prevail.

## ARTICLE 1. CLUB NAME & LOCATION

1.1 This document sets out the rules of membership for members of the private members club (referred to hereafter as "The Rampant Club" or "the Club") which is located at 74A2 Hai Ba Trung Street, Saigon Ward, District 1, Ho Chi Minh City, Vietnam ("the Premises").

## ARTICLE 2. OBJECTS OF THE RAMPANT CLUB

2.1 The objects of The Rampant Club are the provision of whisky culture, hospitality facilities and exclusive experiences for the social interaction of members and their guests, with a particular focus on fostering meaningful connections and cultural enrichment.

2.2 The Club stands as a sanctuary for those who shape industries and communities, providing an environment of trust, discretion, and shared purpose.

## ARTICLE 3. OWNERSHIP & KEY PRINCIPLES

3.1 The Rampant Club is a proprietary private members club brand owned and operated by CTY Ruou Ngon ("the Company"), a private limited company. The Company is responsible for the provision of the Club's facilities and services as more fully described in Schedule Part 1 of these Rules of Membership.

3.2 Membership of the Club corresponds to periods of one year. Membership does not entitle members to own or participate in any shares, voting or other shareholder matters of The Rampant Club or the Company.

3.3 Membership of The Rampant Club provides members with access to exclusive facilities, services and benefits as set out in Schedule Part 1 of these Rules of Membership.

3.4 The Company is affiliated with Duncan Taylor Scotch Whisky Ltd, which owns and operates whisky warehouses and facilities in Scotland. Membership of The Rampant Club confers certain benefits and privileges relating to these facilities.

3.5 Members shall not have any financial liability for the operation of the Club by reason of their membership. Each member's financial responsibility is limited to payment of fees and charges for services consumed.

3.6 These Rules of Membership may be amended from time to time by The Rampant Club in its sole discretion. The latest version will be made available through the application process. Last updated 13th November 2025.

3.7 The Rules of Membership should be read in conjunction with the member application, which together form the membership contract.

## ARTICLE 4. DIRECTION & MANAGEMENT

4.1 Responsibility for the direction and management of The Rampant Club rests with the directors of the Company, supported by the management team appointed by the Company.

4.2 A Membership Committee has been formed with the responsibility of considering and administering applications for new memberships and invitations for membership renewals. The Committee places particular emphasis on cultural fit and alignment with the Club's values.

4.3 Primary contact within The Rampant Club management for members is the Member Experience Manager via members@Therampantclub.com.

## ARTICLE 5. MEMBERSHIPS

5.1 The following categories of membership are available:

- Legacy Member: Members must be 33 years of age or above, representing established individuals shaping their industries and communities.
- Pioneer Member: Members under 33 years of age (minimum 21) representing emerging leaders and rising creatives.
- Corporate Member: A company or organisation can nominate up to three individual employees as members under a single corporate account.

Each nominated employee shall be treated as an independent Member, subject to the Club’s vetting process, and shall enjoy the same rights and obligations as an individual Member.

For the avoidance of doubt, the Corporate Membership is not a flexible or shared arrangement; access rights are strictly limited to the specific individuals recorded in the Club’s Member Intelligence System.

Each individual nominated under a Corporate Account shall be counted as one (01) member within the total cap of ninety-nine (99) Founding Members of The Rampant Club. At the time of nomination, the Organization must provide an official letter of employment confirmation, issued on the company’s letterhead, confirming the nominee’s current position and authorizing such individual to represent the Organization as a Member.

Each nominated individual must complete the Club’s interview and evaluation process before their membership is activated.

The Organization shall have the right to replace nominated employees in the following cases: (i) the employee ceases employment with the Organization; or (ii) the Organization undergoes changes in its senior management structure.

For each replacement, the Organization must submit a written notice and pay a non-refundable Administrative Fee of VND 1,000,000 for the Club to update records, reissue membership cards, and conduct the vetting (interview) process for the replacement individual. Any replacement nominee must satisfy the Club’s age and professional reputation requirements.Honorary Member: Members invited by the Company at the sole discretion of The Rampant Club.

- Honorary Member: A Member invited by the Company at the sole discretion of The Rampant Club.

5.2 Benefits of memberships are set out in Schedule Part 1.

5.3 Except for the replacement of Corporate Member personnel as provided under Article 5.1(c), membership is personal in nature and may not be transferred, assigned, delegated, or shared in any form whatsoever.

5.4 Members are expected to participate in at least two Club events per year to maintain the vibrancy of the community.

5.5 All members of The Rampant Club must be at least 21 years of age. All guests brought to the Premises by a member must be at least 18 years of age. Members are personally responsible for ensuring the age compliance of any guests they introduce to the Club.

5.6 The Club reserves the right to require proof of age from any member or guest at any time. Where a member introduces a guest who is found to be under 18 years of age, the member's membership may be suspended or terminated at the Club's sole discretion without refund.

## ARTICLE 6. MEMBERSHIP APPLICATION & SELECTION

6.1 Membership may be granted solely at the discretion of the Club and is available only by invitation or referral. All prospective members must undergo an interview and assessment process. Applicants who successfully complete this process may, at the Club’s discretion, be

placed on the membership waitlist. Admission to membership is not guaranteed and remains subject to final approval by the Club.

6.2 Individuals seeking membership must first complete and submit a membership application form and participate in the Club’s selection interview process. By submitting an application, the applicant acknowledges and agrees that, if their application is approved, they will be bound by these Rules of Membership and any related policies in effect at the time of admission.

6.3 Membership applicants must be aged 21 or above.

6.4 All membership applications shall be reviewed by the Membership Committee, which retains sole and absolute discretion to approve or reject any application. In exercising this discretion, the Committee may consider factors including, but not limited to, cultural fit, the applicant’s potential contribution to the Club community, and alignment with the Club’s values. The Committee’s decisions are final and not subject to appeal.

6.5 The Membership Committee will comply with all applicable laws in determining whether to accept or reject an application for membership.

6.6 We require payment information to be submitted upon application. If successful, the appropriate joining and annual membership fees will be taken, and confirmation will be sent via the finance department.

6.7 Successful referrals are generously rewarded with club credit and a bespoke bottle from our reserves.

## ARTICLE 7. MEMBERSHIP RENEWAL

7.1 Membership is for a period of one year and is renewable thereafter on an annual basis. Membership renewals are not automatic and are subject to an invitation to renew by The Rampant Club in its sole discretion.

7.2 The first renewal will take effect on the first day of the month following twelve months after the day of joining. Subsequent renewals will be effective on the same date in subsequent years.

7.3 Invitations to renew will be issued prior to the end of the current membership year. Members should confirm their intention promptly in writing.

## ARTICLE 8. MEMBERSHIP PAYMENT

8.1 Following selection as a new member, the member shall pay The Rampant Club any applicable joining fee together with the annual membership fee for the first year's membership.

8.2 Membership benefits may only be enjoyed following payment of applicable membership fees.

8.3 The joining fees for 2025 are:

- Legacy Membership: 5,000 USD (VND equivalent)
- Pioneer Membership: 3,000 USD (VND equivalent)
- Corporate Membership: 8,000 USD (VND equivalent)
- Note: Joining fees waived for the first 30 members

8.4 Annual membership fees for 2025 are:

- Legacy Membership: 5,000 USD (130M VND equivalent)
- Pioneer Membership: 3,000 USD (80M VND equivalent)
- Corporate Membership: 8,000 USD per company (covering 3 nominees) (210M VND equivalent)

8.5 All fees are payable in full in advance by bank transfer or approved payment methods. An allowance will be made for members requesting payment in two halves. One before joining, one at the beginning of the second half of the membership term.

8.6 Membership fees are set by The Rampant Club and may be amended at any time. Renewing members will be notified of any amended fees upon invitation to renew. Fees are calculated to cover the costs of the running of the club. Any increases will be put before the membership committee and attributed to financial situational changes.

8.7 Failure to pay any applicable membership fee for a period of 14 days following the due date shall constitute a material breach of these Rules of Membership and may result in suspension or cancellation of membership.

8.8 All fees stipulated under Article 8 (Entrance Fee and Annual Membership Fee) and any service charges incurred at the Club are [inclusive/exclusive] of Value-Added Tax (VAT) in accordance with applicable laws.

The Rampant Club shall be responsible for issuing electronic invoices to Members for all fees paid. Such invoices shall be sent to the email address registered by the Member or via the Company’s electronic invoicing system.

8.9 Members requesting invoices issued to an organization/entity shall provide accurate and complete information at the time of application submission or, at the latest, at the time of payment, including:

- Name of the organization/entity;
- Tax Identification Number;
- Registered head office address (as stated in the Business Registration Certificate).

The Rampant Club shall not be responsible for any invoice-related claims where the Member provides incomplete, delayed, or incorrect information after the invoice has been issued on the system of the General Department of Taxation.

8.10 For payments made in foreign currency (USD) and converted into VND, the value stated on the VAT invoice shall be based on the actual VND amount received by the Company, in accordance with the applicable exchange rate at the time of payment and in compliance with foreign exchange regulations.

## ARTICLE 9. FREEZING OF MEMBERSHIP

9.1 A Member may suspend their membership for any personal reason by providing written notice (email or letter) to the Member Experience Manager at least fourteen (14) days prior to the intended suspension date. Such suspension does not require approval from the Club but must comply with the limitations set out in Clauses 9.2 and 9.3.

9.2 Members are entitled to suspend their membership once per membership year. The minimum suspension period is three (03) months and the maximum is twelve (12) months.

9.3 During the suspension period, the remaining term of the current membership shall be automatically preserved. The membership expiry date shall be extended by a period equivalent to the actual duration of suspension upon reactivation.

9.4 During the suspension period, the Member is not required to pay membership fees (if on an installment plan), but shall not be entitled to any benefits or access to the Club’s facilities.

For consigned assets (including whisky), the Member shall continue to comply with storage terms and applicable management fees (if any) as stipulated in the Consignment Agreement.

## ARTICLE 10. RESIGNATION OF MEMBERSHIP BY THE MEMBER

10.1 A member may resign from membership by providing written notice to the Member Experience Manager. This must be submitted prior to the annual renewal date.

10.2 A member who resigns shall not be entitled to any refund, rebate, or reimbursement of joining fees, annual membership fees, or any portion thereof. All membership fees are payable and calculated on an annual basis, irrespective of whether the member elects to pay such fees in full or by monthly installments.

## ARTICLE 11. SUSPENSION & CANCELLATION OF MEMBERSHIP BY

THE RAMPANT CLUB

11.1 Violations Leading to Suspension of Membership

Depending on the nature and severity of the violation, the Club shall apply the following suspension measures:

– 03-month suspension: Applicable to first-time or minor violations of operational regulations, including:

- Repeated violations of the Dress Code (more than three (03) times after prior reminders);
- Causing noise or disturbance affecting the shared quiet environment of other Members;
- Bringing guests exceeding the permitted number without prior arrangement with the Member Experience Manager.

– 06-month suspension: Applicable to violations relating to conduct and community standards:

- Disrespectful or aggressive behavior or language towards Club staff or other Members;
- Improper use of facilities or failure to follow safety guidelines resulting in minor damage to Club property;
- Lending or transferring membership privileges (excluding the membership card) to non-eligible persons.

– 09-month suspension: Applicable to repeated or reputational-impact violations:

- Repetition of violations previously subject to 03-month or 06-month suspension;
- Violations of media/privacy rules (e.g., photography or filming in restricted areas) at a non-serious level;
- Engaging in public disputes or conduct that adversely affects the reputation of The Rampant Club.

– 12-month suspension: Applicable to serious violations concerning integrity and responsibility:

- Providing inaccurate information in the membership application without constituting serious fraud;
- Causing significant damage to Club property due to intentional acts or gross negligence;
- Violating regulations on bringing food and beverages (particularly alcohol of unclear origin) into the premises contrary to consignment policies.

11.2 Violations Leading to Termination of Membership

The Club reserves the right to immediately and permanently terminate a Member’s membership in the event of the following acts:

- Using, possessing, or facilitating the use of illegal substances, or organizing any unlawful activities at the Club;
- Engaging in physical violence, sexual harassment, or any conduct that poses a serious threat to the safety of any individual at the Club;
- Disclosing the membership list, personal information of other Members, or disseminating sensitive images obtained within the Club to external parties;
- Failure to settle membership fees or service charges for more than thirty (30) days from the due date, following two (02) written notices;
- Using the name, premises, or membership network of The Rampant Club to conduct unauthorized business or brokerage activities without the Company’s prior written consent;
- Committing any violation after the expiration of a twelve (12)-month suspension period.

11.3 During any period of suspension, the suspended member will be unable to enjoy the benefits of membership and no fees shall be refunded.

11.4 Upon termination of membership, the Member shall not be entitled to any refund of fees under any circumstances.

11.5 A member whose membership has been cancelled is permanently ineligible for re-application. Such individuals are also prohibited from entering or accessing the Club premises as a guest of any member or in any other capacity.

## ARTICLE 12. FACILITIES & SERVICES

12.1 The facilities, services and benefits available to members are set out in Schedule Part 1. The Rampant Club reserves its right to change, enhance or modify these from time to time.

12.2 Key facilities include:

- The Library Bar (private cocktail bar)
- The Studio (Sensory art space)
- The Private Dining Room
- The Rampant Room (world-class whisky bottle-share room)
- Source and Origin Lab (innovation laboratory)

12.3 The Rampant Club may from time to time close facilities for private events, essential maintenance, or to comply with legal requirements. Reasonable endeavours will be made to notify members in advance.

12.4 Members are responsible for using the Club’s facilities for their intended purposes and for exercising due care in the maintenance and preservation of the Club’s property and assets. All usage must comply with the Club’s operational guidelines and safety regulations at the premises.

12.5 Members and their guests are solely responsible for any personal items or property they bring onto the premises.

## ARTICLE 13. PERSONAL INFORMATION

13.1 By participating in the Club, the Member acknowledges and agrees that The Rampant Club is entitled to collect, store, and process the following information for the purposes of membership administration, security assurance, and the legitimate interests of the Club:

(a) Member Information: Including name, contact details, occupation, and other personal data provided in the application;

(b) Guest Information: Including the name and basic identification details of guests introduced to the Club by the Member. The Member is responsible for informing and obtaining the guest’s consent prior to providing such information to the Club.

13.2 Members must provide updates to The Rampant Club of any changes to their contact details or other required information.

13.3 The Company is committed to ensuring the privacy and security of member personal data in compliance with all applicable data protection and privacy laws.

## ARTICLE 14. CONDUCT OF MEMBERS AND GUESTS

14.1 Members are required to comply with the Conduct and Etiquette code relating to membership of The Rampant Club, as set out in Schedule Part 2.

14.2 Members introducing guests to the premises shall make their guests aware of these Rules of Membership. Members are wholly responsible for the conduct of their guests.

14.3 Members may bring up to four guests at a time. Additional guests require prior arrangement with the Member Experience Manager.

14.4 Each member shall be fully responsible for any damage, loss or destruction to any property of the Club caused by such member or their guests.

14.5 Any violation of the Code of Conduct and Etiquette shall be subject to disciplinary action in accordance with Article 11, depending on the nature and severity of the violation.

## ARTICLE 15. INTELLECTUAL PROPERTY

15.1 Members shall not copy, reproduce, display or use the names, logos, trademarks or other identifying features of The Rampant Club without prior written approval.

15.2 Club membership does not confer any licence or rights to use The Rampant Club marks or intellectual property.

## ARTICLE 16. LIABILITY

16.1 Save in respect of fraud, death or personal injury caused by negligence, The Rampant Club excludes liability to the fullest extent permitted by law for any loss, damage or injury arising out of membership or use of the premises and facilities.

16.2 The Rampant Club accepts no responsibility for items or property brought onto the premises by members or guests.

## ARTICLE 17. FORCE MAJEURE

17.1 The Rampant Club shall not be obliged to perform any obligations if such performance is impossible or substantially more difficult as a result of acts of God, government orders, industrial disputes, terrorism, war, pandemics, floods, fire, or other causes beyond reasonable control.

## ARTICLE 18. OTHER IMPORTANT CONDITIONS

18.1 Complaints should be made promptly to management on duty or in writing to the Member Experience Manager.

18.2 Any disputes shall be referred to the Membership Committee for consideration.

18.3 These Rules of Membership constitute the entire agreement between The Rampant Club and the member.

18.4 These rules shall be governed by Vietnamese law and members agree to submit to the jurisdiction of the courts of Vietnam.

## ARTICLE 19. MEMBER RESPONSIBILITY AFTER ALCOHOL CONSUMPTION

19.1 Members and their guests acknowledge and accept that they bear full personal responsibility for their own actions and conduct following the consumption of alcohol at The Rampant Club, including but not limited to driving, participation in traffic, and any activities that may pose a risk to themselves or others.

19.2 The Rampant Club and Ruou Ngon Trading Service Company Limited shall not bear any liability for the conduct, actions, or decisions of any member or guest following their departure from the Premises.

## ARTICLE 20. PROHIBITED SUBSTANCES

20.1 The use, possession, distribution, or facilitation of narcotic substances, psychotropic substances, or any other substances prohibited under the Law on Drug Prevention and Control 2025 and related legislation is strictly and absolutely prohibited on the premises of The Rampant Club.

20.2 Where a member or guest is found or reasonably suspected to be in possession of or using prohibited substances, The Rampant Club shall be entitled to: (i) immediately terminate the member's membership without refund; (ii) remove the member and/or their guest from the Premises; and (iii) report the matter to the competent authorities in Vietnam. Any fines, penalties, or losses suffered by the Company as a result shall be recoverable in full from that member.

## ARTICLE 21. PROHIBITION OF ILLEGAL ACTIVITIES

21.1 Members and their guests are prohibited from engaging in any illegal activity on the Premises, including but not limited to prostitution, solicitation, or any related activity. The Rampant Club is a private members environment and must be maintained as such.

21.2 Where the Club has reasonable grounds to suspect that a member or guest is engaged in illegal activity on the Premises, The Rampant Club shall be entitled to immediately terminate the member's membership without refund, remove the member and their guest from the Premises, and report the matter to the competent authorities. Any costs, fines, or penalties imposed on the Company as a result shall be recoverable in full from that member.

## ARTICLE 22. PERSONAL DATA PROTECTION

22.1 In connection with membership, The Rampant Club will collect, store, and process personal data of members and their guests for the purposes of membership administration, service delivery, and, where required, provision to competent authorities in Vietnam. All personal data is processed in accordance with the Personal Data Protection Law 2025 and Decree No. 356/2025/ND-CP.

22.2 Personal data will not be disclosed to any third party other than competent authorities acting within the scope of their legal powers. Members consent to the collection and processing of their personal data by submitting the membership application.

22.3 Members are prohibited from taking photographs, video recordings, or audio recordings of other members or guests within the Premises without the explicit consent of the persons being recorded. Any such recording that infringes the privacy of another member or guest may result in immediate membership termination at the Club's sole discretion.

## ARTICLE 23. SURVEILLANCE AND SECURITY MONITORING

23.1 The Rampant Club operates closed-circuit television (CCTV) surveillance systems in designated areas of the premises for the purposes of ensuring member, guest, and staff safety.

By entering the Premises, members and their guests consent to such monitoring.

23.2 CCTV footage is retained solely for safety and conduct monitoring purposes and will not be disclosed to any third party except upon request by competent authorities in Vietnam acting within the scope of their legal authority.

## ARTICLE 24. WHISKY CONSIGNMENT

24.1 Members who wish to store whisky at The Rampant Club's Members' Lounge must enter into a separate Whisky Consignment and Storage Agreement with the Club. These Rules of Membership should be read in conjunction with that Agreement.

24.2 Upon the expiry, non-renewal, or termination of a member's membership for any reason, the member must collect all whisky stored at the Premises within 30 days. If the member fails to collect within this period, The Rampant Club reserves the right to arrange the return, storage, or disposal of the whisky at the member's expense following reasonable written notice.

24.3 Members are prohibited from transferring, selling, or exchanging whisky stored at The Rampant Club with any other member or third party on a commercial basis. Any such transaction discovered by the Club may result in immediate membership termination without refund and may be reported to the relevant authorities.

## SCHEDULE PART 1: BENEFITS OF MEMBERSHIP

### A. BENEFITS TO MEMBERS

### 1. Exclusive Access

The Clubhouse Facilities:

- The Library Bar – rotating seasonal cocktails, vintage spirits, curated books and games
- The Studio – rotating sensory art experiences
- The Private Dining Room – for meetings and intimate gatherings
- The Rampant Room – world-class whisky bottle-share room
- Source and Origin Lab – exclusive beverage innovations

### 2. Whisky Benefits

- Quarterly Club Picks – single casks bottled exclusively for members, available for purchase only via the club
- Your Own Cask program – private cask purchase available with full process management
- "The Rarest Reserve" access – first refusal on rare aged stocks
- Private labelling of Duncan Taylor Blends (minimum 20 bottles)
- 20% discount on retail whisky purchases

### 3. Global Benefits

Benefits at Our Scottish Castle (opening 2027, full benefits may change closer to the time of opening):

- Discounts on stays, activities, and dining
- Access to exclusive Rampant Club whisky collection
- Stay at The Rampant Room apartments in Huntly Global Whisky Access:
- Curated distillery tours worldwide (where pre-agreed arrangements exist)
- Bespoke experiences through industry contacts

### 4. Concierge Services

- Zalo/WhatsApp hotline for bookings and requests
- Event mastery – from Scottish adventures to private dining
- Corporate & personal gifting service
- Reciprocal club access globally

### 5. Transport Benefits

- Luxury transport service (4 hours notice)
- Airport fast-track directly to the club for international arrivals

### 6. Events & Networking

- Curated calendar of exclusive events
- Round table events and business brunches
- Annual gifts and amenities program
- Referral rewards

### B. GUEST PRIVILEGES

- Members may bring up to 4 guests at once
- Guests must be signed in by the member
- Members may authorise unsupervised guests at a minimum of 48 hours in advance, written agreement must be provided by the club Chairman. Admittance not guaranteed
- Guest behaviour remains member's responsibility

## SCHEDULE PART 2: CONDUCT & ETIQUETTE

### 1. General Conduct

Members and guests shall conduct themselves with decorum at all times, reflecting the prestige and reputation of The Rampant Club. This environment is built on trust, discretion, and mutual respect.

### 2. Participation Requirement

The Rampant Club is founded on shared experiences. Members are expected to participate in at least two events per year to keep the community vibrant and connections strong.

Attendance affects membership renewal prospects.

### 3. Dress Code

Smart casual attire is expected. Members should maintain a reasonable standard of dress, be clean and tidy, avoiding clothing likely to cause offence.

### 4. Membership Cards

Each member receives a membership card which should be presented upon entry. Cards remain Club property and must be returned upon membership termination.

### 5. Entering & Leaving

Members and guests should enter and leave quietly in consideration of neighbours and the discreet nature of the Club.

### 6. Privacy for Members/Guests

Members should be courteous and discreet, respecting the privacy of others. The Club values discretion above all else.

### 7. Mobile Phones

Phones should be set to silent in the club. Please be considerate of other guests, taking calls in the hallways if necessary.

### 8. Photography & Recording

No photography or recording devices may be used in The Library Bar, The Studio, or The Rampant Room to protect member privacy. Where contravened, The Rampant Club reserves the right to require deletion of recorded content. Photos can be taken at the entrance to the club only.

### 9. Laptop Use

- The Library Bar: No laptops after 4pm
- The Rampant Room: No laptops permitted
- The Private Dining Room: Permitted for business meetings

### 10. Social Media

Unless expressly permitted by The Rampant Club in writing, members should not make public announcements through social media concerning other members, guests, or Club events.

### 11. Smoking

Smoking is permitted only within the Rampant Room and the Private Dining Room (Floors 3 and 4). When smoking inside the rooms, both French doors must remain fully open and smoking may only take place beside the window. The Club may, at its discretion, provide designated exterior smoking areas for member use.

Smoking, including the use of e-cigarettes or similar devices, is strictly prohibited in all other interior areas of the Club premises, including The Studio (to protect the artworks on display) and the Library Bar on Floors 1 and 2. Any breach of these smoking restrictions by a member or their guest will subject the member to disciplinary action in accordance with the Club’s Rules of Membership.

### 12. Substances

12.1 The use, possession, distribution, or facilitation of the use of narcotics, psychotropic substances, or any other prohibited substances under the laws of Vietnam is strictly prohibited at all times within the Club.

12.2 Members and their guests are not permitted to enter or remain on the Club premises while under the influence of narcotics or any prohibited substances.

12.3 Any violation, or any reasonable grounds to suspect a violation, shall result in the immediate termination of membership without any refund of fees. The Club reserves the right to report such matters to the competent police authorities in accordance with Article 20 of these Regulations.

### 13. Settlement of Charges

Members should settle all charges before leaving the premises unless prior arrangements have been made. Members are responsible for all guest charges.

### 14. Special Requirements

Members should notify The Rampant Club of any disabilities, allergies, or dietary requirements relating to themselves or their guests.

### 15. Accidents & Injuries

Any accident or injury should be reported to staff immediately and within 24 hours of the incident.

These Rules of Membership are effective as of February 25th 2026.

The Rampant Club reserves the right to amend these rules at any time to ensure the continued excellence of the member experience.

For membership enquiries:

Email: Membership@TheRampantClub.com

Hotline: Available to members via Zalo/WhatsApp

74A2 Hai Ba Trung, Sai Gon Ward

Ho Chi Minh City, Vietnam$md$,
  $vn$Văn bản này được lập bằng cả tiếng Anh và tiếng Việt. Trong trường hợp có bất kỳ sự khác biệt hoặc mâu thuẫn nào giữa phiên bản tiếng Anh và tiếng Việt, phiên bản tiếng Anh sẽ được ưu tiên áp dụng.

## ĐIỀU 1. TÊN VÀ ĐỊA ĐIỂM CÂU LẠC BỘ

1.1 Văn bản này quy định các điều kiện thành viên áp dụng đối với thành viên của câu lạc bộ tư nhân (sau đây gọi là "The Rampant Club" hoặc "Câu lạc bộ"), có địa chỉ tại 74A2 Đường Hai Bà Trưng, Phường Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam ("Cơ sở").

## ĐIỀU 2. MỤC ĐÍCH CỦA THE RAMPANT CLUB

2.1 Mục đích của The Rampant Club là cung cấp văn hóa whisky, dịch vụ tiếp khách và các trải nghiệm độc quyền nhằm tạo điều kiện giao lưu xã hội cho các thành viên và khách mời của họ, đặc biệt tập trung vào việc xây dựng các mối quan hệ có ý nghĩa và làm giàu văn hóa.

2.2 Câu lạc bộ là nơi dành riêng cho những cá nhân có ảnh hưởng trong ngành và cộng đồng, mang đến một môi trường tin tưởng, kín đáo và chia sẻ mục đích chung.

## ĐIỀU 3. QUYỀN SỞ HỮU VÀ CÁC NGUYÊN TẮC CƠ BẢN

3.1 The Rampant Club là thương hiệu câu lạc bộ tư nhân thuộc quyền sở hữu và điều hành bởi Công ty CTY Rượu Ngon ("Công ty"), một công ty trách nhiệm hữu hạn. Công ty chịu trách nhiệm cung cấp cơ sở vật chất và dịch vụ của Câu lạc bộ như được mô tả chi tiết tại Phụ lục Phần 1 của Quy chế Thành viên này.

3.2 Tư cách thành viên của Câu lạc bộ có hiệu lực theo từng năm. Tư cách thành viên không trao cho thành viên quyền sở hữu hoặc tham gia vào bất kỳ cổ phần, quyền biểu quyết hoặc các vấn đề cổ đông nào của The Rampant Club hoặc Công ty.

3.3 Tư cách thành viên của The Rampant Club cho phép thành viên tiếp cận các cơ sở vật chất, dịch vụ và quyền lợi độc quyền như được quy định tại Phụ lục Phần 1 của Quy chế Thành viên này.

3.4 Công ty là đơn vị liên kết với Duncan Taylor Scotch Whisky Ltd, đơn vị sở hữu và vận hành các kho và cơ sở whisky tại Scotland. Tư cách thành viên của The Rampant Club mang lại một số quyền lợi và ưu đãi liên quan đến các cơ sở này.

3.5 Thành viên không chịu bất kỳ trách nhiệm tài chính nào đối với hoạt động của Câu lạc bộ do tư cách thành viên của mình. Trách nhiệm tài chính của mỗi thành viên chỉ giới hạn ở việc thanh toán các khoản phí và chi phí cho các dịch vụ đã sử dụng.

3.6 Quy chế Thành viên này có thể được The Rampant Club sửa đổi tùy từng thời điểm theo quyết định đơn phương của mình. Phiên bản mới nhất sẽ được cung cấp thông qua quy trình đăng ký. Cập nhật lần cuối ngày 13 tháng 11 năm 2025.

3.7 Quy chế Thành viên cần được đọc cùng với đơn đăng ký thành viên, hai văn bản này cùng tạo thành hợp đồng thành viên.

## ĐIỀU 4. ĐIỀU HÀNH VÀ QUẢN LÝ

4.1 Trách nhiệm điều hành và quản lý The Rampant Club thuộc về các giám đốc của Công ty, với sự hỗ trợ của đội ngũ quản lý do Công ty chỉ định.

4.2 Hội đồng Thành viên đã được thành lập với trách nhiệm xem xét và xử lý các đơn đăng ký thành viên mới cũng như lời mời gia hạn tư cách thành viên. Hội đồng đặc biệt chú trọng đến sự phù hợp về văn hóa và sự tương đồng với các giá trị của Câu lạc bộ.

4.3 Đầu mối liên lạc chính trong ban quản lý The Rampant Club dành cho thành viên là Quản lý Trải nghiệm Thành viên qua địa chỉ email members@Therampantclub.com.

## ĐIỀU 5. TƯ CÁCH THÀNH VIÊN

5.1 Các loại tư cách thành viên sau đây được áp dụng:

- Thành viên Legacy (Di sản): Thành viên phải từ 33 tuổi trở lên, đại diện cho những cá nhân có uy tín đang định hình ngành nghề và cộng đồng của họ.
- Thành viên Pioneer (Tiên phong): Thành viên dưới 33 tuổi (tối thiểu 21 tuổi), đại diện cho những nhà lãnh đạo mới nổi và những người sáng tạo đang tiến.
- Thành viên Corporate (Doanh nghiệp): Một công ty hoặc tổ chức có thể đề cử tối đa ba (03) nhân viên làm thành viên dưới một tài khoản doanh nghiệp duy nhất.

Mỗi nhân viên được đề cử sẽ được xem là một Thành viên độc lập, chịu sự thẩm định, có quyền lợi và nghĩa vụ tương tự như Thành viên cá nhân. Để tránh nhầm lẫn, Thành viên Doanh nghiệp không phải là hình thức "thay đổi linh hoạt" hoặc "dùng chung"; quyền truy cập chỉ giới hạn nghiêm ngặt cho các cá nhân cụ thể được ghi nhận trong Hệ thống Dữ liệu Thành viên (Member Intelligence System) của Câu lạc bộ.

Mỗi nhân sự được đề cử theo Tài khoản Doanh nghiệp sẽ được tính là một (01) thành viên trong tổng giới hạn 99 thành viên sáng lập của The Rampant Club. Tại thời điểm đề cử, Tổ chức phải cung cấp Thư xác nhận công tác chính thức bằng văn bản có tiêu đề của công ty, xác nhận vai trò hiện tại của người được đề cử và ủy quyền cho họ đại diện Tổ chức với tư cách thành viên. Mỗi nhân sự được đề cử phải hoàn thành quy trình phỏng vấn và đánh giá tiêu chuẩn của Câu lạc bộ trước khi tư cách thành viên được kích hoạt.

Tổ chức có quyền thay đổi (thay thế) nhân viên được đề cử trong các trường hợp: (i) Nhân viên đó nghỉ việc tại Tổ chức; hoặc (ii) Tổ chức có thay đổi về cơ cấu nhân sự cấp cao. Mỗi lần thay đổi nhân sự đề cử, Tổ chức phải gửi thông báo bằng văn bản và thanh toán một khoản Phí Hành chính không hoàn lại là 1.000.000 đồng để Câu lạc bộ cập nhật hồ sơ, cấp lại thẻ và thực hiện quy trình thẩm định (phỏng vấn) đối với nhân sự thay thế. Nhân sự thay thế phải đáp ứng các tiêu chuẩn về độ tuổi và uy tín nghề nghiệp của Câu lạc bộ.

- Thành viên Honorary (Danh dự): Thành viên được Công ty mời theo quyết định đơn phương của The Rampant Club.

5.2 Quyền lợi của các loại tư cách thành viên được quy định tại Phụ lục Phần 1.

5.3 Ngoại trừ trường hợp thay đổi nhân sự của Thành viên Corporate theo quy định tại Điều 5.1(c), tư cách thành viên mang tính cá nhân và không được chuyển nhượng, ủy quyền hoặc chia sẻ dưới bất kỳ hình thức nào.

5.4 Thành viên được kỳ vọng tham gia ít nhất hai (02) sự kiện của Câu lạc bộ mỗi năm để duy trì sự sôi động của cộng đồng.

5.5 Tất cả thành viên của The Rampant Club phải từ 21 tuổi trở lên. Tất cả khách mời được thành viên đưa vào Cơ sở phải từ 18 tuổi trở lên. Thành viên chịu trách nhiệm cá nhân trong việc đảm bảo tuân thủ quy định về độ tuổi của mọi khách mời do mình giới thiệu vào Câu lạc bộ.

5.6 Câu lạc bộ có quyền yêu cầu thành viên hoặc khách mời xuất trình giấy tờ xác minh độ tuổi vào bất kỳ thời điểm nào. Trường hợp thành viên giới thiệu khách mời được phát hiện chưa đủ 18 tuổi, tư cách thành viên có thể bị đình chỉ hoặc chấm dứt theo quyết định toàn quyền của Câu lạc bộ mà không hoàn phí.

## ĐIỀU 6. ĐƠN ĐĂNG KÝ VÀ TUYỂN CHỌN THÀNH VIÊN

6.1 Tư cách thành viên chỉ được cấp theo quyết định đơn phương của Câu lạc bộ và chỉ có thể thông qua lời mời hoặc giới thiệu. Tất cả ứng viên phải trải qua quy trình phỏng vấn và đánh giá. Ứng viên hoàn thành thành công quy trình này có thể, theo quyết định của Câu lạc

bộ, được đưa vào danh sách chờ thành viên. Việc kết nạp thành viên không được đảm bảo và phụ thuộc vào sự phê duyệt cuối cùng của Câu lạc bộ.

6.2 Cá nhân muốn trở thành thành viên phải hoàn thành và nộp đơn đăng ký thành viên cũng như tham gia quy trình phỏng vấn tuyển chọn của Câu lạc bộ. Bằng việc nộp đơn đăng ký, ứng viên thừa nhận và đồng ý rằng, nếu đơn đăng ký được chấp thuận, họ sẽ bị ràng buộc bởi Quy chế Thành viên này và bất kỳ chính sách liên quan nào có hiệu lực tại thời điểm kết nạp.

6.3 Ứng viên thành viên phải từ đủ hai mươi mốt (21) tuổi trở lên.

6.4 Tất cả đơn đăng ký thành viên sẽ được Hội đồng Thành viên xem xét. Hội đồng có toàn quyền và quyền tuyệt đối trong việc chấp thuận hoặc từ chối bất kỳ đơn đăng ký nào. Khi thực hiện quyền này, Hội đồng có thể xem xét các yếu tố bao gồm nhưng không giới hạn ở sự phù hợp văn hóa, đóng góp tiềm năng của ứng viên cho cộng đồng Câu lạc bộ và sự tương đồng với các giá trị của Câu lạc bộ. Quyết định của Hội đồng là cuối cùng và không thể khiếu nại.

6.5 Hội đồng Thành viên sẽ tuân thủ tất cả các luật pháp hiện hành khi quyết định chấp thuận hoặc từ chối đơn đăng ký thành viên.

6.6 Chúng tôi yêu cầu thông tin thanh toán được cung cấp khi nộp đơn đăng ký. Nếu thành công, phí gia nhập và phí thành viên hàng năm tương ứng sẽ được thu, và xác nhận sẽ được gửi qua bộ phận tài chính.

6.7 Các giới thiệu thành công sẽ được thưởng hậu hĩnh bằng tín dụng câu lạc bộ và một chai whisky đặc biệt từ kho dự trữ của chúng tôi.

## ĐIỀU 7. GIA HẠN TƯ CÁCH THÀNH VIÊN

7.1 Tư cách thành viên có hiệu lực trong thời hạn một (01) năm và có thể gia hạn hàng năm sau đó. Việc gia hạn tư cách thành viên không tự động và phụ thuộc vào lời mời gia hạn do The Rampant Club đơn phương quyết định.

7.2 Lần gia hạn đầu tiên sẽ có hiệu lực vào ngày đầu tiên của tháng tiếp theo sau mười hai (12) tháng kể từ ngày gia nhập. Các lần gia hạn tiếp theo sẽ có hiệu lực vào cùng ngày đó trong các năm tiếp theo.

7.3 Lời mời gia hạn sẽ được phát hành trước khi kết thúc năm thành viên hiện tại. Thành viên nên xác nhận ý định bằng văn bản một cách kịp thời.

## ĐIỀU 8. PHÍ THÀNH VIÊN

8.1 Sau khi được chọn làm thành viên mới, thành viên sẽ thanh toán cho The Rampant Club phí gia nhập (nếu áp dụng) cùng với phí thành viên hàng năm cho năm đầu tiên.

8.2 Quyền lợi thành viên chỉ được hưởng sau khi đã thanh toán các khoản phí thành viên tương ứng.

8.3 Phí gia nhập năm 2025 như sau:

- Thành viên Legacy (Di sản): 5.000 USD (tương đương VND)
- Thành viên Pioneer (Tiên phong): 3.000 USD (tương đương VND)
- Thành viên Corporate (Doanh nghiệp): 8.000 USD (tương đương VND)
- Lưu ý: Miễn phí gia nhập cho 30 thành viên đầu tiên

8.4 Phí thành viên hàng năm năm 2025 như sau:

- Thành viên Legacy (Di sản): 5.000 USD (tương đương 130 triệu VND)
- Thành viên Pioneer (Tiên phong): 3.000 USD (tương đương 80 triệu VND)
- Thành viên Corporate (Doanh nghiệp): 8.000 USD mỗi công ty (bao gồm 3 người được đề cử) (tương đương 210 triệu VND)

8.5 Tất cả các khoản phí phải được thanh toán đầy đủ trước bằng hình thức chuyển khoản ngân hàng hoặc phương thức thanh toán được chấp thuận. Thành viên có thể yêu cầu thanh toán làm hai (02) đợt: một đợt trước khi gia nhập và một đợt vào đầu nửa sau của kỳ thành viên.

8.6 Phí thành viên do The Rampant Club ấn định và có thể được điều chỉnh bất kỳ lúc nào. Thành viên gia hạn sẽ được thông báo về mọi thay đổi phí khi nhận lời mời gia hạn. Phí được tính toán để trang trải chi phí vận hành câu lạc bộ. Mọi tăng phí sẽ được trình trước Hội đồng Thành viên và phải có căn cứ từ những thay đổi về tình hình tài chính.

8.7 Việc không thanh toán bất kỳ khoản phí thành viên nào trong thời hạn mười bốn (14) ngày kể từ ngày đến hạn sẽ cấu thành vi phạm trọng yếu Quy chế Thành viên này và có thể dẫn đến việc đình chỉ hoặc hủy bỏ tư cách thành viên.

8.8. Tất cả các khoản phí quy định tại Điều 8 (Phí gia nhập và Phí thành viên hàng năm) và các chi phí dịch vụ phát sinh tại Câu lạc bộ là [đã bao gồm/chưa bao gồm] thuế giá trị gia tăng (VAT) theo quy định của pháp luật hiện hành.

The Rampant Club có trách nhiệm xuất hóa đơn điện tử cho Thành viên đối với các khoản phí đã thanh toán. Hóa đơn sẽ được gửi qua địa chỉ email mà Thành viên đã đăng ký trong hồ sơ thành viên hoặc thông qua hệ thống quản lý hóa đơn điện tử của Công ty.

8.9. Thành viên có nhu cầu xuất hóa đơn cho tổ chức/doanh nghiệp có trách nhiệm cung cấp chính xác và đầy đủ các thông tin sau tại thời điểm nộp đơn đăng ký hoặc chậm nhất là tại thời điểm thanh toán:

- Tên tổ chức/doanh nghiệp;
- Mã số thuế;
- Địa chỉ trụ sở chính (theo giấy đăng ký kinh doanh).

Công ty không chịu trách nhiệm đối với các khiếu nại liên quan đến hóa đơn nếu Thành viên cung cấp thông tin chậm trễ hoặc sai lệch sau khi hóa đơn đã được phát hành trên hệ thống Tổng cục Thuế.

8.10. Đối với các khoản thanh toán bằng ngoại tệ (USD) được quy đổi ra VND, giá trị trên hóa đơn VAT sẽ được căn cứ theo số tiền VND thực tế mà Công ty nhận được theo tỷ giá quy đổi tại thời điểm thanh toán phù hợp với quy định về quản lý ngoại hối.

## ĐIỀU 9. TẠM NGƯNG TƯ CÁCH THÀNH VIÊN

9.1 Thành viên có quyền tạm ngưng tư cách thành viên vì bất kỳ lý do cá nhân nào. Thành viên chỉ cần gửi thông báo bằng văn bản (email hoặc thư tay) cho Quản lý Trải nghiệm Thành viên trước ít nhất mười bốn (14) ngày so với ngày dự định tạm ngưng. Việc tạm ngưng này không cần sự phê duyệt từ phía Câu lạc bộ nhưng phải tuân thủ các giới hạn tại Khoản 9.2 và 9.3.

9.2 Thành viên được phép tạm ngưng tối đa 01 lần trong mỗi năm thành viên. Thời gian tạm ngưng tối thiểu là ba (03) tháng và tối đa là mười hai (12) tháng.

9.3 Khi tạm ngưng, thời gian còn lại của kỳ hạn thành viên hiện tại sẽ được tự động bảo lưu. Ngày hết hạn của thẻ thành viên sẽ được gia hạn tương ứng với số ngày đã tạm ngưng thực tế sau khi Thành viên kích hoạt lại tư cách của mình.

9.4. Trong thời gian tạm ngưng, Thành viên không phải đóng phí thành viên (nếu đang trả góp) nhưng đồng thời cũng không được hưởng bất kỳ quyền lợi nào hoặc tiếp cận Cơ sở vật chất của Câu lạc bộ.

Đối với các tài sản ký gửi (rượu Whisky), Thành viên vẫn có nghĩa vụ tuân thủ các điều khoản về lưu trữ hoặc phí quản lý (nếu có) được quy định tại Thỏa thuận Ký gửi.

## ĐIỀU 10. TỪ BỎ TƯ CÁCH THÀNH VIÊN

10.1 Thành viên có thể từ bỏ tư cách thành viên bằng cách gửi thông báo bằng văn bản cho Quản lý Trải nghiệm Thành viên. Thông báo này phải được nộp trước ngày gia hạn hàng năm.

10.2 Thành viên từ bỏ sẽ không được hoàn lại, giảm trừ hoặc bồi hoàn bất kỳ khoản phí gia nhập, phí thành viên hàng năm nào hoặc bất kỳ phần nào của các khoản phí đó. Tất cả các khoản phí thành viên được tính toán trên cơ sở hàng năm, bất kể thành viên chọn thanh toán toàn bộ hay một phần.

## ĐIỀU 11. ĐÌNH CHỈ VÀ HỦY BỎ TƯ CÁCH THÀNH VIÊN BỞI THE

RAMPANT CLUB

11.1 Các vi phạm dẫn đến Đình chỉ Tư cách Thành viên: Tùy vào tính chất và mức độ nghiêm trọng của hành vi, Câu lạc bộ sẽ áp dụng các mức đình chỉ sau:

- Đình chỉ 03 tháng: Áp dụng đối với các vi phạm lần đầu hoặc nhẹ về quy định vận hành, bao gồm:
- Vi phạm quy định về trang phục (Dress Code) quá 03 lần sau khi đã được nhắc nhở;
- Gây tiếng ồn hoặc có hành vi làm ảnh hưởng đến không gian yên tĩnh chung của các thành viên khác;
- Đưa khách mời vào Cơ sở vượt quá số lượng quy định mà không có sự sắp xếp trước với Quản lý Trải nghiệm Thành viên.
- Đình chỉ 06 tháng: Áp dụng đối với các vi phạm về ứng xử và quy tắc cộng đồng:
- Có thái độ hoặc ngôn từ thiếu tôn trọng, gây hấn đối với nhân viên Câu lạc bộ hoặc thành viên khác;
- Sử dụng cơ sở vật chất sai mục đích hoặc không tuân thủ hướng dẫn an toàn gây hư hại nhẹ cho tài sản Câu lạc bộ;
- Cho mượn hoặc chuyển nhượng quyền sử dụng các quyền lợi thành viên (không bao gồm thẻ thành viên) cho người không phải là khách mời hợp lệ.
- Đình chỉ 09 tháng: Áp dụng đối với các vi phạm mang tính hệ thống hoặc ảnh hưởng đến danh tiếng:
- Tái phạm các lỗi đã từng bị đình chỉ 03 hoặc 06 tháng;
- Vi phạm các quy định về bảo mật hình ảnh (chụp ảnh, quay phim tại các khu vực cấm) ở mức độ chưa nghiêm trọng;
- Gây ra các tranh cãi công khai hoặc hành vi làm tổn hại đến hình ảnh của The Rampant Club.
- Đình chỉ 12 tháng: Áp dụng đối với các vi phạm nghiêm trọng về uy tín và trách nhiệm:
- Cung cấp thông tin sai lệch trong hồ sơ thành viên nhưng chưa đến mức trục lợi nghiêm trọng;
- Gây thiệt hại tài sản đáng kể cho Câu lạc bộ do hành vi cố ý hoặc thiếu trách nhiệm nghiêm trọng;
- Vi phạm quy định về việc mang đồ ăn, thức uống (đặc biệt là rượu không rõ nguồn gốc) vào Cơ sở trái với quy định ký gửi.

11.2 Các vi phạm dẫn đến Hủy bỏ Tư cách Thành viên: Câu lạc bộ có quyền chấm dứt ngay lập tức và vĩnh viễn tư cách thành viên đối với các hành vi sau:

- Sử dụng, tàng trữ chất cấm hoặc tổ chức các hoạt động trái pháp luật tại Câu lạc bộ.
- Có hành vi bạo lực thể xác, quấy rối tình dục hoặc đe dọa nghiêm trọng đến an toàn của bất kỳ cá nhân nào tại Câu lạc bộ.
- Tiết lộ danh sách thành viên, thông tin cá nhân của thành viên khác hoặc phát tán hình ảnh nhạy cảm thu thập được tại Câu lạc bộ ra bên ngoài.
- Không thanh toán phí thành viên hoặc các hóa đơn dịch vụ quá 30 ngày kể từ ngày đến hạn và sau 02 lần thông báo bằng văn bản.
- Sử dụng tên tuổi, địa điểm hoặc danh sách thành viên của The Rampant Club để thực hiện các hoạt động kinh doanh, môi giới trái phép khi chưa được Công ty đồng ý bằng văn bản.
- Thực hiện bất kỳ hành vi vi phạm nào sau khi đã hết thời hạn đình chỉ 12 tháng.

11.3 Trong thời gian bị đình chỉ, thành viên bị đình chỉ sẽ không được hưởng các quyền lợi thành viên và không được hoàn lại bất kỳ khoản phí nào.

11.4 Khi bị hủy bỏ tư cách, Thành viên không được hoàn lại bất kỳ khoản phí nào.

11.5 Thành viên có tư cách thành viên bị hủy bỏ sẽ vĩnh viễn không đủ điều kiện đăng ký lại. Những cá nhân này cũng bị cấm vào hoặc tiếp cận cơ sở Câu lạc bộ với tư cách khách mời của bất kỳ thành viên nào hoặc dưới bất kỳ hình thức nào khác.

## ĐIỀU 12. CƠ SỞ VẬT CHẤT VÀ DỊCH VỤ

12.1 Các cơ sở vật chất, dịch vụ và quyền lợi dành cho thành viên được quy định tại Phụ lục Phần 1. The Rampant Club bảo lưu quyền thay đổi, nâng cấp hoặc điều chỉnh các nội dung này tùy từng thời điểm.

12.2 Các cơ sở vật chất chính bao gồm:

- The Library Bar (Quán bar cocktail tư nhân)
- The Studio (Không gian nghệ thuật cảm quan)
- The Private Dining Room (Phòng ăn riêng)
- The Rampant Room (Phòng thưởng thức whisky đẳng cấp thế giới)
- Source and Origin Lab (Phòng thí nghiệm sáng tạo)

12.3 The Rampant Club có thể đóng cửa cơ sở vật chất tùy từng thời điểm để phục vụ sự kiện riêng, bảo trì cần thiết hoặc tuân thủ các yêu cầu pháp luật. Câu lạc bộ sẽ nỗ lực hợp lý để thông báo trước cho thành viên.

12.4 Thành viên có trách nhiệm sử dụng đúng mục đích và có ý thức giữ gìn, bảo quản cơ sở vật chất cũng như tài sản của Câu lạc bộ. Mọi hành vi sử dụng phải tuân thủ các hướng dẫn vận hành và quy định an toàn tại Cơ sở.

12.5 Thành viên và khách mời của họ tự chịu trách nhiệm về bất kỳ tài sản hoặc vật dụng cá nhân nào mang vào cơ sở.

## ĐIỀU 13. THÔNG TIN CÁ NHÂN

13.1 Bằng việc tham gia Câu lạc bộ, Thành viên thừa nhận và đồng ý rằng The Rampant Club có quyền thu thập, lưu trữ và xử lý các thông tin sau đây nhằm mục đích quản lý tư cách thành viên, đảm bảo an ninh và phục vụ các lợi ích hợp pháp của Câu lạc bộ:

(a) Thông tin Thành viên: Bao gồm tên, thông tin liên lạc, nghề nghiệp và các dữ liệu cá nhân khác được cung cấp trong đơn đăng ký;

(b) Thông tin Khách mời: Tên và các thông tin định danh cơ bản của khách mời do Thành viên giới thiệu vào Câu lạc bộ. Thành viên có trách nhiệm thông báo và nhận được sự đồng ý của khách mời về việc cung cấp thông tin này cho Câu lạc bộ.

13.2 Thành viên phải cập nhật cho The Rampant Club về bất kỳ thay đổi nào liên quan đến thông tin liên lạc hoặc các thông tin bắt buộc khác của họ.

13.3 Công ty cam kết đảm bảo quyền riêng tư và bảo mật dữ liệu cá nhân của thành viên theo tất cả các luật bảo vệ dữ liệu và quyền riêng tư hiện hành.

## ĐIỀU 14. QUY TẮC ỨNG XỬ CỦA THÀNH VIÊN VÀ KHÁCH MỜI

14.1 Thành viên phải tuân thủ Quy tắc Ứng xử và Phép tắc liên quan đến tư cách thành viên của The Rampant Club, như được quy định tại Phụ lục Phần 2.

14.2 Thành viên giới thiệu khách vào cơ sở phải thông báo cho khách biết về Quy chế Thành viên này. Thành viên chịu hoàn toàn trách nhiệm về hành vi của khách mời.

14.3 Thành viên có thể mang theo tối đa bốn (04) khách mời cùng một lúc. Việc mang theo thêm khách cần được sắp xếp trước với Quản lý Trải nghiệm Thành viên.

14.4 Mỗi thành viên chịu hoàn toàn trách nhiệm về bất kỳ thiệt hại, mất mát hoặc hư hỏng nào đối với tài sản của Câu lạc bộ do thành viên hoặc khách mời của họ gây ra.

14.5 Mọi hành vi vi phạm Quy tắc Ứng xử và Phép tắc tùy theo tính chất và mức độ sẽ bị xử lý theo quy định tại Điều 11.

## ĐIỀU 15. SỞ HỮU TRÍ TUỆ

15.1 Thành viên không được sao chép, tái tạo, trưng bày hoặc sử dụng tên, logo, nhãn hiệu hoặc các đặc điểm nhận dạng khác của The Rampant Club khi chưa có sự chấp thuận bằng văn bản trước đó.

15.2 Tư cách thành viên không trao bất kỳ giấy phép hay quyền nào để sử dụng nhãn hiệu hoặc tài sản trí tuệ của The Rampant Club.

## ĐIỀU 16. GIỚI HẠN TRÁCH NHIỆM

16.1 Trừ trường hợp gian lận, tử vong hoặc thương tích cá nhân do bất cẩn, The Rampant Club loại trừ trách nhiệm ở mức tối đa mà pháp luật cho phép đối với bất kỳ mất mát, thiệt hại hoặc thương tích nào phát sinh từ tư cách thành viên hoặc việc sử dụng cơ sở và tiện ích.

16.2 The Rampant Club không chịu trách nhiệm về các vật dụng hoặc tài sản do thành viên hoặc khách mời mang vào cơ sở.

## ĐIỀU 17. SỰ KIỆN BẤT KHẢ KHÁNG

17.1 The Rampant Club không có nghĩa vụ thực hiện bất kỳ nghĩa vụ nào nếu việc thực hiện đó là không thể hoặc khó khăn đáng kể do thiên tai, lệnh của chính phủ, tranh chấp lao động, khủng bố, chiến tranh, đại dịch, lũ lụt, hỏa hoạn hoặc các nguyên nhân khác ngoài tầm kiểm soát hợp lý.

## ĐIỀU 18. CÁC ĐIỀU KIỆN QUAN TRỌNG KHÁC

18.1 Mọi khiếu nại nên được gửi kịp thời đến ban quản lý trực hoặc bằng văn bản đến Quản lý Trải nghiệm Thành viên.

18.2 Mọi tranh chấp sẽ được chuyển đến Hội đồng Thành viên để xem xét.

18.3 Quy chế Thành viên này cấu thành toàn bộ thỏa thuận giữa The Rampant Club và thành viên.

18.4 Quy chế này được điều chỉnh bởi pháp luật Việt Nam và thành viên đồng ý chịu sự phán quyết của tòa án Việt Nam.

## ĐIỀU 19. TRÁCH NHIỆM CỦA THÀNH VIÊN SAU KHI SỬ DỤNG RƯỢU

19.1 Thành viên và khách mời xác nhận và chấp nhận rằng họ hoàn toàn chịu trách nhiệm cá nhân đối với hành vi và ứng xử của bản thân sau khi tiêu thụ rượu tại The Rampant Club, bao gồm nhưng không giới hạn ở việc lái xe, tham gia giao thông và bất kỳ hoạt động nào có thể gây nguy hiểm cho bản thân hoặc người khác.

19.2 The Rampant Club và Công ty TNHH Dịch vụ Thương mại Rượu Ngon không chịu bất kỳ trách nhiệm pháp lý nào đối với hành vi, hành động hoặc quyết định của thành viên hoặc khách mời sau khi rời khỏi Cơ sở.

## ĐIỀU 20. CHẤT BỊ CẤM

20.1 Việc sử dụng, tàng trữ, phân phối hoặc tạo điều kiện cho việc sử dụng chất ma túy, chất hướng thần hoặc bất kỳ chất nào bị cấm theo Luật Phòng, chống ma túy 2025 và các văn bản pháp luật liên quan là hoàn toàn bị nghiêm cấm tại Cơ sở của The Rampant Club.

20.2 Khi thành viên hoặc khách mời bị phát hiện hoặc có căn cứ hợp lý để nghi ngờ đang tàng trữ hoặc sử dụng chất bị cấm, The Rampant Club có quyền: (i) chấm dứt ngay lập tức tư cách thành viên mà không hoàn phí; (ii) yêu cầu thành viên và/hoặc khách mời rời khỏi Cơ sở; và (iii) báo cáo vụ việc đến cơ quan có thẩm quyền tại Việt Nam. Mọi khoản tiền phạt, hình phạt hoặc tổn thất mà Công ty phải chịu có thể được yêu cầu bồi hoàn đầy đủ từ thành viên đó.

## ĐIỀU 21. CẤM CÁC HOẠT ĐỘNG TRÁI PHÁP LUẬT

21.1 Thành viên và khách mời bị nghiêm cấm tham gia vào bất kỳ hoạt động trái pháp luật nào tại Cơ sở, bao gồm nhưng không giới hạn ở mại dâm, môi giới mại dâm hoặc bất kỳ hoạt động liên quan nào. The Rampant Club là môi trường dành riêng cho thành viên và phải được duy trì như vậy.

21.2 Khi Câu lạc bộ có căn cứ hợp lý để nghi ngờ thành viên hoặc khách mời đang tham gia vào hoạt động trái pháp luật tại Cơ sở, The Rampant Club có quyền chấm dứt ngay lập tức tư cách thành viên mà không hoàn phí, yêu cầu thành viên và khách mời rời khỏi Cơ sở, và báo cáo vụ việc đến cơ quan có thẩm quyền. Mọi chi phí, tiền phạt hoặc hình phạt áp đặt lên Công ty có thể được yêu cầu bồi hoàn đầy đủ từ thành viên đó.

## ĐIỀU 22. BẢO VỆ DỮ LIỆU CÁ NHÂN

22.1 Trong khuôn khổ tư cách thành viên, The Rampant Club sẽ thu thập, lưu trữ và xử lý dữ liệu cá nhân của thành viên và khách mời nhằm mục đích quản lý thành viên, cung cấp dịch vụ và khi cần thiết, cung cấp cho cơ quan có thẩm quyền tại Việt Nam. Mọi dữ liệu cá nhân được xử lý tuân theo Luật Bảo vệ Dữ liệu Cá nhân 2025 và Nghị định số 356/2025/NĐ-CP.

22.2 Dữ liệu cá nhân sẽ không được tiết lộ cho bất kỳ bên thứ ba nào ngoài cơ quan có thẩm quyền hoạt động trong phạm vi quyền hạn pháp lý của họ. Thành viên đồng ý với việc thu thập và xử lý dữ liệu cá nhân của mình bằng cách nộp đơn đăng ký thành viên.

22.3 Thành viên bị nghiêm cấm chụp ảnh, quay video hoặc ghi âm các thành viên khác hoặc khách mời trong Cơ sở mà không có sự đồng ý rõ ràng của người được ghi lại. Bất kỳ hành vi ghi lại nào xâm phạm quyền riêng tư của thành viên hoặc khách mời khác có thể dẫn đến chấm dứt tư cách thành viên ngay lập tức theo quyết định toàn quyền của Câu lạc bộ.

## ĐIỀU 23. GIÁM SÁT VÀ AN NINH

23.1 The Rampant Club vận hành hệ thống camera giám sát khép kín (CCTV) tại các khu vực được chỉ định trong Cơ sở nhằm mục đích đảm bảo an toàn cho thành viên, khách mời và nhân viên. Bằng việc vào Cơ sở, thành viên và khách mời đồng ý với việc giám sát đó.

23.2 Footage từ CCTV được lưu giữ chỉ nhằm mục đích giám sát an toàn và ứng xử, và sẽ không được tiết lộ cho bất kỳ bên thứ ba nào ngoại trừ theo yêu cầu của cơ quan có thẩm quyền tại Việt Nam hoạt động trong phạm vi thẩm quyền pháp lý của họ.

## ĐIỀU 24. KÝ GỬI RƯỢU WHISKY

24.1 Thành viên muốn lưu trữ rượu whisky tại Members' Lounge của The Rampant Club phải ký kết Hợp đồng Ký gửi và Lưu trữ Rượu Whisky riêng biệt với Câu lạc bộ. Quy chế Thành viên này cần được đọc cùng với Hợp đồng đó.

24.2 Khi tư cách thành viên hết hạn, không được gia hạn hoặc bị chấm dứt vì bất kỳ lý do gì, thành viên phải lấy lại toàn bộ rượu whisky đang lưu trữ tại Cơ sở trong vòng 30 ngày. Nếu thành viên không lấy lại rượu trong thời hạn này, The Rampant Club có quyền sắp xếp hoàn trả, lưu kho hoặc xử lý rượu đó với chi phí do thành viên chịu, sau khi thông báo bằng văn bản hợp lý.

24.3 Thành viên bị nghiêm cấm chuyển nhượng, bán hoặc trao đổi rượu whisky đang lưu trữ tại The Rampant Club với bất kỳ thành viên khác hoặc bên thứ ba nào trên cơ sở thương mại. Bất kỳ giao dịch nào thuộc loại này bị Câu lạc bộ phát hiện có thể dẫn đến chấm dứt tư cách thành viên ngay lập tức mà không hoàn phí và có thể được báo cáo đến cơ quan có liên quan.

## PHỤ LỤC PHẦN 1: QUYỀN LỢI THÀNH VIÊN

### A. QUYỀN LỢI DÀNH CHO THÀNH VIÊN

### 1. Quyền Tiếp cận Độc quyền

Cơ sở vật chất của Câu lạc bộ:

- The Library Bar – cocktail theo mùa, rượu mạnh cổ điển, sách và trò chơi được tuyển chọn
- The Studio – trải nghiệm nghệ thuật cảm quan luân phiên
- The Private Dining Room – dành cho các cuộc họp và tiếp khách thân mật
- The Rampant Room – phòng thưởng thức whisky đẳng cấp thế giới
- Source and Origin Lab – sáng tạo đồ uống độc quyền

### 2. Quyền lợi Whisky

- Club Picks hàng quý – các thùng riêng đóng chai độc quyền cho thành viên, chỉ bán qua câu lạc bộ
- Chương trình Your Own Cask – mua thùng whisky riêng với dịch vụ quản lý toàn trình
- Quyền tiếp cận "The Rarest Reserve" – quyền ưu tiên mua các dòng whisky quý hiếm lâu năm
- Nhãn hiệu riêng cho các dòng pha chế Duncan Taylor (tối thiểu 20 chai)
- Giảm giá 20% khi mua whisky lẻ

### 3. Quyền lợi Toàn cầu

Quyền lợi tại Lâu đài Scotland của chúng tôi (dự kiến khai trương năm 2027, quyền lợi có thể thay đổi trước thời điểm khai trương):

- Giảm giá lưu trú, hoạt động và ẩm thực
- Tiếp cận bộ sưu tập whisky độc quyền của The Rampant Club
- Lưu trú tại các căn hộ The Rampant Room ở Huntly Tiếp cận Whisky Toàn cầu:
- Các chuyến tham quan nhà máy chưng cất được tuyển chọn trên toàn thế giới (tại nơi có thỏa thuận từ trước)
- Trải nghiệm theo yêu cầu thông qua mạng lưới ngành

### 4. Dịch vụ Chăm sóc Cá nhân (Concierge)

- Đường dây nóng Zalo/WhatsApp để đặt chỗ và yêu cầu
- Tổ chức sự kiện – từ những chuyến phiêu lưu tại Scotland đến tiệc tối riêng
- Dịch vụ quà tặng doanh nghiệp và cá nhân
- Quyền tiếp cận câu lạc bộ đối tác trên toàn cầu

### 5. Quyền lợi Vận chuyển

- Dịch vụ vận chuyển hạng sang (báo trước 4 giờ)
- Dịch vụ làm thủ tục nhanh tại sân bay về thẳng câu lạc bộ cho khách quốc tế

### 6. Sự kiện và Kết nối

- Lịch sự kiện độc quyền được tuyển chọn
- Hội thảo bàn tròn và brunch kinh doanh
- Chương trình quà tặng và ưu đãi hàng năm
- Phần thưởng giới thiệu

### B. ĐẶC QUYỀN KHÁCH MỜI

- Thành viên có thể mang theo tối đa 4 khách mời cùng một lúc
- Khách mời phải được thành viên đăng ký khi vào
- Thành viên có thể ủy quyền cho khách không có mặt thành viên với thời gian báo trước tối thiểu 48 giờ, phải có sự đồng ý bằng văn bản của Chủ tịch Câu lạc bộ. Không đảm bảo được vào cửa.
- Hành vi của khách mời thuộc trách nhiệm của thành viên

## PHỤ LỤC PHẦN 2: QUY TẮC ỨNG XỬ VÀ PHÉP TẮC

### 1. Quy tắc Ứng xử Chung

Thành viên và khách mời phải cư xử đúng mực mọi lúc, phản ánh uy tín và danh tiếng của The Rampant Club. Môi trường này được xây dựng trên nền tảng tin tưởng, kín đáo và tôn trọng lẫn nhau.

### 2. Yêu cầu Tham gia

The Rampant Club được xây dựng trên những trải nghiệm chung. Thành viên được kỳ vọng tham gia ít nhất hai (02) sự kiện mỗi năm để duy trì sự sôi động của cộng đồng và sự kết nối bền chặt. Mức độ tham dự ảnh hưởng đến triển vọng gia hạn tư cách thành viên.

### 3. Quy định Trang phục

Yêu cầu trang phục lịch sự. Thành viên nên duy trì tiêu chuẩn trang phục phù hợp, sạch sẽ và gọn gàng, tránh các trang phục có thể gây phản cảm.

### 4. Thẻ Thành viên

Mỗi thành viên nhận được một thẻ thành viên và phải xuất trình khi vào. Thẻ thành viên là tài sản của Câu lạc bộ và phải được trả lại khi chấm dứt tư cách thành viên.

### 5. Ra vào

Thành viên và khách mời nên ra vào một cách yên tĩnh, tôn trọng hàng xóm và tính chất kín đáo của Câu lạc bộ.

### 6. Quyền riêng tư của Thành viên/Khách mời

Thành viên nên lịch sự và kín đáo, tôn trọng quyền riêng tư của người khác. Câu lạc bộ coi trọng sự kín đáo trên tất cả.

### 7. Điện thoại Di động

Điện thoại phải để chế độ im lặng trong câu lạc bộ. Vui lòng tôn trọng các khách khác, nghe điện thoại tại hành lang nếu cần.

### 8. Chụp ảnh và Ghi hình

Không được sử dụng thiết bị chụp ảnh hoặc ghi hình tại The Library Bar, The Studio hoặc

The Rampant Room để bảo vệ quyền riêng tư của thành viên. Trong trường hợp vi phạm, The Rampant Club bảo lưu quyền yêu cầu xóa nội dung đã ghi lại. Chỉ được phép chụp ảnh tại khu vực lối vào câu lạc bộ.

### 9. Sử dụng Máy tính Xách tay

- The Library Bar: Không sử dụng máy tính xách tay sau 16 giờ
- The Rampant Room: Không được sử dụng máy tính xách tay
- The Private Dining Room: Được phép sử dụng cho cuộc họp kinh doanh

### 10. Mạng Xã hội

Trừ khi được The Rampant Club cho phép rõ ràng bằng văn bản, thành viên không được đưa thông báo công khai trên mạng xã hội về các thành viên khác, khách mời hoặc sự kiện của Câu lạc bộ.

### 11. Hút thuốc

Chỉ được phép hút thuốc trong The Rampant Room và The Private Dining Room (Tầng 3 và Tầng 4). Khi hút thuốc bên trong phòng, cả hai cánh cửa kính Pháp phải được mở hoàn toàn và chỉ được hút thuốc cạnh cửa sổ. Câu lạc bộ có thể, theo quyết định của mình, bố trí khu vực hút thuốc ngoài trời cho thành viên sử dụng.

Việc hút thuốc, bao gồm việc sử dụng thuốc lá điện tử hoặc các thiết bị tương tự, bị nghiêm cấm tuyệt đối trong tất cả các khu vực nội thất khác của Câu lạc bộ, bao gồm The Studio (để bảo vệ các tác phẩm nghệ thuật trưng bày) và The Library Bar tại Tầng 1 và Tầng 2. Mọi vi phạm quy định hút thuốc bởi thành viên hoặc khách mời sẽ khiến thành viên phải chịu hành động kỷ luật theo Quy chế Thành viên của Câu lạc bộ.

### 12. Ma túy và các chất cấm

12.1 Việc sử dụng, tàng trữ, phân phối hoặc tạo điều kiện sử dụng ma túy, chất hướng thần hoặc bất kỳ chất cấm nào khác theo quy định pháp luật Việt Nam là hoàn toàn bị nghiêm cấm tại Câu lạc bộ vào mọi thời điểm.

12.2 Thành viên và khách mời không được phép vào hoặc lưu lại Câu lạc bộ trong trạng thái bị ảnh hưởng bởi ma túy hoặc các chất cấm.

12.3 Mọi hành vi vi phạm hoặc có căn cứ hợp lý để nghi ngờ vi phạm sẽ dẫn đến việc chấm dứt ngay lập tức tư cách thành viên mà không hoàn phí. Câu lạc bộ bảo lưu quyền trình báo vụ việc cho cơ quan công an theo quy định tại Điều 20 của Quy chế này.

### 13. Thanh toán Chi phí

Thành viên phải thanh toán tất cả các chi phí trước khi rời cơ sở, trừ khi đã có thỏa thuận trước. Thành viên chịu trách nhiệm về tất cả các chi phí của khách mời.

### 14. Yêu cầu Đặc biệt

Thành viên nên thông báo cho The Rampant Club về bất kỳ tình trạng khuyết tật, dị ứng hoặc yêu cầu về chế độ ăn nào liên quan đến họ hoặc khách mời.

### 15. Tai nạn và Thương tích

Mọi tai nạn hoặc thương tích phải được báo cáo ngay cho nhân viên và trong vòng hai mươi bốn (24) giờ kể từ khi xảy ra sự cố.

Quy chế Thành viên này có hiệu lực kể từ ngày 25 tháng 02 năm 2026.

The Rampant Club bảo lưu quyền sửa đổi các quy định này bất kỳ lúc nào nhằm đảm bảo sự xuất sắc liên tục của trải nghiệm thành viên.

Để biết thêm thông tin về tư cách thành viên:

Email: Membership@TheRampantClub.com

Đường dây nóng: Dành cho thành viên qua Zalo/WhatsApp

74A2 Hai Bà Trưng, Phường Sài Gòn

Thành phố Hồ Chí Minh, Việt Nam$vn$
);

-- The register's NAME for this document still said "Membership Agreement",
-- which would have printed as the heading above the Terms and Conditions.
update terms_documents
   set name_en = 'Terms & Conditions',
       name_vn = 'Điều Kiện và Điều Khoản'
 where doc_key = 'membership_terms';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_cur uuid; v_ver text; v_en int; v_vn int; v_old int;
begin
  v_cur := current_terms_version('membership_terms');
  select version, length(body), length(body_vn) into v_ver, v_en, v_vn
    from terms_versions where id = v_cur;
  select count(*) into v_old from terms_versions where doc_key = 'membership_terms' and version = '1.0';
  raise notice 'current membership_terms is now v% · % chars EN · % chars VN · v1.0 still present: %',
    v_ver, v_en, v_vn, (v_old = 1);
  if v_ver <> '2.0' then raise exception 'v2.0 is not current — check effective_date'; end if;
  if v_vn is null or v_vn = 0 then raise exception 'the Vietnamese body did not land'; end if;
  if v_old <> 1 then raise exception 'v1.0 was disturbed — it must remain exactly as signed'; end if;
end $$;
