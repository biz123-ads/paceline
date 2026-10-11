-- ProjectPulse: accounts, projects and AI credits.
--
-- Every table carries user_id and Row Level Security: a signed-in user reads
-- and writes only their own rows, straight from the browser. The credit
-- ledger is read-only for users; only the server (service role) writes it.

-- --------------------------------------------------------------- projects

create table public.projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null check (kind in ('saas', 'app', 'other')),
  stage text not null check (stage in ('idea', 'building', 'launched', 'growing')),
  website_url text,
  launch_date date,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  pricing_summary text not null default '' check (char_length(pricing_summary) <= 500),
  target_audience text not null default '' check (char_length(target_audience) <= 500),
  tech_stack text[] not null default '{}',
  cash_balance bigint not null default 0 check (cash_balance >= 0),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

-- One row per project and month. Money in cents.
create table public.snapshots (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  mrr bigint not null check (mrr >= 0),
  paying_customers integer not null check (paying_customers >= 0),
  new_mrr bigint check (new_mrr >= 0),
  expansion_mrr bigint check (expansion_mrr >= 0),
  contraction_mrr bigint check (contraction_mrr >= 0),
  churned_mrr bigint check (churned_mrr >= 0),
  new_customers integer check (new_customers >= 0),
  churned_customers integer check (churned_customers >= 0),
  costs bigint check (costs >= 0),
  source text not null default 'manual' check (source in ('manual', 'csv', 'stripe', 'revenuecat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, period)
);

create index snapshots_user_id_idx on public.snapshots (user_id);

-- One goal per project.
create table public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null unique references public.projects on delete cascade,
  label text not null default '' check (char_length(label) <= 100),
  target_mrr bigint not null check (target_mrr > 0),
  deadline text not null check (deadline ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  baseline_period text not null check (baseline_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  baseline_mrr bigint not null check (baseline_mrr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals (user_id);

-- The plan's levers; null means "use what the data says".
create table public.assumptions (
  project_id uuid primary key references public.projects on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  arpu bigint check (arpu > 0),
  monthly_churn_rate double precision check (monthly_churn_rate between 0 and 1),
  new_customers_per_month double precision check (new_customers_per_month between 0 and 1000000),
  monthly_costs bigint check (monthly_costs >= 0),
  updated_at timestamptz not null default now()
);

create index assumptions_user_id_idx on public.assumptions (user_id);

-- ---------------------------------------------------- row level security

alter table public.projects enable row level security;
alter table public.snapshots enable row level security;
alter table public.goals enable row level security;
alter table public.assumptions enable row level security;

create policy "own projects" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Rows that hang off a project: yours, and the project must be yours too.
create policy "own snapshots" on public.snapshots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );

create policy "own goals" on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );

create policy "own assumptions" on public.assumptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ AI credits

-- Movements, never edited: the balance is their sum. A chat reserves its
-- credits up front (negative delta) and gets them back as a refund if the
-- answer fails. (reason, reference) makes Stripe webhooks idempotent.
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('signup_bonus', 'purchase', 'chat', 'refund', 'adjustment')),
  reference text,
  created_at timestamptz not null default now(),
  unique (reason, reference)
);

create index credit_ledger_user_id_idx on public.credit_ledger (user_id);

alter table public.credit_ledger enable row level security;

create policy "read own credits" on public.credit_ledger
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Balance of the signed-in user.
create function public.credit_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer
  from public.credit_ledger
  where user_id = (select auth.uid());
$$;

grant execute on function public.credit_balance() to authenticated;

-- Server only: takes `amount` credits for one request, or fails if the
-- balance is too low. Serialised per user so two requests can't both spend
-- the last credit.
create function public.reserve_credits(p_user_id uuid, p_amount integer, p_reference text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select coalesce(sum(delta), 0) into balance
  from public.credit_ledger where user_id = p_user_id;
  if balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into public.credit_ledger (user_id, delta, reason, reference)
  values (p_user_id, -p_amount, 'chat', p_reference);
  return balance - p_amount;
end;
$$;

-- Server only: gives back what a failed request reserved (once).
create function public.refund_credits(p_reference text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.credit_ledger (user_id, delta, reason, reference)
  select user_id, -delta, 'refund', reference
  from public.credit_ledger
  where reason = 'chat' and reference = p_reference
  on conflict (reason, reference) do nothing;
$$;

revoke execute on function public.reserve_credits(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.refund_credits(text) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, integer, text) to service_role;
grant execute on function public.refund_credits(text) to service_role;

-- A few free credits to try the assistant, once per account.
create function public.grant_signup_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_ledger (user_id, delta, reason, reference)
  values (new.id, 10, 'signup_bonus', new.id::text)
  on conflict (reason, reference) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.grant_signup_bonus();

-- One row per assistant question: what it cost us, to price credits from
-- measurements. Written by the server only; users can't read it.
create table public.assistant_requests (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid,
  credits integer not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  web_searches integer not null default 0,
  model_turns integer not null default 0,
  outcome text not null check (outcome in ('answered', 'refused', 'failed')),
  created_at timestamptz not null default now()
);

create index assistant_requests_user_id_idx on public.assistant_requests (user_id);

alter table public.assistant_requests enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes.
