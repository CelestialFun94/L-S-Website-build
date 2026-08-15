create policy intake_requests_internal_select
on public.intake_requests for select to authenticated
using ((select private.is_internal_user()));

create policy intake_requests_internal_insert
on public.intake_requests for insert to authenticated
with check ((select private.is_internal_user()) and created_by = (select auth.uid()));

create policy intake_requests_creator_delete
on public.intake_requests for delete to authenticated
using ((select private.is_internal_user()) and created_by = (select auth.uid()));

create policy intake_responses_internal_select
on public.intake_responses for select to authenticated
using ((select private.is_internal_user()));

grant select, insert, delete on public.intake_requests to authenticated;
grant select on public.intake_responses to authenticated;

create policy oauth_connections_owner_select
on public.oauth_connections for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_internal_user()));

create policy oauth_connections_owner_insert
on public.oauth_connections for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_internal_user()));

create policy oauth_connections_owner_update
on public.oauth_connections for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_internal_user()))
with check (user_id = (select auth.uid()) and (select private.is_internal_user()));

create policy oauth_connections_owner_delete
on public.oauth_connections for delete to authenticated
using (user_id = (select auth.uid()) and (select private.is_internal_user()));

grant select, insert, update, delete on public.oauth_connections to authenticated;

create policy integration_connections_internal_update
on public.integration_connections for update to authenticated
using ((select private.is_internal_user()))
with check ((select private.is_internal_user()));

grant update on public.integration_connections to authenticated;
