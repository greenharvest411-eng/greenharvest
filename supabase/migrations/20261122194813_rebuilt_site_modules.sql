create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  txn_date date not null,
  name text not null,
  category text not null,
  quantity text,
  cost_ugx bigint not null check(cost_ugx>=0),
  expected_benefit text,
  proof text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(id,organisation_id)
);
create index if not exists purchases_org_date_idx on purchases(organisation_id,txn_date desc) where deleted_at is null;

create table if not exists crop_cycles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  name text not null,
  area text,
  cost_ugx bigint not null default 0 check(cost_ugx>=0),
  harvest_quantity text,
  revenue_ugx bigint not null default 0 check(revenue_ugx>=0),
  started_on date not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(id,organisation_id)
);
create index if not exists crop_cycles_org_date_idx on crop_cycles(organisation_id,started_on desc) where deleted_at is null;

create table if not exists investment_decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  decision_date date not null,
  name text not null,
  amount_ugx bigint not null default 0 check(amount_ugx>=0),
  reason text,
  approver text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(id,organisation_id)
);
create index if not exists decisions_org_date_idx on investment_decisions(organisation_id,decision_date desc) where deleted_at is null;

insert into permissions(code,description) values
 ('finance.contribution.view','View founder contributions'),('finance.contribution.create','Record founder contributions'),
 ('purchase.view','View purchases'),('purchase.create','Record purchases'),
 ('crop.view','View crop cycles'),('crop.create','Record crop cycles'),
 ('decision.view','View investment decisions'),('decision.create','Record investment decisions'),
 ('structure.view','View departments and locations'),('structure.create','Create departments and locations'),
 ('audit.view','View audit log')
on conflict(code) do nothing;
insert into role_permissions(role_id,permission_code)
select r.id,p.code from roles r cross join permissions p where r.name='Owner'
on conflict do nothing;

-- The app accesses PostgreSQL through its private Node API, not the Supabase
-- Data API. Keep all public tables closed to anon/authenticated clients until
-- explicit policies for the chosen auth model are added.
alter table organisations enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table memberships enable row level security;
alter table user_roles enable row level security;
alter table sessions enable row level security;
alter table departments enable row level security;
alter table locations enable row level security;
alter table projects enable row level security;
alter table accounts enable row level security;
alter table exchange_rates enable row level security;
alter table transactions enable row level security;
alter table founder_contributions enable row level security;
alter table audit_log enable row level security;
alter table purchases enable row level security;
alter table crop_cycles enable row level security;
alter table investment_decisions enable row level security;

