-- Observação própria (até 200), encaminhamento com hora, e a nota não some se vier vazia.

alter table senhas add column if not exists observacao text not null default '';

update senhas
set observacao = left(trim(resolucao), 200)
where observacao = ''
  and resolucao is not null
  and trim(resolucao) <> '';

alter table senhas drop constraint if exists senhas_observacao_len;
alter table senhas add constraint senhas_observacao_len check (char_length(observacao) <= 200);

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

grant execute on function finalizar_senha(uuid, uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
