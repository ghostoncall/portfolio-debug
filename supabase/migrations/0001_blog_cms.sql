-- Blog CMS database layer: full-text search, fuzzy matching, analytics,
-- revisions support, RLS, realtime and scheduled publishing.
--
-- Idempotent: safe to re-run. Applied with scripts/apply-sql.mjs.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;
-- pg_cron: scheduled publishing. Wrapped so a project without pg_cron still
-- gets everything else (scheduling stays server-side enforced regardless).
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%), scheduled publishing relies on server-side filtering only', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Plain-text extraction (searchable body text, never raw JSON/HTML)
-- ---------------------------------------------------------------------------

create or replace function cms_strip_html(html text)
returns text language sql immutable as $$
  select coalesce(btrim(regexp_replace(regexp_replace(coalesce(html, ''), '<[^>]*>', ' ', 'gi'), '\s+', ' ', 'g')), '')
$$;

-- Legacy Block[] bodies: extract text fields.
create or replace function cms_blocks_plain_text(blocks jsonb)
returns text language plpgsql immutable as $$
declare
  b jsonb;
  parts text[] := '{}';
begin
  if blocks is null or jsonb_typeof(blocks) is distinct from 'array' then
    return '';
  end if;
  for b in select * from jsonb_array_elements(blocks) loop
    if b ? 'body' and jsonb_typeof(b->'body') = 'string' then
      parts := parts || (b->>'body');
    end if;
    if b ? 'text' and jsonb_typeof(b->'text') = 'string' then
      parts := parts || (b->>'text');
    end if;
    if b ? 'caption' and jsonb_typeof(b->'caption') = 'string' then
      parts := parts || (b->>'caption');
    end if;
    if b ? 'code' and jsonb_typeof(b->'code') = 'string' then
      parts := parts || (b->>'code');
    end if;
    if b ? 'items' and jsonb_typeof(b->'items') = 'array' then
      parts := parts || (select coalesce(string_agg(i, ' '), '') from jsonb_array_elements_text(b->'items') i where jsonb_typeof(to_jsonb(i)) = 'string');
    end if;
  end loop;
  return coalesce(array_to_string(parts, ' '), '');
end $$;

-- ---------------------------------------------------------------------------
-- Search index maintenance (trigger-maintained, updates on content change)
-- ---------------------------------------------------------------------------

create or replace function cms_posts_search_vector()
returns trigger language plpgsql as $$
declare
  doc jsonb;
  title text;
  dek text;
  tags_text text;
  body_text text;
begin
  doc := new.published;
  title := concat_ws(' ', doc->>'title', new.slug);
  dek := coalesce(doc->>'dek', '');
  select coalesce(string_agg(t, ' '), '') into tags_text
    from jsonb_array_elements_text(coalesce(doc->'tags', '[]'::jsonb)) t;
  body_text := cms_strip_html(coalesce(doc->'body'->>'html', ''));
  if body_text = '' then
    body_text := cms_blocks_plain_text(coalesce(doc->'blocks', '[]'::jsonb));
  end if;

  new.search_text := concat_ws(' ', title, dek, tags_text, body_text);
  new.search :=
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(dek, '') || ' ' || coalesce(tags_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'C');
  return new;
end $$;

drop trigger if exists posts_search_sync on posts;
create trigger posts_search_sync
  before insert or update of published, slug on posts
  for each row execute function cms_posts_search_vector();

-- Backfill existing rows.
update posts set slug = slug where search is null or search_text is null;

create index if not exists posts_search_text_trgm_idx
  on posts using gin (search_text gin_trgm_ops);
create index if not exists posts_public_idx on posts (is_public, published_at);
create index if not exists posts_needs_publish_idx on posts (needs_publish, published_at);

-- ---------------------------------------------------------------------------
-- Shared "visible posts" predicate (published, not scheduled, not private)
-- ---------------------------------------------------------------------------

create or replace function cms_visible_post(p posts)
returns boolean language sql immutable as $$
  select p.is_public
    and (p.published_at is null or p.published_at <= now())
    and coalesce(p.published->>'visibility', 'public') <> 'private'
$$;

-- ---------------------------------------------------------------------------
-- Search RPC (weighted FTS + trigram fuzzy fallback)
-- ---------------------------------------------------------------------------

-- Core scoring pass, shared by all sort orders. Returns every matching row
-- (no pagination) so the public function can re-order and paginate.
create or replace function _search_blog_posts_core(
  p_query text,
  p_tag text,
  p_year int,
  p_featured boolean
)
returns table (
  slug text, title text, dek text, date text, tags jsonb, cover jsonb,
  read_time text, author text, featured boolean, published_at timestamptz,
  rank real, headline text, total bigint
)
language plpgsql stable as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  tq tsquery;
begin
  if q is not null then
    tq := websearch_to_tsquery('english', q);
    -- If exact FTS matches nothing, fall back to fuzzy matching for this query.
    if not exists (select 1 from posts where cms_visible_post(posts) and search @@ tq) then
      tq := null;
    end if;
  end if;

  return query
  with visible as (
    select * from posts p where cms_visible_post(p)
  ),
  filtered as (
    select v.* from visible v
    where (p_tag is null or exists (
            select 1 from jsonb_array_elements_text(coalesce(v.published->'tags', '[]'::jsonb)) t
            where lower(t) = lower(p_tag)))
      and (p_year is null or substring(coalesce(v.published->>'date', ''), 1, 4) = p_year::text)
      and (p_featured is null or coalesce((v.published->>'featured')::boolean, false) = p_featured)
  ),
  scored as (
    select f.*,
      case
        when tq is not null then
          ts_rank_cd(f.search, tq, 32) * 2
          + case when f.published->>'title' ilike '%' || q || '%' then 0.75 else 0 end
        when q is not null then
          greatest(
            similarity(f.search_text, q) * 0.6,
            coalesce((select max(similarity(w, q)) from unnest(string_to_array(f.search_text, ' ')) w), 0)
          )
        else 0
      end as score
    from filtered f
    where q is null
       or (tq is not null and f.search @@ tq)
       or (tq is null and (
            f.search_text ilike '%' || q || '%'
            or exists (select 1 from unnest(string_to_array(f.search_text, ' ')) w
                       where similarity(w, q) > 0.55)
          ))
  ),
  counted as (
    select s.*, count(*) over () as total_count,
      case when tq is not null and q is not null then
        ts_headline('english', left(s.search_text, 4000), tq,
                    'MaxWords=32, MinWords=12, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')
      end as headline
    from scored s
  )
  select
    c.published->>'slug', c.published->>'title', c.published->>'dek', c.published->>'date',
    coalesce(c.published->'tags', '[]'::jsonb), coalesce(c.published->'cover', 'null'::jsonb),
    c.published->>'readTime', c.published->>'author',
    coalesce((c.published->>'featured')::boolean, false),
    c.published_at,
    c.score::real, c.headline, c.total_count
  from counted c;
end $$;

create or replace function search_blog_posts(
  p_query text default null,
  p_tag text default null,
  p_year int default null,
  p_featured boolean default null,
  p_sort text default 'relevance',
  p_page int default 1,
  p_per_page int default 10
)
returns table (
  slug text, title text, dek text, date text, tags jsonb, cover jsonb,
  read_time text, author text, featured boolean, published_at timestamptz,
  rank real, headline text, total bigint
)
language plpgsql stable as $$
declare
  page int := greatest(1, coalesce(p_page, 1));
  per_page int := least(50, greatest(1, coalesce(p_per_page, 10)));
  row_offset int := (page - 1) * per_page;
  post_date timestamptz;
begin
  if p_sort = 'newest' then
    return query
    select r.slug, r.title, r.dek, r.date, r.tags, r.cover, r.read_time, r.author,
           r.featured, r.published_at, r.rank, r.headline, r.total
    from _search_blog_posts_core(p_query, p_tag, p_year, p_featured) r
    order by to_timestamp(coalesce(nullif(r.date, ''), '1970-01-01'), 'YYYY-MM-DD') desc
    limit per_page offset row_offset;
  elsif p_sort = 'oldest' then
    return query
    select r.slug, r.title, r.dek, r.date, r.tags, r.cover, r.read_time, r.author,
           r.featured, r.published_at, r.rank, r.headline, r.total
    from _search_blog_posts_core(p_query, p_tag, p_year, p_featured) r
    order by to_timestamp(coalesce(nullif(r.date, ''), '1970-01-01'), 'YYYY-MM-DD') asc
    limit per_page offset row_offset;
  else
    return query
    select r.slug, r.title, r.dek, r.date, r.tags, r.cover, r.read_time, r.author,
           r.featured, r.published_at, r.rank, r.headline, r.total
    from _search_blog_posts_core(p_query, p_tag, p_year, p_featured) r
    order by r.rank desc nulls last,
             to_timestamp(coalesce(nullif(r.date, ''), '1970-01-01'), 'YYYY-MM-DD') desc
    limit per_page offset row_offset;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Suggestions, tags, related posts
-- ---------------------------------------------------------------------------

create or replace function search_blog_suggest(p_query text, p_limit int default 6)
returns table (kind text, label text, slug text)
language plpgsql stable as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if q is null then
    return;
  end if;

  return query
  select 'post'::text, p.published->>'title', p.slug
  from posts p
  where cms_visible_post(p)
    and (
      p.published->>'title' ilike '%' || q || '%'
      or p.search @@ websearch_to_tsquery('english', q)
      or exists (select 1 from unnest(string_to_array(p.search_text, ' ')) w
                 where similarity(w, q) > 0.55)
    )
  order by
    (p.published->>'title' ilike q || '%') desc,
    ts_rank_cd(p.search, websearch_to_tsquery('english', q)) desc nulls last,
    p.published->>'date' desc
  limit least(p_limit, 10);

  return query
  select 'tag'::text, t.value, null::text
  from posts p,
       jsonb_array_elements_text(coalesce(p.published->'tags', '[]'::jsonb)) t
  where cms_visible_post(p)
    and (t.value ilike '%' || q || '%' or similarity(t.value, q) > 0.4)
  group by t.value
  order by count(*) desc, t.value
  limit least(p_limit, 10);
end $$;

create or replace function get_blog_tags()
returns table (tag text, count bigint)
language sql stable as $$
  select t.value as tag, count(*)::bigint as count
  from posts p, jsonb_array_elements_text(coalesce(p.published->'tags', '[]'::jsonb)) t
  where cms_visible_post(p)
  group by t.value
  order by count(*) desc, t.value asc
$$;

drop function if exists get_related_posts(text, integer);
create or replace function get_related_posts(p_slug text, p_limit int default 3)
returns table (
  out_slug text, out_title text, out_dek text, out_date text, out_tags jsonb,
  out_cover jsonb, out_read_time text, out_author text, out_featured boolean,
  out_published_at timestamptz
)
language plpgsql stable as $$
declare
  self_tags jsonb;
  self_date text;
begin
  select published->'tags', published->>'date' into self_tags, self_date
  from posts where slug = p_slug and cms_visible_post(posts);
  if self_tags is null then return; end if;
  return query
  select
    p.published->>'slug', p.published->>'title', p.published->>'dek', p.published->>'date',
    coalesce(p.published->'tags','[]'::jsonb), coalesce(p.published->'cover','null'::jsonb),
    p.published->>'readTime', p.published->>'author',
    coalesce((p.published->>'featured')::boolean, false), p.published_at
  from posts p
  where cms_visible_post(p) and p.slug <> p_slug
  order by
    (select count(*) from jsonb_array_elements_text(self_tags) st
       where st.value in (select jsonb_array_elements_text(coalesce(p.published->'tags','[]'::jsonb)))) desc,
    (substring(coalesce(p.published->>'date',''),1,4) = substring(coalesce(self_date,''),1,4)) desc,
    p.published->>'date' desc
  limit greatest(1, least(p_limit, 6));
end $$;

-- ---------------------------------------------------------------------------
-- Analytics: once-per-session view counting
-- ---------------------------------------------------------------------------

create or replace function record_post_view(p_slug text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v integer;
begin
  if not exists (select 1 from posts p where p.slug = p_slug and cms_visible_post(p)) then
    return null;
  end if;
  insert into post_views (slug, views, last_viewed_at)
  values (p_slug, 1, now())
  on conflict (slug) do update
    set views = post_views.views + 1, last_viewed_at = now()
  returning views into v;
  return v;
end $$;

revoke all on function record_post_view(text) from public;
grant execute on function record_post_view(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled publishing (idempotent, runs every minute via pg_cron)
-- ---------------------------------------------------------------------------

create or replace function publish_due_posts()
returns integer
language plpgsql as $$
declare
  changed integer;
begin
  -- Copy staged → published for posts whose scheduled time arrived.
  -- needs_publish is cleared in the same statement, so re-runs are no-ops.
  with due as (
    update posts
    set published = staged, needs_publish = false, updated_at = now()
    where needs_publish and is_public
      and published_at is not null and published_at <= now()
    returning 1
  )
  select count(*) into changed from due;
  return changed;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- cron.job has no unique constraint on jobname in all versions: re-create.
    perform cron.unschedule(jobid) from cron.job where jobname = 'publish-due-posts';
    perform cron.schedule('publish-due-posts', '* * * * *', 'select publish_due_posts()');
  end if;
exception when others then
  raise notice 'cron schedule skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Admin overview (single query for the dashboard)
-- ---------------------------------------------------------------------------

create or replace function get_blog_overview()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'total', (select count(*) from posts),
    'published', (select count(*) from posts p where p.is_public
                    and (p.published_at is null or p.published_at <= now())),
    'drafts', (select count(*) from posts p where not p.is_public),
    'scheduled', (select count(*) from posts p where p.is_public
                    and p.published_at is not null and p.published_at > now()),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'title', p.published->>'title',
        'isPublic', p.is_public, 'updatedAt', p.updated_at,
        'publishedAt', p.published_at
      ) order by p.updated_at desc), '[]'::jsonb)
      from (select * from posts order by updated_at desc limit 5) p
    ),
    'topViewed', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', v.slug, 'views', v.views,
        'title', p.published->>'title'
      ) order by v.views desc), '[]'::jsonb)
      from (select v.* from post_views v order by v.views desc limit 5) v
      join posts p on p.slug = v.slug
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app server connects as the table owner (bypasses RLS); these policies
-- protect direct anon/authenticated access (browser, realtime, storage UIs).
-- ---------------------------------------------------------------------------

alter table posts enable row level security;
alter table pages enable row level security;
alter table projects enable row level security;
alter table settings enable row level security;
alter table media_assets enable row level security;
alter table blog_settings enable row level security;
alter table post_revisions enable row level security;
alter table post_views enable row level security;
alter table contact_messages enable row level security;

-- posts: public reads published+live+non-private only.
drop policy if exists posts_public_read on posts;
create policy posts_public_read on posts for select to anon
  using (cms_visible_post(posts));

drop policy if exists posts_admin_all on posts;
create policy posts_admin_all on posts for all to authenticated
  using (true) with check (true);

-- projects: public reads live projects.
drop policy if exists projects_public_read on projects;
create policy projects_public_read on projects for select to anon
  using (is_public and (published_at is null or published_at <= now()));

drop policy if exists projects_admin_all on projects;
create policy projects_admin_all on projects for all to authenticated
  using (true) with check (true);

-- pages: server-rendered only; admin can manage.
drop policy if exists pages_admin_all on pages;
create policy pages_admin_all on pages for all to authenticated
  using (true) with check (true);

-- settings / blog settings: admin only (public pages go through the server).
drop policy if exists settings_admin_all on settings;
create policy settings_admin_all on settings for all to authenticated
  using (true) with check (true);

drop policy if exists blog_settings_admin_all on blog_settings;
create policy blog_settings_admin_all on blog_settings for all to authenticated
  using (true) with check (true);

-- media metadata: admin only (files themselves are public storage objects).
drop policy if exists media_admin_all on media_assets;
create policy media_admin_all on media_assets for all to authenticated
  using (true) with check (true);

-- revisions: admin only.
drop policy if exists revisions_admin_all on post_revisions;
create policy revisions_admin_all on post_revisions for all to authenticated
  using (true) with check (true);

-- views: readable by admin; writes go through record_post_view().
drop policy if exists views_admin_read on post_views;
create policy views_admin_read on post_views for select to authenticated using (true);

-- contact: visitors may submit; only the admin reads/manages.
drop policy if exists contact_public_insert on contact_messages;
create policy contact_public_insert on contact_messages for insert to anon
  with check (char_length(name) <= 200 and char_length(email) <= 320 and char_length(message) <= 10000);

drop policy if exists contact_admin_all on contact_messages;
create policy contact_admin_all on contact_messages for all to authenticated
  using (true) with check (true);

-- Table privileges (Supabase defaults usually cover this; explicit is safer).
grant select on posts to anon;
grant select on projects to anon;
grant insert on contact_messages to anon;
grant all on posts to authenticated;
grant all on pages to authenticated;
grant all on projects to authenticated;
grant all on settings to authenticated;
grant all on media_assets to authenticated;
grant all on blog_settings to authenticated;
grant all on post_revisions to authenticated;
grant select on post_views to authenticated;
grant all on contact_messages to authenticated;

grant execute on function search_blog_posts(text, text, int, boolean, text, int, int) to anon, authenticated;
grant execute on function search_blog_suggest(text, int) to anon, authenticated;
grant execute on function get_blog_tags() to anon, authenticated;
grant execute on function get_related_posts(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: admin sees live publishing + inbox updates; post conflict warning
-- ---------------------------------------------------------------------------

drop publication if exists supabase_realtime;
create publication supabase_realtime for table posts, contact_messages;
