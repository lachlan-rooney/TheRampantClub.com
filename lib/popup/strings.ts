// ═══════════════════════════════════════════════════════════════════════════
// EVERY WORD THE POP-UP SAYS — one table, both languages, in the order a guest
// meets them.
// ───────────────────────────────────────────────────────────────────────────
// The same shape as lib/studio/auction: one file, so the Vietnamese review
// screen can list every string and prove none was missed, and so a sentence
// cannot be written twice in two places and drift.
//
// ⚠ THE VIETNAMESE IS A DRAFT until a native speaker has read it. It is marked
// as such in the admin. The English is the club's.
//
// ⚠ WRITTEN TO BE READ STANDING UP, by somebody holding a drink, on a tablet
// at arm's length. Short lines. No sentence that needs reading twice.
// ═══════════════════════════════════════════════════════════════════════════

export type Lang = 'en' | 'vn'

export const POPUP_STRINGS = {
  // ── Screen 1 · choose a session ─────────────────────────────────────────
  k_title:      { en: 'Join us for a session', vn: 'Tham dự một lượt' },
  k_lead:       { en: 'Choose a time. Each one lasts {n} minutes.',
                  vn: 'Chọn giờ. Mỗi lượt kéo dài {n} phút.' },
  k_places_one: { en: '1 place left', vn: 'còn 1 chỗ' },
  k_places:     { en: '{n} places left', vn: 'còn {n} chỗ' },
  k_full:       { en: 'Full', vn: 'Hết chỗ' },
  k_waitlist:   { en: 'Full — join the waiting list', vn: 'Hết chỗ — vào danh sách chờ' },
  k_none_left:  { en: 'No more sessions tonight.', vn: 'Tối nay không còn lượt nào.' },
  // On a phone the nine sessions are split in two — the ones with room, then
  // the full ones under this line. The tag marks the soonest time that can
  // actually be given away, which is the tile a thumb lands on first.
  k_soonest:    { en: 'Soonest', vn: 'Sớm nhất' },
  k_full_heading: { en: 'Full — waiting list only', vn: 'Hết chỗ — chỉ còn danh sách chờ' },
  k_paused:     { en: 'Bookings are paused for a moment. Please ask a member of staff.',
                  vn: 'Việc đăng ký đang tạm dừng. Vui lòng hỏi nhân viên.' },

  // ── Screen 2 · who ──────────────────────────────────────────────────────
  k_your_details: { en: 'Your details', vn: 'Thông tin của bạn' },
  k_name:       { en: 'Name', vn: 'Tên' },
  k_email:      { en: 'Email', vn: 'Email' },
  k_email_hint: { en: 'For your ticket. Not needed to come in.',
                  vn: 'Để gửi vé. Không bắt buộc để vào.' },
  k_party:      { en: 'How many of you?', vn: 'Bao nhiêu người?' },
  k_party_one:  { en: 'Just me', vn: 'Một mình' },
  k_party_n:    { en: '{n} people', vn: '{n} người' },
  k_back:       { en: 'Back', vn: 'Quay lại' },
  k_next:       { en: 'Next', vn: 'Tiếp' },

  // ── Screen 3 · check, then confirm ──────────────────────────────────────
  // ⚠ THE EMAIL IS SHOWN BACK IN LARGE TYPE. A tablet in a crowd produces
  // typos, and this is the only moment to catch one — but it NEVER blocks the
  // booking, because a wrong address must not cost a guest their place.
  k_check:      { en: 'Is this right?', vn: 'Đã đúng chưa?' },
  k_check_email:{ en: 'We will send your ticket here.', vn: 'Chúng tôi sẽ gửi vé đến đây.' },
  k_confirm:    { en: 'Confirm my place', vn: 'Xác nhận chỗ của tôi' },
  k_edit:       { en: 'Change', vn: 'Sửa' },
  k_working:    { en: 'Holding your place', vn: 'Đang giữ chỗ cho bạn' },

  // ── The guarantee ───────────────────────────────────────────────────────
  k_done_title: { en: 'Your name is on the list.', vn: 'Tên bạn đã có trong danh sách.' },
  k_done_come:  { en: 'Come back at {time}.', vn: 'Hãy quay lại lúc {time}.' },
  k_done_early: { en: 'Please arrive five minutes early.', vn: 'Vui lòng đến sớm năm phút.' },
  k_done_mail:  { en: 'Your ticket is on its way to your email.',
                  vn: 'Vé của bạn đang được gửi tới email.' },
  k_done_nomail:{ en: 'You are on the list by name — no email needed.',
                  vn: 'Bạn đã có tên trong danh sách — không cần email.' },
  k_done_again: { en: 'Done', vn: 'Xong' },

  // ── The waiting list ────────────────────────────────────────────────────
  k_wait_title: { en: 'You are on the waiting list.', vn: 'Bạn đang ở danh sách chờ.' },
  k_wait_line:  { en: 'That session is full. If a place opens for {time}, we will email you at once.',
                  vn: 'Lượt đó đã hết chỗ. Nếu có chỗ trống lúc {time}, chúng tôi sẽ email ngay cho bạn.' },
  k_wait_note:  { en: 'This is not a ticket yet.', vn: 'Đây chưa phải là vé.' },

  // ═══ THE STAFF HOME SCREEN ═══════════════════════════════════════════════
  // ⚠ THIS SCREEN EXISTS BECAUSE THE FIRST STAFF MEMBER HANDED A PHONE COULD
  // NOT SEE WHAT TO DO. There was a sign-up form and a small unlabelled ◆ in
  // the corner that led, behind a second PIN, to the door. Everything about
  // that was wrong for somebody picking the phone up for the first time.
  //
  // Two buttons. Her name. Nothing else.
  h_signed_in:    { en: 'Signed in as {name}', vn: 'Đang đăng nhập: {name}' },
  h_signup:       { en: 'Sign up a guest', vn: 'Đăng ký khách' },
  h_scan:         { en: 'Scan a ticket', vn: 'Quét vé' },
  h_signout:      { en: 'Sign out', vn: 'Đăng xuất' },
  h_practice:     { en: 'PRACTICE', vn: 'TẬP DƯỢT' },
  h_practice_sub: { en: 'This is a practice run. Nothing here is Friday.',
                    vn: 'Đây là buổi tập dượt. Không phải tối thứ Sáu.' },
  h_who:          { en: 'Who are you?', vn: 'Bạn là ai?' },
  h_your_pin:     { en: '{name} — your PIN', vn: '{name} — mã PIN của bạn' },
  h_start:        { en: 'Start', vn: 'Bắt đầu' },
  h_someone_else: { en: 'Someone else', vn: 'Người khác' },
  h_done:         { en: 'Done', vn: 'Xong' },
  h_back_home:    { en: 'Back', vn: 'Quay lại' },

  // ── The slot list, read at a glance ──────────────────────────────────────
  s_places:       { en: '{n} places', vn: '{n} chỗ' },
  s_one_place:    { en: '1 place left', vn: 'còn 1 chỗ' },
  s_full:         { en: 'FULL', vn: 'HẾT CHỖ' },
  s_next_free:    { en: 'NEXT WITH SPACE', vn: 'CÒN CHỖ SỚM NHẤT' },
  s_running:      { en: 'ON NOW', vn: 'ĐANG DIỄN RA' },
  s_waitlist_btn: { en: 'Add to waiting list', vn: 'Thêm vào danh sách chờ' },
  s_choose:       { en: 'Choose a time', vn: 'Chọn giờ' },
  s_how_many:     { en: 'How many people?', vn: 'Bao nhiêu người?' },
  s_confirm_btn:  { en: 'Confirm', vn: 'Xác nhận' },
  s_emailed:      { en: 'The QR ticket has been emailed.', vn: 'Vé QR đã được gửi qua email.' },
  s_not_emailed:  { en: 'No email given — they are on the list by name.',
                    vn: 'Không có email — khách đã có tên trong danh sách.' },
  s_email_failed: { en: 'The email could not be sent. They are still on the list.',
                    vn: 'Không gửi được email. Khách vẫn có trong danh sách.' },
  s_show_guest:   { en: 'Show this to the guest', vn: 'Cho khách xem màn hình này' },

  // ── The scan screen ──────────────────────────────────────────────────────
  sc_type:        { en: 'Type the code', vn: 'Nhập mã' },
  sc_byname:      { en: 'Find by name', vn: 'Tìm theo tên' },
  sc_let_in:      { en: 'LET THEM IN', vn: 'MỜI VÀO' },

  // ═══ THE DOOR (item 1) ═══════════════════════════════════════════════════
  // ⚠ THE DOOR IS A STAFF SURFACE AND IT IS STILL BILINGUAL. Every other
  // /kiosk screen carries the switch, and the people holding these phones on
  // Friday read Vietnamese first. A staff screen in English only is the club
  // asking its own floor team to work in a second language at a door with a
  // queue — which is exactly the standing rule this club already has.
  d_title:        { en: 'The door', vn: 'Cửa vào' },
  d_who:          { en: 'Who is on the door?', vn: 'Ai đang trực cửa?' },
  d_your_pin:     { en: '{name} — your PIN', vn: '{name} — mã PIN của bạn' },
  d_open:         { en: 'Open the door list', vn: 'Mở danh sách cửa' },
  d_someone_else: { en: 'Someone else', vn: 'Người khác' },
  d_wrong_pin:    { en: 'Wrong PIN.', vn: 'Sai mã PIN.' },

  d_in_now:       { en: 'IN NOW', vn: 'ĐANG VÀO' },
  d_next:         { en: 'NEXT', vn: 'TIẾP THEO' },
  d_no_session:   { en: 'NO SESSION RUNNING', vn: 'KHÔNG CÓ LƯỢT NÀO' },
  d_offline:      { en: 'OFFLINE', vn: 'MẤT MẠNG' },
  d_to_send:      { en: '{n} to send', vn: '{n} chờ gửi' },

  d_scan:         { en: 'Scan a ticket', vn: 'Quét vé' },
  d_type_code:    { en: 'OR TYPE THE 8-CHARACTER CODE', vn: 'HOẶC NHẬP MÃ 8 KÝ TỰ' },
  d_go:           { en: 'Go', vn: 'Tìm' },
  d_find:         { en: 'Find a name, email or code — any session',
                    vn: 'Tìm theo tên, email hoặc mã — mọi lượt' },
  d_matches:      { en: '{n} matches', vn: '{n} kết quả' },
  d_match_one:    { en: '1 match', vn: '1 kết quả' },
  d_nobody:       { en: 'Nobody booked.', vn: 'Chưa có ai đặt.' },
  d_admit:        { en: 'Admit', vn: 'Cho vào' },
  d_undo:         { en: 'Undo', vn: 'Hoàn tác' },
  d_in_count:     { en: 'in', vn: 'đã vào' },
  d_walkup:       { en: '+ Walk-up at the door', vn: '+ Khách đến trực tiếp' },
  d_back_signup:  { en: 'Back to sign-up', vn: 'Quay lại đăng ký' },
  d_finished:     { en: 'finished', vn: 'đã xong' },
  d_never_came:   { en: '{n} never came', vn: '{n} không đến' },
  d_hide:         { en: 'hide', vn: 'ẩn' },
  d_show:         { en: 'show', vn: 'hiện' },
  d_cap:          { en: 'cap {n}', vn: 'tối đa {n}' },
  d_over_by:      { en: 'OVER BY {n}', vn: 'VƯỢT {n}' },
  d_waiting_n:    { en: '{n} waiting', vn: '{n} đang chờ' },
  d_party_of:     { en: 'party of {n}', vn: 'nhóm {n} người' },
  d_one_person:   { en: 'one', vn: 'một người' },
  d_waiting_list: { en: 'WAITING LIST', vn: 'DANH SÁCH CHỜ' },
  d_is_walkup:    { en: 'walk-up', vn: 'đến trực tiếp' },
  d_in_at:        { en: 'in at {time} by {who}', vn: 'vào lúc {time}, bởi {who}' },
  d_offline_tag:  { en: '(offline)', vn: '(ngoại tuyến)' },

  // ── The ten things a scan can say ───────────────────────────────────────
  // ⚠ WORDED AS A DOORMAN SPEAKS, not as a system reports. Every one of these
  // is read aloud to somebody standing in front of you.
  d_s_valid:      { en: 'In you come', vn: 'Mời vào' },
  d_s_queued:     { en: 'In you come — saved on this phone',
                    vn: 'Mời vào — đã lưu trên máy này' },
  d_s_used:       { en: 'Already admitted', vn: 'Đã vào rồi' },
  d_s_used_by:    { en: 'by {who} at {time}', vn: 'bởi {who} lúc {time}' },
  d_s_early:      { en: 'Too early', vn: 'Còn sớm' },
  d_s_early_sub:  { en: 'Their session starts at {time}.', vn: 'Lượt của họ bắt đầu lúc {time}.' },
  d_s_late:       { en: 'That session has finished', vn: 'Lượt đó đã kết thúc' },
  d_s_waiting:    { en: 'On the waiting list — not a ticket',
                    vn: 'Đang ở danh sách chờ — chưa phải vé' },
  d_s_waiting_sub:{ en: 'They have no place yet. Check the run sheet before letting them in.',
                    vn: 'Họ chưa có chỗ. Hãy kiểm tra bảng điều hành trước khi cho vào.' },
  d_s_cancelled:  { en: 'Cancelled', vn: 'Đã huỷ' },
  d_s_unknown:    { en: 'Not on tonight’s list', vn: 'Không có trong danh sách tối nay' },
  d_s_wrong:      { en: 'A ticket for another event', vn: 'Vé của sự kiện khác' },
  d_s_wrong_sub:  { en: 'Code {code} belongs to a different evening — a rehearsal ticket, most likely.',
                    vn: 'Mã {code} thuộc một buổi khác — rất có thể là vé diễn tập.' },
  d_s_malformed:  { en: 'That is not a ticket code', vn: 'Đó không phải mã vé' },
  d_s_in_of:      { en: '{n} of {total} in', vn: '{n} trên {total} đã vào' },
  d_s_wrong_row:  { en: 'Undo — wrong person', vn: 'Hoàn tác — nhầm người' },

  // ── How many of them are here ───────────────────────────────────────────
  d_how_many:     { en: 'Booked for {n}. How many are here?',
                    vn: 'Đã đặt cho {n} người. Hiện có mấy người?' },
  d_cancel:       { en: 'Cancel', vn: 'Huỷ' },

  // ── A walk-up ───────────────────────────────────────────────────────────
  d_walk_title:   { en: 'Walk-up', vn: 'Khách đến trực tiếp' },
  d_walk_sub:     { en: 'Somebody at the door who never signed up. They go straight in.',
                    vn: 'Khách ở cửa chưa đăng ký. Họ vào ngay.' },
  d_walk_name:    { en: 'Name', vn: 'Tên' },
  d_walk_go:      { en: 'Let them in', vn: 'Cho vào' },
  d_walk_anyway:  { en: 'Let them in anyway', vn: 'Vẫn cho vào' },
  d_walk_full:    { en: 'This session is full.', vn: 'Lượt này đã hết chỗ.' },
  d_walk_full_sub:{ en: 'Letting them in puts it over the cap, and the run sheet will show that.',
                    vn: 'Cho vào sẽ vượt sức chứa, và bảng điều hành sẽ hiển thị điều đó.' },

  // ── No signal ───────────────────────────────────────────────────────────
  d_off_title:    { en: 'No signal. The door still works.',
                    vn: 'Mất mạng. Cửa vẫn hoạt động.' },
  d_off_sub:      { en: 'Names are from this phone’s saved copy. Ticks are kept and sent when the signal returns.',
                    vn: 'Danh sách lấy từ bản lưu trên máy. Các lượt cho vào được giữ lại và gửi đi khi có mạng.' },
  d_bad_title:    { en: 'The door list could not be read.',
                    vn: 'Không đọc được danh sách cửa.' },
  d_bad_sub:      { en: 'Everything below is the last copy this phone saved.',
                    vn: 'Phần dưới là bản lưu gần nhất trên máy này.' },
  d_cam_none:     { en: 'This phone cannot use the camera to read codes. Type the code instead.',
                    vn: 'Máy này không dùng được camera để đọc mã. Hãy nhập mã bằng tay.' },
  d_cam_fail:     { en: 'The camera could not be opened. Type the code instead.',
                    vn: 'Không mở được camera. Hãy nhập mã bằng tay.' },
  d_close:        { en: 'Close', vn: 'Đóng' },
  // ── The camera, and the permission the phone will ask for ───────────────
  d_cam_aim:      { en: 'Point the camera at the QR code', vn: 'Hướng camera vào mã QR' },
  d_cam_asking:   { en: 'Your phone will ask to use the camera. Tap Allow.',
                    vn: 'Điện thoại sẽ hỏi quyền dùng camera. Hãy chọn Cho phép.' },
  d_cam_denied:   { en: 'The camera was not allowed.', vn: 'Camera chưa được cho phép.' },
  d_cam_denied_ios: { en: 'Tap “aA” in the address bar → Website Settings → Camera → Allow. Or just type the code.',
                      vn: 'Chạm “aA” trên thanh địa chỉ → Cài đặt trang web → Camera → Cho phép. Hoặc nhập mã bằng tay.' },
  d_cam_none_found: { en: 'This phone has no camera we can use. Type the code instead.',
                      vn: 'Máy này không có camera dùng được. Hãy nhập mã bằng tay.' },
  d_cam_starting: { en: 'Starting the camera…', vn: 'Đang mở camera…' },
  d_cam_type:     { en: 'Type the code instead', vn: 'Nhập mã bằng tay' },

  // ── The staff menu behind the PIN, on the sign-up phone ─────────────────
  k_menu_sub:     { en: 'This phone. Two jobs.', vn: 'Một máy. Hai việc.' },
  k_menu_signup:  { en: 'Take a sign-up', vn: 'Nhận đăng ký' },
  k_menu_door:    { en: 'Door list', vn: 'Danh sách cửa' },
  k_pin_title:    { en: 'Your PIN', vn: 'Mã PIN của bạn' },
  k_continue:     { en: 'Continue', vn: 'Tiếp tục' },

  // ── THE TIME MOVED (item 4) ─────────────────────────────────────────────
  // ⚠ THE NEW TIME IS THE SUBJECT LINE. Somebody glancing at a phone in a
  // crowd reads the subject and nothing else, and the one fact that changed
  // is the only fact worth putting there.
  mail_shift_subject: { en: 'Your pop-up time is now {time}',
                        vn: 'Giờ tham dự của bạn nay là {time}' },
  mail_shift_lead:    { en: 'We are running a little behind.',
                        vn: 'Chúng tôi đang chậm hơn một chút.' },
  mail_shift_was:     { en: 'You were booked for {was}.', vn: 'Bạn đã đặt lúc {was}.' },
  mail_shift_now:     { en: 'Please come at {time} instead.', vn: 'Vui lòng đến lúc {time}.' },
  mail_shift_same:    { en: 'Your ticket and code are unchanged.',
                        vn: 'Vé và mã của bạn không thay đổi.' },

  // ── A MESSAGE FROM THE CLUB (item 5) ────────────────────────────────────
  mail_msg_subject:   { en: 'A note from The Rampant Club', vn: 'Lời nhắn từ The Rampant Club' },

  // ── TEN MINUTES TO GO (item 6) ──────────────────────────────────────────
  mail_rem_subject:   { en: 'Your session starts at {time}', vn: 'Lượt của bạn bắt đầu lúc {time}' },
  mail_rem_lead:      { en: 'You are on in {n} minutes.', vn: 'Còn {n} phút nữa là đến lượt bạn.' },
  mail_rem_where:     { en: 'Come to the door a few minutes early and show this.',
                        vn: 'Vui lòng đến cửa sớm vài phút và xuất trình vé này.' },

  // ── THE MORNING AFTER (item 7) ──────────────────────────────────────────
  // ⚠ THE BODY COPY IS THE OWNER'S AND IS NOT WRITTEN HERE. These are only the
  // wrappers — the greeting, the sign-off and the unsubscribe line, which are
  // the club's standard and not editorial.
  mail_fu_hello:      { en: 'Dear {name},', vn: 'Kính gửi {name},' },
  mail_fu_unsub:      { en: 'If you would rather not hear from us again, unsubscribe.',
                        vn: 'Nếu bạn không muốn nhận thư nữa, hãy huỷ đăng ký.' },
  mail_fu_unsub_link: { en: 'Unsubscribe', vn: 'Huỷ đăng ký' },
  mail_fu_test:       { en: 'TEST — this is a preview sent to the owner only.',
                        vn: 'THỬ — đây là bản xem trước chỉ gửi cho chủ sở hữu.' },

  // ── Refusals, in the words a guest actually reads ───────────────────────
  k_err_name:   { en: 'Please enter a name.', vn: 'Vui lòng nhập tên.' },
  k_err_email:  { en: 'That email does not look right. Check it, or leave it blank.',
                  vn: 'Email có vẻ chưa đúng. Hãy kiểm tra lại, hoặc để trống.' },
  // ⚠ THE CLASH IS NAMED. A bare "already booked" sends a guest to argue with
  // staff; the time tells them what to do next.
  k_err_dup:    { en: 'This email already has a place at {time}.',
                  vn: 'Email này đã có chỗ lúc {time}.' },
  k_err_dup_ask:{ en: 'Ask a member of staff to change or cancel it.',
                  vn: 'Vui lòng nhờ nhân viên thay đổi hoặc huỷ.' },
  k_err_started:{ en: 'That session has started. Please choose another.',
                  vn: 'Lượt đó đã bắt đầu. Vui lòng chọn lượt khác.' },
  k_err_toobig: { en: 'We can take up to {n} at a time.', vn: 'Mỗi lượt tối đa {n} người.' },
  k_err_full:   { en: 'That place has just gone. Here are the sessions with room.',
                  vn: 'Chỗ đó vừa hết. Đây là các lượt còn chỗ.' },

  // ⚠ NEVER A FALSE CONFIRMATION. Places are limited, so nothing is promised
  // until the server has written it. With no connection the tablet says so and
  // stops — staff take the name on paper.
  k_err_offline:{ en: "We can't take bookings for a moment.",
                  vn: 'Hiện chưa thể nhận đăng ký.' },
  k_err_offline_ask: { en: 'Please ask a member of staff — they will take your name.',
                       vn: 'Vui lòng hỏi nhân viên — họ sẽ ghi tên bạn.' },

  // ── Privacy, short enough to read standing up ───────────────────────────
  k_privacy:    { en: 'The Rampant Club is collecting your name and email to hold this place and send your ticket.',
                  vn: 'The Rampant Club thu thập tên và email của bạn để giữ chỗ và gửi vé.' },
  k_privacy_link: { en: 'Privacy notice', vn: 'Chính sách riêng tư' },
  // The owner's wording, unticked by default. It decides ONE thing: which of
  // the two follow-up emails arrives. Never whether there is a place.
  k_consent:    { en: "I'd like to hear from The Rampant Club after tonight.",
                  vn: 'Tôi muốn nhận thông tin từ The Rampant Club sau tối nay.' },

  // ── The emails ──────────────────────────────────────────────────────────
  mail_ticket_subject: { en: 'Your place at {time} — {title}', vn: 'Chỗ của bạn lúc {time} — {title}' },
  mail_ticket_lead:    { en: 'Your name is on the list.', vn: 'Tên bạn đã có trong danh sách.' },
  mail_ticket_when:    { en: 'Come back at {time}. Please arrive five minutes early.',
                         vn: 'Hãy quay lại lúc {time}. Vui lòng đến sớm năm phút.' },
  mail_ticket_where:   { en: 'Where', vn: 'Địa điểm' },
  mail_ticket_show:    { en: 'Show this at the door.', vn: 'Vui lòng xuất trình ở cửa.' },
  // ⚠ THE MOST USEFUL SENTENCE IN THE EMAIL. A guest in a crowd with one bar
  // of signal cannot open an inbox; a screenshot is on their phone already.
  mail_ticket_shot:    { en: 'Take a screenshot of this now — it works without signal.',
                         vn: 'Hãy chụp màn hình ngay — vé vẫn dùng được khi không có mạng.' },
  mail_ticket_code:    { en: 'Or give your name, or this code:', vn: 'Hoặc đọc tên, hoặc mã này:' },

  mail_wait_subject: { en: 'You are on the waiting list — {title}', vn: 'Bạn đang ở danh sách chờ — {title}' },
  mail_wait_lead:    { en: 'You are on the waiting list for {time}.', vn: 'Bạn đang ở danh sách chờ lúc {time}.' },
  // ⚠ SAID PLAINLY AND EARLY. A waiting-list email that looks like a ticket is
  // a guest turned away at a door holding what they think is one.
  mail_wait_not:     { en: 'This is not a ticket. If a place opens we will email you at once, and that email will have your ticket in it.',
                       vn: 'Đây không phải là vé. Nếu có chỗ trống, chúng tôi sẽ email ngay cho bạn, và email đó sẽ có vé.' },

  mail_promoted_subject: { en: 'A place has opened — {time}', vn: 'Đã có chỗ trống — {time}' },
  mail_promoted_lead:    { en: 'A place has opened and it is yours.', vn: 'Đã có một chỗ trống và nó là của bạn.' },

} as const

export type PopupKey = keyof typeof POPUP_STRINGS

export function tr(lang: Lang, key: PopupKey, vars?: Record<string, string | number>): string {
  const row = POPUP_STRINGS[key] as { en: string; vn: string }
  let s = (lang === 'vn' ? row.vn : row.en) || row.en
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** HH:MM in the venue's clock, which is the only clock anybody there is in. */
export function timeLabel(iso: string, timezone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}
