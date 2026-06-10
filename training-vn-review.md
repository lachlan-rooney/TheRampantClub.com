# The Rampant Club — Staff Training · Vietnamese Review

**For Miss Châu.** Below is every line of the staff training handbook (the in-app `/admin/training` page), English on the left, the AI Vietnamese draft on the right. Please correct the **VN** column wherever it reads unnaturally or is wrong — especially the step-by-step procedures (booking tables, member logins). English is the source of truth; UI button labels / room names / code are intentionally left in English (staff see them that way on screen).

**19 sections · 227 lines to review.**

---

## Getting started

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Getting started | Bắt đầu |
| What the CRM is, who it is for, and how to think about it. | CRM là gì, dành cho ai, và cách hiểu về nó. |
| The admin portal at `/admin` is the team's working surface — it's where we manage prospects, members, the whisky library, the floor, and everything in between. It is *not* a public-facing site; only signed-in admins reach it. | Cổng quản trị tại `/admin` là nơi làm việc của đội ngũ — nơi chúng ta quản lý khách tiềm năng, thành viên, thư viện whisky, khu vực phục vụ và mọi thứ ở giữa. Đây *không* phải trang công khai; chỉ quản trị viên đã đăng nhập mới vào được. |
| The sidebar is grouped by job-to-be-done: | Thanh bên được nhóm theo công việc cần làm: |
| **Floor** — what you need at the club: MX Daily (the morning brief), Tonight (service prep), Calendar (bookings), Shift Checklists (opening/closing handover), Harmony Log (end-of-shift AI capture), Notices, Quick Reference. | **Floor** — những gì bạn cần tại câu lạc bộ: MX Daily (bản tóm tắt buổi sáng), Tonight (chuẩn bị phục vụ), Calendar (đặt chỗ), Shift Checklists (bàn giao mở/đóng ca), Harmony Log (ghi nhận cuối ca bằng AI), Notices, Quick Reference. |
| **Intelligence** — the CRM: Pipeline (prospects), Members, User Roster, Pref Candidates (review queue), Member Cards (NFC), Agreements (signed PDFs). | **Intelligence** — phần CRM: Pipeline (khách tiềm năng), Members, User Roster, Pref Candidates (hàng chờ duyệt), Member Cards (thẻ NFC), Agreements (PDF đã ký). |
| **Whisky Library** — Inventory, Lockers, Fixtures. | **Whisky Library** — Inventory (tồn kho), Lockers (tủ rượu), Fixtures (lịch thi đấu). |
| **House** — House Rules, Journal, Press, this Training doc. | **House** — House Rules (nội quy), Journal (nhật ký), Press (báo chí), và tài liệu Training này. |
| Everything you do in the admin portal is logged. Activity timelines on members and prospects are the team's collective memory — write clear, professional notes; assume the GM, the MX, and the founder will all read them. | Mọi thao tác trong cổng quản trị đều được ghi lại. Dòng thời gian hoạt động của thành viên và khách tiềm năng là ký ức chung của cả đội — hãy ghi chú rõ ràng, chuyên nghiệp; cứ cho rằng GM, MX và nhà sáng lập đều sẽ đọc. |

## Pipeline (prospects)

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Pipeline (prospects) | Pipeline (khách tiềm năng) |
| How to add a prospect, move them through the stages, and convert them into a member. | Cách thêm khách tiềm năng, đưa họ qua các giai đoạn, và chuyển thành thành viên. |
| The Pipeline at [/admin/mis/pipeline](/admin/mis/pipeline) is the kanban for everyone who isn't a member yet. Cards move left-to-right through six active stages, plus three off-ramps for prospects who don't convert. | Pipeline tại [/admin/mis/pipeline](/admin/mis/pipeline) là bảng kanban cho tất cả những người chưa phải thành viên. Thẻ di chuyển từ trái sang phải qua sáu giai đoạn chính, cùng ba lối rẽ cho khách không chuyển đổi. |
| Active stages | Các giai đoạn chính |
| Off-ramps | Các lối rẽ |
| Daily flow | Quy trình hằng ngày |
| Open the Pipeline first thing. Glance at the *Needs attention* dashboard at the top — stale leads, interviews this week, actions due. | Mở Pipeline đầu tiên. Liếc bảng *Needs attention* ở trên cùng — lead bị bỏ quên, phỏng vấn tuần này, việc đến hạn. |
| Add new prospects via the **＋ Add prospect** button. Minimum required: full name. Capture source, referred-by, and contact info if you have them. | Thêm khách mới bằng nút **＋ Add prospect**. Tối thiểu phải có: họ tên đầy đủ. Ghi nguồn, người giới thiệu và thông tin liên hệ nếu có. |
| For interviews: open the prospect, fill in the *Interview* section. After the interview, use the rubric to score 1–5 on each dimension. The overall score appears live. | Với phỏng vấn: mở khách, điền mục *Interview*. Sau phỏng vấn, dùng thang chấm 1–5 cho từng tiêu chí. Điểm tổng hiện trực tiếp. |
| When ready to admit: hit **✉ Send signing invitation** — see the next section. | Khi sẵn sàng kết nạp: nhấn **✉ Send signing invitation** — xem mục kế tiếp. |
| Hover any card in the kanban. You'll see three icons: **→** moves to the next stage, **✉** toggles letter-sent, **×** archives. Use these to fly through stage updates. | Di chuột lên bất kỳ thẻ nào trên kanban. Bạn sẽ thấy ba biểu tượng: **→** chuyển sang giai đoạn kế, **✉** bật/tắt đã-gửi-thư, **×** lưu trữ. Dùng chúng để cập nhật giai đoạn thật nhanh. |

## Signing loop

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Signing loop | Vòng ký kết |
| How a prospect becomes a fully Active member: send the link, they sign, status flips. | Cách một khách tiềm năng trở thành thành viên Active: gửi liên kết, họ ký, trạng thái chuyển. |
| The signing loop turns an approved prospect into a member with a signed agreement on file — automatically. You no longer need to manually convert prospects to members. | Vòng ký kết biến một khách đã duyệt thành thành viên có hợp đồng đã ký trong hồ sơ — một cách tự động. Bạn không còn phải chuyển khách thành thành viên thủ công. |
| Step by step | Từng bước |
| Open the prospect's detail page. | Mở trang chi tiết của khách. |
| In the sidebar, click **✉ Send signing invitation**. | Ở thanh bên, nhấn **✉ Send signing invitation**. |
| Pick the tier (Founding / Legacy / Pioneer / Corporate / Honorary), confirm the email (auto-detected from contact info), add mobile if you have it. | Chọn hạng (Founding / Legacy / Pioneer / Corporate / Honorary), xác nhận email (tự nhận từ thông tin liên hệ), thêm số di động nếu có. |
| Hit **Send invitation**. Behind the scenes: | Nhấn **Send invitation**. Phía sau hậu trường: |
| A `member_no` is minted (or the existing provisional one is reused). | Một `member_no` được cấp (hoặc dùng lại số tạm hiện có). |
| A `members` row is created with status `Pending Signature`. | Một dòng `members` được tạo với trạng thái `Pending Signature`. |
| A signing invitation is created with a unique link. | Một thư mời ký được tạo kèm liên kết riêng. |
| An email goes out via Resend. | Email được gửi qua Resend. |
| The prospect flips to *Application Received*. | Khách chuyển sang *Application Received*. |
| The sidebar now shows invitation status — sent date, viewed/view-count, reminder count. You can **Resend email**, **Copy link**, or **Revoke**. | Thanh bên giờ hiển thị trạng thái thư mời — ngày gửi, đã xem/số lượt xem, số lần nhắc. Bạn có thể **Resend email**, **Copy link**, hoặc **Revoke**. |
| When they sign, everything closes the loop: member flips to *Active* with today's join date, prospect flips to *Onboarded*, and a signed PDF lands in storage. | Khi họ ký, mọi thứ khép vòng: thành viên chuyển sang *Active* với ngày gia nhập là hôm nay, khách chuyển sang *Onboarded*, và một PDF đã ký được lưu vào kho. |
| The *★ Force convert without signing* override creates an Active member with no agreement on file. Only use this when a paper agreement has been signed offline and you're catching up the system. | Tùy chọn *★ Force convert without signing* tạo một thành viên Active mà không có hợp đồng trong hồ sơ. Chỉ dùng khi đã ký hợp đồng giấy ngoại tuyến và bạn đang cập nhật lại hệ thống. |

## Guardian Angel cycle (per visit)

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Guardian Angel cycle (per visit) | Chu trình Guardian Angel (mỗi lần ghé) |
| Each visit moves Overture → Accord → Continuum → Closed. This is what makes PS(t) live. | Mỗi lần ghé đi qua Overture → Accord → Continuum → Closed. Đây là điều giữ cho PS(t) luôn sống. |
| Every visit at The Rampant Club runs a four-phase cycle. The brief assembles itself before arrival, the team logs structured observations during, and a closing note feeds the next visit's brief — closing the loop the dissertation describes. | Mỗi lần ghé The Rampant Club chạy một chu trình bốn giai đoạn. Bản tóm tắt tự lắp trước khi khách đến, đội ngũ ghi nhận quan sát có cấu trúc trong lúc phục vụ, và một ghi chú kết thúc nuôi bản tóm tắt cho lần ghé sau — khép lại vòng lặp mà luận văn mô tả. |
| How to start a visit | Cách bắt đầu một lần ghé |
| The natural way: a member taps their NFC card → kiosk auto-creates the visit at phase=`overture` and routes the host to it. If they have a confirmed booking today, it's linked automatically and the booking flips to *arrived*. | Cách tự nhiên: thành viên chạm thẻ NFC → kiosk tự tạo lần ghé ở phase=`overture` và đưa người tiếp đón đến đó. Nếu hôm nay họ có đặt chỗ đã xác nhận, nó được liên kết tự động và đặt chỗ chuyển sang *arrived*. |
| The manual way: open the member profile and click **◉ Start tonight's visit →**. Or, from the calendar, click **◉ Start visit** on the booking card. | Cách thủ công: mở hồ sơ thành viên và nhấn **◉ Start tonight's visit →**. Hoặc, từ calendar, nhấn **◉ Start visit** trên thẻ đặt chỗ. |
| Overture · pre-arrival brief | Overture · bản tóm tắt trước khi đến |
| Three things, assembled live from current data: Score-5 non-negotiables (the never-get-wrong items), open **⚠ REVALIDATE** preferences (confirm these on the visit to lift R), and the last `data_for_next_overture` note from this member's previous closed visit. Click **◆ Begin Accord →** to step forward. | Ba thứ, lắp trực tiếp từ dữ liệu hiện tại: các điểm Score-5 không thể sai (những điều tuyệt đối không được nhầm), các sở thích **⚠ REVALIDATE** đang mở (xác nhận chúng trong lần ghé để nâng R), và ghi chú `data_for_next_overture` cuối cùng từ lần ghé đã đóng trước của thành viên. Nhấn **◆ Begin Accord →** để bước tiếp. |
| Accord · live observation log | Accord · nhật ký quan sát trực tiếp |
| Each observation has a category, a sentiment (Excellence / Neutral / Grievance), an optional 1–5 score, and one of three modes: | Mỗi quan sát có một danh mục, một sắc thái (Excellence / Neutral / Grievance), một điểm 1–5 tùy chọn, và một trong ba chế độ: |
| **Just an observation** — pure record, no preference touched. | **Just an observation** — chỉ ghi nhận, không động đến sở thích nào. |
| **Link to an existing preference** with Confirmed / Contradicted / Revised — fires write contract A: `validation_count` climbs, `last_validated` resets, a `validation_event` lands. Revalidation flag clears. | **Link to an existing preference** với Confirmed / Contradicted / Revised — kích hoạt write contract A: `validation_count` tăng, `last_validated` được đặt lại, một `validation_event` được ghi. Cờ revalidation được xóa. |
| **Spawn a new candidate** — sends the proposal to the candidates queue for an admin to accept (write contract B) or reject. | **Spawn a new candidate** — gửi đề xuất vào hàng chờ candidates để quản trị viên chấp nhận (write contract B) hoặc từ chối. |
| Continuum · the loop-closer | Continuum · khâu khép vòng |
| The single most important field: `data_for_next_overture`. Write the one sentence the team needs from tonight when this member walks back in. Required to close the visit. Once written, hit **◆ Mark visit closed →**. Done. | Trường quan trọng nhất: `data_for_next_overture`. Viết đúng một câu mà đội ngũ cần từ tối nay cho lần sau thành viên này quay lại. Bắt buộc phải có để đóng lần ghé. Viết xong, nhấn **◆ Mark visit closed →**. Xong. |
| Phases move forward only — overture → accord → continuum → closed. You can't skip steps or go backwards. If something was logged in error, archive the visit from the visits log. | Các giai đoạn chỉ tiến về phía trước — overture → accord → continuum → closed. Không thể bỏ bước hay lùi lại. Nếu ghi nhầm điều gì, hãy lưu trữ lần ghé từ nhật ký visits. |

## Preference candidates

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Preference candidates | Ứng viên sở thích |
| Review queue for new preferences proposed by observations and AI extractions. | Hàng chờ duyệt cho các sở thích mới do quan sát và AI đề xuất. |
| [/admin/mis/candidates](/admin/mis/candidates) is the gate between "the AI thinks this might be a preference" and "this is actually a preference." Two paths feed it: | [/admin/mis/candidates](/admin/mis/candidates) là cửa ngăn giữa "AI nghĩ đây có thể là một sở thích" và "đây thật sự là một sở thích." Hai luồng dẫn vào đây: |
| An observation during Accord flagged as "spawn a new candidate." | Một quan sát trong Accord được đánh dấu "spawn a new candidate." |
| The Harmony Log's AI extraction proposing a preference from a shift narrative. | AI của Harmony Log đề xuất một sở thích từ bản tường thuật ca làm. |
| How to review | Cách duyệt |
| Open the queue. Pending count shows at the top; default filter is pending. | Mở hàng chờ. Số lượng pending hiện ở trên; bộ lọc mặc định là pending. |
| Each card shows the suggested preference, the member, the source observation snippet (with a link back to the originating visit), and the source label. | Mỗi thẻ hiển thị sở thích được gợi ý, thành viên, đoạn quan sát nguồn (kèm liên kết về lần ghé gốc), và nhãn nguồn. |
| Click **Review** to expand and edit the name, category, S₀ / Confidence / λ / Frequency. The system snaps your values to the allowed sets if they drift outside. | Nhấn **Review** để mở rộng và chỉnh tên, danh mục, S₀ / Confidence / λ / Frequency. Hệ thống tự đưa giá trị về tập hợp lệ nếu lệch ra ngoài. |
| **Accept** fires the atomic promote RPC — the preference lands with `validation_count=1` and the candidate marks the moment it was promoted. | **Accept** kích hoạt RPC promote nguyên tử — sở thích được tạo với `validation_count=1` và ứng viên đánh dấu thời điểm được thăng. |
| **Reject** closes the candidate with no preference written. | **Reject** đóng ứng viên mà không tạo sở thích nào. |
| AI is good at suggesting; humans are still better at curating. Every preference in the member intelligence system has been through a human pass — that's what keeps PS(t) meaningful. | AI giỏi gợi ý; con người vẫn giỏi chọn lọc hơn. Mọi sở thích trong hệ thống member intelligence đều đã qua một lượt duyệt của con người — đó là điều giữ cho PS(t) có ý nghĩa. |

## Members (MIS)

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Members (MIS) | Thành viên (MIS) |
| The member roster, the PS(t) score, preferences, and revalidation. | Danh sách thành viên, điểm PS(t), sở thích, và revalidation. |
| [/admin/mis](/admin/mis) is the member intelligence dashboard. Every member has a profile showing their preferences, scoring history, and activity. The headline number is **PS(t)** — the time-decayed preference score. | [/admin/mis](/admin/mis) là bảng điều khiển member intelligence. Mỗi thành viên có một hồ sơ thể hiện sở thích, lịch sử điểm và hoạt động. Con số chủ đạo là **PS(t)** — điểm sở thích đã suy giảm theo thời gian. |
| What PS(t) means | PS(t) nghĩa là gì |
| PS(t) = S₀ × C × e^(−λt) × F × R × M, clamped 0..5. In plain English: a preference's power fades over time unless you revalidate it. A member who said "loves Bowmore" 18 months ago and hasn't reordered will have a much lower PS(t) than someone who reordered last week. | PS(t) = S₀ × C × e^(−λt) × F × R × M, giới hạn trong 0..5. Nói đơn giản: sức mạnh của một sở thích phai dần theo thời gian trừ khi bạn revalidate nó. Một thành viên nói "thích Bowmore" 18 tháng trước mà chưa gọi lại sẽ có PS(t) thấp hơn nhiều so với người vừa gọi lại tuần trước. |
| **S₀** — base strength (1–5) when the preference was first captured. | **S₀** — độ mạnh gốc (1–5) khi sở thích được ghi nhận lần đầu. |
| **C** — confidence factor (was this said directly, observed, or inferred?). | **C** — hệ số tin cậy (điều này được nói trực tiếp, quan sát được, hay suy luận ra?). |
| **λ** — decay rate. Longer-lived preferences (a love of Highland malts) decay slower than transient ones (a phase with rye). | **λ** — tốc độ suy giảm. Sở thích bền lâu (yêu thích Highland malt) phai chậm hơn sở thích nhất thời (giai đoạn mê rye). |
| **F** — frequency multiplier (how often they reorder). | **F** — hệ số tần suất (họ gọi lại thường xuyên đến đâu). |
| **R** — recency boost (last engagement). | **R** — điểm cộng theo độ gần đây (lần tương tác cuối). |
| **M** — multiplier from confirmed re-statements (revalidations). | **M** — hệ số nhân từ các lần khẳng định lại (revalidation). |
| Revalidating preferences | Revalidate sở thích |
| When a member reconfirms a preference (they ordered it again, mentioned it again, gave you new feedback), use the **Revalidate** button. This bumps R and M and refreshes the timestamp, so PS(t) climbs back up. | Khi một thành viên khẳng định lại một sở thích (gọi lại, nhắc lại, hoặc cho phản hồi mới), hãy dùng nút **Revalidate**. Việc này nâng R và M cùng làm mới mốc thời gian, nên PS(t) leo lên lại. |
| Adding preferences from interviews | Thêm sở thích từ phỏng vấn |
| During or after an interview, upload the transcript on the prospect's profile and the system extracts structured preferences using Claude. Review each extracted preference, edit if needed, accept. They land on the provisional member's profile. | Trong hoặc sau phỏng vấn, tải bản ghi lên hồ sơ của khách và hệ thống trích xuất sở thích có cấu trúc bằng Claude. Duyệt từng sở thích được trích, chỉnh nếu cần, rồi chấp nhận. Chúng sẽ xuất hiện trên hồ sơ thành viên tạm. |

## Member logins & onboarding

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Member logins & onboarding | Tài khoản thành viên & onboarding |
| Give a member their own login to the member portal — temp password, shown once, they set their own. | Cấp cho thành viên tài khoản riêng vào cổng thành viên — mật khẩu tạm, hiện một lần, họ tự đặt mật khẩu của mình. |
| A member needs a login to see the member portal (their palate, visits, gifts, the whisky library). You create it from their member record at [/admin/mis](/admin/mis) → open the member → the **Member login** panel. | Thành viên cần một tài khoản để xem cổng thành viên (khẩu vị, lần ghé, quà tặng, thư viện whisky). Bạn tạo nó từ hồ sơ thành viên tại [/admin/mis](/admin/mis) → mở thành viên → bảng **Member login**. |
| Creating a login | Tạo tài khoản |
| On the member's record, find the **Member login** panel. If they have no login yet it shows *No login yet* with a **Create member login** button. | Trong hồ sơ thành viên, tìm bảng **Member login**. Nếu họ chưa có tài khoản, bảng hiện *No login yet* kèm nút **Create member login**. |
| Click it, enter the member's **email** (their login), and hit **Create login**. | Nhấn nút đó, nhập **email** của thành viên (chính là tài khoản đăng nhập), rồi nhấn **Create login**. |
| A **temporary password** appears. **Copy it** and relay it to the member (Zalo / WhatsApp / in person). Then hit **Done — I've relayed it**. | Một **mật khẩu tạm** hiện ra. **Sao chép** và chuyển cho thành viên (Zalo / WhatsApp / trực tiếp). Sau đó nhấn **Done — I've relayed it**. |
| The member signs in at [/login](/login) with their email + the temp password, and is immediately required to set their own password before they reach anything. | Thành viên đăng nhập tại [/login](/login) bằng email + mật khẩu tạm, và bị yêu cầu đặt mật khẩu riêng ngay trước khi vào được bất cứ đâu. |
| It is generated, shown that one time, and **never stored** — you cannot look it up again. Copy and relay it when it appears. If it's lost, you'll need to reset the account rather than retrieve it. Never write it somewhere insecure. | Nó được sinh ra, hiện đúng một lần, và **không bao giờ được lưu** — bạn không thể tra lại. Hãy sao chép và chuyển ngay khi nó hiện. Nếu mất, bạn phải đặt lại tài khoản chứ không lấy lại được. Đừng bao giờ ghi nó ở nơi không an toàn. |
| A freshly-created login is forced to `/set-password` on first sign-in — it can't reach any member page until the member sets their own password. So the temp password is only ever a one-time handoff. | Tài khoản vừa tạo bị buộc đến `/set-password` ở lần đăng nhập đầu — không vào được trang thành viên nào cho đến khi đặt mật khẩu riêng. Vậy nên mật khẩu tạm chỉ là cú bàn giao một lần. |
| A member record links to a single login. If one already exists the panel shows **✓ Linked** with the email — don't create a second. | Mỗi hồ sơ thành viên liên kết với đúng một tài khoản. Nếu đã có, bảng hiện **✓ Linked** kèm email — đừng tạo cái thứ hai. |

## Lockers

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Lockers | Tủ rượu |
| Visual map of the physical locker wall. Assign members, track bottles and fill levels. | Bản đồ trực quan của tường tủ rượu thật. Gán thành viên, theo dõi chai và mức rượu còn lại. |
| [/admin/lockers](/admin/lockers) mirrors the physical wall. Each tile is a real locker; the position on the screen matches the position on the wall (row + column). | [/admin/lockers](/admin/lockers) phản chiếu tường thật. Mỗi ô là một tủ thật; vị trí trên màn hình khớp với vị trí trên tường (hàng + cột). |
| Tile colours | Màu của ô |
| {{#7AB07A:Green}} — occupied (assigned to a member). | {{#7AB07A:Xanh lá}} — đang dùng (đã gán cho một thành viên). |
| {{#D4B85A:Gold}} — reserved (held but not yet active). | {{#D4B85A:Vàng}} — đã giữ (giữ chỗ nhưng chưa kích hoạt). |
| {{#B2AA98:Muted}} — empty. | {{#B2AA98:Xám}} — trống. |
| {{#C27070:Red-tinted}} — retired (broken, removed, do not assign). | {{#C27070:Đỏ nhạt}} — ngừng dùng (hỏng, đã gỡ, không gán). |
| Assigning a locker | Gán một tủ |
| Click any empty tile. | Nhấn vào một ô trống bất kỳ. |
| In the drawer, search for the member by name or number. Click them — assignment is instant. | Trong ngăn kéo, tìm thành viên theo tên hoặc số. Nhấn vào họ — việc gán diễn ra tức thì. |
| Optionally set a custom display label (e.g. "Bowmore Society — corner"). | Tùy chọn đặt nhãn hiển thị riêng (vd. "Bowmore Society — góc"). |
| Tracking contents | Theo dõi rượu trong tủ |
| Open the locker. Scroll to *Contents*. | Mở tủ. Cuộn xuống mục *Contents*. |
| Add a bottle: name, distillery, age, ABV, fill %. | Thêm một chai: tên, nhà chưng cất, số năm, ABV, % còn lại. |
| Drag the fill slider whenever a bottle is poured down. Anything ≤ 25% shows up on the dashboard as a top-up opportunity. | Kéo thanh trượt mức rượu mỗi khi rót vơi đi. Bất cứ chai nào ≤ 25% sẽ hiện trên dashboard như một cơ hội châm thêm. |
| Use the *Notes* field for things the team should know — lock combinations, fragile glass, members who like a specific glass paired with their bottle. | Dùng trường *Notes* cho những điều đội ngũ nên biết — mã khóa, ly dễ vỡ, thành viên thích một loại ly riêng đi kèm chai của họ. |

## Member cards (NFC)

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Member cards (NFC) | Thẻ thành viên (NFC) |
| Linking physical NFC cards to member profiles. | Liên kết thẻ NFC vật lý với hồ sơ thành viên. |
| [/admin/cards](/admin/cards) is where physical NFC cards get bound to member records. Once linked, a tap at any kiosk pulls up the member instantly. | [/admin/cards](/admin/cards) là nơi gắn thẻ NFC vật lý với hồ sơ thành viên. Sau khi liên kết, một cú chạm tại bất kỳ kiosk nào sẽ mở hồ sơ thành viên ngay lập tức. |
| Open the card admin page. | Mở trang quản trị thẻ. |
| Tap a fresh card at the kiosk (it shows up as orphaned). | Chạm một thẻ mới tại kiosk (nó hiện ra dạng orphaned — chưa gắn). |
| From the admin page, link it to the right member by selecting them. | Từ trang quản trị, liên kết nó với đúng thành viên bằng cách chọn họ. |
| Cards carry stored credit (in VND). Top-ups happen via the transaction endpoint; the kiosk shows current balance after every tap. | Thẻ mang số dư lưu sẵn (bằng VND). Việc nạp thêm diễn ra qua endpoint giao dịch; kiosk hiển thị số dư hiện tại sau mỗi lần chạm. |

## Tonight

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Tonight | Tonight |
| Pre-shift brief: who is coming in, what they prefer, what to remember. | Bản tóm tắt trước ca: ai sẽ đến, họ thích gì, cần nhớ điều gì. |
| [/admin/tonight](/admin/tonight) is the manager's first stop of the evening. Bookings cross-referenced with member intelligence: top preferences, last-visit notes, birthday/anniversary flags. | [/admin/tonight](/admin/tonight) là điểm dừng đầu tiên của quản lý mỗi tối. Đặt chỗ được đối chiếu với member intelligence: sở thích nổi bật, ghi chú lần ghé trước, cờ sinh nhật/kỷ niệm. |
| How to use it | Cách dùng |
| Print or screen-mirror to the back-of-house monitor. | In ra hoặc chiếu lên màn hình khu vực hậu cần. |
| Brief the team — call out anyone with a milestone, anyone with an open complaint, anyone the GM has asked the team to give special attention. | Dặn dò đội ngũ — nêu tên ai có dấu mốc, ai có khiếu nại còn mở, ai được GM yêu cầu quan tâm đặc biệt. |
| After service, jot any new preferences or notes against the member. | Sau khi phục vụ, ghi lại sở thích hoặc ghi chú mới cho thành viên. |

## Calendar & bookings

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Calendar & bookings | Lịch & đặt chỗ |
| Who's coming in, which room and table, when. Member bookings and house entries both live here. | Ai đến, phòng nào và bàn nào, khi nào. Cả đặt chỗ của thành viên lẫn mục nội bộ đều ở đây. |
| [/admin/calendar](/admin/calendar) is the weekly grid — day columns, today highlighted. Filter by space (Library Bar / The Studio / The Rampant Room / The Dining Room / Source & Origin Lab). Each card shows the member, party size, time or session, the booked **table(s)**, and any notes. | [/admin/calendar](/admin/calendar) là lưới theo tuần — cột theo ngày, hôm nay được tô sáng. Lọc theo không gian (Library Bar / The Studio / The Rampant Room / The Dining Room / Source & Origin Lab). Mỗi thẻ hiển thị thành viên, số khách, giờ hoặc phiên, **bàn** đã đặt, và ghi chú. |
| Booking a member in | Đặt chỗ cho một thành viên |
| Hit **＋ New booking** at the top-right of the calendar. The form opens on the **Member booking** tab. | Nhấn **＋ New booking** ở góc trên bên phải của lịch. Biểu mẫu mở ở tab **Member booking**. |
| Pick the member (autocomplete from the roster) and the date. Set **either** a precise start time **or** a session (early / evening / late) — both is fine. Set the party size. | Chọn thành viên (gợi ý tự động từ danh sách) và ngày. Đặt **hoặc** giờ bắt đầu cụ thể **hoặc** một phiên (early / evening / late) — cả hai cũng được. Đặt số khách. |
| Pick the **Room**. The **Tables** picker below then shows every table in that room with its seat count. | Chọn **Room**. Bộ chọn **Tables** bên dưới sẽ hiện mọi bàn trong phòng đó kèm số chỗ ngồi. |
| Tap the table(s) for this party. The running counter reads `N seats selected · party M` — the seats must cover the party. A six-top can't sit on a single four-seat table; add a second table or pick a bigger one. | Chạm chọn (các) bàn cho nhóm này. Bộ đếm hiện `N seats selected · party M` — số chỗ phải đủ cho số khách. Nhóm sáu người không thể ngồi một bàn bốn chỗ; hãy thêm bàn thứ hai hoặc chọn bàn lớn hơn. |
| If the member has an email on file, optionally tick **Send confirmation email to the member** (Resend). No email → the checkbox disables itself and tells you. | Nếu thành viên có email trong hồ sơ, tùy chọn tích **Send confirmation email to the member** (Resend). Không có email → ô tích tự khóa và báo cho bạn. |
| Save → back to the calendar with the booking on the right day, showing its table(s). | Lưu → quay lại lịch với đặt chỗ ở đúng ngày, hiển thị (các) bàn của nó. |
| The tables, room by room | Các bàn, theo từng phòng |
| **Library Bar** — Bookcase Table (4), Window Table (4), the **Sofa** (book it *whole* for up to 8, or as its three segments — left 3, middle 2, right 3), and six Bar Stools (1 each). | **Library Bar** — Bookcase Table (4), Window Table (4), chiếc **Sofa** (đặt *nguyên* tối đa 8 người, hoặc theo ba đoạn — trái 3, giữa 2, phải 3), và sáu Bar Stool (mỗi cái 1). |
| **The Studio** — book it *whole* (the big table, seats 6), or as three tables of 2 (A / B / C). | **The Studio** — đặt *nguyên* (bàn lớn, 6 chỗ), hoặc theo ba bàn 2 chỗ (A / B / C). |
| **The Rampant Room** — four independent tables: Table 1 & 2 (6 each), Table 3 & 4 (4 each). | **The Rampant Room** — bốn bàn độc lập: Table 1 & 2 (mỗi bàn 6), Table 3 & 4 (mỗi bàn 4). |
| **The Dining Room** and **Source & Origin Lab** — one whole-room unit each; booking it takes the whole room (exclusive). | **The Dining Room** và **Source & Origin Lab** — mỗi nơi là một đơn vị nguyên phòng; đặt là lấy trọn phòng (độc quyền). |
| Booking the **whole Sofa** blocks its three segments, and booking **any segment** blocks the whole Sofa — but the segments are independent of each other (left, middle and right can be three different parties). Same for the Studio (whole vs A / B / C). The bar stools and the room's other tables stay free regardless. | Đặt **nguyên Sofa** sẽ khóa ba đoạn của nó, và đặt **bất kỳ đoạn nào** sẽ khóa nguyên Sofa — nhưng các đoạn độc lập với nhau (trái, giữa, phải có thể là ba nhóm khác nhau). Studio cũng vậy (nguyên bàn so với A / B / C). Ghế bar và các bàn khác trong phòng vẫn trống bình thường. |
| A table shows **greyed and unselectable** when it's already booked for that time, or when it conflicts with what you've already picked (the either-or). If a save is refused as *unavailable*, that table was taken for the window — pick another table or time. The system will not let you double-book a table. | Một bàn hiện **mờ và không chọn được** khi đã có người đặt cho khung giờ đó, hoặc khi nó xung đột với lựa chọn của bạn (quy tắc một-hoặc-kia). Nếu lưu bị từ chối là *unavailable*, bàn đó đã được giữ cho khung giờ — chọn bàn hoặc giờ khác. Hệ thống sẽ không cho đặt trùng một bàn. |
| Tap-to-start | Chạm-để-bắt-đầu |
| When a member taps their NFC card at the kiosk, the system: (1) creates a visit at phase=`overture` with arrival_time stamped, (2) if exactly one confirmed booking exists for them today, links it and flips the booking to *arrived*, (3) routes the host straight into the Guardian Angel detail page. Walk-ins work the same way — no booking link, but the cycle starts cleanly. | Khi thành viên chạm thẻ NFC tại kiosk, hệ thống: (1) tạo một lần ghé ở phase=`overture` với arrival_time được đóng dấu, (2) nếu hôm nay họ có đúng một đặt chỗ đã xác nhận, liên kết nó và chuyển đặt chỗ sang *arrived*, (3) đưa người tiếp đón thẳng vào trang chi tiết Guardian Angel. Khách vãng lai cũng vậy — không có liên kết đặt chỗ, nhưng chu trình vẫn bắt đầu gọn gàng. |
| From the calendar itself, today's confirmed/pending booking cards show a **◉ Start visit** button that does the same thing (member_no path instead of card_uid). | Ngay trên lịch, các thẻ đặt chỗ confirmed/pending của hôm nay có nút **◉ Start visit** làm điều tương tự (theo member_no thay vì card_uid). |
| If a member has more than one confirmed booking today (e.g. dinner then drinks), the tap-to-start skips the auto-link — staff resolves which booking the arrival applies to from the calendar. | Nếu một thành viên có nhiều hơn một đặt chỗ đã xác nhận trong hôm nay (vd. ăn tối rồi uống), chạm-để-bắt-đầu sẽ bỏ qua tự liên kết — nhân viên tự chọn lần đến này ứng với đặt chỗ nào trên lịch. |
| House entries — closures, hires & visits | Mục nội bộ — đóng cửa, thuê riêng & khách ghé |
| For anything that isn't a member booking — a closure, a private hire, a supplier or distiller visit, a tasting — use the **House / non-member entry** tab on the same **＋ New booking** form. Give it a title, a kind (closure / private hire / supplier / tasting / other), a date, and optionally a time and room. | Với bất cứ điều gì không phải đặt chỗ của thành viên — đóng cửa, thuê riêng, nhà cung cấp hoặc nhà chưng cất ghé thăm, một buổi nếm thử — dùng tab **House / non-member entry** trên cùng biểu mẫu **＋ New booking**. Đặt tiêu đề, loại (closure / private hire / supplier / tasting / other), ngày, và tùy chọn giờ cùng phòng. |
| Every house entry has a **Visibility**. **Member-visible (shows on member events)** means members see it on their events page — e.g. "Club closed tonight". **Staff-only (members never see it)** is invisible to members — e.g. "Private hire for the Nguyen party". When in doubt — anything members shouldn't see — choose staff-only. | Mỗi mục nội bộ có một **Visibility**. **Member-visible (shows on member events)** nghĩa là thành viên thấy nó trên trang sự kiện — vd. "Câu lạc bộ đóng cửa tối nay". **Staff-only (members never see it)** thì thành viên không thấy — vd. "Thuê riêng cho nhóm nhà Nguyễn". Khi phân vân — bất cứ điều gì thành viên không nên thấy — chọn staff-only. |
| Tick **Closes the room** and the entry blocks member bookings for that window. With **no tables picked**, the whole room closes. **Pick specific tables** and only those are blocked — a private hire of just the Sofa leaves the rest of the bar bookable. Leave "closes the room" off for something purely informational, like a distiller visit that doesn't take the space. | Tích **Closes the room** thì mục này sẽ khóa việc đặt chỗ của thành viên trong khung giờ đó. **Không chọn bàn nào** → cả phòng đóng. **Chọn bàn cụ thể** → chỉ những bàn đó bị khóa — thuê riêng mỗi chiếc Sofa thì phần còn lại của quầy bar vẫn đặt được. Bỏ trống "closes the room" cho những việc chỉ mang tính thông báo, như một nhà chưng cất ghé thăm mà không chiếm chỗ. |

## Shift checklists

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Shift checklists | Danh sách kiểm ca |
| Opening and closing sheets. Tick as you go; sign off at the end. | Phiếu mở ca và đóng ca. Tích khi làm; ký xác nhận khi xong. |
| [/admin/checklists](/admin/checklists) holds the day's opening and closing sheets side by side. The opening sheet is what the morning team works through; the closing sheet is what the night team finishes the day with. Both feed the MX Daily handover. | [/admin/checklists](/admin/checklists) đặt phiếu mở ca và đóng ca cạnh nhau. Phiếu mở ca là thứ đội buổi sáng làm theo; phiếu đóng ca là thứ đội buổi tối kết thúc ngày. Cả hai cùng nuôi phần bàn giao MX Daily. |
| How to use a sheet | Cách dùng một phiếu |
| Type your initials in the field at the top-right of the page. Stored in your browser so you only do this once. | Nhập tên viết tắt của bạn vào ô góc trên bên phải trang. Được lưu trong trình duyệt nên chỉ làm một lần. |
| Tick each item as you complete it. Your initials and a timestamp are captured automatically. | Tích từng mục khi hoàn thành. Tên viết tắt và mốc thời gian được ghi tự động. |
| Write anything for the next team in **Notes for the handover**. This is the part Miss Châu reads on the MX Daily page in the morning. | Ghi mọi điều cho đội kế tiếp vào **Notes for the handover**. Đây là phần Miss Châu đọc trên trang MX Daily vào buổi sáng. |
| At the end of the shift, hit **Lock & sign**. The sheet is sealed, the locking person is recorded, and the sheet renders read-only. | Cuối ca, nhấn **Lock & sign**. Phiếu được niêm, người khóa được ghi lại, và phiếu chuyển sang chỉ-đọc. |
| Editing the item list | Chỉnh danh sách mục |
| Items live in `lib/checklist-templates.ts`. Engineers can rename, add or remove items there; existing checklists keep whatever they already recorded. New items appear on every future day's sheet automatically. | Các mục nằm trong `lib/checklist-templates.ts`. Kỹ sư có thể đổi tên, thêm hoặc bớt mục ở đó; các phiếu đã có vẫn giữ những gì đã ghi. Mục mới tự xuất hiện trên phiếu của mọi ngày sau. |
| The most recent closing sheet's handover note surfaces at the top of [/admin/mx-daily](/admin/mx-daily). Miss Châu opens MX Daily first thing; reading the closing handover is part of her day-one ritual. | Ghi chú bàn giao của phiếu đóng ca gần nhất hiện lên đầu [/admin/mx-daily](/admin/mx-daily). Miss Châu mở MX Daily đầu tiên; đọc bàn giao đóng ca là một phần nếp làm việc mỗi ngày của cô. |

## Harmony Log

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Harmony Log | Harmony Log |
| End-of-shift narrative. Type what happened; Claude proposes structured updates. | Bản tường thuật cuối ca. Gõ những gì đã diễn ra; Claude đề xuất các cập nhật có cấu trúc. |
| [/admin/harmony](/admin/harmony) is where the team closes out a shift. You type one paragraph about the night — names, drinks, conversations, complaints, walk-ins, charges — and Claude reads it back and proposes a list of structured updates. You tick what to keep, hit Apply, and everything fans out to the right MIS tables. | [/admin/harmony](/admin/harmony) là nơi đội ngũ khép lại một ca. Bạn gõ một đoạn về buổi tối — tên, đồ uống, cuộc trò chuyện, khiếu nại, khách vãng lai, khoản tính tiền — và Claude đọc lại rồi đề xuất một danh sách cập nhật có cấu trúc. Bạn tích những gì muốn giữ, nhấn Apply, và mọi thứ tỏa về đúng các bảng MIS. |
| Daily flow | Quy trình hằng ngày |
| End of shift, open [/admin/harmony/new](/admin/harmony/new). | Cuối ca, mở [/admin/harmony/new](/admin/harmony/new). |
| Fill the shift metadata (date is pre-filled to today; pick early / evening / late / all-day). | Điền thông tin ca (ngày đã điền sẵn là hôm nay; chọn early / evening / late / all-day). |
| Type the narrative. Be specific with names and drinks. Don't worry about format — write like you'd brief the GM in person. | Gõ bản tường thuật. Cụ thể về tên và đồ uống. Đừng lo định dạng — viết như khi bạn báo cáo trực tiếp với GM. |
| Hit **Save & Process**. You land on the detail page and the extraction stream kicks off automatically. | Nhấn **Save & Process**. Bạn vào trang chi tiết và luồng trích xuất tự khởi động. |
| Review the checklist on the right. Each row shows the proposed update — a tier, an icon, the member hint, and a one-line summary. Untick anything you don't want; click × to reject. | Duyệt danh sách bên phải. Mỗi dòng hiện cập nhật được đề xuất — một cấp, một biểu tượng, gợi ý thành viên, và tóm tắt một dòng. Bỏ tích những gì không muốn; nhấn × để từ chối. |
| Hit **Apply N →**. Accepted rows fan out into the live tables. | Nhấn **Apply N →**. Các dòng được chấp nhận tỏa vào các bảng thật. |
| What Claude proposes | Claude đề xuất những gì |
| **Visits** — one row per identified member, written to `visits` at `phase='accord'` so they enter the Guardian Angel lifecycle. Open the visit detail to add a `data_for_next_overture` note and close out. | **Visits** — một dòng cho mỗi thành viên nhận diện được, ghi vào `visits` ở `phase='accord'` để bước vào vòng đời Guardian Angel. Mở chi tiết lần ghé để thêm ghi chú `data_for_next_overture` và đóng lại. |
| **Preferences** — bottles loved, requested, asked about → land in `preference_candidates` for a human review pass. Accepted ones become real preferences via [/admin/mis/candidates](/admin/mis/candidates). | **Preferences** — chai được yêu thích, được yêu cầu, được hỏi đến → vào `preference_candidates` để qua một lượt duyệt của con người. Những cái được chấp nhận thành sở thích thật qua [/admin/mis/candidates](/admin/mis/candidates). |
| **Bottle pours** — depletes a bottle in the member's locker. "finished" → 0%; otherwise drops one quarter unless you specify a fill. | **Bottle pours** — làm vơi một chai trong tủ của thành viên. "finished" → 0%; nếu không sẽ giảm một phần tư trừ khi bạn chỉ định mức. |
| **Prospects** — walk-ins mentioned as potential members. Mints a new P-xxx at the Lead stage, links the referrer if hinted. | **Prospects** — khách vãng lai được nhắc đến như thành viên tiềm năng. Cấp một P-xxx mới ở giai đoạn Lead, liên kết người giới thiệu nếu có gợi ý. |
| **Complaints** — friction items. If the narrative says "we fixed it", they're marked resolved on the spot. | **Complaints** — các điểm vướng. Nếu bản tường thuật nói "đã xử lý", chúng được đánh dấu giải quyết ngay. |
| **Card charges** — explicit amounts charged tonight. Inserts into `card_transactions` and decrements the live balance. | **Card charges** — các khoản tính tiền cụ thể trong tối nay. Chèn vào `card_transactions` và trừ vào số dư hiện tại. |
| The team writes names how they normally would ("Smith", "Tran", "Sarah"). The apply step matches them against the live roster. If exactly one member matches, the update goes through. If zero or many match, the row is marked *failed* with the reason — open the log to see why and fix manually. | Đội ngũ viết tên như bình thường ("Smith", "Trần", "Sarah"). Bước apply khớp chúng với danh sách thật. Nếu khớp đúng một thành viên, cập nhật đi qua. Nếu khớp không ai hoặc nhiều người, dòng bị đánh dấu *failed* kèm lý do — mở nhật ký để xem vì sao và sửa thủ công. |
| Hitting **↻ Re-process** wipes the pending extractions (already-applied rows are preserved) and re-runs Claude on the same narrative. Useful if you edit the narrative after seeing what was missed. | Nhấn **↻ Re-process** xóa các trích xuất đang chờ (các dòng đã apply được giữ nguyên) và chạy lại Claude trên cùng bản tường thuật. Hữu ích nếu bạn sửa bản tường thuật sau khi thấy còn sót gì. |

## MX Daily

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| MX Daily | MX Daily |
| The Member Experience Manager's daily checklist — birthdays, lapsed members, complaints. | Danh sách hằng ngày của Member Experience Manager — sinh nhật, thành viên thưa vắng, khiếu nại. |
| [/admin/mx-daily](/admin/mx-daily) bundles the Member Experience Manager's four daily checks into one screen: | [/admin/mx-daily](/admin/mx-daily) gom bốn việc kiểm tra hằng ngày của Member Experience Manager vào một màn hình: |
| **Tonight's brief** — abridged version of the Tonight page. | **Tonight's brief** — bản rút gọn của trang Tonight. |
| **Birthdays + milestones** — anyone with a birthday this week or hitting an N-year membership anniversary. | **Birthdays + milestones** — ai có sinh nhật tuần này hoặc chạm mốc kỷ niệm N năm thành viên. |
| **Lapsed radar** — Active members who haven't visited in 30/60/90 days. | **Lapsed radar** — thành viên Active chưa ghé trong 30/60/90 ngày. |
| **Complaint queue** — anything flagged as friction in the last 14 days. | **Complaint queue** — bất cứ điều gì bị đánh dấu là vướng mắc trong 14 ngày qua. |
| Pair this with the morning coffee. Anything flagged should generate one specific action by end of day — a card, a call, a comp pour at next visit. | Kết hợp việc này với ly cà phê buổi sáng. Bất cứ điều gì được đánh dấu nên dẫn tới một hành động cụ thể trước cuối ngày — một tấm thiệp, một cuộc gọi, một ly mời ở lần ghé tới. |

## Journal & house notes

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Journal & house notes | Nhật ký & ghi chú nội bộ |
| Where culture, decisions, and stories get written down. | Nơi văn hóa, quyết định và câu chuyện được ghi lại. |
| [/admin/journal](/admin/journal) is the cultural ledger. Capture what happened, decisions made, member stories. It is not a transactional log — that's what activity timelines are for. The journal is for the things future-us will want to remember about who we were. | [/admin/journal](/admin/journal) là sổ ghi văn hóa. Ghi lại những gì đã xảy ra, quyết định đã đưa ra, câu chuyện của thành viên. Đây không phải nhật ký giao dịch — đó là việc của dòng thời gian hoạt động. Nhật ký dành cho những điều mà chúng ta của tương lai sẽ muốn nhớ về con người mình từng là. |

## Gifting · Unreasonable Hospitality

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Gifting · Unreasonable Hospitality | Quà tặng · Unreasonable Hospitality |
| 10–15% of each member’s dues earmarked for thoughtful, invisible love. | 10–15% phí của mỗi thành viên được dành riêng cho sự quan tâm chu đáo, thầm lặng. |
| The principle: every member quietly carries a gifting budget — a percentage of what they pay us each year, set aside to surprise them. Birthday card with a bottle, dining experience after a difficult quarter, thank-you for a referral that mattered. The team logs what was given, why, and at what cost. The budget runs anniversary to anniversary so a year of nothing followed by a sudden splurge is visible. | Nguyên tắc: mỗi thành viên âm thầm mang một ngân sách quà tặng — một phần trăm số tiền họ trả mỗi năm, để dành tạo bất ngờ cho họ. Một tấm thiệp sinh nhật kèm một chai rượu, một trải nghiệm ẩm thực sau một quý khó khăn, một lời cảm ơn cho một lượt giới thiệu có ý nghĩa. Đội ngũ ghi lại đã tặng gì, vì sao, và chi phí bao nhiêu. Ngân sách chạy từ kỷ niệm này đến kỷ niệm kế, nên một năm không có gì rồi đột ngột chi đậm sẽ lộ rõ. |
| Setting the budget | Đặt ngân sách |
| [/admin/tier-budgets](/admin/tier-budgets) — one row per tier with annual dues and a gifting percentage. Multiply them together and you get the per-member annual budget. The founder/GM owns this page; dial 10→15% when calibrating the "invisible love" cap. | [/admin/tier-budgets](/admin/tier-budgets) — mỗi hạng một dòng với phí năm và phần trăm dành cho quà. Nhân chúng với nhau ra ngân sách năm cho mỗi thành viên. Trang này thuộc về nhà sáng lập/GM; chỉnh 10→15% khi hiệu chỉnh mức trần của "tình cảm thầm lặng". |
| Logging a gift | Ghi một món quà |
| Open [/admin/gifts](/admin/gifts) and hit **＋ Log a gift**. | Mở [/admin/gifts](/admin/gifts) và nhấn **＋ Log a gift**. |
| Pick the member, the date, the occasion (birthday / anniversary / thoughtful / apology / recovery / dining moment / referral thanks / other), the category (bottle / experience / dining / etc.), and the cost in VND. | Chọn thành viên, ngày, dịp (birthday / anniversary / thoughtful / apology / recovery / dining moment / referral thanks / other), danh mục (bottle / experience / dining / v.v.), và chi phí bằng VND. |
| Write the gift description, the source (vendor name if applicable), and — most important — **why we did this**. The dissertation calls this the "expected value" field. It's the receipt against the loyalty case. | Viết mô tả món quà, nguồn (tên nhà cung cấp nếu có), và — quan trọng nhất — **vì sao ta làm điều này**. Luận văn gọi đây là trường "expected value". Đó là biên nhận cho bài toán lòng trung thành. |
| Optionally upload a photo. Pick a member first to enable upload; the file goes to the private `gift-photos` bucket and a signed read URL is generated when the ledger displays it. | Tùy chọn tải ảnh lên. Chọn thành viên trước để bật tải lên; tệp vào bucket riêng `gift-photos` và một URL đọc có chữ ký được tạo khi sổ hiển thị nó. |
| Where it shows up | Nó hiện ra ở đâu |
| **The ledger itself** — org-wide list with filters by occasion. A red "unloved members" banner surfaces anyone with budget but no gift this cycle — the alarm bell. | **Chính cuốn sổ** — danh sách toàn tổ chức với bộ lọc theo dịp. Một dải đỏ "unloved members" nêu lên ai còn ngân sách nhưng chưa có quà trong kỳ này — chuông báo động. |
| **MX Daily anniversaries panel** — each anniversary row shows a tiny progress bar: how much of that member's annual budget is spent, with the bar going red if they've had zero gifts. Miss Châu sees at a glance who's overdue for a touch. | **Bảng kỷ niệm MX Daily** — mỗi dòng kỷ niệm hiện một thanh tiến độ nhỏ: đã tiêu bao nhiêu ngân sách năm của thành viên đó, thanh chuyển đỏ nếu họ chưa nhận quà nào. Miss Châu nhìn một cái là biết ai đã quá hạn được quan tâm. |
| **Member profile** — coming soon: per-member gifting history with the same budget view. | **Hồ sơ thành viên** — sắp có: lịch sử quà tặng theo từng thành viên với cùng góc nhìn ngân sách. |
| The member never sees this page. The point is that the team can track and budget the "random, thoughtful gifting" principle systematically, so it actually happens, evenly, across every member, every year. | Thành viên không bao giờ thấy trang này. Điểm mấu chốt là đội ngũ có thể theo dõi và lập ngân sách cho nguyên tắc "tặng quà ngẫu nhiên, chu đáo" một cách hệ thống, để nó thật sự diễn ra, đều đặn, cho mọi thành viên, mỗi năm. |

## Whisky tools

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Whisky tools | Công cụ whisky |
| Match a member to a dram — Suggest a pour, the Flavour Finder, the flavour radar. | Ghép một thành viên với một ly rượu — Suggest a pour, Flavour Finder, biểu đồ radar hương vị. |
| A set of tools for putting the right whisky in front of a member, all grounded in the club's flavour data (the 13-family taxonomy) rather than guesswork. | Một bộ công cụ để đặt đúng chai whisky trước mặt thành viên, tất cả dựa trên dữ liệu hương vị của câu lạc bộ (hệ phân loại 13 nhóm) thay vì phỏng đoán. |
| Suggest a pour | Suggest a pour |
| On a member's record ([/admin/mis](/admin/mis) → open the member) there's a **Suggest a pour** panel. Hit **◆ Suggest →** and it recommends bottles from that member's own taste profile. If their palate isn't mapped yet, you can tap a flavour shape and suggest from that instead — it always recommends from real bottles in the library, never invents one. | Trong hồ sơ một thành viên ([/admin/mis](/admin/mis) → mở thành viên) có bảng **Suggest a pour**. Nhấn **◆ Suggest →** và nó gợi ý các chai dựa trên hồ sơ khẩu vị của chính thành viên đó. Nếu khẩu vị của họ chưa được lập, bạn có thể chạm chọn một hình dạng hương vị và gợi ý từ đó — nó luôn gợi ý từ các chai có thật trong thư viện, không bao giờ bịa ra. |
| Flavour Finder & the radar | Flavour Finder & biểu đồ radar |
| The [Flavour Finder](/members/whisky/finder) matches a dram to a described taste — members can self-serve it, or you can run it with them. Each bottle in the [Whisky Library](/members/whisky) has a **flavour radar** showing its profile across the families — a quick visual of whether a bottle is, say, peaty and coastal or sweet and sherried. | [Flavour Finder](/members/whisky/finder) ghép một ly rượu với khẩu vị được mô tả — thành viên có thể tự dùng, hoặc bạn cùng làm với họ. Mỗi chai trong [Whisky Library](/members/whisky) có một **biểu đồ radar hương vị** thể hiện hồ sơ của nó qua các nhóm — một hình ảnh nhanh cho biết một chai là, chẳng hạn, khói than và mặn biển hay ngọt và sherry. |
| A member unsure what to drink, or a guest you don't know well — open their record and hit Suggest a pour, or run the Finder together. It turns "what do you fancy?" into two or three confident, on-taste options. | Một thành viên chưa biết uống gì, hoặc một vị khách bạn chưa hiểu rõ — mở hồ sơ của họ và nhấn Suggest a pour, hoặc cùng dùng Finder. Nó biến câu "bạn thích gì?" thành hai hoặc ba lựa chọn tự tin, đúng gu. |

## What members see

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| What members see | Thành viên thấy những gì |
| The member portal — so you can guide a member and know the boundaries. | Cổng thành viên — để bạn hướng dẫn thành viên và biết giới hạn. |
| Members with a login (see **Member logins & onboarding**) have their own portal. Knowing what's there helps you answer their questions. | Thành viên có tài khoản (xem **Member logins & onboarding**) có cổng riêng của họ. Biết những gì ở đó giúp bạn trả lời câu hỏi của họ. |
| The **Whisky Library** — the bottles as an A–Z shelf, searchable, each with its flavour radar; and the **Flavour Finder**. | **Whisky Library** — các chai dưới dạng kệ A–Z, tìm kiếm được, mỗi chai kèm biểu đồ radar hương vị; và **Flavour Finder**. |
| For an onboarded member, their **own** personal layer: their **palate** (a written taste summary + radar), their **visits**, and **gifts** they've received from the club. | Với một thành viên đã onboard, lớp cá nhân **của riêng** họ: **khẩu vị** (một bản tóm tắt khẩu vị bằng chữ + radar), các **lần ghé**, và **quà tặng** họ đã nhận từ câu lạc bộ. |
| Events & notices (including member-visible house entries), fixtures, spaces, the menus, house rules. | Sự kiện & thông báo (bao gồm các mục nội bộ được hiển thị cho thành viên), lịch thi đấu, không gian, thực đơn, nội quy. |
| A member sees **only their own** data — never another member's taste, visits or gifts. And members **can't book themselves** — booking is staff-only, so if a member wants a table they ask you, and you book it on the calendar. | Một thành viên chỉ thấy dữ liệu **của riêng họ** — không bao giờ thấy khẩu vị, lần ghé hay quà tặng của thành viên khác. Và thành viên **không thể tự đặt chỗ** — đặt chỗ chỉ do nhân viên làm, nên nếu một thành viên muốn một bàn họ sẽ nhờ bạn, và bạn đặt trên lịch. |

## Troubleshooting

| English | Tiếng Việt (sửa nếu cần) |
|---|---|
| Troubleshooting | Xử lý sự cố |
| Things that look broken but usually are not. | Những thứ trông như hỏng nhưng thường thì không. |
| I sent an invitation but no email arrived | Tôi đã gửi thư mời nhưng không có email nào đến |
| Check the invitation status pill on the prospect's profile. If it says "sent" but the recipient didn't get it, look for the link via **Copy link** and share it manually. Resend can be slow during high-volume periods; check spam too. If a different error appears in the activity log, escalate to the engineer. | Kiểm tra nhãn trạng thái thư mời trên hồ sơ của khách. Nếu nó ghi "sent" mà người nhận không nhận được, lấy liên kết qua **Copy link** và gửi thủ công. Resend có thể chậm vào lúc cao điểm; kiểm tra cả hộp spam. Nếu một lỗi khác hiện trong nhật ký hoạt động, chuyển cho kỹ sư. |
| A kiosk tap shows "orphaned" | Một cú chạm kiosk hiện "orphaned" |
| The card has never been linked to a member. Open [/admin/cards](/admin/cards), find the orphan, link it. | Thẻ chưa bao giờ được liên kết với thành viên. Mở [/admin/cards](/admin/cards), tìm thẻ orphan, liên kết nó. |
| A prospect's PS(t) is locked at 0 | PS(t) của một khách bị kẹt ở 0 |
| They have no preferences captured yet, or all preferences are archived. Open the profile, add or revalidate at least one preference. | Họ chưa có sở thích nào được ghi nhận, hoặc mọi sở thích đã được lưu trữ. Mở hồ sơ, thêm hoặc revalidate ít nhất một sở thích. |
| Lockers wall is empty | Tường tủ rượu trống trơn |
| The grid needs to be seeded. Click **＋ Seed grid** on the Lockers page and tell it your rows × cols. Existing assignments are preserved. | Lưới cần được khởi tạo. Nhấn **＋ Seed grid** trên trang Lockers và nhập số hàng × cột. Các phần đã gán được giữ nguyên. |
