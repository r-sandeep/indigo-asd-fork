-- ============================================================================
-- 016_daily_log_photos.sql
-- Adds missing RLS policies to the already-existing daily_log_photos table
-- (created in 008 with no policies — RLS was enabled but no rules defined).
-- Also adds storage object policies for the project-photos bucket.
--
-- daily_log_photos schema (from 008):
--   id               uuid PK
--   daily_log_id     uuid FK → daily_logs(id) ON DELETE CASCADE
--   document_id      uuid FK NOT NULL → documents(id)   ← storage record
--   caption          text
--   ai_caption       text
--   sequence         int  DEFAULT 0
--   is_client_visible boolean DEFAULT true
--   created_at       timestamptz
--
-- Prerequisite: create the "project-photos" bucket (private) in the
-- Supabase dashboard before running this migration.
-- Storage path convention: {tenant_id}/daily-logs/{log_id}/{uuid}.{ext}
-- ============================================================================

-- ── 1. daily_log_photos table RLS ─────────────────────────────────────────
-- The table has RLS enabled (migration 008) but zero policies, so nothing
-- is accessible yet. Add staff + portal-client policies.

-- Tenant members: full access (join through daily_logs for tenant_id)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'daily_log_photos'
      and policyname = 'tenant members manage daily log photos'
  ) then
    execute $p$
      create policy "tenant members manage daily log photos" on daily_log_photos
        for all using (
          exists (
            select 1 from daily_logs dl
            where  dl.id = daily_log_photos.daily_log_id
              and  dl.tenant_id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;

-- Portal clients: read-only on photos for their published, client-visible logs
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'daily_log_photos'
      and policyname = 'clients view daily log photos'
  ) then
    execute $p$
      create policy "clients view daily log photos" on daily_log_photos
        for select using (
          is_client_visible = true
          and exists (
            select 1
            from   daily_logs dl
            join   projects   p  on p.id = dl.project_id
            where  dl.id                 = daily_log_photos.daily_log_id
              and  dl.is_client_visible  = true
              and  dl.published_at       is not null
              and  is_client_on_job(p.job_id)
          )
        )
    $p$;
  end if;
end $$;

-- ── 2. Storage object policies for project-photos bucket ───────────────────
-- Path structure: {tenant_id}/daily-logs/{log_id}/{uuid}.{ext}
-- First path segment is the tenant UUID — used for tenant-level access control.

-- Tenant staff: read
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'tenant staff read project photos'
  ) then
    execute $p$
      create policy "tenant staff read project photos" on storage.objects
        for select using (
          bucket_id = 'project-photos'
          and split_part(name, '/', 1) in (
            select id::text from tenants
            where  id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;

-- Tenant staff: upload
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'tenant staff upload project photos'
  ) then
    execute $p$
      create policy "tenant staff upload project photos" on storage.objects
        for insert with check (
          bucket_id = 'project-photos'
          and split_part(name, '/', 1) in (
            select id::text from tenants
            where  id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;

-- Tenant staff: delete
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'tenant staff delete project photos'
  ) then
    execute $p$
      create policy "tenant staff delete project photos" on storage.objects
        for delete using (
          bucket_id = 'project-photos'
          and split_part(name, '/', 1) in (
            select id::text from tenants
            where  id in (select get_user_tenant_ids())
          )
        )
    $p$;
  end if;
end $$;

-- Portal clients: read photos on published, client-visible logs
-- Joins documents → daily_log_photos → daily_logs → projects to verify.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'portal clients read project photos'
  ) then
    execute $p$
      create policy "portal clients read project photos" on storage.objects
        for select using (
          bucket_id = 'project-photos'
          and exists (
            select 1
            from   documents          doc
            join   daily_log_photos   dlp  on dlp.document_id   = doc.id
            join   daily_logs         dl   on dl.id             = dlp.daily_log_id
            join   projects           p    on p.id              = dl.project_id
            where  doc.storage_path        = storage.objects.name
              and  doc.storage_bucket      = 'project-photos'
              and  dlp.is_client_visible   = true
              and  dl.is_client_visible    = true
              and  dl.published_at         is not null
              and  is_client_on_job(p.job_id)
          )
        )
    $p$;
  end if;
end $$;
