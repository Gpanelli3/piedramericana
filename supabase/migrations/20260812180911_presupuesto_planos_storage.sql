-- Bucket privado para planos / comprobantes de cotización por OT.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presupuesto-planos',
  'presupuesto-planos',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura / subida / actualización / borrado para usuarios autenticados.
drop policy if exists "presupuesto_planos_select_authenticated" on storage.objects;
create policy "presupuesto_planos_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'presupuesto-planos');

drop policy if exists "presupuesto_planos_insert_authenticated" on storage.objects;
create policy "presupuesto_planos_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'presupuesto-planos');

drop policy if exists "presupuesto_planos_update_authenticated" on storage.objects;
create policy "presupuesto_planos_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'presupuesto-planos')
  with check (bucket_id = 'presupuesto-planos');

drop policy if exists "presupuesto_planos_delete_authenticated" on storage.objects;
create policy "presupuesto_planos_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'presupuesto-planos');
