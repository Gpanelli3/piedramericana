-- Tabla de usuarios de negocio enlazada a auth.users (antes public.profiles).

alter table public.profiles rename to usuarios;

alter policy "authenticated_select_profiles" on public.usuarios rename to "authenticated_select_usuarios";
alter policy "authenticated_update_own_profile" on public.usuarios rename to "authenticated_update_own_usuario";

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;
