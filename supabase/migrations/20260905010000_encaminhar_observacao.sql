-- Finalizar com outro tipo manda a senha para essa fila, em vez de encerrar.
-- A observação (resolucao) vai junto, até 200 caracteres.

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

  obs := nullif(left(trim(coalesce(p_observacao, '')), 200), '');
  destino := coalesce(p_tipo_id, alvo.tipo_id);

  if destino is distinct from alvo.tipo_id then
    select nome into destino_nome from tipos_atendimento where id = destino and ativo = true;
    if destino_nome is null then
      return json_build_object('ok', false, 'motivo', 'tipo_invalido');
    end if;

    insert into historico_chamadas (senha_id, tipo_id, chamado_por, local)
    values (
      alvo.id,
      destino,
      p_operador,
      'Encaminhado para ' || destino_nome || coalesce(' · ' || obs, '')
    );

    update senhas
    set tipo_id = destino,
        status = 'na_fila',
        hora_atendimento = null,
        hora_inicio = null,
        hora_fim = null,
        atendido_por = null,
        resolucao = obs,
        updated_by = p_operador
    where id = p_id
    returning * into alvo;

    return json_build_object('ok', true, 'encaminhou', true, 'senha', row_to_json(alvo));
  end if;

  update senhas
  set status = 'resolvido',
      hora_fim = timezone('utc', now()),
      resolucao = case when p_observacao is null then resolucao else obs end,
      updated_by = p_operador
  where id = p_id
  returning * into alvo;

  return json_build_object('ok', true, 'encaminhou', false, 'senha', row_to_json(alvo));
end;
$$;

grant execute on function finalizar_senha(uuid, uuid, uuid, text) to anon, authenticated;
