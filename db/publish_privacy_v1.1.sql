-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLISH · Privacy Notice v1.1 — the Vietnamese.  REVIEW, then run. Runs ONCE.
-- ───────────────────────────────────────────────────────────────────────────
-- v1.0 is English only. This adds body_vn so the notice exists in the language
-- most of the membership reads, and carries the SAME English body forward
-- unchanged — v1.1 is a translation, not a revision.
--
-- ═══ `required` STAYS OFF. THAT IS THE POINT OF THIS FILE. ═════════════════
-- This translation was produced by an AI, not by a Vietnamese reader. A
-- translation of a document members must AGREE to is a different risk class
-- from an event blurb: a mistranslated obligation is a mistranslated consent.
--
-- So this publishes the version and CHANGES NOTHING about whether it gates.
-- terms_documents.privacy.required is false (see db/privacy_gate_stand_down.sql)
-- and must stay false until a fluent reader has been through it. The line that
-- turns the gate back on is deliberately NOT in this file.
--
-- What to have checked first, in priority order:
--   1. The AI-processing paragraph — longest, most consequential, and the one
--      where a stiff translation reads as evasive rather than forthcoming.
--   2. "Những người chưa phải hội viên" — written to be read by someone who is
--      NOT a member and may not know they are in a database. Tone matters most.
--   3. Form of address: `quý vị` throughout. If the club says anh/chị or
--      quý hội viên in practice, that should carry through consistently.
--   4. "Ghép khẩu vị" for palate matching, and "dram" left untranslated.
--   5. "The Snug" left in English as a room name.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
begin
  if not exists (select 1 from terms_versions where doc_key='privacy' and version='1.0') then
    raise exception 'PUBLISH: privacy v1.0 is not published' using hint = 'Nothing applied.';
  end if;
  if exists (select 1 from terms_versions where doc_key='privacy' and version='1.1') then
    raise exception 'PUBLISH: privacy v1.1 already exists'
      using hint = 'A published version is immutable. Publish 1.2, do not re-run this.';
  end if;
end $prereq$;

-- ═══ ACT AS THE ADMIN ══════════════════════════════════════════════════════
-- publish_terms_version() gates on is_admin_uid(auth.uid()), which is NULL in
-- the SQL editor. Mr Rooney's own UUID, baked in — no placeholder to swap.
select set_config('request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true);

select publish_terms_version(
  'privacy',
  '1.1',
  current_date,
  'What We Keep, and Why',
  'Những Gì Chúng Tôi Lưu Giữ, và Vì Sao',
$body_en$# What We Keep, and Why

Most clubs give you a privacy notice written by someone who hopes you won't read it. This one is written on the assumption that you will, and that you'd rather know.

The short version: we keep a fair amount about you. We keep it because a club that remembers is a better club than one that doesn't, and because the alternative — asking you the same questions every visit — is worse service dressed as discretion. None of it is sold, and you can see all of it whenever you like.

The longer version is below, including the parts that might give you pause. We'd rather you read them here than discover them later.

## Who holds this

Ruou Ngon Trading Co., Ltd., which operates The Rampant Club at 74A2 Hai Bà Trưng, Phường Sài Gòn, Ho Chi Minh City.

Tax code 0318108862.

Anything in this notice: Membership@therampantclub.com

**Duncan Taylor Scotch Whisky Ltd has no access to member data.** The club stocks their whisky, and a guest may settle their visit by buying a bottle from the Duncan Taylor store — those are commercial arrangements. They carry no access to anything held about you. That separation is maintained in the system itself, not only in policy.

## What we keep

### Who you are

Your name, the name we call you, your membership number and category, your contact details, your membership and renewal dates, and who introduced you.

### What you like

This is the part worth explaining properly.

The club keeps a record of your preferences — the drams you've enjoyed, the ones you've politely declined, how you take your water, where you prefer to sit, whether you'd rather be introduced or left alone. Some of this you'll have told us. Much of it is observed by staff over time and written down afterwards.

Three things about that record you should know:

**It's scored.** Each preference carries a confidence level reflecting how sure we are, and that confidence **decays**. A taste noted once, two years ago, is held more loosely than one confirmed on your last four visits. The system is built to forget things that stop being true, because a club acting on stale assumptions is worse than one that asks.

**It sometimes keeps your words.** Where what you said matters more than a summary of it, the record holds the phrase itself.

**It notices when you contradict yourself.** If you tell us one thing and later tell us another, the record flags it rather than silently overwriting. That isn't kept to catch you out — it's kept so staff ask rather than guess, because tastes change and a club that quietly picks one answer will get it wrong half the time.

We also derive a **palate profile** from your tasting notes and what you drink — a picture of the flavours you lean toward. It's yours to see in the portal.

### What happens when you're here

Your visits: when you arrived, which room, who looked after you, and how long you stayed. Your card taps at the kiosks. What you ordered and what it cost. Guests you brought and when.

A note from each visit about how it went and what to carry into the next one — including, plainly, an impression of your mood. If you arrived tired, or left in better spirits than you came, a member of staff may have written that down. It is kept so the next person looking after you starts from somewhere sensible.

Bottles you keep in your locker, and gifts sent to you by the club, including what they cost us.

### What you tell us

Concierge requests, messages, tasting notes you've written, bottles you've saved, events you've signed up for, anything you post in The Snug, and any other member you've asked not to be seated with or introduced to.

### What you pay

Membership dues, any joining fee, top-ups and your account balance, and what you've spent.

**We hold no card details at all.** Dues and top-ups are paid by bank transfer, so what we keep is the record of the payment — the amount, the date and the reference. There is no card number to store, and no card processor involved.

## The parts we'd rather tell you about than have you find

**Staff read a brief before you arrive.** When you're expected, the member of staff looking after you sees a short summary — your name, your preferences, anything outstanding from last time, and anything they should know to make the evening go well. It exists so that good service looks like attentiveness rather than interrogation. It is read backstage, never displayed where you or other members can see it.

**We write down when things go wrong.** If you've had a poor evening, raised a complaint, or simply seemed unhappy, a member of staff records what happened and what was done about it. We keep it because the alternative — a complaint that vanishes when the person who heard it goes off shift — is how clubs fail their members quietly. It is held in confidence and used to put things right.

**Those written accounts are processed by an AI service.** A staff member's account of an evening is plain English, and turning it into structured records is slow. So the text is sent to Anthropic, an overseas provider, which proposes what should be recorded. **A member of staff reviews and approves every proposal — nothing is written by the system alone**, and no decision about you is made automatically.

You should know what that means: text naming you and describing your evening leaves Vietnam and is read by an automated system operated by a third party. It is not used to train anybody's models. We tell you because a notice listing our hosting and payment providers while omitting this one would be misleading about the thing you'd most want to know.

**Members and staff see different things.** The screen you sign into at the bar shows your own visits, your palate and what's on. It deliberately does not show the scored preference register, the visit notes or the service record described above — those are working tools for staff. You are entitled to see everything we hold about you. You'll see it by asking us, not by finding it on a tablet in a room where someone can read over your shoulder.

**Palate matching is on unless you turn it off.** The club may suggest introductions to members whose tastes resemble yours. If you'd rather not, say so — in the portal or to any member of staff — and it stops, with no effect on anything else.

**Management sees summaries.** Reports on how the club is running are produced and sent by email to management. They deal in patterns and totals rather than individuals, but where a member is named they are covered by the same confidence as everything else here.

## People who aren't members

The club keeps records on people who have been proposed, introduced or considered for membership — including who introduced them, how they know one another, and notes from any conversation or interview.

If that's you, and you're reading this: you have the same rights set out below, and you do not have to be a member to use them. Write to Membership@therampantclub.com and we will tell you what we hold, correct it, or delete it.

If you're not admitted, or you don't pursue it, we delete what we hold twelve months after we last heard from you.

## Who sees it

Club staff, in the course of looking after you, and limited to what their role requires. Management, for running the club.

Nobody else. We do not sell member data, we do not share it with advertisers, and we do not pass it to other businesses — including those connected to the club by ownership or supply.

Some suppliers necessarily process data on our behalf, under contract and on our instructions only:

- **Supabase** — hosting and database (Singapore)
- **Resend** — email to members
- **Anthropic** — the AI processing described above (United States)

## How long we keep it

While you are a member, and for **two years** after your membership ends. After that, preference and visit records are deleted.

Financial and accounting records are kept for as long as Vietnamese law requires.

Records on people who never became members: **twelve months** after last contact.

You can ask us to delete preference and visit records **at any time, including while you remain a member**. You can ask us to forget your tastes and start again. It will make the service worse for a while, and that is entirely your prerogative.

## What you can ask us to do

At any time, and without explaining why:

- **See everything** we hold about you — all of it, including the preference register, the visit notes and the service record. Ask and we'll produce it.
- **Correct** anything that's wrong.
- **Delete** what you'd rather we didn't keep, subject only to records we're required to retain.
- **Withdraw your consent** — to marketing, to palate matching, or to any processing not required to provide your membership.
- **Object** to something specific, or ask us to stop a particular kind of processing.
- **Complain** — to us first, and to the relevant Vietnamese authority if we haven't put it right.

Write to Membership@therampantclub.com. We'll respond within thirty days.

## Marketing

Separate, optional, and off unless you turn it on. Declining costs you nothing — you'll still hear about anything affecting your membership, because that isn't marketing.

Withdraw it at any time, without affecting anything else.

## When this changes

We'll tell you, and we'll ask you to look at the new version next time you sign in. Every version is kept, along with the date you agreed to it, so there's never a question about which terms applied when.
$body_en$,
$body_vn$# Những Gì Chúng Tôi Lưu Giữ, và Vì Sao

**The Rampant Club — Thông Báo về Quyền Riêng Tư**
Phiên bản 1.1 · 9 tháng 9, 2026

---

Phần lớn các câu lạc bộ đưa cho quý vị một thông báo quyền riêng tư do người ta soạn với hy vọng quý vị sẽ không đọc. Bản này được viết với giả định ngược lại: rằng quý vị sẽ đọc, và rằng quý vị muốn biết.

Nói ngắn gọn: chúng tôi lưu giữ khá nhiều thông tin về quý vị. Chúng tôi làm vậy vì một câu lạc bộ biết ghi nhớ thì phục vụ tốt hơn một câu lạc bộ không nhớ gì — và vì lựa chọn còn lại, hỏi quý vị đúng những câu ấy mỗi lần quý vị ghé, là sự phục vụ kém khoác áo tế nhị. Không có thông tin nào được bán, và quý vị có thể xem toàn bộ bất cứ lúc nào.

Phần chi tiết ở bên dưới, kể cả những điều có thể khiến quý vị dừng lại suy nghĩ. Chúng tôi muốn quý vị đọc chúng ở đây, hơn là biết đến sau này.

---

## Bên lưu giữ thông tin

Công ty TNHH Thương Mại Rượu Ngon, đơn vị vận hành The Rampant Club tại 74A2 Hai Bà Trưng, Phường Sài Gòn, Thành phố Hồ Chí Minh.

Mã số thuế 0318108862.

Mọi vấn đề liên quan đến thông báo này: Membership@therampantclub.com

**Duncan Taylor Scotch Whisky Ltd không có quyền truy cập dữ liệu hội viên.** Câu lạc bộ có bán whisky của họ, và khách mời có thể thanh toán cho buổi ghé thăm bằng cách mua một chai tại cửa hàng Duncan Taylor — đó là các thỏa thuận thương mại. Chúng không đi kèm bất kỳ quyền truy cập nào vào thông tin về quý vị. Sự tách bạch này được duy trì ngay trong hệ thống, không chỉ trên giấy tờ.

---

## Những gì chúng tôi lưu giữ

### Quý vị là ai

Tên của quý vị, tên chúng tôi vẫn gọi quý vị, số hội viên và hạng hội viên, thông tin liên hệ, ngày gia nhập và ngày gia hạn, và người đã giới thiệu quý vị.

### Điều quý vị yêu thích

Đây là phần đáng được giải thích cho cặn kẽ.

Câu lạc bộ ghi lại sở thích của quý vị — những dram quý vị thích, những chai quý vị lịch sự từ chối, cách quý vị dùng nước, chỗ ngồi quý vị ưa, và việc quý vị muốn được giới thiệu với hội viên khác hay muốn được yên tĩnh. Một phần trong đó là do quý vị nói với chúng tôi. Phần lớn hơn là do nhân viên quan sát theo thời gian rồi ghi lại sau đó.

Có ba điều về hồ sơ ấy mà quý vị nên biết:

**Nó có thang tin cậy.** Mỗi sở thích được gắn một mức độ tin cậy phản ánh chúng tôi chắc chắn đến đâu, và mức tin cậy ấy **giảm dần theo thời gian**. Một sở thích chỉ ghi nhận một lần, từ hai năm trước, được giữ nhẹ hơn một sở thích đã được xác nhận qua bốn lần ghé gần nhất. Hệ thống được thiết kế để quên đi những gì không còn đúng nữa, bởi một câu lạc bộ hành xử theo giả định cũ kỹ còn tệ hơn một câu lạc bộ chịu khó hỏi.

**Đôi khi nó giữ lại nguyên lời quý vị.** Khi cách quý vị nói quan trọng hơn phần tóm tắt, hồ sơ giữ lại chính câu nói ấy.

**Nó nhận ra khi quý vị nói khác đi.** Nếu quý vị nói với chúng tôi một điều rồi sau đó nói khác, hồ sơ đánh dấu điều đó thay vì lặng lẽ ghi đè. Việc này không nhằm bắt lỗi quý vị — nó được giữ để nhân viên biết hỏi lại thay vì đoán, bởi khẩu vị thay đổi, và một câu lạc bộ lặng lẽ chọn lấy một câu trả lời sẽ sai một nửa số lần.

Chúng tôi cũng xây dựng một **hồ sơ khẩu vị** từ những ghi chú nếm thử và những gì quý vị dùng — một bức tranh về các hương vị quý vị nghiêng về. Quý vị có thể xem nó trong cổng hội viên.

### Những gì diễn ra khi quý vị ở đây

Các lần ghé của quý vị: đến lúc nào, ở phòng nào, ai phục vụ quý vị, và ở lại bao lâu. Những lần quý vị chạm thẻ tại kiosk. Những gì quý vị gọi và chi phí. Khách quý vị dẫn theo và thời điểm.

Một ghi chú sau mỗi lần ghé về việc buổi tối diễn ra thế nào và điều gì nên mang sang lần sau — bao gồm, nói thẳng, cảm nhận về tâm trạng của quý vị. Nếu quý vị đến trong lúc mệt, hoặc ra về vui hơn lúc đến, một nhân viên có thể đã ghi lại điều đó. Nó được giữ để người phục vụ quý vị lần sau bắt đầu từ một chỗ hợp lý.

Những chai quý vị gửi trong tủ riêng, và những món quà câu lạc bộ gửi tặng quý vị, bao gồm cả chi phí của chúng.

### Những gì quý vị nói với chúng tôi

Các yêu cầu concierge, tin nhắn, ghi chú nếm thử quý vị viết, những chai quý vị lưu lại, các sự kiện quý vị đăng ký, mọi điều quý vị đăng trong The Snug, và tên bất kỳ hội viên nào quý vị đề nghị không xếp ngồi cùng hoặc không giới thiệu.

### Những gì quý vị thanh toán

Phí hội viên, phí gia nhập (nếu có), các lần nạp tiền và số dư tài khoản, cùng những khoản quý vị đã chi.

**Chúng tôi không lưu bất kỳ thông tin thẻ nào.** Phí hội viên và các khoản nạp được thanh toán bằng chuyển khoản ngân hàng, nên điều chúng tôi giữ là bản ghi của giao dịch — số tiền, ngày và nội dung chuyển khoản. Không có số thẻ nào để lưu, và không có đơn vị xử lý thẻ nào tham gia.

---

## Những phần chúng tôi muốn tự nói ra, hơn là để quý vị tự phát hiện

**Nhân viên đọc một bản tóm tắt trước khi quý vị đến.** Khi câu lạc bộ biết quý vị sẽ ghé, nhân viên phục vụ quý vị được xem một bản tóm tắt ngắn — tên quý vị, sở thích của quý vị, những gì còn dang dở từ lần trước, và những điều họ nên biết để buổi tối diễn ra tốt đẹp. Nó tồn tại để sự phục vụ chu đáo trông giống như sự tinh ý, chứ không phải một cuộc hỏi han. Nó được đọc ở phía sau, không bao giờ hiển thị ở nơi quý vị hay hội viên khác có thể nhìn thấy.

**Chúng tôi ghi lại khi có điều gì đó không ổn.** Nếu quý vị có một buổi tối không vui, đưa ra phàn nàn, hoặc đơn giản là có vẻ không hài lòng, nhân viên sẽ ghi lại chuyện gì đã xảy ra và đã xử lý ra sao. Chúng tôi giữ lại vì lựa chọn còn lại — một lời phàn nàn biến mất khi người nghe nó hết ca — là cách các câu lạc bộ lặng lẽ phụ lòng hội viên. Nó được giữ kín và dùng để sửa cho đúng.

**Những ghi chép ấy được xử lý bởi một dịch vụ AI.** Ghi chép của nhân viên về một buổi tối là văn xuôi thông thường, và việc chuyển nó thành dữ liệu có cấu trúc rất mất thời gian. Vì vậy đoạn văn ấy được gửi tới Anthropic, một nhà cung cấp ở nước ngoài, để đề xuất những gì nên được ghi nhận. **Một nhân viên xem xét và phê duyệt từng đề xuất — không có gì được ghi lại chỉ bởi hệ thống**, và không có quyết định nào về quý vị được đưa ra một cách tự động.

Quý vị nên hiểu rõ điều đó có nghĩa gì: đoạn văn bản có tên quý vị và mô tả buổi tối của quý vị rời khỏi Việt Nam và được một hệ thống tự động do bên thứ ba vận hành đọc. Nó không được dùng để huấn luyện mô hình của bất kỳ ai. Chúng tôi nói với quý vị điều này vì một thông báo liệt kê các nhà cung cấp hạ tầng và thanh toán mà bỏ qua chi tiết này sẽ là đánh lừa quý vị về đúng điều quý vị muốn biết nhất.

**Hội viên và nhân viên nhìn thấy những thứ khác nhau.** Màn hình quý vị đăng nhập tại quầy hiển thị các lần ghé của chính quý vị, hồ sơ khẩu vị và lịch hoạt động. Nó cố ý không hiển thị bảng sở thích có thang tin cậy, các ghi chú sau mỗi lần ghé, hay hồ sơ xử lý phàn nàn nói trên — đó là công cụ làm việc của nhân viên. Quý vị có quyền xem mọi thứ chúng tôi lưu giữ về mình. Quý vị sẽ xem được bằng cách hỏi chúng tôi, chứ không phải bằng cách mở trên một máy tính bảng đặt giữa phòng, nơi người khác có thể đọc qua vai quý vị.

**Ghép khẩu vị được bật sẵn cho đến khi quý vị tắt.** Câu lạc bộ có thể đề xuất giới thiệu quý vị với những hội viên có gu tương đồng. Nếu quý vị không muốn, chỉ cần nói — trong cổng hội viên hoặc với bất kỳ nhân viên nào — và việc đó dừng lại, không ảnh hưởng đến bất cứ điều gì khác.

**Ban quản lý xem các báo cáo tổng hợp.** Các báo cáo về tình hình vận hành câu lạc bộ được lập và gửi qua email cho ban quản lý. Chúng nói về xu hướng và số liệu tổng hơn là về từng cá nhân, nhưng ở những chỗ có nêu tên hội viên, thông tin ấy được bảo mật như mọi thứ khác trong thông báo này.

---

## Những người chưa phải hội viên

Câu lạc bộ lưu giữ hồ sơ về những người đã được đề cử, giới thiệu hoặc được cân nhắc kết nạp — bao gồm ai giới thiệu họ, họ quen biết nhau ra sao, và ghi chú từ các cuộc trò chuyện hay phỏng vấn.

Nếu đó là quý vị, và quý vị đang đọc dòng này: quý vị có đầy đủ các quyền nêu ở phần dưới, và quý vị không cần phải là hội viên mới được sử dụng chúng. Hãy viết thư tới Membership@therampantclub.com và chúng tôi sẽ cho quý vị biết chúng tôi đang lưu gì, sửa lại, hoặc xóa đi.

Nếu quý vị không được kết nạp, hoặc không tiếp tục, chúng tôi xóa những gì đang lưu sau mười hai tháng kể từ lần liên hệ cuối cùng.

---

## Ai được xem

Nhân viên câu lạc bộ, trong quá trình phục vụ quý vị, và chỉ trong phạm vi công việc của họ yêu cầu. Ban quản lý, để vận hành câu lạc bộ.

Không ai khác. Chúng tôi không bán dữ liệu hội viên, không chia sẻ với các đơn vị quảng cáo, và không chuyển cho doanh nghiệp nào khác — kể cả những đơn vị có liên hệ với câu lạc bộ qua sở hữu hay cung ứng.

Một số nhà cung cấp buộc phải xử lý dữ liệu thay mặt chúng tôi, theo hợp đồng và chỉ theo chỉ dẫn của chúng tôi:

- **Supabase** — hạ tầng và cơ sở dữ liệu (Singapore)
- **Resend** — gửi email cho hội viên
- **Anthropic** — phần xử lý AI mô tả ở trên (Hoa Kỳ)

---

## Chúng tôi lưu trong bao lâu

Trong thời gian quý vị là hội viên, và **hai năm** sau khi tư cách hội viên kết thúc. Sau đó, hồ sơ sở thích và hồ sơ các lần ghé được xóa.

Hồ sơ tài chính và kế toán được lưu trong thời hạn pháp luật Việt Nam yêu cầu.

Hồ sơ về những người chưa từng trở thành hội viên: **mười hai tháng** kể từ lần liên hệ cuối.

Quý vị có thể yêu cầu chúng tôi xóa hồ sơ sở thích và hồ sơ các lần ghé **bất cứ lúc nào, kể cả khi vẫn đang là hội viên**. Quý vị có thể yêu cầu chúng tôi quên hết khẩu vị của quý vị và bắt đầu lại. Việc đó sẽ khiến sự phục vụ kém đi trong một thời gian, và đó hoàn toàn là quyền của quý vị.

---

## Những gì quý vị có thể yêu cầu

Bất cứ lúc nào, và không cần giải thích lý do:

- **Xem toàn bộ** những gì chúng tôi lưu về quý vị — tất cả, bao gồm bảng sở thích, các ghi chú sau mỗi lần ghé và hồ sơ xử lý phàn nàn. Chỉ cần hỏi và chúng tôi sẽ cung cấp.
- **Sửa** bất kỳ điều gì không đúng.
- **Xóa** những gì quý vị không muốn chúng tôi giữ, trừ các hồ sơ mà pháp luật buộc phải lưu.
- **Rút lại sự đồng ý** — với các thông tin tiếp thị, với việc ghép khẩu vị, hoặc với bất kỳ hoạt động xử lý nào không cần thiết để duy trì tư cách hội viên của quý vị.
- **Phản đối** một việc cụ thể, hoặc yêu cầu chúng tôi ngừng một hình thức xử lý nhất định.
- **Khiếu nại** — với chúng tôi trước, và với cơ quan có thẩm quyền của Việt Nam nếu chúng tôi chưa giải quyết thỏa đáng.

Hãy viết tới Membership@therampantclub.com. Chúng tôi sẽ phản hồi trong vòng ba mươi ngày.

---

## Thông tin tiếp thị

Tách riêng, không bắt buộc, và mặc định tắt cho đến khi quý vị bật. Việc từ chối không khiến quý vị mất gì — quý vị vẫn nhận được mọi thông tin ảnh hưởng đến tư cách hội viên của mình, vì đó không phải là tiếp thị.

Quý vị có thể rút lại bất cứ lúc nào, không ảnh hưởng đến bất cứ điều gì khác.

---

## Khi thông báo này thay đổi

Chúng tôi sẽ báo cho quý vị, và mời quý vị xem lại phiên bản mới trong lần đăng nhập kế tiếp. Mọi phiên bản đều được lưu, cùng với ngày quý vị đồng ý, nên sẽ không bao giờ có tranh cãi về việc điều khoản nào áp dụng vào thời điểm nào.
$body_vn$
);

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_body text; v_vn text; v_required boolean; v_current uuid;
begin
  select body, body_vn into v_body, v_vn
    from terms_versions where doc_key='privacy' and version='1.1';

  if coalesce(length(btrim(v_vn)),0) < 5000 then
    raise exception 'SELF-CHECK: the Vietnamese body is missing or truncated (% chars)', coalesce(length(v_vn),0);
  end if;
  if position('Anthropic' in v_vn) = 0 then
    raise exception 'SELF-CHECK: the AI-processing disclosure is absent from the Vietnamese';
  end if;
  if v_body is null or length(v_body) < 5000 then
    raise exception 'SELF-CHECK: the English body did not carry forward';
  end if;

  -- The whole point: publishing a translation must not switch the gate on.
  select required into v_required from terms_documents where doc_key='privacy';
  if v_required then
    raise exception 'SELF-CHECK: privacy.required is TRUE — this file must not gate anyone. Set it false.';
  end if;

  select current_terms_version('privacy') into v_current;
  raise notice 'PUBLISHED — privacy v1.1, % chars EN / % chars VN. required = false, so it gates nobody. Current version is now %.',
    length(v_body), length(v_vn), v_current;
end $check$;
