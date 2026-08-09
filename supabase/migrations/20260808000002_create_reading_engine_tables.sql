-- Create tables for the LingQ-style Reading Engine

create table if not exists reading_resources (
    id          uuid        primary key default gen_random_uuid(),
    title       text        not null,
    content     text        not null,
    language    varchar(5)  not null,
    difficulty  varchar(20),
    topic       varchar(100),
    source_url  text,
    created_by  uuid        references users(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index idx_reading_resources_language on reading_resources(language);
create index idx_reading_resources_difficulty on reading_resources(difficulty);
create index idx_reading_resources_topic on reading_resources(topic);

-- Enable full-text search via pg_trgm
create index if not exists idx_reading_resources_title_trgm
    on reading_resources using gin (title gin_trgm_ops);

create index if not exists idx_reading_resources_content_trgm
    on reading_resources using gin (content gin_trgm_ops);

create table if not exists reading_progress (
    user_id                    uuid        primary key references users(id) on delete cascade,
    words_read                 bigint      not null default 0,
    articles_completed         int         not null default 0,
    total_reading_time_seconds int         not null default 0,
    fluency_percentage         smallint    not null default 0 check (fluency_percentage >= 0 and fluency_percentage <= 100),
    last_read_at               timestamptz,
    updated_at                 timestamptz not null default now()
);

-- RPC to atomically upsert reading progress
create or replace function upsert_reading_progress(
    p_user_id        uuid,
    p_resource_id    uuid,
    p_words_read     int,
    p_duration_seconds int
) returns void as $$
begin
    insert into reading_progress (user_id, words_read, articles_completed, total_reading_time_seconds, fluency_percentage, last_read_at, updated_at)
    values (p_user_id, p_words_read, 1, p_duration_seconds, 0, now(), now())
    on conflict (user_id) do update
    set words_read                 = reading_progress.words_read + p_words_read,
        articles_completed         = reading_progress.articles_completed + 1,
        total_reading_time_seconds = reading_progress.total_reading_time_seconds + p_duration_seconds,
        last_read_at               = now(),
        updated_at                 = now();
end;
$$ language plpgsql security definer;

-- RLS: users can only read/update their own progress
alter table reading_progress enable row level security;

create policy "Users can view own progress"
    on reading_progress for select
    using (auth.uid() = user_id);

create policy "Users can update own progress"
    on reading_progress for update
    using (auth.uid() = user_id);

-- RLS for reading_resources: anyone can read, only owner can mutate
alter table reading_resources enable row level security;

create policy "Anyone can read resources"
    on reading_resources for select
    using (true);

create policy "Authenticated users can create resources"
    on reading_resources for insert
    with check (auth.uid() is not null);

create policy "Creator can update resource"
    on reading_resources for update
    using (auth.uid() = created_by);

create policy "Creator can delete resource"
    on reading_resources for delete
    using (auth.uid() = created_by);