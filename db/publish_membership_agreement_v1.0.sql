-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLISH · Membership Agreement v1.0  ·  REVIEW, then run. Runs ONCE.
-- ───────────────────────────────────────────────────────────────────────────
-- The executed, reviewed bilingual agreement, as markdown, from
--   ~/Downloads/The Rampant Club Membership Agreement Bilingual (6).docx
--
-- PUBLISHED AS SIGNED — DELIBERATELY, INCLUDING ITS DEFECTS:
--   · "One Hundred and Thirty One Million Vientmaese Dong"  (sic)
--   · Pioneer and Corporate VND equivalents left blank
-- These are NOT to be corrected here. The portal copy must be the same text a
-- member put their name to; if it differs, the portal copy is the one they will
-- point at. A correction is a NEW SIGNED VERSION, never an edit to the display
-- copy — which is also what the immutability trigger on terms_versions enforces.
--
-- REMOVED (not text, apparatus): the blank application form and the club's
-- countersignature block — the last four rows of the source table. On a web page
-- they are rows of empty underscores, and the second carries the club signatory's
-- name, which has no business on a read-only copy shown to every member.
--
-- SAFE AGAINST THE CONSENT GATE: membership_terms is satisfied_by='signature',
-- and my_consent_state() returns needs_action=false for signature documents
-- unconditionally. Publishing this CANNOT gate a member behind a document they
-- have no way to consent to. Verified in the function body before writing this.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
begin
  if not exists (select 1 from terms_documents where doc_key = 'membership_terms') then
    raise exception 'PUBLISH: membership_terms is not registered'
      using hint = 'Run db/terms_documents.sql first. Nothing has been applied.';
  end if;
  if exists (select 1 from terms_versions where doc_key = 'membership_terms' and version = '1.0') then
    raise exception 'PUBLISH: membership_terms v1.0 already exists'
      using hint = 'A published version is immutable. Publish 1.1, do not re-run this.';
  end if;
end $prereq$;

-- ═══ ACT AS THE ADMIN ══════════════════════════════════════════════════════
-- publish_terms_version() gates on is_admin_uid(auth.uid()), and auth.uid() is
-- NULL in the SQL editor, so the call would raise 'admin only'. This is Mr
-- Rooney's own UUID, baked in — there is no placeholder to swap.
select set_config('request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true);

-- ═══ PUBLISH ═══════════════════════════════════════════════════════════════
-- effective_date is the earliest signature on record (signed_agreements). If the
-- club adopted the agreement on a different date, change this ONE value.
select publish_terms_version(
  'membership_terms',
  '1.0',
  '2026-04-11'::date,
  'Membership Agreement',
  'Thỏa Thuận Thành Viên',
$body_en$# The Rampant Club — Membership Agreement

*Bilingual Edition – Phiên bản Song ngữ*

This document is prepared in both English and Vietnamese. In the event of any discrepancy or inconsistency between the English and Vietnamese versions, the English version shall prevail.

## WHAT IS THE RAMPANT CLUB?

The Rampant Club is a private sanctuary for serious whisky lovers and discerning individuals who value unrestricted freedom, trust, and exceptional shared experiences.

Located at 74A2 Hai Ba Trung, directly opposite the Park Hyatt in Ho Chi Minh City, the five-floor clubhouse offers:

- Unlimited self-pour access to hundreds of open whiskies in The Rampant Room (our world-class bottle-share space)
- A discreet cocktail bar with seasonal & vintage spirits
- Immersive rotating art studio – an additional serene space where members can enjoy bottle-share drinks surrounded by quarterly curated, interactive installations
- Private dining room for intimate gatherings
- Cutting-edge Source & Origin beverage lab

Membership is capped at 99. No menus. No measures. No permission needed.

Everything runs on mutual trust and personal responsibility – bottles are shared, spaces are respected, privacy is absolute.

This is not for everyone. It exists for those who understand why such freedom is rare.

## MEMBER BENEFITS AT A GLANCE

- Unlimited access to the Saigon clubhouse and all its spaces
- First access to Club Picks – exclusive single-cask bottlings selected by members
- Private blending workshops and the option to purchase your own full cask (with trips to Scotland)
- Priority on "Rarest Reserve" releases
- Reciprocal access to a vetted network of elite private clubs worldwide
- Concierge hotline (Zalo/WhatsApp), event planning, private labelling, gifting service (20% retail discount)
- Curated global calendar of exceptional events: whisky journeys, round tables (Chatham House rules), golf outings, private dinners, and more
- A powerful community of 99 trusted, influential members – the real network advantage

## MEMBERSHIP & FINANCIAL COMMITMENT

Membership is by invitation, or referral only. All applicants undergo a review process. The Club reserves the right to accept or decline at its absolute discretion, and is under no obligation to provide reasons.

Joining Fee

Waived for the first 30 members (founding member phase).

Thereafter: to be determined later by the Club’s Board of Members (BOM).

Annual Dues (billed annually, non-refundable)

- Legacy Membership (established leaders & regular users) – USD 5,000

(equivalent to VND 131,000,000 VND – in words: One Hundred and Thirty One Million Vientmaese Dong)

____________________________________________________________________ Vietnam Dong)

- Pioneer Membership (under 33, emerging talent) – USD 3,000

(equivalent to VND ……………………. – in words:

____________________________________________________________________ Vietnam Dong)

- Corporate Membership (3 nominated seats per company) – USD 8,000

(equivalent to VND ……………………. – in words:

____________________________________________________________________ Vietnam Dong)

Additional Notes on Costs

- Food, non-complimentary drinks, private room hire, event tickets, and takeaway bottles are charged separately (members receive preferential pricing).
- Club fees are intended only to support the running of the club.
- The Rampant Room is free for members to use responsibly.

Guest Access to The Rampant Room (per guest, per visit – no time limit)

- 3,500,000 VND per guest, or
- Donation of an appropriate quality whisky bottle to the room (one per guest per visit)
- Purchase of a bottle of whisky from the Duncan Taylor Whisky Store (must possess a TRC sticker)

## YOUR APPLICATION

All applications are reviewed by the Club’s member committee. Submitting this form does not guarantee membership. Successful applicants will be contacted directly. Please allow time for the review process – we do not confirm timelines.

Declaration / Confirmation

By submitting this application, I confirm that:

- I have read and understood the Club’s ethos, and genuinely subscribe to its principles of trust, personal responsibility, and mutual respect
- I understand that if accepted, I will be subject to the annual dues and any applicable joining fee for my preferred membership category
- I understand that membership is not guaranteed, that the Club reserves the right to decline any application without explanation, and that total membership is strictly limited to 99
$body_en$,
$body_vn$# The Rampant Club — Membership Agreement

*Bilingual Edition – Phiên bản Song ngữ*

Văn bản này được lập bằng cả tiếng Anh và tiếng Việt. Trong trường hợp có bất kỳ sự khác biệt hoặc mâu thuẫn nào giữa phiên bản tiếng Anh và tiếng Việt, phiên bản tiếng Anh sẽ được ưu tiên áp dụng.

## THE RAMPANT CLUB LÀ GÌ?

The Rampant Club là một không gian riêng tư dành cho những người đam mê whisky thực thụ và những cá nhân tinh tế, trân trọng sự tự do không giới hạn, niềm tin và những trải nghiệm chia sẻ đặc biệt.

Tọa lạc tại 74A2 Hai Bà Trưng, đối diện Park Hyatt tại Thành phố Hồ Chí Minh, câu lạc bộ năm tầng cung cấp:

- Quyền tự rót không giới hạn hàng trăm chai whisky đang mở trong The Rampant Room (không gian chia sẻ chai whisky đẳng cấp thế giới)
- Quán bar cocktail kín đáo với rượu mạnh theo mùa và cổ điển
- Phòng nghệ thuật luân phiên sống động – không gian tĩnh lặng nơi thành viên có thể thưởng thức đồ uống chia sẻ giữa các tác phẩm nghệ thuật tương tác được tuyển chọn theo quý
- Phòng ăn riêng cho các buổi gặp gỡ thân mật
- Phòng thí nghiệm đồ uống Source & Origin tiên tiến

Số lượng thành viên giới hạn ở mức 99. Không thực đơn. Không định lượng. Không cần xin phép.

Mọi thứ vận hành dựa trên niềm tin lẫn nhau và trách nhiệm cá nhân – chai được chia sẻ, không gian được tôn trọng, quyền riêng tư là tuyệt đối.

Đây không dành cho tất cả mọi người. Nơi này tồn tại cho những ai hiểu vì sao sự tự do như vậy là hiếm có.

## TỔNG QUAN QUYỀN LỢI THÀNH VIÊN

- Quyền tiếp cận không giới hạn câu lạc bộ tại Sài Gòn và tất cả các không gian
- Quyền ưu tiên mua Club Picks – các dòng whisky đơn thùng đóng chai độc quyền do thành viên lựa chọn
- Hội thảo pha chế riêng và cơ hội mua thùng whisky riêng của bạn (kèm chuyến đi Scotland)
- Ưu tiên mua các dòng "Rarest Reserve"
- Quyền tiếp cận mạng lưới câu lạc bộ tư nhân hàng đầu được thẩm định trên toàn cầu
- Đường dây nóng Concierge (Zalo/WhatsApp), tổ chức sự kiện, nhãn riêng, dịch vụ quà tặng (giảm giá 20% khi mua lẻ)
- Lịch sự kiện toàn cầu được tuyển chọn: hành trình whisky, hội thảo bàn tròn (quy tắc Chatham House), chơi golf, tiệc tối riêng và nhiều hơn nữa
- Một cộng đồng 99 thành viên uy tín, có ảnh hưởng – lợi thế mạng lưới thực sự

## TƯ CÁCH THÀNH VIÊN VÀ CAM KẾT TÀI CHÍNH

Tư cách thành viên chỉ được cấp theo lời mời hoặc giới thiệu. Tất cả ứng viên phải trải qua quy trình xét duyệt. Câu lạc bộ bảo lưu quyền chấp thuận hoặc từ chối theo quyết định tuyệt đối của mình và không có nghĩa vụ cung cấp lý do.

Phí Gia nhập

Miễn cho 30 thành viên đầu tiên (giai đoạn thành viên sáng lập).

Sau đó: sẽ được ấn định bởi Hội đồng Thành viên (BOM) của Câu lạc bộ.

Phí Hàng năm (thanh toán hàng năm, không hoàn lại)

- Thành viên Legacy (lãnh đạo có uy tín & người dùng thường xuyên) – 5.000 USD(tương đương 131,000,000 VND NĐ – bằng chữ: ____________________________________________________________________ đồng)
- Thành viên Pioneer (dưới 33 tuổi, tài năng mới nổi) – 3.000 USD(tương đương …………………… VNĐ – bằng chữ: ____________________________________________________________________ đồng)
- Thành viên Corporate (03 suất đề cử mỗi công ty) – 8.000 USD(tương đương …………………… VNĐ – bằng chữ: ____________________________________________________________________ đồng)

Ghi chú Bổ sung về Chi phí

- Thức ăn, đồ uống không miễn phí, thuê phòng riêng, vé sự kiện và chai mang về được tính riêng (thành viên được hưởng giá ưu đãi).
- Phí câu lạc bộ chỉ nhằm mục đích hỗ trợ vận hành câu lạc bộ.
- The Rampant Room miễn phí cho thành viên sử dụng có trách nhiệm.

Quyền Tiếp cận The Rampant Room cho Khách mời (mỗi khách, mỗi lần – không giới hạn thời gian)

- 3.500.000 VND mỗi khách, hoặc
- Đóng góp một chai whisky chất lượng phù hợp vào phòng (một chai mỗi khách mỗi lần đến)
- Mua một chai whisky từ Cửa hàng Whisky Duncan Taylor (phải có nhãn dán TRC)

## ĐƠN ĐĂNG KÝ CỦA BẠN

Tất cả đơn đăng ký được Hội đồng thành viên của Câu lạc bộ xem xét. Việc nộp đơn này không đảm bảo tư cách thành viên. Các ứng viên thành công sẽ được liên hệ trực tiếp. Vui lòng cho phép thời gian cho quy trình xét duyệt – chúng tôi không cam kết về thời hạn.

Tuyên bố / Xác nhận

Bằng việc nộp đơn đăng ký này, tôi xác nhận rằng:

- Tôi đã đọc và hiểu triết lý của Câu lạc bộ, và thực sự đồng ý với các nguyên tắc về niềm tin, trách nhiệm cá nhân và tôn trọng lẫn nhau
- Tôi hiểu rằng nếu được chấp thuận, tôi sẽ phải chịu các khoản phí hàng năm và phí gia nhập áp dụng cho loại hình thành viên mà tôi lựa chọn
- Tôi hiểu rằng tư cách thành viên không được đảm bảo, rằng Câu lạc bộ bảo lưu quyền từ chối bất kỳ đơn đăng ký nào mà không cần giải thích, và tổng số thành viên được giới hạn nghiêm ngặt ở mức 99
$body_vn$
);

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
-- Asserts the two properties that actually matter: it IS the signed text, and it
-- is NOT carrying the signature apparatus.
do $check$
declare v_body text; v_vn text; v_n int;
begin
  select count(*) into v_n from terms_versions where doc_key = 'membership_terms';
  if v_n <> 1 then raise exception 'SELF-CHECK: expected exactly 1 membership_terms version, found %', v_n; end if;

  select body, body_vn into v_body, v_vn from terms_versions
   where doc_key = 'membership_terms' and version = '1.0';

  if position('Vientmaese' in v_body) = 0 then
    raise exception 'SELF-CHECK: the published body is NOT the as-signed text (the known typo is absent)';
  end if;
  if position('Hồng Diễm' in v_body) > 0 or position('Hồng Diễm' in coalesce(v_vn,'')) > 0 then
    raise exception 'SELF-CHECK: the club signatory name reached a member-visible body';
  end if;
  if position('APPLICATION FORM' in v_body) > 0 then
    raise exception 'SELF-CHECK: the application form survived into the published body';
  end if;

  raise notice 'PUBLISHED — membership_terms v1.0, % chars EN / % chars VN, as signed.',
    length(v_body), length(coalesce(v_vn,''));
end $check$;
