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

create table if not exists tipos_atendimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text not null unique,
  cor text not null default '#6B3FA0',
  ordem smallint not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into tipos_atendimento (nome, sigla, cor, ordem) values
  ('Triagem', 'T', '#6B3FA0', 1),
  ('Consulta', 'C', '#7BA83D', 2),
  ('Ajuizamento', 'A', '#D97A9A', 3)
on conflict (sigla) do nothing;

create table if not exists configuracoes (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references operadores (id)
);

insert into configuracoes (chave, valor) values
  ('ordem_chamada', 'proporcao'),
  ('ordem_normais', '2'),
  ('ordem_preferenciais', '1'),
  ('dispenser_modo', 'nenhum'),
  ('dispenser_proxima', '1'),
  ('dispenser_proxima_comum', '1'),
  ('dispenser_proxima_pref', '1')
on conflict (chave) do nothing;

create table if not exists senhas (
  id uuid primary key default gen_random_uuid(),
  data date not null default (timezone('America/Sao_Paulo', now()))::date,
  numero integer not null,
  nome text not null default '',
  tipo_id uuid references tipos_atendimento (id),
  preferencial boolean not null default false,
  preferencial_tipo text
    check (preferencial_tipo is null or preferencial_tipo in ('cadeira', 'idoso', 'gestante', 'bebe', 'obesidade', 'autismo')),
  hora_recepcao timestamptz,
  hora_atendimento timestamptz,
  atendido_por uuid references operadores (id),
  processo text not null default '',
  servico_id uuid references servicos (id),
  setor_id smallint references setores (id),
  status text not null default 'recepcao'
    check (status in ('recepcao', 'na_fila', 'em_atendimento', 'resolvido', 'cancelado')),
  resolucao text,
  observacao text not null default '',
  hora_chegada timestamptz not null default now(),
  hora_encaminhamento timestamptz,
  hora_inicio timestamptz,
  hora_fim timestamptz,
  created_by uuid references operadores (id),
  updated_by uuid references operadores (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nao_respondeu integer not null default 0,
  constraint senhas_numero_por_dia unique (data, numero, preferencial),
  constraint senhas_observacao_len check (char_length(observacao) <= 200)
);

alter table senhas add column if not exists observacao text not null default '';
alter table senhas drop constraint if exists senhas_observacao_len;
alter table senhas add constraint senhas_observacao_len check (char_length(observacao) <= 200);

create index if not exists senhas_dia_status_idx on senhas (data, status);
create index if not exists senhas_dia_setor_idx on senhas (data, setor_id, status);
create index if not exists senhas_dia_servico_idx on senhas (data, servico_id);
create index if not exists senhas_dia_atendido_idx on senhas (data, atendido_por);
create index if not exists senhas_dia_pref_tipo_idx on senhas (data, preferencial_tipo);

create table if not exists historico_chamadas (
  id uuid primary key default gen_random_uuid(),
  senha_id uuid not null references senhas (id) on delete cascade,
  tipo_id uuid references tipos_atendimento (id),
  chamado_por uuid references operadores (id),
  chamado_em timestamptz not null default now(),
  local text not null default ''
);
create index if not exists historico_senha_idx on historico_chamadas (senha_id, chamado_em);

create table if not exists painel_chamadas (
  id uuid primary key default gen_random_uuid(),
  data date not null default (timezone('America/Sao_Paulo', now()))::date,
  numero integer not null,
  preferencial boolean not null default false,
  tipo_id uuid references tipos_atendimento (id),
  senha_id uuid references senhas (id) on delete set null,
  origem text not null default 'tipo'
    check (origem in ('geral', 'tipo')),
  chamado_em timestamptz not null default now(),
  chamado_por uuid references operadores (id)
);
create index if not exists painel_chamadas_dia_idx on painel_chamadas (data, chamado_em desc);

create table if not exists painel_imagens (
  id uuid primary key default gen_random_uuid(),
  ordem bigint not null default (extract(epoch from now()) * 1000)::bigint,
  mime text not null default 'image/jpeg',
  conteudo text not null,
  created_at timestamptz not null default now()
);
create index if not exists painel_imagens_ordem_idx on painel_imagens (ordem);

create or replace function painel_imagens_limite()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from painel_imagens) >= 30 then
    raise exception 'Limite de 30 imagens no painel da TV';
  end if;
  return new;
end;
$$;

drop trigger if exists painel_imagens_limite_trg on painel_imagens;
create trigger painel_imagens_limite_trg
before insert on painel_imagens
for each row execute procedure painel_imagens_limite();

create or replace function senhas_auto_numero()
returns trigger
language plpgsql
as $$
declare
  modo text;
  chave_rolo text;
  atual integer;
begin
  if new.data is null then
    new.data := (timezone('America/Sao_Paulo', now()))::date;
  end if;
  perform pg_advisory_xact_lock(879001, to_char(new.data, 'YYYYMMDD')::int);

  if new.numero is not null and new.numero > 0 then
    return new;
  end if;

  select coalesce(
    (select valor from configuracoes where chave = 'dispenser_modo'),
    'nenhum'
  ) into modo;

  if modo = 'separado' then
    chave_rolo := case when new.preferencial then 'dispenser_proxima_pref' else 'dispenser_proxima_comum' end;
    select greatest(coalesce(valor::int, 1), 1) into atual
      from configuracoes where chave = chave_rolo for update;
    if not found then
      atual := 1;
    end if;
    new.numero := atual;
    update configuracoes
      set valor = (atual + 1)::text
      where chave = chave_rolo;
    if not found then
      insert into configuracoes (chave, valor) values (chave_rolo, (atual + 1)::text);
    end if;
    return new;
  end if;

  if modo = 'unico' then
    select greatest(coalesce(valor::int, 1), 1) into atual
      from configuracoes where chave = 'dispenser_proxima' for update;
    if not found then
      atual := 1;
    end if;
    new.numero := atual;
    update configuracoes
      set valor = (atual + 1)::text
      where chave = 'dispenser_proxima';
    if not found then
      insert into configuracoes (chave, valor) values ('dispenser_proxima', (atual + 1)::text);
    end if;
    return new;
  end if;

  select coalesce(max(numero), 0) + 1
    into new.numero
    from senhas
    where data = new.data;
  return new;
end;
$$;

drop trigger if exists senhas_auto_numero on senhas;
create trigger senhas_auto_numero
before insert on senhas
for each row execute procedure senhas_auto_numero();

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

drop trigger if exists configuracoes_updated_at on configuracoes;
create trigger configuracoes_updated_at
before update on configuracoes
for each row execute procedure set_updated_at();

create or replace function login_operador(p_usuario text, p_senha text)
returns json
language plpgsql
security definer
set search_path = public, extensions
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
set search_path = public, extensions
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
set search_path = public, extensions
as $$
begin
  update operadores
  set senha_hash = crypt(p_senha, gen_salt('bf'))
  where id = p_id;
end;
$$;

create or replace function chamar_senha(p_id uuid, p_operador uuid, p_hora timestamptz default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  local_nome text;
  quem text;
  primeira boolean := false;
  agora timestamptz;
begin
  if p_operador is null then
    return json_build_object('ok', false, 'motivo', 'sem_operador');
  end if;

  select * into alvo from senhas where id = p_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  if alvo.data is distinct from (timezone('America/Sao_Paulo', now()))::date then
    return json_build_object('ok', false, 'motivo', 'outro_dia');
  end if;

  if alvo.status = 'resolvido' or alvo.hora_fim is not null then
    return json_build_object('ok', false, 'motivo', 'ja_finalizada');
  end if;

  if alvo.status = 'em_atendimento' and alvo.atendido_por is distinct from p_operador then
    select nome into quem from operadores where id = alvo.atendido_por;
    return json_build_object('ok', false, 'motivo', 'ja_chamada', 'com', coalesce(quem, 'outra pessoa'));
  end if;

  select coalesce(t.nome, '') into local_nome
  from tipos_atendimento t
  where t.id = alvo.tipo_id;

  agora := coalesce(p_hora, timezone('utc', now()));

  if alvo.status is distinct from 'em_atendimento' then
    primeira := true;
    update senhas
    set status = 'em_atendimento',
        hora_inicio = coalesce(hora_inicio, agora),
        hora_atendimento = coalesce(hora_atendimento, agora),
        hora_fim = null,
        atendido_por = p_operador,
        updated_by = p_operador
    where id = p_id
    returning * into alvo;
  else
    update senhas
    set updated_by = p_operador
    where id = p_id
    returning * into alvo;
  end if;

  insert into historico_chamadas (senha_id, tipo_id, chamado_por, local)
  values (alvo.id, alvo.tipo_id, p_operador, coalesce(local_nome, ''));

  insert into painel_chamadas (data, numero, preferencial, tipo_id, senha_id, origem, chamado_por)
  values (alvo.data, alvo.numero, alvo.preferencial, alvo.tipo_id, alvo.id, 'tipo', p_operador);

  return json_build_object('ok', true, 'primeira', primeira, 'senha', row_to_json(alvo));
end;
$$;

create or replace function proxima_da_fila(p_tipo_id uuid, p_data date, p_exceto uuid default null)
returns uuid
language plpgsql
as $$
declare
  regra text;
  n_quota int := 2;
  p_quota int := 1;
  n_count int := 0;
  p_count int := 0;
  escolhida uuid;
  rec record;
  ids uuid[] := array[]::uuid[];
  prefs boolean[] := array[]::boolean[];
  i int;
  pref_i int := 0;
  adianta boolean;
  eh_pref boolean;
begin
  select coalesce(
    (select valor from configuracoes where chave = 'ordem_chamada'),
    'proporcao'
  ) into regra;

  begin
    n_quota := greatest(0, least(99, coalesce(
      (select valor from configuracoes where chave = 'ordem_normais')::int,
      2
    )));
  exception when others then
    n_quota := 2;
  end;

  begin
    p_quota := greatest(0, least(99, coalesce(
      (select valor from configuracoes where chave = 'ordem_preferenciais')::int,
      1
    )));
  exception when others then
    p_quota := 1;
  end;

  if regra = 'preferenciais_primeiro' then
    select id into escolhida
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status = 'na_fila'
      and hora_fim is null
      and id is distinct from p_exceto
    order by coalesce(nao_respondeu, 0),
             preferencial desc,
             coalesce(hora_recepcao, hora_chegada, created_at),
             numero
    for update skip locked
    limit 1;
    return escolhida;
  end if;

  if regra = 'intercalar' or p_quota = 0 then
    select id into escolhida
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status = 'na_fila'
      and hora_fim is null
      and id is distinct from p_exceto
    order by coalesce(nao_respondeu, 0),
             coalesce(hora_recepcao, hora_chegada, created_at),
             numero
    for update skip locked
    limit 1;
    return escolhida;
  end if;

  for rec in
    select preferencial
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status in ('em_atendimento', 'resolvido')
    order by coalesce(hora_atendimento, hora_inicio, created_at), numero
  loop
    if rec.preferencial then
      p_count := p_count + 1;
      if p_quota <= 0 or p_count >= p_quota then
        n_count := 0;
        p_count := 0;
      end if;
    else
      n_count := n_count + 1;
    end if;
  end loop;

  if p_exceto is not null then
    select preferencial into eh_pref from senhas where id = p_exceto;
    if found then
      if eh_pref then
        p_count := p_count + 1;
        if p_quota <= 0 or p_count >= p_quota then
          n_count := 0;
          p_count := 0;
        end if;
      else
        n_count := n_count + 1;
      end if;
    end if;
  end if;

  for rec in
    select id, preferencial
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status = 'na_fila'
      and hora_fim is null
      and id is distinct from p_exceto
    order by coalesce(nao_respondeu, 0),
             coalesce(hora_recepcao, hora_chegada, created_at),
             numero
    for update skip locked
  loop
    ids := ids || rec.id;
    prefs := prefs || rec.preferencial;
  end loop;

  if cardinality(ids) = 0 then
    return null;
  end if;

  for i in 1..cardinality(ids) loop
    if prefs[i] then
      pref_i := i;
      exit;
    end if;
  end loop;

  if prefs[1] then
    return ids[1];
  end if;

  adianta := pref_i > 0
    and p_quota > 0
    and p_count < p_quota
    and (n_quota <= 0 or n_count >= n_quota);

  if adianta then
    return ids[pref_i];
  end if;

  return ids[1];
end;
$$;

create or replace function reservar_numero(p_preferencial boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  modo text;
  chave_rolo text;
  atual integer;
begin
  perform pg_advisory_xact_lock(879002, 1);

  select coalesce(
    (select valor from configuracoes where chave = 'dispenser_modo'),
    'nenhum'
  ) into modo;

  if modo is distinct from 'unico' and modo is distinct from 'separado' then
    select coalesce(max(numero), 0) + 1 into atual
      from senhas
      where data = (timezone('America/Sao_Paulo', now()))::date;
    return json_build_object('ok', true, 'numero', atual, 'reservado', false, 'modo', 'nenhum');
  end if;

  if modo = 'separado' then
    chave_rolo := case when coalesce(p_preferencial, false) then 'dispenser_proxima_pref' else 'dispenser_proxima_comum' end;
  else
    chave_rolo := 'dispenser_proxima';
  end if;

  select greatest(coalesce(valor::int, 1), 1) into atual
    from configuracoes where chave = chave_rolo for update;
  if not found then
    atual := 1;
    insert into configuracoes (chave, valor) values (chave_rolo, '2')
    on conflict (chave) do update set valor = '2';
  else
    update configuracoes set valor = (atual + 1)::text where chave = chave_rolo;
  end if;

  return json_build_object(
    'ok', true,
    'numero', atual,
    'reservado', true,
    'modo', modo,
    'preferencial', coalesce(p_preferencial, false)
  );
end;
$$;

create or replace function chamar_proxima(p_tipo_id uuid, p_operador uuid, p_data date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  escolhida uuid;
begin
  if p_operador is null or p_tipo_id is null then
    return json_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  if p_data is distinct from (timezone('America/Sao_Paulo', now()))::date then
    return json_build_object('ok', false, 'motivo', 'outro_dia');
  end if;

  escolhida := proxima_da_fila(p_tipo_id, p_data, null);

  if escolhida is null then
    return json_build_object('ok', false, 'motivo', 'fila_vazia');
  end if;

  return chamar_senha(escolhida, p_operador, null);
end;
$$;

drop function if exists finalizar_senha(uuid, uuid);
drop function if exists finalizar_senha(uuid, uuid, uuid, text);

create function finalizar_senha(
  p_id uuid,
  p_operador uuid,
  p_tipo_id uuid default null,
  p_observacao text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  eh_admin boolean;
  destino uuid;
  origem_nome text;
  destino_nome text;
  obs text;
begin
  if p_operador is null then
    return json_build_object('ok', false, 'motivo', 'sem_operador');
  end if;

  select * into alvo from senhas where id = p_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  if alvo.data is distinct from (timezone('America/Sao_Paulo', now()))::date then
    return json_build_object('ok', false, 'motivo', 'outro_dia');
  end if;

  if alvo.status is distinct from 'em_atendimento' then
    return json_build_object('ok', false, 'motivo', 'nao_em_atendimento');
  end if;

  select exists (
    select 1 from operadores
    where id = p_operador and papel = 'admin' and ativo = true
  ) into eh_admin;

  if alvo.atendido_por is distinct from p_operador and not eh_admin then
    return json_build_object('ok', false, 'motivo', 'nao_e_sua');
  end if;

  obs := left(trim(coalesce(p_observacao, alvo.observacao, '')), 200);
  destino := coalesce(p_tipo_id, alvo.tipo_id);

  if destino is distinct from alvo.tipo_id then
    select t.nome into destino_nome from tipos_atendimento t where t.id = destino and t.ativo = true;
    if destino_nome is null then
      return json_build_object('ok', false, 'motivo', 'tipo_invalido');
    end if;
    select t.nome into origem_nome from tipos_atendimento t where t.id = alvo.tipo_id;

    insert into historico_chamadas (senha_id, tipo_id, chamado_por, local)
    values (
      alvo.id,
      alvo.tipo_id,
      p_operador,
      'Encaminhado de ' || coalesce(origem_nome, '?') || ' para ' || destino_nome
        || case when obs <> '' then ' · ' || obs else '' end
    );

    update senhas
    set tipo_id = destino,
        status = 'na_fila',
        hora_atendimento = null,
        hora_inicio = null,
        hora_fim = null,
        hora_encaminhamento = timezone('utc', now()),
        atendido_por = null,
        observacao = obs,
        updated_by = p_operador
    where id = p_id
    returning * into alvo;

    return json_build_object('ok', true, 'encaminhou', true, 'senha', row_to_json(alvo));
  end if;

  update senhas
  set status = 'resolvido',
      hora_fim = timezone('utc', now()),
      observacao = obs,
      updated_by = p_operador
  where id = p_id
  returning * into alvo;

  return json_build_object('ok', true, 'encaminhou', false, 'senha', row_to_json(alvo));
end;
$$;

create or replace function liberar_senha(p_id uuid, p_operador uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  eh_admin boolean;
begin
  select * into alvo from senhas where id = p_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  select exists (
    select 1 from operadores
    where id = p_operador and papel = 'admin' and ativo = true
  ) into eh_admin;

  if alvo.atendido_por is not null
     and alvo.atendido_por is distinct from p_operador
     and not eh_admin then
    return json_build_object('ok', false, 'motivo', 'nao_e_sua');
  end if;

  update senhas
  set hora_atendimento = null,
      hora_inicio = null,
      hora_fim = null,
      status = 'na_fila',
      atendido_por = null,
      updated_by = p_operador
  where id = p_id;

  return json_build_object('ok', true);
end;
$$;

create or replace function nao_respondeu_senha(p_id uuid, p_operador uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  eh_admin boolean;
  escolhida uuid;
  proxima json;
begin
  if p_operador is null then
    return json_build_object('ok', false, 'motivo', 'sem_operador');
  end if;

  select * into alvo from senhas where id = p_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  if alvo.data is distinct from (timezone('America/Sao_Paulo', now()))::date then
    return json_build_object('ok', false, 'motivo', 'outro_dia');
  end if;

  if alvo.status is distinct from 'em_atendimento' then
    return json_build_object('ok', false, 'motivo', 'nao_chamada');
  end if;

  select exists (
    select 1 from operadores
    where id = p_operador and papel = 'admin' and ativo = true
  ) into eh_admin;

  if alvo.atendido_por is distinct from p_operador and not eh_admin then
    return json_build_object('ok', false, 'motivo', 'nao_e_sua');
  end if;

  insert into historico_chamadas (senha_id, tipo_id, chamado_por, local)
  values (alvo.id, alvo.tipo_id, p_operador, 'Não respondeu');

  update senhas
  set hora_atendimento = null,
      hora_inicio = null,
      hora_fim = null,
      status = 'na_fila',
      atendido_por = null,
      nao_respondeu = coalesce(nao_respondeu, 0) + 1,
      updated_by = p_operador
  where id = p_id
  returning * into alvo;

  escolhida := proxima_da_fila(alvo.tipo_id, alvo.data, p_id);

  if escolhida is null then
    return json_build_object('ok', true, 'pulada', row_to_json(alvo), 'proxima', json_build_object('ok', false, 'motivo', 'fila_vazia'));
  end if;

  proxima := chamar_senha(escolhida, p_operador, null);
  return json_build_object('ok', true, 'pulada', row_to_json(alvo), 'proxima', proxima);
end;
$$;

grant execute on function login_operador(text, text) to anon, authenticated;
grant execute on function criar_operador(text, text, text, text) to anon, authenticated;
grant execute on function definir_senha_operador(uuid, text) to anon, authenticated;
grant execute on function chamar_senha(uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function proxima_da_fila(uuid, date, uuid) to anon, authenticated;
grant execute on function reservar_numero(boolean) to anon, authenticated;
grant execute on function chamar_proxima(uuid, uuid, date) to anon, authenticated;
grant execute on function finalizar_senha(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function liberar_senha(uuid, uuid) to anon, authenticated;
grant execute on function nao_respondeu_senha(uuid, uuid) to anon, authenticated;

alter table setores enable row level security;
alter table senhas enable row level security;
alter table operadores enable row level security;
alter table servicos enable row level security;
alter table tipos_atendimento enable row level security;
alter table historico_chamadas enable row level security;
alter table configuracoes enable row level security;
alter table painel_chamadas enable row level security;
alter table painel_imagens enable row level security;

drop policy if exists setores_publico on setores;
create policy setores_publico on setores for all using (true) with check (true);

drop policy if exists senhas_publico on senhas;
create policy senhas_publico on senhas for all using (true) with check (true);

drop policy if exists operadores_publico on operadores;
create policy operadores_publico on operadores for all using (true) with check (true);

drop policy if exists servicos_publico on servicos;
create policy servicos_publico on servicos for all using (true) with check (true);

drop policy if exists tipos_publico on tipos_atendimento;
create policy tipos_publico on tipos_atendimento for all using (true) with check (true);

drop policy if exists historico_publico on historico_chamadas;
create policy historico_publico on historico_chamadas for all using (true) with check (true);

drop policy if exists configuracoes_publico on configuracoes;
create policy configuracoes_publico on configuracoes for all using (true) with check (true);

drop policy if exists painel_chamadas_publico on painel_chamadas;
create policy painel_chamadas_publico on painel_chamadas for all using (true) with check (true);

drop policy if exists painel_imagens_publico on painel_imagens;
create policy painel_imagens_publico on painel_imagens for all using (true) with check (true);
do $$
begin
  grant all on table painel_imagens to anon, authenticated;
exception when undefined_object then null;
end $$;

alter table senhas replica identity full;
alter table setores replica identity full;
alter table servicos replica identity full;
alter table operadores replica identity full;
alter table tipos_atendimento replica identity full;
alter table historico_chamadas replica identity full;
alter table configuracoes replica identity full;
alter table painel_chamadas replica identity full;

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
  begin
    alter publication supabase_realtime add table tipos_atendimento;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table historico_chamadas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table configuracoes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table painel_chamadas;
  exception when duplicate_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
