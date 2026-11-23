create extension if not exists pgcrypto;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references organisations(id),
  name text not null check (length(trim(name)) between 1 and 200),
  base_currency char(3) not null default 'UGX' check (base_currency ~ '^[A-Z]{3}$'),
  financial_year_start_month smallint not null default 1 check (financial_year_start_month between 1 and 12),
  created_at timestamptz not null default now(),
  unique (id, base_currency)
);
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  name text not null,
  unique nulls not distinct (organisation_id,name),
  unique (id,organisation_id)
);
create table if not exists permissions (
  code text primary key,
  description text not null
);
create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_code text not null references permissions(code),
  primary key(role_id,permission_code)
);
create table if not exists memberships (
  user_id uuid not null references users(id),
  organisation_id uuid not null references organisations(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(user_id,organisation_id)
);
create table if not exists user_roles (
  user_id uuid not null,
  role_id uuid not null,
  organisation_id uuid not null,
  department_id uuid,
  project_id uuid,
  location_id uuid,
  primary key(user_id,role_id,organisation_id),
  foreign key(user_id,organisation_id) references memberships(user_id,organisation_id),
  foreign key(role_id,organisation_id) references roles(id,organisation_id)
);
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);
create index if not exists sessions_expiry_idx on sessions(expires_at);
create table if not exists departments (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null, unique(id,organisation_id), unique(organisation_id,name)
);
create table if not exists locations (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null, size_note text, unique(id,organisation_id), unique(organisation_id,name)
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  department_id uuid, location_id uuid, name text not null,
  status text not null default 'Planned' check(status in ('Planned','Active','Completed')),
  budget_ugx bigint not null default 0 check(budget_ugx>=0), forecast_revenue_ugx bigint not null default 0 check(forecast_revenue_ugx>=0),
  main_risk text, next_milestone text, milestone_date date, created_at timestamptz not null default now(), deleted_at timestamptz,
  photo_key text,
  unique(id,organisation_id),
  foreign key(department_id,organisation_id) references departments(id,organisation_id),
  foreign key(location_id,organisation_id) references locations(id,organisation_id)
);
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null, kind text not null check(kind in ('Cash','Bank','Mobile money')),
  currency char(3) not null default 'UGX' check(currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references users(id), created_at timestamptz not null default now(), deleted_at timestamptz,
  unique(id,organisation_id), unique(organisation_id,name)
);
create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  from_currency char(3) not null check(from_currency ~ '^[A-Z]{3}$'), to_currency char(3) not null default 'UGX' check(to_currency ~ '^[A-Z]{3}$'),
  rate numeric(24,10) not null check(rate>0), rate_date date not null, source text,
  entered_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(id,organisation_id,from_currency), unique(id,organisation_id,from_currency,to_currency)
);
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  txn_date date not null, direction text not null check(direction in ('in','out')), description text not null,
  original_minor bigint not null check(original_minor>0), currency char(3) not null check(currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(24,10) not null check(exchange_rate>0), exchange_rate_id uuid,
  amount_ugx bigint not null check(amount_ugx>0), account_id uuid, project_id uuid, department_id uuid,
  phase smallint check(phase between 1 and 9), evidence text,
  created_by uuid not null references users(id), created_at timestamptz not null default now(),
  deleted_at timestamptz, reversed_by uuid references transactions(id),
  foreign key(account_id,organisation_id) references accounts(id,organisation_id),
  foreign key(project_id,organisation_id) references projects(id,organisation_id),
  foreign key(department_id,organisation_id) references departments(id,organisation_id),
  foreign key(exchange_rate_id,organisation_id,currency) references exchange_rates(id,organisation_id,from_currency)
);
create index if not exists transactions_org_date_idx on transactions(organisation_id,txn_date desc) where deleted_at is null;
create table if not exists founder_contributions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  txn_date date not null, original_minor bigint not null check(original_minor>0), currency char(3) not null check(currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(24,10) not null check(exchange_rate>0), exchange_rate_id uuid, amount_ugx bigint not null check(amount_ugx>0),
  planned_ugx bigint, phase smallint check(phase between 0 and 9), account_id uuid, created_by uuid not null references users(id),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  foreign key(exchange_rate_id,organisation_id,currency) references exchange_rates(id,organisation_id,from_currency),
  foreign key(account_id,organisation_id) references accounts(id,organisation_id)
);
create table if not exists audit_log (
  id bigserial primary key, at timestamptz not null default now(), user_id uuid references users(id), organisation_id uuid references organisations(id),
  action text not null, record_type text, record_id text, old_value jsonb, new_value jsonb, ip inet, user_agent text
);
create index if not exists audit_log_org_at_idx on audit_log(organisation_id,at desc);
create or replace function deny_audit_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end; $$;
drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update before update or delete on audit_log for each row execute function deny_audit_mutation();

insert into permissions(code,description) values
 ('*','Owner: all permissions'),('organisation.view','View company profile'),
 ('finance.account.view','View finance accounts'),('finance.account.create','Create finance accounts'),
 ('finance.rate.view','View exchange rates'),('finance.rate.create','Create exchange rates'),
 ('finance.transaction.view','View finance transactions'),('finance.transaction.create','Create finance transactions'),
 ('project.view','View projects'),('project.create','Create projects'),('documents.upload','Upload company pictures')
on conflict(code) do nothing;
insert into roles(organisation_id,name) values(null,'Owner') on conflict do nothing;
insert into role_permissions(role_id,permission_code)
select r.id,p.code from roles r cross join permissions p where r.name='Owner' and r.organisation_id is null
on conflict do nothing;

