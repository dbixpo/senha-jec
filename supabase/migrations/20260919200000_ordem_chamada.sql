-- Ordem de chamada: intercalado (1 preferencial, 1 comum) ou preferenciais sempre na frente.

create table if not exists configuracoes (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references operadores (id)
);

insert into configuracoes (chave, valor) values
  ('ordem_chamada', 'intercalar')
on conflict (chave) do nothing;

drop trigger if exists configuracoes_updated_at on configuracoes;
create trigger configuracoes_updated_at
before update on configuracoes
for each row execute procedure set_updated_at();

alter table configuracoes enable row level security;
drop policy if exists configuracoes_publico on configuracoes;
create policy configuracoes_publico on configuracoes for all using (true) with check (true);
alter table configuracoes replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table configuracoes;
  exception when duplicate_object then null;
  end;
end;
$$;

create or replace function proxima_da_fila(p_tipo_id uuid, p_data date, p_exceto uuid default null)
returns uuid
language plpgsql
as $$
declare
  regra text;
  escolhida uuid;
  slots_pref integer;
  slots_comum integer;
  quer_pref boolean;
begin
  select coalesce(
    (select valor from configuracoes where chave = 'ordem_chamada'),
    'intercalar'
  ) into regra;

  if regra is distinct from 'intercalar' then
    select id into escolhida
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status = 'na_fila'
      and hora_fim is null
      and id is distinct from p_exceto
    order by coalesce(nao_respondeu, 0), preferencial desc, numero
    for update skip locked
    limit 1;
    return escolhida;
  end if;

  select
    count(*) filter (
      where preferencial
        and (status is distinct from 'na_fila' or coalesce(nao_respondeu, 0) > 0)
    ),
    count(*) filter (
      where not preferencial
        and (status is distinct from 'na_fila' or coalesce(nao_respondeu, 0) > 0)
    )
  into slots_pref, slots_comum
  from senhas
  where data = p_data
    and tipo_id = p_tipo_id;

  quer_pref := coalesce(slots_pref, 0) <= coalesce(slots_comum, 0);

  if quer_pref then
    select id into escolhida
    from senhas
    where data = p_data
      and tipo_id = p_tipo_id
      and status = 'na_fila'
      and hora_fim is null
      and preferencial = true
      and id is distinct from p_exceto
    order by coalesce(nao_respondeu, 0), numero
    for update skip locked
    limit 1;
    if escolhida is not null then
      return escolhida;
    end if;
  end if;

  select id into escolhida
  from senhas
  where data = p_data
    and tipo_id = p_tipo_id
    and status = 'na_fila'
    and hora_fim is null
    and preferencial = false
    and id is distinct from p_exceto
  order by coalesce(nao_respondeu, 0), numero
  for update skip locked
  limit 1;
  if escolhida is not null then
    return escolhida;
  end if;

  select id into escolhida
  from senhas
  where data = p_data
    and tipo_id = p_tipo_id
    and status = 'na_fila'
    and hora_fim is null
    and preferencial = true
    and id is distinct from p_exceto
  order by coalesce(nao_respondeu, 0), numero
  for update skip locked
  limit 1;
  return escolhida;
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

grant execute on function proxima_da_fila(uuid, date, uuid) to anon, authenticated;
grant execute on function chamar_proxima(uuid, uuid, date) to anon, authenticated;
grant execute on function nao_respondeu_senha(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
