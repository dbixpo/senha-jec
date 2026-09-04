-- Senha JEC — cole no SQL Editor do Supabase (projeto "Senha JEC") e rode de uma vez.
-- Fuso: América/São Paulo.
-- Depois rode supabase/seed.sql (arquivo local, não vai para o GitHub).

create extension if not exists pgcrypto;

create table if not exists setores (
  id smallint primary key,
  nome text not null,
  cor text not null default '#C4895A',
  ordem smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into setores (id, nome, cor, ordem) values
  (1, 'Setor 1', '#C4895A', 1),
  (2, 'Setor 2', '#8A7A4B', 2),
  (3, 'Setor 3', '#B56A4A', 3),
  (4, 'Setor 4', '#6B4E3A', 4)
on conflict (id) do nothing;

create table if not exists operadores (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  nome text not null,
  papel text not null default 'operador'
    check (papel in ('admin', 'operador')),
  ativo boolean not null default true,
  senha_hash text not null,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  ativo boolean not null default true,
  created_by uuid references operadores (id),
  updated_by uuid references operadores (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists senhas (
  id uuid primary key default gen_random_uuid(),
  data date not null default (timezone('America/Sao_Paulo', now()))::date,
  numero integer not null,
  nome text not null default '',
  servico_id uuid references servicos (id),
  setor_id smallint references setores (id),
  status text not null default 'recepcao'
    check (status in ('recepcao', 'na_fila', 'em_atendimento', 'resolvido', 'cancelado')),
  resolucao text,
  hora_chegada timestamptz not null default now(),
  hora_encaminhamento timestamptz,
  hora_inicio timestamptz,
  hora_fim timestamptz,
  created_by uuid references operadores (id),
  updated_by uuid references operadores (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint senhas_numero_por_dia unique (data, numero)
);

create index if not exists senhas_dia_status_idx on senhas (data, status);
create index if not exists senhas_dia_setor_idx on senhas (data, setor_id, status);
create index if not exists senhas_dia_servico_idx on senhas (data, servico_id);

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

drop trigger if exists setores_updated_at on setores;
create trigger setores_updated_at
before update on setores
for each row execute procedure set_updated_at();

drop trigger if exists operadores_updated_at on operadores;
create trigger operadores_updated_at
before update on operadores
for each row execute procedure set_updated_at();

drop trigger if exists servicos_updated_at on servicos;
create trigger servicos_updated_at
before update on servicos
for each row execute procedure set_updated_at();

create or replace function login_operador(p_usuario text, p_senha text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  op operadores%rowtype;
begin
  select * into op
  from operadores
  where usuario = lower(trim(p_usuario))
    and ativo = true;

  if not found then
    return null;
  end if;

  if op.senha_hash is distinct from crypt(p_senha, op.senha_hash) then
    return null;
  end if;

  update operadores
  set ultimo_acesso = now()
  where id = op.id;

  return json_build_object(
    'id', op.id,
    'usuario', op.usuario,
    'nome', op.nome,
    'papel', op.papel
  );
end;
$$;

create or replace function criar_operador(p_usuario text, p_nome text, p_senha text, p_papel text default 'operador')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  novo operadores%rowtype;
begin
  insert into operadores (usuario, nome, senha_hash, papel)
  values (lower(trim(p_usuario)), trim(p_nome), crypt(p_senha, gen_salt('bf')), p_papel)
  returning * into novo;

  return json_build_object(
    'id', novo.id,
    'usuario', novo.usuario,
    'nome', novo.nome,
    'papel', novo.papel,
    'ativo', novo.ativo,
    'created_at', novo.created_at
  );
end;
$$;

create or replace function definir_senha_operador(p_id uuid, p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update operadores
  set senha_hash = crypt(p_senha, gen_salt('bf'))
  where id = p_id;
end;
$$;

grant execute on function login_operador(text, text) to anon, authenticated;
grant execute on function criar_operador(text, text, text, text) to anon, authenticated;
grant execute on function definir_senha_operador(uuid, text) to anon, authenticated;

alter table setores enable row level security;
alter table senhas enable row level security;
alter table operadores enable row level security;
alter table servicos enable row level security;

drop policy if exists setores_publico on setores;
create policy setores_publico on setores for all using (true) with check (true);

drop policy if exists senhas_publico on senhas;
create policy senhas_publico on senhas for all using (true) with check (true);

drop policy if exists operadores_publico on operadores;
create policy operadores_publico on operadores for all using (true) with check (true);

drop policy if exists servicos_publico on servicos;
create policy servicos_publico on servicos for all using (true) with check (true);

alter table senhas replica identity full;
alter table setores replica identity full;
alter table servicos replica identity full;
alter table operadores replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table senhas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table setores;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table servicos;
  exception when duplicate_object then null;
  end;
end;
$$;
