insert into permissions(code, description) values
  ('people.update','Update people records'),
  ('asset.update','Update asset records')
on conflict (code) do nothing;

insert into role_permissions(role_id, permission_code)
select r.id, p.code from roles r cross join permissions p where r.name='Owner'
on conflict do nothing;
