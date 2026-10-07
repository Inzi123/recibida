-- Tabla de confirmaciones de asistencia (RSVP).
-- Pegá TODO este archivo en Supabase > SQL Editor > New query y tocá "Run".
--
-- Una fila por respuesta. Si alguien confirma por su familia:
--   nombre               = quien completa el formulario
--   acompanantes         = cuántas personas vienen con esa persona
--   nombres_acompanantes = los nombres de esas personas

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null check (char_length(nombre) between 1 and 100),
  asiste boolean not null,
  acompanantes int not null default 0 check (acompanantes between 0 and 10),
  nombres_acompanantes text[] not null default '{}' check (
    cardinality(nombres_acompanantes) = acompanantes
    and array_position(nombres_acompanantes, null) is null
    and not ('' = any (nombres_acompanantes))
    and char_length(array_to_string(nombres_acompanantes, '')) <= 1000
  )
);

alter table public.rsvps enable row level security;

-- Los invitados (rol anon) solo pueden insertar. No hay policy de select,
-- así que nadie puede leer las respuestas desde la página.
create policy "Invitados pueden confirmar"
  on public.rsvps for insert
  to anon
  with check (true);


-- Lista para el admin (admin.html).
-- Devuelve las respuestas solo si recibe la clave que se escribe en admin.html.
-- Acá se guarda el hash SHA-256 de la clave en minúsculas, no la clave: aunque
-- alguien vea este archivo, no puede leerla. La clave no distingue mayúsculas.
-- Para cambiar la clave, mirá el README.
create or replace function public.listar_rsvps(clave text)
returns setof public.rsvps
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if encode(sha256(convert_to(lower(coalesce(clave, '')), 'UTF8')), 'hex')
     <> 'c0a99f332ba301fed812ed7fbc72298eb90321061f2a0541028db0e505aaed2b' then
    raise exception 'Clave incorrecta' using errcode = '28000';
  end if;

  return query
    select * from public.rsvps order by created_at desc;
end;
$$;

revoke execute on function public.listar_rsvps(text) from public, anon, authenticated;
grant execute on function public.listar_rsvps(text) to anon;
