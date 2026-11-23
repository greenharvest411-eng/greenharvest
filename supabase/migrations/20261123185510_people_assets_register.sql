create table employees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  job_title text check (job_title is null or length(job_title) <= 150),
  email text check (email is null or length(email) <= 320),
  phone text check (phone is null or length(phone) <= 50),
  start_date date,
  status text not null default 'Active' check (status in ('Active','On leave','Inactive')),
  department_id uuid,
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, email),
  foreign key (department_id, organisation_id) references departments(id, organisation_id)
);
create index employees_org_name_idx on employees(organisation_id, full_name);
create index employees_org_department_idx on employees(organisation_id, department_id) where department_id is not null;

create table assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  name text not null check (length(trim(name)) between 1 and 200),
  category text not null check (length(trim(category)) between 1 and 100),
  asset_tag text check (asset_tag is null or length(asset_tag) <= 100),
  acquired_on date,
  cost_ugx bigint not null default 0 check (cost_ugx >= 0),
  status text not null default 'In use' check (status in ('In use','Maintenance','Retired')),
  location_id uuid,
  assigned_to uuid,
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, asset_tag),
  foreign key (location_id, organisation_id) references locations(id, organisation_id),
  foreign key (assigned_to, organisation_id) references employees(id, organisation_id)
);
create index assets_org_name_idx on assets(organisation_id, name);
create index assets_org_location_idx on assets(organisation_id, location_id) where location_id is not null;
create index assets_org_assignee_idx on assets(organisation_id, assigned_to) where assigned_to is not null;

alter table employees enable row level security;
alter table assets enable row level security;
revoke all on table employees, assets from anon, authenticated;

insert into permissions(code, description) values
  ('people.view','View people register'),
  ('people.create','Add people'),
  ('asset.view','View asset register'),
  ('asset.create','Add assets')
on conflict (code) do nothing;
insert into role_permissions(role_id, permission_code)
select r.id, p.code from roles r cross join permissions p where r.name='Owner'
on conflict do nothing;
