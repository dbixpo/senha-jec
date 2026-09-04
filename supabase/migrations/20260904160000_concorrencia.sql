-- Concorrência: número único no dia e chamada exclusiva da senha.

create or replace function senhas_auto_numero()
returns trigger
language plpgsql
as $$
begin
  if new.data is null then
    new.data := (timezone('America/Sao_Paulo', now()))::date;
  end if;
  perform pg_advisory_xact_lock(879001, to_char(new.data, 'YYYYMMDD')::int);
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

create or replace function chamar_senha(p_id uuid, p_operador uuid, p_hora timestamptz default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo senhas%rowtype;
  quem text;
begin
  if p_operador is null then
    return json_build_object('ok', false, 'motivo', 'sem_operador');
  end if;

  select * into alvo from senhas where id = p_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  if alvo.hora_atendimento is not null and alvo.atendido_por is distinct from p_operador then
    select nome into quem from operadores where id = alvo.atendido_por;
    return json_build_object('ok', false, 'motivo', 'ja_chamada', 'com', coalesce(quem, 'outra pessoa'));
  end if;

  update senhas
  set hora_atendimento = coalesce(p_hora, timezone('utc', now())),
      status = 'em_atendimento',
      atendido_por = p_operador,
      updated_by = p_operador
  where id = p_id
  returning * into alvo;

  return json_build_object('ok', true, 'senha', row_to_json(alvo));
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
      status = 'na_fila',
      atendido_por = null,
      updated_by = p_operador
  where id = p_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function chamar_senha(uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function chamar_proxima(uuid, uuid, date) to anon, authenticated;
grant execute on function liberar_senha(uuid, uuid) to anon, authenticated;
