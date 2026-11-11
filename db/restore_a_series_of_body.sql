-- ═══════════════════════════════════════════════════════════════════════════
-- THE WAY BACK: "A Series Of Body"
-- ───────────────────────────────────────────────────────────────────────────
-- The owner confirmed on 11 Nov 2026 that this work is NOT in the Rizal
-- Fathoni exhibition, and its row was deleted from collaboration_pieces so
-- that every count on the guide reads eight rather than nine.
--
-- Deleting a row with a 1,968-character artist statement and an uploaded image
-- is not a thing to do without shipping its reversal in the same commit. Run
-- this file and the work returns exactly as it was, at sort 9, with its own
-- id — so anything that ever referenced it still matches.
--
-- ⚠ IT WILL COME BACK AS THE NINTH PIECE, and the guide will say "9 pieces"
-- again the moment it does. That is the point: the counts read the data.
--
-- ⚠ IT HAS NO LOT, and this file does not give it one. It was never in the
-- auction and was never for sale. See THE NINTH PIECE in db/studio_auction.sql.
--
-- The image is untouched by the delete — it lives in the event-media bucket,
-- not in this row — so restoring the row restores the picture with it.
-- ═══════════════════════════════════════════════════════════════════════════

insert into collaboration_pieces (
  id, collaboration_id, sort, title_en, title_vn, artist_name, year, medium_en, medium_vn, dimensions, image_path, description_en, description_vn, provenance, beneficiary_en, beneficiary_vn, beneficiary_logo_path, beneficiary_url
) values (
  '59f87699-c835-4b4e-a987-fee2895f0d35',
  'c150ed30-4ae3-4328-b865-5ab2a3d5ad34',
  '9',
  'A Series Of Body',
  null,
  null,
  '2026',
  'Acrylic & Oil on Cotton Paper and Cardboard',
  'Acrylic & sơn dầu trên giấy cotton và bìa carton',
  '15.5 × 53 cm · 20 × 26 × 5 cm',
  'https://ofdwjqugtbkunujvvcud.supabase.co/storage/v1/object/public/event-media/studio/pieces/c150ed30-4ae3-4328-b865-5ab2a3d5ad34/e643c25b-206b-4cdc-8287-f8fa421aed74.jpg',
  'This series begins with a question that is both disturbing and difficult to resolve: what does it mean when the body becomes entangled with the corruption of power?

The figure of the ani-ani — the mistress or companion of powerful men who, in certain corruption cases, becomes part of the public spectacle surrounding illicit wealth — emerges here not merely as an individual, but as a symptom of a larger system. Her body becomes a site where power, desire, privilege, and money intersect. The darkness that dominates these works is intentional — not simply an aesthetic choice, but a reflection of the moral darkness surrounding the circulation of public money. The money spent on luxury, pleasure, and excess is not an abstract possession; it originates from the labour of society — from taxes, wages, and the everyday sacrifices of people expected to contribute to a system they trust to serve the public good.

The series questions the distance between those who struggle to fulfil their obligations and those who transform the fruits of those obligations into personal pleasure. Here, nudity is not presented as erotic liberation. It becomes a metaphor for exposure, vulnerability, and moral dissection — the body stripped of its glamour and placed against a darkness produced by a system that allows power to consume what belongs to the collective. The work does not seek to blame the woman whose body appears within these narratives; instead it interrogates the structure that makes such relationships possible — the men who possess power, the money that enables excess, and a political culture in which public resources can be transformed into private luxury. Ultimately it asks what remains when wealth, status, and desire are stripped away: the nakedness of power, the nakedness of complicity, and the uncomfortable truth that corruption is never only about money — it is about the erosion of responsibility, dignity, and the collective trust of a society.',
  'Loạt tác phẩm này bắt đầu bằng một câu hỏi vừa gây bất an vừa khó ngã ngũ: điều gì xảy ra khi thân thể bị cuốn vào sự tha hoá của quyền lực?

Hình ảnh người "ani-ani" — người tình hay bạn đồng hành của những kẻ quyền thế, người trong một số vụ tham nhũng trở thành một phần của màn trình diễn công khai quanh khối tài sản bất chính — xuất hiện ở đây không chỉ như một cá nhân, mà như triệu chứng của một hệ thống lớn hơn. Thân thể cô trở thành nơi quyền lực, dục vọng, đặc quyền và tiền bạc giao nhau. Bóng tối bao trùm những tác phẩm này là có chủ ý — không đơn thuần là một lựa chọn thẩm mỹ, mà là phản chiếu của bóng tối đạo đức quanh dòng chảy của tiền công. Khoản tiền tiêu cho xa xỉ, khoái lạc và dư thừa không phải một thứ sở hữu trừu tượng; nó đến từ lao động của xã hội — từ thuế, từ tiền lương, từ những hy sinh thường nhật của những người được kỳ vọng đóng góp cho một hệ thống mà họ tin là phụng sự lợi ích chung.

Loạt tác phẩm chất vấn khoảng cách giữa những người chật vật hoàn thành nghĩa vụ của mình và những người biến thành quả của các nghĩa vụ ấy thành khoái lạc cá nhân. Ở đây, sự khoả thân không được trình bày như giải phóng nhục cảm. Nó trở thành ẩn dụ cho sự phơi bày, cho tình trạng mong manh, và cho một cuộc mổ xẻ đạo đức — thân thể bị tước đi hào nhoáng và đặt trước một bóng tối do chính hệ thống cho phép quyền lực ngốn lấy những gì thuộc về tập thể tạo ra. Tác phẩm không tìm cách kết tội người phụ nữ có thân thể xuất hiện trong những tự sự ấy; thay vào đó nó tra vấn cấu trúc khiến những mối quan hệ như vậy trở nên khả dĩ — những người đàn ông nắm quyền, đồng tiền cho phép sự dư thừa, và một văn hoá chính trị trong đó nguồn lực công có thể biến thành xa xỉ riêng tư. Sau cùng, nó hỏi còn lại gì khi của cải, địa vị và dục vọng bị bóc đi: sự trần trụi của quyền lực, sự trần trụi của đồng loã, và sự thật khó chịu rằng tham nhũng chưa bao giờ chỉ là chuyện tiền bạc — nó là sự xói mòn của trách nhiệm, của phẩm giá, và của niềm tin chung trong một xã hội.',
  null,
  null,
  null,
  null,
  null
)
on conflict (id) do nothing;
-- Check: select sort, title_en from collaboration_pieces
--         where collaboration_id = (select id from collaborations where slug = 'rizal-fathoni')
--         order by sort;   → nine rows again
