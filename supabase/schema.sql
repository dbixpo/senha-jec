-- Controle de fila — rode isto no SQL Editor do Supabase (de uma vez).
-- Fuso: América/São Paulo. Sem login por enquanto: quem tiver o link usa.

create table if not exists setores (
  id smallint primary key,
  nome text not null,
  cor text not null default '#1F6B56',
  ordem smallint not null default 1
);

insert into setores (id, nome, cor, ordem) values
  (1, 'Setor 1', '#1F6B56', 1),
  (2, 'Setor 2', '#2F5D8A', 2),
  (3, 'Setor 3', '#8A4B2F', 3),
  (4, 'Setor 4', '#6B3F7A', 4)
on conflict (id) do nothing;

create table if not exists senhas (
  id uuid primary key default gen_random_uuid(),
  data date not null default (timezone('America/Sao_Paulo', now()))::date,
  numero integer not null,
  nome text not null default '',
  setor_id smallint references setores (id),
  status text not null default 'recepcao'
    check (status in ('recepcao', 'na_fila', 'em_atendimento', 'resolvido', 'cancelado')),
  resolucao text,
  hora_chegada timestamptz not null default now(),
  hora_encaminhamento timestamptz,
  hora_inicio timestamptz,
  hora_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint senhas_numero_por_dia unique (data, numero)
);

create index if not exists senhas_dia_status_idx on senhas (data, status);
create index if not exists senhas_dia_setor_idx on senhas (data, setor_id, status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists senhas_updated_at on senhas;
create trigger senhas_updated_at
before update on senhas
for each row execute procedure set_updated_at();

alter table setores enable row level security;
alter table senhas enable row level security;

drop policy if exists setores_publico on setores;
create policy setores_publico on setores
  for all using (true) with check (true);

drop policy if exists senhas_publico on senhas;
create policy senhas_publico on senhas
  for all using (true) with check (true);

alter table senhas replica identity full;
alter table setores replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table senhas;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table setores;
  exception when duplicate_object then
    null;
  end;
end;
$$;
