-- Voz da chamada (o que a TV fala e em que ordem) + guichês por tipo.

alter table tipos_atendimento
  add column if not exists guiches smallint not null default 1;

alter table tipos_atendimento drop constraint if exists tipos_guiches_ok;
alter table tipos_atendimento add constraint tipos_guiches_ok check (guiches >= 0 and guiches <= 20);

alter table painel_chamadas add column if not exists guiche smallint;
alter table painel_chamadas add column if not exists requisitante text not null default '';
alter table painel_chamadas add column if not exists atendente text not null default '';
alter table painel_chamadas add column if not exists local_nome text not null default '';

insert into configuracoes (chave, valor) values
  ('voz_script', '[{"id":"requisitante","on":true},{"id":"senha","on":true},{"id":"local","on":true},{"id":"guiche","on":true},{"id":"atendente","on":false}]')
on conflict (chave) do nothing;

drop function if exists chamar_proxima(uuid, uuid, date);
drop function if exists chamar_senha(uuid, uuid, timestamptz);
drop function if exists chamar_senha(uuid, uuid);

create function chamar_senha(
  p_id uuid,
  p_operador uuid,
  p_hora timestamptz default null,
  p_guiche integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  local_nome text := '';
  n_guiches smallint := 0;
  v_guiche integer := p_guiche;
  quem text;
  atendente_nome text := '';
  primeiro text := '';
  hist_local text := '';
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

  select coalesce(t.nome, ''), coalesce(t.guiches, 0)
    into local_nome, n_guiches
    from tipos_atendimento t
    where t.id = alvo.tipo_id;

  if n_guiches > 0 then
    if v_guiche is null or v_guiche < 1 or v_guiche > n_guiches then
      return json_build_object('ok', false, 'motivo', 'sem_guiche');
    end if;
  else
    v_guiche := null;
  end if;

  select coalesce(nome, '') into atendente_nome from operadores where id = p_operador;
  primeiro := split_part(trim(atendente_nome), ' ', 1);
  hist_local := coalesce(local_nome, '');
  if v_guiche is not null then
    hist_local := hist_local || ' · guichê ' || v_guiche::text;
  end if;

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
  values (alvo.id, alvo.tipo_id, p_operador, hist_local);

  insert into painel_chamadas (
    data, numero, preferencial, tipo_id, senha_id, origem, chamado_por,
    guiche, requisitante, atendente, local_nome
  )
  values (
    alvo.data, alvo.numero, alvo.preferencial, alvo.tipo_id, alvo.id, 'tipo', p_operador,
    v_guiche, coalesce(alvo.nome, ''), primeiro, coalesce(local_nome, '')
  );

  return json_build_object('ok', true, 'primeira', primeira, 'senha', row_to_json(alvo));
end;
$$;

create function chamar_proxima(
  p_tipo_id uuid,
  p_operador uuid,
  p_data date,
  p_guiche integer default null
)
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

  return chamar_senha(escolhida, p_operador, null, p_guiche);
end;
$$;
