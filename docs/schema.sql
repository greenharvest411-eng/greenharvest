-- Green Harvest Uganda Ltd - draft PostgreSQL schema for the Phase 2 foundation.
-- STATUS: untested draft for developer review. It is the target for the future backend.
-- Rules: money kept as exact numbers; every row belongs to an organisation; no hard deletes of financial rows.
create extension if not exists pgcrypto;

create table organisations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references organisations(id),          -- subsidiaries point at the parent
  name text not null,
  base_currency char(3) not null default 'UGX',
  created_at timestamptz not null default now()
);
create table departments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  name text not null
);
create table locations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  name text not null, size_note text
);
create table projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  name text not null,
  status text not null check (status in ('Planned','Active','Completed')),
  budget_ugx bigint not null default 0 check (budget_ugx >= 0),
  forecast_revenue_ugx bigint not null default 0 check (forecast_revenue_ugx >= 0),
  main_risk text, next_milestone text, milestone_date date,
  created_at timestamptz not null default now()
);
create table accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  name text not null,
  kind text not null check (kind in ('Cash','Bank','Mobile money'))
);
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency char(3) not null, to_currency char(3) not null default 'UGX',
  rate numeric(18,6) not null check (rate > 0),
  rate_date date not null, source text,
  entered_by uuid, created_at timestamptz not null default now()
);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  txn_date date not null,
  direction text not null check (direction in ('in','out')),
  description text not null,
  original_amount numeric(18,2) not null check (original_amount >= 0),
  currency char(3) not null,
  exchange_rate numeric(18,6) not null default 1,          -- rate actually used, kept forever
  exchange_rate_id uuid references exchange_rates(id),
  amount_ugx bigint not null,                              -- reporting figure, never recalculated
  account_id uuid references accounts(id),
  project_id uuid references projects(id),
  department_id uuid references departments(id),
  phase smallint check (phase between 1 and 9),
  evidence text,
  created_by uuid, created_at timestamptz not null default now(),
  deleted_at timestamptz                                   -- soft delete only
);
create table founder_contributions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  month smallint not null check (month between 1 and 12),
  planned_ugx bigint, original_amount numeric(18,2) not null, currency char(3) not null,
  exchange_rate numeric(18,6) not null default 1, amount_ugx bigint not null,
  phase smallint check (phase between 0 and 9), account_note text,
  created_by uuid, created_at timestamptz not null default now(), deleted_at timestamptz
);
-- Users, roles and permissions (role-based, scoped to organisation/department/project/location)
create table users (id uuid primary key default gen_random_uuid(), email text unique not null, full_name text, is_active boolean not null default true);
create table roles (id uuid primary key default gen_random_uuid(), name text unique not null);
create table permissions (code text primary key);            -- e.g. 'finance.expense.create'
create table role_permissions (role_id uuid references roles(id), permission_code text references permissions(code), primary key (role_id, permission_code));
create table user_roles (
  user_id uuid references users(id), role_id uuid references roles(id),
  organisation_id uuid references organisations(id), department_id uuid, project_id uuid, location_id uuid
);
-- Append-only audit log
create table audit_log (
  id bigserial primary key, at timestamptz not null default now(),
  user_id uuid, action text not null, table_name text, record_id text,
  old_value jsonb, new_value jsonb, ip inet
);
revoke update, delete on audit_log from public;              -- also enforce with a trigger and restricted DB roles
