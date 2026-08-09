create index if not exists activities_actor_user_id_idx on public.activities (actor_user_id);
create index if not exists bookings_project_id_idx on public.bookings (project_id);
create index if not exists file_records_created_by_idx on public.file_records (created_by);
create index if not exists operator_items_created_by_idx on public.operator_items (created_by);
create index if not exists payments_artist_id_idx on public.payments (artist_id);
create index if not exists retainers_invoice_id_idx on public.retainers (invoice_id);
