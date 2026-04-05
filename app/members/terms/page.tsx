'use client'

import { useState } from 'react'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

const articles = [
  {
    titleEn: 'Article 1: Club Name & Location',
    titleVn: '\u0110i\u1EC1u 1. T\u00EAn V\u00E0 \u0110\u1ECBa \u0110i\u1EC3m C\u00E2u L\u1EA1c B\u1ED9',
    contentEn: [
      '1.1 This document sets out the rules of membership for members of the private members club (referred to hereafter as "The Rampant Club" or "the Club") which is located at 74A2 Hai Ba Trung Street, Saigon Ward, District 1, Ho Chi Minh City, Vietnam ("the Premises").',
    ],
    contentVn: [
      '1.1 V\u0103n b\u1EA3n n\u00E0y quy \u0111\u1ECBnh c\u00E1c \u0111i\u1EC1u ki\u1EC7n th\u00E0nh vi\u00EAn \u00E1p d\u1EE5ng \u0111\u1ED1i v\u1EDBi th\u00E0nh vi\u00EAn c\u1EE7a c\u00E2u l\u1EA1c b\u1ED9 t\u01B0 nh\u00E2n (sau \u0111\u00E2y g\u1ECDi l\u00E0 "The Rampant Club" ho\u1EB7c "C\u00E2u l\u1EA1c b\u1ED9"), c\u00F3 \u0111\u1ECBa ch\u1EC9 t\u1EA1i 74A2 \u0110\u01B0\u1EDDng Hai B\u00E0 Tr\u01B0ng, Ph\u01B0\u1EDDng S\u00E0i G\u00F2n, Th\u00E0nh ph\u1ED1 H\u1ED3 Ch\u00ED Minh, Vi\u1EC7t Nam ("C\u01A1 s\u1EDF").',
    ],
  },
  {
    titleEn: 'Article 2: Objects of The Rampant Club',
    titleVn: '\u0110i\u1EC1u 2. M\u1EE5c \u0110\u00EDch C\u1EE7a The Rampant Club',
    contentEn: [
      '2.1 The objects of The Rampant Club are the provision of whisky culture, hospitality facilities and exclusive experiences for the social interaction of members and their guests, with a particular focus on fostering meaningful connections and cultural enrichment.',
      '2.2 The Club stands as a sanctuary for those who shape industries and communities, providing an environment of trust, discretion, and shared purpose.',
    ],
    contentVn: [
      '2.1 M\u1EE5c \u0111\u00EDch c\u1EE7a The Rampant Club l\u00E0 cung c\u1EA5p v\u0103n h\u00F3a whisky, d\u1ECBch v\u1EE5 ti\u1EBFp kh\u00E1ch v\u00E0 c\u00E1c tr\u1EA3i nghi\u1EC7m \u0111\u1ED9c quy\u1EC1n nh\u1EB1m t\u1EA1o \u0111i\u1EC1u ki\u1EC7n giao l\u01B0u x\u00E3 h\u1ED9i cho c\u00E1c th\u00E0nh vi\u00EAn v\u00E0 kh\u00E1ch m\u1EDDi c\u1EE7a h\u1ECD, \u0111\u1EB7c bi\u1EC7t t\u1EADp trung v\u00E0o vi\u1EC7c x\u00E2y d\u1EF1ng c\u00E1c m\u1ED1i quan h\u1EC7 c\u00F3 \u00FD ngh\u0129a v\u00E0 l\u00E0m gi\u00E0u v\u0103n h\u00F3a.',
      '2.2 C\u00E2u l\u1EA1c b\u1ED9 l\u00E0 n\u01A1i d\u00E0nh ri\u00EAng cho nh\u1EEFng c\u00E1 nh\u00E2n c\u00F3 \u1EA3nh h\u01B0\u1EDFng trong ng\u00E0nh v\u00E0 c\u1ED9ng \u0111\u1ED3ng, mang \u0111\u1EBFn m\u1ED9t m\u00F4i tr\u01B0\u1EDDng tin t\u01B0\u1EDFng, k\u00EDn \u0111\u00E1o v\u00E0 chia s\u1EBB m\u1EE5c \u0111\u00EDch chung.',
    ],
  },
  {
    titleEn: 'Article 3: Ownership & Key Principles',
    titleVn: '\u0110i\u1EC1u 3. Quy\u1EC1n S\u1EDF H\u1EEFu V\u00E0 C\u00E1c Nguy\u00EAn T\u1EAFc C\u01A1 B\u1EA3n',
    contentEn: [
      '3.1 The Rampant Club is a proprietary private members club brand owned and operated by CTY Ruou Ngon ("the Company"), a private limited company.',
      '3.2 Membership of the Club corresponds to periods of one year. Membership does not entitle members to own or participate in any shares, voting or other shareholder matters.',
      '3.3 Membership provides members with access to exclusive facilities, services and benefits as set out in Schedule Part 1.',
      '3.4 The Company is affiliated with Duncan Taylor Scotch Whisky Ltd, which owns and operates whisky warehouses and facilities in Scotland.',
      '3.5 Members shall not have any financial liability for the operation of the Club by reason of their membership.',
      '3.6 These Rules of Membership may be amended from time to time by The Rampant Club in its sole discretion. Last updated 13th November 2025.',
      '3.7 The Rules of Membership should be read in conjunction with the member application, which together form the membership contract.',
    ],
    contentVn: [
      '3.1 The Rampant Club l\u00E0 th\u01B0\u01A1ng hi\u1EC7u c\u00E2u l\u1EA1c b\u1ED9 t\u01B0 nh\u00E2n thu\u1ED9c quy\u1EC1n s\u1EDF h\u1EEFu v\u00E0 \u0111i\u1EC1u h\u00E0nh b\u1EDFi C\u00F4ng ty CTY R\u01B0\u1EE3u Ngon ("C\u00F4ng ty"), m\u1ED9t c\u00F4ng ty tr\u00E1ch nhi\u1EC7m h\u1EEFu h\u1EA1n.',
      '3.2 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn c\u1EE7a C\u00E2u l\u1EA1c b\u1ED9 c\u00F3 hi\u1EC7u l\u1EF1c theo t\u1EEBng n\u0103m. T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn kh\u00F4ng trao cho th\u00E0nh vi\u00EAn quy\u1EC1n s\u1EDF h\u1EEFu ho\u1EB7c tham gia v\u00E0o b\u1EA5t k\u1EF3 c\u1ED5 ph\u1EA7n, quy\u1EC1n bi\u1EC3u quy\u1EBFt ho\u1EB7c c\u00E1c v\u1EA5n \u0111\u1EC1 c\u1ED5 \u0111\u00F4ng n\u00E0o.',
      '3.3 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn cho ph\u00E9p th\u00E0nh vi\u00EAn ti\u1EBFp c\u1EADn c\u00E1c c\u01A1 s\u1EDF v\u1EADt ch\u1EA5t, d\u1ECBch v\u1EE5 v\u00E0 quy\u1EC1n l\u1EE3i \u0111\u1ED9c quy\u1EC1n nh\u01B0 \u0111\u01B0\u1EE3c quy \u0111\u1ECBnh t\u1EA1i Ph\u1EE5 l\u1EE5c Ph\u1EA7n 1.',
      '3.4 C\u00F4ng ty l\u00E0 \u0111\u01A1n v\u1ECB li\u00EAn k\u1EBFt v\u1EDBi Duncan Taylor Scotch Whisky Ltd, \u0111\u01A1n v\u1ECB s\u1EDF h\u1EEFu v\u00E0 v\u1EADn h\u00E0nh c\u00E1c kho v\u00E0 c\u01A1 s\u1EDF whisky t\u1EA1i Scotland.',
      '3.5 Th\u00E0nh vi\u00EAn kh\u00F4ng ch\u1ECBu b\u1EA5t k\u1EF3 tr\u00E1ch nhi\u1EC7m t\u00E0i ch\u00EDnh n\u00E0o \u0111\u1ED1i v\u1EDBi ho\u1EA1t \u0111\u1ED9ng c\u1EE7a C\u00E2u l\u1EA1c b\u1ED9 do t\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn c\u1EE7a m\u00ECnh.',
      '3.6 Quy ch\u1EBF Th\u00E0nh vi\u00EAn n\u00E0y c\u00F3 th\u1EC3 \u0111\u01B0\u1EE3c s\u1EEDa \u0111\u1ED5i t\u00F9y t\u1EEBng th\u1EDDi \u0111i\u1EC3m. C\u1EADp nh\u1EADt l\u1EA7n cu\u1ED1i ng\u00E0y 13 th\u00E1ng 11 n\u0103m 2025.',
      '3.7 Quy ch\u1EBF Th\u00E0nh vi\u00EAn c\u1EA7n \u0111\u01B0\u1EE3c \u0111\u1ECDc c\u00F9ng v\u1EDBi \u0111\u01A1n \u0111\u0103ng k\u00FD th\u00E0nh vi\u00EAn, hai v\u0103n b\u1EA3n n\u00E0y c\u00F9ng t\u1EA1o th\u00E0nh h\u1EE3p \u0111\u1ED3ng th\u00E0nh vi\u00EAn.',
    ],
  },
  {
    titleEn: 'Article 4: Direction & Management',
    titleVn: '\u0110i\u1EC1u 4. \u0110i\u1EC1u H\u00E0nh V\u00E0 Qu\u1EA3n L\u00FD',
    contentEn: [
      '4.1 Responsibility for the direction and management of The Rampant Club rests with the directors of the Company.',
      '4.2 A Membership Committee has been formed with the responsibility of considering and administering applications for new memberships and invitations for membership renewals.',
      '4.3 Primary contact within The Rampant Club management for members is the Member Experience Manager via members@Therampantclub.com.',
    ],
    contentVn: [
      '4.1 Tr\u00E1ch nhi\u1EC7m \u0111i\u1EC1u h\u00E0nh v\u00E0 qu\u1EA3n l\u00FD The Rampant Club thu\u1ED9c v\u1EC1 c\u00E1c gi\u00E1m \u0111\u1ED1c c\u1EE7a C\u00F4ng ty.',
      '4.2 H\u1ED9i \u0111\u1ED3ng Th\u00E0nh vi\u00EAn \u0111\u00E3 \u0111\u01B0\u1EE3c th\u00E0nh l\u1EADp v\u1EDBi tr\u00E1ch nhi\u1EC7m xem x\u00E9t v\u00E0 x\u1EED l\u00FD c\u00E1c \u0111\u01A1n \u0111\u0103ng k\u00FD th\u00E0nh vi\u00EAn m\u1EDBi c\u0169ng nh\u01B0 l\u1EDDi m\u1EDDi gia h\u1EA1n t\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn.',
      '4.3 \u0110\u1EA7u m\u1ED1i li\u00EAn l\u1EA1c ch\u00EDnh l\u00E0 Qu\u1EA3n l\u00FD Tr\u1EA3i nghi\u1EC7m Th\u00E0nh vi\u00EAn qua \u0111\u1ECBa ch\u1EC9 email members@Therampantclub.com.',
    ],
  },
  {
    titleEn: 'Article 5: Memberships',
    titleVn: '\u0110i\u1EC1u 5. T\u01B0 C\u00E1ch Th\u00E0nh Vi\u00EAn',
    contentEn: [
      '5.1 The following categories of membership are available: Legacy Member (33+ years), Pioneer Member (21-32 years), Corporate Member (up to 3 nominees per company), and Honorary Member (by invitation).',
      '5.2 Benefits of memberships are set out in Schedule Part 1.',
      '5.3 Membership is personal in nature and may not be transferred, assigned, delegated, or shared in any form.',
      '5.4 Members are expected to participate in at least two Club events per year.',
      '5.5 All members must be at least 21 years of age. All guests must be at least 18 years of age.',
      '5.6 The Club reserves the right to require proof of age from any member or guest at any time.',
    ],
    contentVn: [
      '5.1 C\u00E1c lo\u1EA1i t\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn: Th\u00E0nh vi\u00EAn Legacy (t\u1EEB 33 tu\u1ED5i), Th\u00E0nh vi\u00EAn Pioneer (21-32 tu\u1ED5i), Th\u00E0nh vi\u00EAn Corporate (t\u1ED1i \u0111a 3 ng\u01B0\u1EDDi \u0111\u01B0\u1EE3c \u0111\u1EC1 c\u1EED), v\u00E0 Th\u00E0nh vi\u00EAn Honorary (theo l\u1EDDi m\u1EDDi).',
      '5.2 Quy\u1EC1n l\u1EE3i \u0111\u01B0\u1EE3c quy \u0111\u1ECBnh t\u1EA1i Ph\u1EE5 l\u1EE5c Ph\u1EA7n 1.',
      '5.3 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn mang t\u00EDnh c\u00E1 nh\u00E2n v\u00E0 kh\u00F4ng \u0111\u01B0\u1EE3c chuy\u1EC3n nh\u01B0\u1EE3ng, \u1EE7y quy\u1EC1n ho\u1EB7c chia s\u1EBB d\u01B0\u1EDBi b\u1EA5t k\u1EF3 h\u00ECnh th\u1EE9c n\u00E0o.',
      '5.4 Th\u00E0nh vi\u00EAn \u0111\u01B0\u1EE3c k\u1EF3 v\u1ECDng tham gia \u00EDt nh\u1EA5t hai s\u1EF1 ki\u1EC7n m\u1ED7i n\u0103m.',
      '5.5 T\u1EA5t c\u1EA3 th\u00E0nh vi\u00EAn ph\u1EA3i t\u1EEB 21 tu\u1ED5i tr\u1EDF l\u00EAn. T\u1EA5t c\u1EA3 kh\u00E1ch m\u1EDDi ph\u1EA3i t\u1EEB 18 tu\u1ED5i tr\u1EDF l\u00EAn.',
      '5.6 C\u00E2u l\u1EA1c b\u1ED9 c\u00F3 quy\u1EC1n y\u00EAu c\u1EA7u x\u00E1c minh \u0111\u1ED9 tu\u1ED5i v\u00E0o b\u1EA5t k\u1EF3 th\u1EDDi \u0111i\u1EC3m n\u00E0o.',
    ],
  },
  {
    titleEn: 'Article 6: Membership Application & Selection',
    titleVn: '\u0110i\u1EC1u 6. \u0110\u01A1n \u0110\u0103ng K\u00FD V\u00E0 Tuy\u1EC3n Ch\u1ECDn',
    contentEn: [
      '6.1 Membership may be granted solely at the discretion of the Club and is available only by invitation or referral.',
      '6.2 Individuals must complete a membership application form and participate in the Club\u2019s selection interview process.',
      '6.3 Membership applicants must be aged 21 or above.',
      '6.4 All applications shall be reviewed by the Membership Committee. The Committee\u2019s decisions are final and not subject to appeal.',
      '6.5 The Membership Committee will comply with all applicable laws.',
      '6.6 Payment information must be submitted upon application.',
      '6.7 Successful referrals are rewarded with club credit and a bespoke bottle from our reserves.',
    ],
    contentVn: [
      '6.1 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn ch\u1EC9 \u0111\u01B0\u1EE3c c\u1EA5p theo quy\u1EBFt \u0111\u1ECBnh \u0111\u01A1n ph\u01B0\u01A1ng c\u1EE7a C\u00E2u l\u1EA1c b\u1ED9 v\u00E0 ch\u1EC9 th\u00F4ng qua l\u1EDDi m\u1EDDi ho\u1EB7c gi\u1EDBi thi\u1EC7u.',
      '6.2 C\u00E1 nh\u00E2n ph\u1EA3i ho\u00E0n th\u00E0nh \u0111\u01A1n \u0111\u0103ng k\u00FD v\u00E0 tham gia quy tr\u00ECnh ph\u1ECFng v\u1EA5n.',
      '6.3 \u1EE8ng vi\u00EAn ph\u1EA3i t\u1EEB \u0111\u1EE7 21 tu\u1ED5i tr\u1EDF l\u00EAn.',
      '6.4 T\u1EA5t c\u1EA3 \u0111\u01A1n \u0111\u0103ng k\u00FD s\u1EBD \u0111\u01B0\u1EE3c H\u1ED9i \u0111\u1ED3ng Th\u00E0nh vi\u00EAn xem x\u00E9t. Quy\u1EBFt \u0111\u1ECBnh l\u00E0 cu\u1ED1i c\u00F9ng.',
      '6.5 H\u1ED9i \u0111\u1ED3ng s\u1EBD tu\u00E2n th\u1EE7 t\u1EA5t c\u1EA3 c\u00E1c lu\u1EADt ph\u00E1p hi\u1EC7n h\u00E0nh.',
      '6.6 Th\u00F4ng tin thanh to\u00E1n \u0111\u01B0\u1EE3c y\u00EAu c\u1EA7u khi n\u1ED9p \u0111\u01A1n.',
      '6.7 C\u00E1c gi\u1EDBi thi\u1EC7u th\u00E0nh c\u00F4ng s\u1EBD \u0111\u01B0\u1EE3c th\u01B0\u1EDFng b\u1EB1ng t\u00EDn d\u1EE5ng v\u00E0 m\u1ED9t chai whisky \u0111\u1EB7c bi\u1EC7t.',
    ],
  },
  {
    titleEn: 'Article 7: Membership Renewal',
    titleVn: '\u0110i\u1EC1u 7. Gia H\u1EA1n T\u01B0 C\u00E1ch Th\u00E0nh Vi\u00EAn',
    contentEn: [
      '7.1 Membership is for one year and is renewable annually. Renewals are not automatic and are subject to invitation by the Club.',
      '7.2 The first renewal takes effect on the first day of the month following twelve months after joining.',
      '7.3 Invitations to renew will be issued prior to the end of the current membership year.',
    ],
    contentVn: [
      '7.1 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn c\u00F3 hi\u1EC7u l\u1EF1c m\u1ED9t n\u0103m v\u00E0 c\u00F3 th\u1EC3 gia h\u1EA1n h\u00E0ng n\u0103m. Vi\u1EC7c gia h\u1EA1n kh\u00F4ng t\u1EF1 \u0111\u1ED9ng.',
      '7.2 L\u1EA7n gia h\u1EA1n \u0111\u1EA7u ti\u00EAn c\u00F3 hi\u1EC7u l\u1EF1c v\u00E0o ng\u00E0y \u0111\u1EA7u ti\u00EAn c\u1EE7a th\u00E1ng ti\u1EBFp theo sau 12 th\u00E1ng.',
      '7.3 L\u1EDDi m\u1EDDi gia h\u1EA1n s\u1EBD \u0111\u01B0\u1EE3c ph\u00E1t h\u00E0nh tr\u01B0\u1EDBc khi k\u1EBFt th\u00FAc n\u0103m th\u00E0nh vi\u00EAn.',
    ],
  },
  {
    titleEn: 'Article 8: Membership Payment',
    titleVn: '\u0110i\u1EC1u 8. Ph\u00ED Th\u00E0nh Vi\u00EAn',
    contentEn: [
      '8.1 Following selection, the member shall pay the applicable joining fee together with the annual membership fee.',
      '8.2 Benefits may only be enjoyed following payment of applicable fees.',
      '8.3 Joining fees for 2025: Legacy $5,000 USD, Pioneer $3,000 USD, Corporate $8,000 USD. Joining fees waived for the first 30 members.',
      '8.4 Annual fees for 2025: Legacy $5,000 USD, Pioneer $3,000 USD, Corporate $8,000 USD per company (covering 3 nominees).',
      '8.5 All fees are payable in full in advance. An allowance may be made for payment in two halves.',
      '8.6 Fees may be amended at any time. Renewing members will be notified of changes.',
      '8.7 Failure to pay within 14 days may result in suspension or cancellation.',
    ],
    contentVn: [
      '8.1 Sau khi \u0111\u01B0\u1EE3c ch\u1ECDn, th\u00E0nh vi\u00EAn s\u1EBD thanh to\u00E1n ph\u00ED gia nh\u1EADp c\u00F9ng ph\u00ED th\u00E0nh vi\u00EAn h\u00E0ng n\u0103m.',
      '8.2 Quy\u1EC1n l\u1EE3i ch\u1EC9 \u0111\u01B0\u1EE3c h\u01B0\u1EDFng sau khi thanh to\u00E1n.',
      '8.3 Ph\u00ED gia nh\u1EADp 2025: Legacy 5.000 USD, Pioneer 3.000 USD, Corporate 8.000 USD. Mi\u1EC5n ph\u00ED cho 30 th\u00E0nh vi\u00EAn \u0111\u1EA7u ti\u00EAn.',
      '8.4 Ph\u00ED h\u00E0ng n\u0103m 2025: Legacy 5.000 USD, Pioneer 3.000 USD, Corporate 8.000 USD m\u1ED7i c\u00F4ng ty.',
      '8.5 T\u1EA5t c\u1EA3 ph\u00ED ph\u1EA3i thanh to\u00E1n \u0111\u1EA7y \u0111\u1EE7 tr\u01B0\u1EDBc. C\u00F3 th\u1EC3 thanh to\u00E1n l\u00E0m hai \u0111\u1EE3t.',
      '8.6 Ph\u00ED c\u00F3 th\u1EC3 \u0111\u01B0\u1EE3c \u0111i\u1EC1u ch\u1EC9nh b\u1EA5t k\u1EF3 l\u00FAc n\u00E0o.',
      '8.7 Kh\u00F4ng thanh to\u00E1n trong 14 ng\u00E0y c\u00F3 th\u1EC3 d\u1EABn \u0111\u1EBFn \u0111\u00ECnh ch\u1EC9 ho\u1EB7c h\u1EE7y b\u1ECF.',
    ],
  },
  {
    titleEn: 'Article 9: Freezing of Membership',
    titleVn: '\u0110i\u1EC1u 9. T\u1EA1m Ng\u01B0ng T\u01B0 C\u00E1ch Th\u00E0nh Vi\u00EAn',
    contentEn: [
      '9.1 A Member may suspend their membership by providing written notice at least 14 days prior.',
      '9.2 Members may suspend once per year. Minimum 3 months, maximum 12 months.',
      '9.3 The membership expiry date shall be extended by the duration of suspension.',
      '9.4 During suspension, no fees are due but no benefits or access are available.',
    ],
    contentVn: [
      '9.1 Th\u00E0nh vi\u00EAn c\u00F3 th\u1EC3 t\u1EA1m ng\u01B0ng b\u1EB1ng c\u00E1ch g\u1EEDi th\u00F4ng b\u00E1o tr\u01B0\u1EDBc \u00EDt nh\u1EA5t 14 ng\u00E0y.',
      '9.2 T\u1EA1m ng\u01B0ng t\u1ED1i \u0111a 1 l\u1EA7n/n\u0103m. T\u1ED1i thi\u1EC3u 3 th\u00E1ng, t\u1ED1i \u0111a 12 th\u00E1ng.',
      '9.3 Ng\u00E0y h\u1EBFt h\u1EA1n s\u1EBD \u0111\u01B0\u1EE3c gia h\u1EA1n t\u01B0\u01A1ng \u1EE9ng.',
      '9.4 Trong th\u1EDDi gian t\u1EA1m ng\u01B0ng, kh\u00F4ng ph\u1EA3i \u0111\u00F3ng ph\u00ED nh\u01B0ng kh\u00F4ng \u0111\u01B0\u1EE3c h\u01B0\u1EDFng quy\u1EC1n l\u1EE3i.',
    ],
  },
  {
    titleEn: 'Article 10: Resignation',
    titleVn: '\u0110i\u1EC1u 10. T\u1EEB B\u1ECF T\u01B0 C\u00E1ch Th\u00E0nh Vi\u00EAn',
    contentEn: [
      '10.1 A member may resign by providing written notice prior to the annual renewal date.',
      '10.2 A resigning member shall not be entitled to any refund.',
    ],
    contentVn: [
      '10.1 Th\u00E0nh vi\u00EAn c\u00F3 th\u1EC3 t\u1EEB b\u1ECF b\u1EB1ng c\u00E1ch g\u1EEDi th\u00F4ng b\u00E1o tr\u01B0\u1EDBc ng\u00E0y gia h\u1EA1n.',
      '10.2 Th\u00E0nh vi\u00EAn t\u1EEB b\u1ECF s\u1EBD kh\u00F4ng \u0111\u01B0\u1EE3c ho\u00E0n l\u1EA1i b\u1EA5t k\u1EF3 kho\u1EA3n ph\u00ED n\u00E0o.',
    ],
  },
  {
    titleEn: 'Article 11: Suspension & Cancellation by the Club',
    titleVn: '\u0110i\u1EC1u 11. \u0110\u00ECnh Ch\u1EC9 V\u00E0 H\u1EE7y B\u1ECF',
    contentEn: [
      '11.1 Suspension measures range from 3 to 12 months depending on severity, including dress code violations, disrespectful behaviour, privacy breaches, and property damage.',
      '11.2 Immediate termination applies for: illegal substances, violence, harassment, disclosure of member information, non-payment exceeding 30 days, or unauthorized business activities.',
      '11.3 During suspension, no benefits shall be available and no fees refunded.',
      '11.4 Upon termination, no refund of fees under any circumstances.',
      '11.5 A terminated member is permanently ineligible for re-application and prohibited from entering as a guest.',
    ],
    contentVn: [
      '11.1 C\u00E1c m\u1EE9c \u0111\u00ECnh ch\u1EC9 t\u1EEB 3 \u0111\u1EBFn 12 th\u00E1ng t\u00F9y m\u1EE9c \u0111\u1ED9 nghi\u00EAm tr\u1ECDng.',
      '11.2 Ch\u1EA5m d\u1EE9t ngay l\u1EADp t\u1EE9c \u00E1p d\u1EE5ng cho: ch\u1EA5t c\u1EA5m, b\u1EA1o l\u1EF1c, qu\u1EA5y r\u1ED1i, ti\u1EBFt l\u1ED9 th\u00F4ng tin th\u00E0nh vi\u00EAn, kh\u00F4ng thanh to\u00E1n qu\u00E1 30 ng\u00E0y, ho\u1EB7c ho\u1EA1t \u0111\u1ED9ng kinh doanh tr\u00E1i ph\u00E9p.',
      '11.3 Trong th\u1EDDi gian \u0111\u00ECnh ch\u1EC9, kh\u00F4ng \u0111\u01B0\u1EE3c h\u01B0\u1EDFng quy\u1EC1n l\u1EE3i v\u00E0 kh\u00F4ng ho\u00E0n ph\u00ED.',
      '11.4 Khi b\u1ECB h\u1EE7y b\u1ECF, kh\u00F4ng \u0111\u01B0\u1EE3c ho\u00E0n ph\u00ED.',
      '11.5 Th\u00E0nh vi\u00EAn b\u1ECB h\u1EE7y b\u1ECF v\u0129nh vi\u1EC5n kh\u00F4ng \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n \u0111\u0103ng k\u00FD l\u1EA1i.',
    ],
  },
  {
    titleEn: 'Article 12: Facilities & Services',
    titleVn: '\u0110i\u1EC1u 12. C\u01A1 S\u1EDF V\u1EADt Ch\u1EA5t V\u00E0 D\u1ECBch V\u1EE5',
    contentEn: [
      '12.1 Facilities and benefits are set out in Schedule Part 1 and may be modified.',
      '12.2 Key facilities: The Library Bar, The Studio, The Private Dining Room, The Rampant Room, Source and Origin Lab.',
      '12.3 Facilities may be closed for private events or maintenance.',
      '12.4 Members are responsible for using facilities for their intended purposes.',
      '12.5 Members and guests are responsible for personal items brought onto the premises.',
    ],
    contentVn: [
      '12.1 C\u01A1 s\u1EDF v\u1EADt ch\u1EA5t v\u00E0 quy\u1EC1n l\u1EE3i \u0111\u01B0\u1EE3c quy \u0111\u1ECBnh t\u1EA1i Ph\u1EE5 l\u1EE5c Ph\u1EA7n 1.',
      '12.2 C\u00E1c c\u01A1 s\u1EDF ch\u00EDnh: The Library Bar, The Studio, The Private Dining Room, The Rampant Room, Source and Origin Lab.',
      '12.3 C\u01A1 s\u1EDF c\u00F3 th\u1EC3 \u0111\u00F3ng c\u1EEDa cho s\u1EF1 ki\u1EC7n ri\u00EAng ho\u1EB7c b\u1EA3o tr\u00EC.',
      '12.4 Th\u00E0nh vi\u00EAn c\u00F3 tr\u00E1ch nhi\u1EC7m s\u1EED d\u1EE5ng \u0111\u00FAng m\u1EE5c \u0111\u00EDch.',
      '12.5 Th\u00E0nh vi\u00EAn v\u00E0 kh\u00E1ch t\u1EF1 ch\u1ECBu tr\u00E1ch nhi\u1EC7m v\u1EC1 t\u00E0i s\u1EA3n c\u00E1 nh\u00E2n.',
    ],
  },
  {
    titleEn: 'Article 13: Personal Information',
    titleVn: '\u0110i\u1EC1u 13. Th\u00F4ng Tin C\u00E1 Nh\u00E2n',
    contentEn: [
      '13.1 The Club collects, stores, and processes member and guest information for membership administration and security.',
      '13.2 Members must update any changes to their contact details.',
      '13.3 The Company is committed to privacy and data protection compliance.',
    ],
    contentVn: [
      '13.1 C\u00E2u l\u1EA1c b\u1ED9 thu th\u1EADp, l\u01B0u tr\u1EEF v\u00E0 x\u1EED l\u00FD th\u00F4ng tin \u0111\u1EC3 qu\u1EA3n l\u00FD th\u00E0nh vi\u00EAn v\u00E0 \u0111\u1EA3m b\u1EA3o an ninh.',
      '13.2 Th\u00E0nh vi\u00EAn ph\u1EA3i c\u1EADp nh\u1EADt m\u1ECDi thay \u0111\u1ED5i th\u00F4ng tin li\u00EAn l\u1EA1c.',
      '13.3 C\u00F4ng ty cam k\u1EBFt b\u1EA3o v\u1EC7 quy\u1EC1n ri\u00EAng t\u01B0 v\u00E0 d\u1EEF li\u1EC7u c\u00E1 nh\u00E2n.',
    ],
  },
  {
    titleEn: 'Article 14: Conduct',
    titleVn: '\u0110i\u1EC1u 14. Quy T\u1EAFc \u1EE8ng X\u1EED',
    contentEn: [
      '14.1 Members must comply with the Conduct and Etiquette code in Schedule Part 2.',
      '14.2 Members introducing guests must make them aware of these Rules.',
      '14.3 Members may bring up to four guests at a time.',
      '14.4 Each member is responsible for any damage caused by themselves or their guests.',
      '14.5 Violations are subject to disciplinary action under Article 11.',
    ],
    contentVn: [
      '14.1 Th\u00E0nh vi\u00EAn ph\u1EA3i tu\u00E2n th\u1EE7 Quy t\u1EAFc \u1EE8ng x\u1EED t\u1EA1i Ph\u1EE5 l\u1EE5c Ph\u1EA7n 2.',
      '14.2 Th\u00E0nh vi\u00EAn ph\u1EA3i th\u00F4ng b\u00E1o cho kh\u00E1ch v\u1EC1 Quy ch\u1EBF n\u00E0y.',
      '14.3 Th\u00E0nh vi\u00EAn c\u00F3 th\u1EC3 mang theo t\u1ED1i \u0111a 4 kh\u00E1ch m\u1EDDi.',
      '14.4 Th\u00E0nh vi\u00EAn ch\u1ECBu tr\u00E1ch nhi\u1EC7m v\u1EC1 thi\u1EC7t h\u1EA1i do m\u00ECnh ho\u1EB7c kh\u00E1ch g\u00E2y ra.',
      '14.5 Vi ph\u1EA1m s\u1EBD b\u1ECB x\u1EED l\u00FD theo \u0110i\u1EC1u 11.',
    ],
  },
  {
    titleEn: 'Article 15: Intellectual Property',
    titleVn: '\u0110i\u1EC1u 15. S\u1EDF H\u1EEFu Tr\u00ED Tu\u1EC7',
    contentEn: [
      '15.1 Members shall not use the Club\u2019s names, logos, or trademarks without prior written approval.',
      '15.2 Membership does not confer any licence to use The Rampant Club marks.',
    ],
    contentVn: [
      '15.1 Th\u00E0nh vi\u00EAn kh\u00F4ng \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng t\u00EAn, logo, nh\u00E3n hi\u1EC7u khi ch\u01B0a c\u00F3 s\u1EF1 ch\u1EA5p thu\u1EADn.',
      '15.2 T\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn kh\u00F4ng trao b\u1EA5t k\u1EF3 quy\u1EC1n s\u1EED d\u1EE5ng nh\u00E3n hi\u1EC7u n\u00E0o.',
    ],
  },
  {
    titleEn: 'Article 16: Liability',
    titleVn: '\u0110i\u1EC1u 16. Gi\u1EDBi H\u1EA1n Tr\u00E1ch Nhi\u1EC7m',
    contentEn: [
      '16.1 The Club excludes liability to the fullest extent permitted by law.',
      '16.2 The Club accepts no responsibility for items brought onto the premises.',
    ],
    contentVn: [
      '16.1 C\u00E2u l\u1EA1c b\u1ED9 lo\u1EA1i tr\u1EEB tr\u00E1ch nhi\u1EC7m \u1EDF m\u1EE9c t\u1ED1i \u0111a m\u00E0 ph\u00E1p lu\u1EADt cho ph\u00E9p.',
      '16.2 C\u00E2u l\u1EA1c b\u1ED9 kh\u00F4ng ch\u1ECBu tr\u00E1ch nhi\u1EC7m v\u1EC1 t\u00E0i s\u1EA3n mang v\u00E0o c\u01A1 s\u1EDF.',
    ],
  },
  {
    titleEn: 'Article 17: Force Majeure',
    titleVn: '\u0110i\u1EC1u 17. S\u1EF1 Ki\u1EC7n B\u1EA5t Kh\u1EA3 Kh\u00E1ng',
    contentEn: [
      '17.1 The Club shall not be obliged to perform obligations made impossible by acts of God, government orders, pandemics, or other causes beyond reasonable control.',
    ],
    contentVn: [
      '17.1 C\u00E2u l\u1EA1c b\u1ED9 kh\u00F4ng c\u00F3 ngh\u0129a v\u1EE5 th\u1EF1c hi\u1EC7n c\u00E1c ngh\u0129a v\u1EE5 b\u1EA5t kh\u1EA3 thi do thi\u00EAn tai, l\u1EC7nh ch\u00EDnh ph\u1EE7, \u0111\u1EA1i d\u1ECBch ho\u1EB7c nguy\u00EAn nh\u00E2n ngo\u00E0i t\u1EA7m ki\u1EC3m so\u00E1t.',
    ],
  },
  {
    titleEn: 'Article 18: Other Conditions',
    titleVn: '\u0110i\u1EC1u 18. C\u00E1c \u0110i\u1EC1u Ki\u1EC7n Kh\u00E1c',
    contentEn: [
      '18.1 Complaints should be made to management or the Member Experience Manager.',
      '18.2 Disputes shall be referred to the Membership Committee.',
      '18.3 These Rules constitute the entire agreement.',
      '18.4 These rules are governed by Vietnamese law.',
    ],
    contentVn: [
      '18.1 Khi\u1EBFu n\u1EA1i n\u00EAn g\u1EEDi \u0111\u1EBFn ban qu\u1EA3n l\u00FD ho\u1EB7c Qu\u1EA3n l\u00FD Tr\u1EA3i nghi\u1EC7m Th\u00E0nh vi\u00EAn.',
      '18.2 Tranh ch\u1EA5p s\u1EBD \u0111\u01B0\u1EE3c chuy\u1EC3n \u0111\u1EBFn H\u1ED9i \u0111\u1ED3ng Th\u00E0nh vi\u00EAn.',
      '18.3 Quy ch\u1EBF n\u00E0y c\u1EA5u th\u00E0nh to\u00E0n b\u1ED9 th\u1ECFa thu\u1EADn.',
      '18.4 Quy ch\u1EBF \u0111\u01B0\u1EE3c \u0111i\u1EC1u ch\u1EC9nh b\u1EDFi ph\u00E1p lu\u1EADt Vi\u1EC7t Nam.',
    ],
  },
  {
    titleEn: 'Article 19: Alcohol Responsibility',
    titleVn: '\u0110i\u1EC1u 19. Tr\u00E1ch Nhi\u1EC7m Sau Khi S\u1EED D\u1EE5ng R\u01B0\u1EE3u',
    contentEn: [
      '19.1 Members bear full personal responsibility for their actions following alcohol consumption.',
      '19.2 The Club shall not bear any liability following departure from the Premises.',
    ],
    contentVn: [
      '19.1 Th\u00E0nh vi\u00EAn ho\u00E0n to\u00E0n ch\u1ECBu tr\u00E1ch nhi\u1EC7m c\u00E1 nh\u00E2n sau khi ti\u00EAu th\u1EE5 r\u01B0\u1EE3u.',
      '19.2 C\u00E2u l\u1EA1c b\u1ED9 kh\u00F4ng ch\u1ECBu tr\u00E1ch nhi\u1EC7m sau khi th\u00E0nh vi\u00EAn r\u1EDDi kh\u1ECFi C\u01A1 s\u1EDF.',
    ],
  },
  {
    titleEn: 'Article 20: Prohibited Substances',
    titleVn: '\u0110i\u1EC1u 20. Ch\u1EA5t B\u1ECB C\u1EA5m',
    contentEn: [
      '20.1 The use, possession, or distribution of illegal substances is strictly prohibited.',
      '20.2 Violation may result in immediate termination, removal from premises, and reporting to authorities.',
    ],
    contentVn: [
      '20.1 Vi\u1EC7c s\u1EED d\u1EE5ng, t\u00E0ng tr\u1EEF ho\u1EB7c ph\u00E2n ph\u1ED1i ch\u1EA5t c\u1EA5m l\u00E0 ho\u00E0n to\u00E0n b\u1ECB nghi\u00EAm c\u1EA5m.',
      '20.2 Vi ph\u1EA1m c\u00F3 th\u1EC3 d\u1EABn \u0111\u1EBFn ch\u1EA5m d\u1EE9t ngay l\u1EADp t\u1EE9c v\u00E0 b\u00E1o c\u00E1o c\u01A1 quan c\u00F3 th\u1EA9m quy\u1EC1n.',
    ],
  },
  {
    titleEn: 'Article 21: Prohibition of Illegal Activities',
    titleVn: '\u0110i\u1EC1u 21. C\u1EA5m Ho\u1EA1t \u0110\u1ED9ng Tr\u00E1i Ph\u00E1p Lu\u1EADt',
    contentEn: [
      '21.1 Members and guests are prohibited from engaging in any illegal activity on the Premises.',
      '21.2 The Club may immediately terminate membership and report to authorities.',
    ],
    contentVn: [
      '21.1 Th\u00E0nh vi\u00EAn v\u00E0 kh\u00E1ch b\u1ECB nghi\u00EAm c\u1EA5m tham gia ho\u1EA1t \u0111\u1ED9ng tr\u00E1i ph\u00E1p lu\u1EADt t\u1EA1i C\u01A1 s\u1EDF.',
      '21.2 C\u00E2u l\u1EA1c b\u1ED9 c\u00F3 quy\u1EC1n ch\u1EA5m d\u1EE9t ngay l\u1EADp t\u1EE9c v\u00E0 b\u00E1o c\u00E1o c\u01A1 quan c\u00F3 th\u1EA9m quy\u1EC1n.',
    ],
  },
  {
    titleEn: 'Article 22: Personal Data Protection',
    titleVn: '\u0110i\u1EC1u 22. B\u1EA3o V\u1EC7 D\u1EEF Li\u1EC7u C\u00E1 Nh\u00E2n',
    contentEn: [
      '22.1 Personal data is processed in accordance with Vietnamese data protection laws.',
      '22.2 Data will not be disclosed to third parties except competent authorities.',
      '22.3 Members are prohibited from recording other members or guests without consent.',
    ],
    contentVn: [
      '22.1 D\u1EEF li\u1EC7u c\u00E1 nh\u00E2n \u0111\u01B0\u1EE3c x\u1EED l\u00FD tu\u00E2n theo lu\u1EADt b\u1EA3o v\u1EC7 d\u1EEF li\u1EC7u Vi\u1EC7t Nam.',
      '22.2 D\u1EEF li\u1EC7u s\u1EBD kh\u00F4ng \u0111\u01B0\u1EE3c ti\u1EBFt l\u1ED9 ngo\u00E0i c\u01A1 quan c\u00F3 th\u1EA9m quy\u1EC1n.',
      '22.3 Th\u00E0nh vi\u00EAn b\u1ECB nghi\u00EAm c\u1EA5m ghi h\u00ECnh ng\u01B0\u1EDDi kh\u00E1c khi ch\u01B0a c\u00F3 s\u1EF1 \u0111\u1ED3ng \u00FD.',
    ],
  },
  {
    titleEn: 'Article 23: Surveillance',
    titleVn: '\u0110i\u1EC1u 23. Gi\u00E1m S\u00E1t V\u00E0 An Ninh',
    contentEn: [
      '23.1 The Club operates CCTV in designated areas. By entering, members consent to monitoring.',
      '23.2 Footage is retained solely for safety purposes.',
    ],
    contentVn: [
      '23.1 C\u00E2u l\u1EA1c b\u1ED9 v\u1EADn h\u00E0nh CCTV t\u1EA1i c\u00E1c khu v\u1EF1c \u0111\u01B0\u1EE3c ch\u1EC9 \u0111\u1ECBnh. Khi v\u00E0o C\u01A1 s\u1EDF, th\u00E0nh vi\u00EAn \u0111\u1ED3ng \u00FD v\u1EDBi vi\u1EC7c gi\u00E1m s\u00E1t.',
      '23.2 H\u00ECnh \u1EA3nh ch\u1EC9 \u0111\u01B0\u1EE3c l\u01B0u gi\u1EEF nh\u1EB1m m\u1EE5c \u0111\u00EDch an to\u00E0n.',
    ],
  },
  {
    titleEn: 'Article 24: Whisky Consignment',
    titleVn: '\u0110i\u1EC1u 24. K\u00FD G\u1EEDi R\u01B0\u1EE3u Whisky',
    contentEn: [
      '24.1 Members wishing to store whisky must enter into a separate Whisky Consignment and Storage Agreement.',
      '24.2 Upon membership ending, whisky must be collected within 30 days.',
    ],
    contentVn: [
      '24.1 Th\u00E0nh vi\u00EAn mu\u1ED1n l\u01B0u tr\u1EEF whisky ph\u1EA3i k\u00FD H\u1EE3p \u0111\u1ED3ng K\u00FD g\u1EEDi ri\u00EAng bi\u1EC7t.',
      '24.2 Khi k\u1EBFt th\u00FAc t\u01B0 c\u00E1ch th\u00E0nh vi\u00EAn, whisky ph\u1EA3i \u0111\u01B0\u1EE3c thu h\u1ED3i trong 30 ng\u00E0y.',
    ],
  },
]

export default function TermsPage() {
  const [lang, setLang] = useState<'en' | 'vn'>('en')

  return (
    <>
      <NavOverlay variant="members" dark />
      <MemberPage title="Rules of Membership" subtitle="Quy Chế Thành Viên">
        {/* Bilingual note */}
        <p style={{
          fontFamily: "'Google Sans Code', 'DM Mono', monospace",
          fontSize: 10,
          color: '#B2AA98',
          opacity: 0.5,
          fontStyle: 'italic',
          textAlign: 'center',
          marginBottom: 24,
          marginTop: 0,
        }}>
          {lang === 'en'
            ? 'This document is prepared in both English and Vietnamese. In the event of any discrepancy, the English version shall prevail.'
            : 'V\u0103n b\u1EA3n n\u00E0y \u0111\u01B0\u1EE3c l\u1EADp b\u1EB1ng c\u1EA3 ti\u1EBFng Anh v\u00E0 ti\u1EBFng Vi\u1EC7t. Trong tr\u01B0\u1EDDng h\u1EE3p c\u00F3 s\u1EF1 kh\u00E1c bi\u1EC7t, phi\u00EAn b\u1EA3n ti\u1EBFng Anh s\u1EBD \u0111\u01B0\u1EE3c \u01B0u ti\u00EAn \u00E1p d\u1EE5ng.'}
        </p>

        {/* Language toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
          <button
            onClick={() => setLang('en')}
            style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.04em',
              padding: '6px 20px',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: lang === 'en' ? '1px solid transparent' : '1px solid rgba(229,212,194,0.2)',
              background: lang === 'en' ? 'rgba(229,212,194,0.12)' : 'transparent',
              color: lang === 'en' ? '#E5D4C2' : '#B2AA98',
            }}
          >
            EN
          </button>
          <button
            onClick={() => setLang('vn')}
            style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.04em',
              padding: '6px 20px',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: lang === 'vn' ? '1px solid transparent' : '1px solid rgba(229,212,194,0.2)',
              background: lang === 'vn' ? 'rgba(229,212,194,0.12)' : 'transparent',
              color: lang === 'vn' ? '#E5D4C2' : '#B2AA98',
            }}
          >
            VN
          </button>
        </div>

        {/* Articles */}
        {articles.map((article, i) => (
          <div key={i}>
            <h3 style={{
              fontFamily: "'Rampant Sans', serif",
              fontSize: 16,
              fontWeight: 600,
              color: '#E5D4C2',
              marginBottom: 12,
              marginTop: 0,
            }}>
              {lang === 'en' ? article.titleEn : article.titleVn}
            </h3>
            {(lang === 'en' ? article.contentEn : article.contentVn).map((clause, j) => (
              <p key={j} style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                fontSize: 11,
                color: '#B2AA98',
                lineHeight: 1.85,
                textAlign: 'justify',
                margin: '0 0 8px 0',
              }}>
                {clause}
              </p>
            ))}
            {i < articles.length - 1 && (
              <div style={{
                width: 8,
                height: 8,
                background: '#E5D4C2',
                transform: 'rotate(45deg)',
                opacity: 0.15,
                margin: '32px auto',
              }} />
            )}
          </div>
        ))}
      </MemberPage>
    </>
  )
}
