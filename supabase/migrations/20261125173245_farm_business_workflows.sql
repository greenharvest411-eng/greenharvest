-- Farm operations, supplier/customer registers, stock, sales, attendance and payroll.
create table suppliers (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null check (length(trim(name)) between 1 and 200), contact_name text, phone text, email text, address text,
  created_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(id, organisation_id), unique(organisation_id, name)
);
create table customers (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null check (length(trim(name)) between 1 and 200), contact_name text, phone text, email text, address text,
  created_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(id, organisation_id), unique(organisation_id, name)
);
create table stock_items (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  name text not null check (length(trim(name)) between 1 and 200), category text not null default 'Other',
  unit text not null default 'unit', reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  location_id uuid, created_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(id, organisation_id), foreign key(location_id, organisation_id) references locations(id, organisation_id)
);
create index stock_items_org_name_idx on stock_items(organisation_id, name);
create table stock_movements (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  item_id uuid not null, movement_date date not null, movement_type text not null check (movement_type in ('receipt','issue','adjustment','sale')),
  quantity numeric(14,3) not null check (quantity <> 0), unit_cost_ugx bigint not null default 0 check (unit_cost_ugx >= 0),
  reference text, created_by uuid not null references users(id), created_at timestamptz not null default now(),
  foreign key(item_id, organisation_id) references stock_items(id, organisation_id)
);
create index stock_movements_org_item_date_idx on stock_movements(organisation_id,item_id,movement_date desc);
alter table purchases add column supplier_id uuid;
alter table purchases add column stock_item_id uuid;
alter table purchases add column quantity_units numeric(14,3);
alter table purchases add column project_id uuid;
alter table purchases add constraint purchases_supplier_org_fk foreign key(supplier_id,organisation_id) references suppliers(id,organisation_id);
alter table purchases add constraint purchases_stock_item_org_fk foreign key(stock_item_id,organisation_id) references stock_items(id,organisation_id);
alter table purchases add constraint purchases_project_org_fk foreign key(project_id,organisation_id) references projects(id,organisation_id);
alter table crop_cycles add column location_id uuid;
alter table crop_cycles add column variety text;
alter table crop_cycles add column status text not null default 'Growing' check(status in ('Planned','Growing','Harvested','Closed'));
alter table crop_cycles add constraint crop_cycles_location_org_fk foreign key(location_id,organisation_id) references locations(id,organisation_id);
alter table employees add column salary_ugx bigint not null default 0 check(salary_ugx >= 0);
create table attendance (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id), employee_id uuid not null,
  attendance_date date not null, status text not null check(status in ('Present','Absent','Leave','Half day')),
  notes text, created_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(organisation_id, employee_id, attendance_date),
  foreign key(employee_id,organisation_id) references employees(id,organisation_id)
);
create index attendance_org_date_idx on attendance(organisation_id,attendance_date desc);
create table payroll (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id), employee_id uuid not null,
  period_start date not null, period_end date not null, gross_ugx bigint not null check(gross_ugx >= 0),
  paid_ugx bigint not null default 0 check(paid_ugx >= 0 and paid_ugx <= gross_ugx), status text not null default 'Pending' check(status in ('Pending','Partially paid','Paid')),
  paid_on date, notes text, created_by uuid not null references users(id), created_at timestamptz not null default now(),
  unique(organisation_id,employee_id,period_start), check(period_end >= period_start),
  foreign key(employee_id,organisation_id) references employees(id,organisation_id)
);
create index payroll_org_period_idx on payroll(organisation_id,period_start desc);
create table sales (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id),
  sale_date date not null, customer_id uuid, crop_cycle_id uuid, stock_item_id uuid,
  produce text not null, quantity numeric(14,3) not null check(quantity > 0), unit text not null default 'kg',
  unit_price_ugx bigint not null check(unit_price_ugx >= 0), total_ugx bigint not null check(total_ugx >= 0),
  payment_method text, notes text, created_by uuid not null references users(id), created_at timestamptz not null default now(),
  foreign key(customer_id,organisation_id) references customers(id,organisation_id),
  foreign key(crop_cycle_id,organisation_id) references crop_cycles(id,organisation_id),
  foreign key(stock_item_id,organisation_id) references stock_items(id,organisation_id)
);
create index sales_org_date_idx on sales(organisation_id,sale_date desc);
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table stock_items enable row level security;
alter table stock_movements enable row level security;
alter table attendance enable row level security;
alter table payroll enable row level security;
alter table sales enable row level security;
revoke all on table suppliers,customers,stock_items,stock_movements,attendance,payroll,sales from anon,authenticated;
insert into permissions(code,description) values
 ('supplier.view','View suppliers'),('supplier.create','Create suppliers'),
 ('customer.view','View customers'),('customer.create','Create customers'),
 ('stock.view','View stock'),('stock.create','Manage stock'),
 ('sales.view','View sales'),('sales.create','Record sales'),
 ('attendance.view','View attendance'),('attendance.create','Record attendance'),
 ('payroll.view','View payroll'),('payroll.create','Record payroll')
on conflict(code) do nothing;
insert into role_permissions(role_id,permission_code)
select r.id,p.code from roles r cross join permissions p where r.name='Owner'
on conflict do nothing;
