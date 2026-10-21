// Shared predecessor schema for isolated PGlite/native-PostgreSQL tests only.
// Auth, cron and net are test doubles; no hosted Supabase or network call occurs.
export const predecessorSchema = `
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema private; create schema extensions; create schema vault; create schema net; create schema cron;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,n*2),'hex')$$;
 create table public.profiles(id uuid primary key references auth.users(id),display_name text default '',city text default '',preferred_front text default 'worker',account_type text);
 create table public.sole_admin(singleton boolean primary key default true,user_id uuid unique references auth.users(id));
 create table public.businesses(id uuid primary key default gen_random_uuid(),owner_id uuid unique references auth.users(id),name text,created_at timestamptz default now(),unique(id,owner_id));
 create table public.campaign_drafts(id uuid primary key default gen_random_uuid(),business_id uuid,owner_id uuid,title text,action text,quantity integer,created_at timestamptz default now(),updated_at timestamptz default now());
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
 create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$select 1::bigint$$;
 grant usage on schema public,private,auth,extensions to authenticated,service_role; grant all on all tables in schema public to service_role;
 grant execute on all functions in schema auth to authenticated,service_role;
`;
