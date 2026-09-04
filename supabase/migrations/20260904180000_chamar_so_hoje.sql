-- Chamada só no dia de hoje (fuso América/São Paulo). Outros dias são consulta.

create or replace function chamar_senha(p_id uuid, p_operador uuid, p_hora timestamptz default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  local_nome text;
  primeira boolean := false;
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

  select coalesce(t.nome, '') into local_nome
  from tipos_atendimento t
  where t.id = alvo.tipo_id;

  if alvo.hora_atendimento is null then
    primeira := true;
    update senhas
    set hora_atendimento = coalesce(p_hora, timezone('utc', now())),
        status = 'em_atendimento',
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
    and hora_atendimento is null
  order by preferencial desc, numero
  for update skip locked
  limit 1;

  if escolhida is null then
    return json_build_object('ok', false, 'motivo', 'fila_vazia');
  end if;

  return chamar_senha(escolhida, p_operador, null);
end;
$$;
