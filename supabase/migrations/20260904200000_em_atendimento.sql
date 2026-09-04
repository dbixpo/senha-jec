-- Chamar só coloca em atendimento. Finalizar encerra. Não respondeu devolve pra fila.

update senhas
set
  status = 'resolvido',
  hora_inicio = coalesce(hora_inicio, hora_atendimento),
  hora_fim = coalesce(hora_fim, hora_atendimento)
where hora_atendimento is not null
  and hora_fim is null;

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

  return json_build_object('ok', true, 'primeira', primeira, 'senha', row_to_json(alvo));
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

  select id into escolhida
  from senhas
  where data = p_data
    and tipo_id = p_tipo_id
    and status = 'na_fila'
    and hora_fim is null
  order by coalesce(nao_respondeu, 0), preferencial desc, numero
  for update skip locked
  limit 1;

  if escolhida is null then
    return json_build_object('ok', false, 'motivo', 'fila_vazia');
  end if;

  return chamar_senha(escolhida, p_operador, null);
end;
$$;

create or replace function finalizar_senha(p_id uuid, p_operador uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  eh_admin boolean;
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

  update senhas
  set status = 'resolvido',
      hora_fim = timezone('utc', now()),
      updated_by = p_operador
  where id = p_id
  returning * into alvo;

  return json_build_object('ok', true, 'senha', row_to_json(alvo));
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

  select id into escolhida
  from senhas
  where data = alvo.data
    and tipo_id = alvo.tipo_id
    and status = 'na_fila'
    and hora_fim is null
    and id is distinct from p_id
  order by coalesce(nao_respondeu, 0), preferencial desc, numero
  for update skip locked
  limit 1;

  if escolhida is null then
    return json_build_object('ok', true, 'pulada', row_to_json(alvo), 'proxima', json_build_object('ok', false, 'motivo', 'fila_vazia'));
  end if;

  proxima := chamar_senha(escolhida, p_operador, null);
  return json_build_object('ok', true, 'pulada', row_to_json(alvo), 'proxima', proxima);
end;
$$;

grant execute on function chamar_senha(uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function chamar_proxima(uuid, uuid, date) to anon, authenticated;
grant execute on function finalizar_senha(uuid, uuid) to anon, authenticated;
grant execute on function liberar_senha(uuid, uuid) to anon, authenticated;
grant execute on function nao_respondeu_senha(uuid, uuid) to anon, authenticated;
