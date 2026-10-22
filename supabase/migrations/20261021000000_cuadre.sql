-- Cuadre: cuentas de usuario y datos en Supabase

-- Tablas

create table public.categorias (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nombre text not null check (length(nombre) between 1 and 60),
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  grupo text not null check (grupo in ('necesidad', 'gusto', 'ahorro', 'aporte')),
  icono text not null default 'tag',
  color smallint not null default 0 check (color between 0 and 9),
  primary key (user_id, id)
);

create table public.cuentas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nombre text not null check (length(nombre) between 1 and 60),
  tipo text not null check (tipo in ('efectivo', 'banco', 'billetera')),
  primary key (user_id, id)
);

create table public.movimientos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  -- Pesos colombianos, siempre positivo y sin decimales.
  monto bigint not null check (monto > 0),
  categoria_id text not null,
  cuenta_id text not null,
  fecha date not null,
  nota text not null default '' check (length(nota) <= 200),
  creado_en timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, categoria_id) references public.categorias (user_id, id),
  foreign key (user_id, cuenta_id) references public.cuentas (user_id, id)
);
create index movimientos_por_fecha on public.movimientos (user_id, fecha desc);

-- Límite mensual por categoría de gasto.
create table public.presupuestos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categoria_id text not null,
  limite bigint not null check (limite > 0),
  primary key (user_id, categoria_id),
  foreign key (user_id, categoria_id) references public.categorias (user_id, id) on delete cascade
);

create table public.metas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nombre text not null check (length(nombre) between 1 and 60),
  objetivo bigint not null check (objetivo > 0),
  ahorrado bigint not null default 0 check (ahorrado >= 0),
  fecha_limite date,
  creado_en timestamptz not null default now(),
  primary key (user_id, id)
);

-- Si la descripción del banco contiene `patron`, el movimiento importado va a `categoria_id`.
create table public.reglas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patron text not null check (length(patron) between 1 and 80),
  categoria_id text not null,
  primary key (user_id, patron),
  foreign key (user_id, categoria_id) references public.categorias (user_id, id) on delete cascade
);

-- Seguridad: cada quien solo ve y cambia sus propias filas

alter table public.categorias enable row level security;
alter table public.cuentas enable row level security;
alter table public.movimientos enable row level security;
alter table public.presupuestos enable row level security;
alter table public.metas enable row level security;
alter table public.reglas enable row level security;

-- (select auth.uid()) se evalúa una sola vez por consulta y no una vez por fila.
create policy "solo lo propio" on public.categorias for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo propio" on public.cuentas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo propio" on public.movimientos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo propio" on public.presupuestos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo propio" on public.metas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo propio" on public.reglas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sin sesión no se puede tocar nada.
revoke all on public.categorias, public.cuentas, public.movimientos, public.presupuestos, public.metas, public.reglas from anon;

-- Funciones

-- Reemplaza todos los datos del usuario en una sola transacción
create or replace function public.reemplazar_todo(datos jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  delete from public.movimientos where user_id = uid;
  delete from public.reglas where user_id = uid;
  delete from public.presupuestos where user_id = uid;
  delete from public.metas where user_id = uid;
  delete from public.cuentas where user_id = uid;
  delete from public.categorias where user_id = uid;

  insert into public.categorias (user_id, id, nombre, tipo, grupo, icono, color)
  select uid, c->>'id', c->>'name', c->>'kind', c->>'group', coalesce(c->>'icon', 'tag'), coalesce((c->>'color')::smallint, 0)
  from jsonb_array_elements(coalesce(datos->'categories', '[]')) c;

  insert into public.cuentas (user_id, id, nombre, tipo)
  select uid, a->>'id', a->>'name', a->>'type'
  from jsonb_array_elements(coalesce(datos->'accounts', '[]')) a;

  insert into public.movimientos (user_id, id, tipo, monto, categoria_id, cuenta_id, fecha, nota, creado_en)
  select uid, t->>'id', t->>'kind', (t->>'amount')::bigint, t->>'categoryId', t->>'accountId', (t->>'date')::date,
         coalesce(t->>'note', ''), coalesce((t->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(datos->'transactions', '[]')) t;

  insert into public.presupuestos (user_id, categoria_id, limite)
  select uid, b->>'categoryId', (b->>'limit')::bigint
  from jsonb_array_elements(coalesce(datos->'budgets', '[]')) b;

  insert into public.metas (user_id, id, nombre, objetivo, ahorrado, fecha_limite, creado_en)
  select uid, g->>'id', g->>'name', (g->>'target')::bigint, coalesce((g->>'saved')::bigint, 0),
         nullif(g->>'deadline', '')::date, coalesce((g->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(datos->'goals', '[]')) g;

  insert into public.reglas (user_id, patron, categoria_id)
  select uid, r->>'pattern', r->>'categoryId'
  from jsonb_array_elements(coalesce(datos->'rules', '[]')) r
  on conflict (user_id, patron) do nothing;
end;
$$;

revoke all on function public.reemplazar_todo(jsonb) from public, anon;
grant execute on function public.reemplazar_todo(jsonb) to authenticated;

-- "Eliminar mi cuenta": borra el usuario y, en cascada, todos sus datos
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
