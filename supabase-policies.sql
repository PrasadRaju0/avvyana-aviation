-- Run this once in Supabase Dashboard > SQL Editor.
-- The application currently uses the public anon key for its data operations.

alter table public.student_accounts enable row level security;
alter table public.flight_submissions enable row level security;
alter table public.leave_requests enable row level security;

-- Add fields used by the current flight-availability form if the table was
-- created from an older schema.
alter table public.flight_submissions
  add column if not exists unavailability_reason text default '',
  add column if not exists total_flying_hours numeric default 0,
  add column if not exists queue_status text default 'pending',
  add column if not exists queue_started_at timestamptz,
  add column if not exists queue_completed_at timestamptz,
  add column if not exists submitted_at timestamptz default now();

notify pgrst, 'reload schema';

drop policy if exists "student_accounts_select_anon" on public.student_accounts;
drop policy if exists "student_accounts_insert_anon" on public.student_accounts;
drop policy if exists "student_accounts_update_anon" on public.student_accounts;
create policy "student_accounts_select_anon"
  on public.student_accounts for select to anon, authenticated
  using (true);
create policy "student_accounts_insert_anon"
  on public.student_accounts for insert to anon, authenticated
  with check (true);
create policy "student_accounts_update_anon"
  on public.student_accounts for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "flight_submissions_select_anon" on public.flight_submissions;
drop policy if exists "flight_submissions_insert_anon" on public.flight_submissions;
drop policy if exists "flight_submissions_update_anon" on public.flight_submissions;
drop policy if exists "flight_submissions_delete_anon" on public.flight_submissions;
create policy "flight_submissions_select_anon"
  on public.flight_submissions for select to anon, authenticated
  using (true);
create policy "flight_submissions_insert_anon"
  on public.flight_submissions for insert to anon, authenticated
  with check (true);
create policy "flight_submissions_update_anon"
  on public.flight_submissions for update to anon, authenticated
  using (true)
  with check (true);
create policy "flight_submissions_delete_anon"
  on public.flight_submissions for delete to anon, authenticated
  using (true);

drop policy if exists "student_accounts_delete_anon" on public.student_accounts;
create policy "student_accounts_delete_anon"
  on public.student_accounts for delete to anon, authenticated
  using (true);

drop policy if exists "leave_requests_select_anon" on public.leave_requests;
drop policy if exists "leave_requests_insert_anon" on public.leave_requests;
drop policy if exists "leave_requests_update_anon" on public.leave_requests;
drop policy if exists "leave_requests_delete_anon" on public.leave_requests;
create policy "leave_requests_select_anon"
  on public.leave_requests for select to anon, authenticated
  using (true);
create policy "leave_requests_insert_anon"
  on public.leave_requests for insert to anon, authenticated
  with check (true);
create policy "leave_requests_update_anon"
  on public.leave_requests for update to anon, authenticated
  using (true)
  with check (true);
create policy "leave_requests_delete_anon"
  on public.leave_requests for delete to anon, authenticated
  using (true);
