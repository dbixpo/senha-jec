-- Não respondeu: devolve a senha à fila (no fim de quem já faltou) e chama a próxima.

alter table senhas
  add column if not exists nao_respondeu integer not null default 0;

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
  order by coalesce(nao_respondeu, 0), preferencial desc, numero
  for update skip locked
  limit 1;

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

  if alvo.hora_atendimento is null then
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
    and hora_atendimento is null
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

grant execute on function nao_respondeu_senha(uuid, uuid) to anon, authenticated;
