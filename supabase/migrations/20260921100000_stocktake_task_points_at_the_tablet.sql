-- ═══════════════════════════════════════════════════════════════════════════
-- THE COUNT TASK POINTS AT PAPER. THAT IS WHY IT HAS NEVER BEEN DONE.
-- ───────────────────────────────────────────────────────────────────────────
-- "Count the back bar and the store. Write the count sheet." has landed on a
-- shift four times — weeks of 7, 14 and 21 September — and sat `not_started`
-- every single time. Meanwhile the digital stocktake has recorded ZERO
-- sessions since it was built, against a catalogue of 333 bottles.
--
-- The instruction and the system pointed in different directions. The task
-- asked for a count sheet; nothing anywhere told anybody the tool existed, and
-- the tool needed an admin login that the people who count bottles do not
-- have. Both halves are fixed now — the count lives on the room tablet behind
-- the PIN they already use — so the task says where to go.
--
-- BOTH TABLES, deliberately. shift_task_instances are materialised copies:
-- changing the template alone would leave THIS week's task — the one Mr Sĩ
-- picks up today — still reading "write the count sheet".
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

update public.shift_template_tasks
   set title_en = 'Stocktake on the room tablet: Staff → Count the back bar. Search the bottle, tap its level, Finish when done. Anything more than 2 bottles out, find out why before you leave.',
       title_vi = 'Kiểm kê bằng máy tính bảng trong phòng: Nhân viên → Kiểm kê quầy bar. Tìm chai, chọn mức rượu, bấm Kết thúc khi xong. Chênh lệch trên 2 chai phải tìm ra nguyên nhân trước khi về.'
 where title_en ilike '%back bar%' and title_en ilike '%count sheet%';

-- This week's copy, and any other week still open on it.
update public.shift_task_instances
   set title_en = 'Stocktake on the room tablet: Staff → Count the back bar. Search the bottle, tap its level, Finish when done. Anything more than 2 bottles out, find out why before you leave.',
       title_vi = 'Kiểm kê bằng máy tính bảng trong phòng: Nhân viên → Kiểm kê quầy bar. Tìm chai, chọn mức rượu, bấm Kết thúc khi xong. Chênh lệch trên 2 chai phải tìm ra nguyên nhân trước khi về.'
 where title_en ilike '%back bar%' and title_en ilike '%count sheet%'
   and status <> 'done';

-- Read it back: the task as it now reads on a shift.
select week_start, status, left(title_en, 72) as reads
  from public.shift_task_instances
 where title_en ilike '%back bar%'
 order by week_start desc;
