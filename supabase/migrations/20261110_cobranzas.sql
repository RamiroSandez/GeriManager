-- Módulo Cobranzas: cuenta corriente mensual por paciente contra la obra social.
-- Reemplaza la planilla compartida de Excel. Correr una vez en Supabase → SQL Editor.
--
-- Los tipos de geriatrico_id / paciente_id se copian de las tablas existentes
-- (geriatricos.id y "Pacientes".id) para que las foreign keys coincidan.

do $$
declare
  t_geri text := (select format_type(atttypid, atttypmod) from pg_attribute
                  where attrelid = 'public.geriatricos'::regclass and attname = 'id');
  t_pac  text := (select format_type(atttypid, atttypmod) from pg_attribute
                  where attrelid = 'public."Pacientes"'::regclass and attname = 'id');
begin
  -- Configuración de la cuenta de cada paciente (una por paciente)
  execute format($sql$
    create table if not exists public.cobranzas_cuentas (
      id bigint generated always as identity primary key,
      geriatrico_id %1$s not null references public.geriatricos(id) on delete cascade,
      paciente_id %2$s not null unique references public."Pacientes"(id) on delete cascade,
      cobertura text,
      porcentaje_honorarios numeric(5,2) not null default 8 check (porcentaje_honorarios between 0 and 100),
      honorario_inicial numeric(14,2) check (honorario_inicial >= 0),
      honorario_inicial_abonado_el date,
      observaciones text,
      created_at timestamptz not null default now()
    )
  $sql$, t_geri, t_pac);

  -- Un registro por mes facturado
  execute format($sql$
    create table if not exists public.cobranzas_meses (
      id bigint generated always as identity primary key,
      geriatrico_id %1$s not null references public.geriatricos(id) on delete cascade,
      paciente_id %2$s not null references public."Pacientes"(id) on delete cascade,
      periodo date not null check (extract(day from periodo) = 1),
      numero_factura text,
      importe numeric(14,2) check (importe >= 0),
      fecha_presentacion date,
      lugar_presentacion text,
      fecha_cobro date,
      importe_cobrado numeric(14,2) check (importe_cobrado >= 0),
      pagador text check (pagador in ('obra_social', 'familiar', 'otro')),
      porcentaje_honorarios numeric(5,2) not null default 8 check (porcentaje_honorarios between 0 and 100),
      honorarios_abonados_el date,
      observaciones text,
      created_at timestamptz not null default now(),
      unique (paciente_id, periodo)
    )
  $sql$, t_geri, t_pac);
end $$;

create index if not exists cobranzas_cuentas_geriatrico_idx on public.cobranzas_cuentas (geriatrico_id);
create index if not exists cobranzas_meses_geriatrico_idx on public.cobranzas_meses (geriatrico_id);

-- ── Seguridad: solo dueño del geriátrico o miembros admin/gerente ───────────
-- security definer para poder leer geriatricos/miembros sin depender de sus políticas.
create or replace function public.puede_gestionar_cobranzas(gid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from geriatricos g where g.id::text = gid and g.user_id = auth.uid())
      or exists (select 1 from miembros_geriatrico m
                 where m.geriatrico_id::text = gid and m.user_id = auth.uid() and m.rol in ('admin', 'gerente'))
$$;

alter table public.cobranzas_cuentas enable row level security;
alter table public.cobranzas_meses enable row level security;

drop policy if exists cobranzas_cuentas_acceso on public.cobranzas_cuentas;
create policy cobranzas_cuentas_acceso on public.cobranzas_cuentas
  for all to authenticated
  using (public.puede_gestionar_cobranzas(geriatrico_id::text))
  with check (
    public.puede_gestionar_cobranzas(geriatrico_id::text)
    -- evita asociar un paciente de otro geriátrico
    and exists (select 1 from public."Pacientes" p where p.id = paciente_id and p.geriatrico_id = cobranzas_cuentas.geriatrico_id)
  );

drop policy if exists cobranzas_meses_acceso on public.cobranzas_meses;
create policy cobranzas_meses_acceso on public.cobranzas_meses
  for all to authenticated
  using (public.puede_gestionar_cobranzas(geriatrico_id::text))
  with check (
    public.puede_gestionar_cobranzas(geriatrico_id::text)
    -- evita asociar un paciente de otro geriátrico
    and exists (select 1 from public."Pacientes" p where p.id = paciente_id and p.geriatrico_id = cobranzas_meses.geriatrico_id)
  );
