-- Ordem de chamada: respeitar chegada (não fura quem chegou antes).
-- Dispenser de papel: nenhum, rolo único ou dois rolos (comum e preferencial).

insert into configuracoes (chave, valor) values
  ('dispenser_modo', 'nenhum'),
  ('dispenser_proxima', '1'),
  ('dispenser_proxima_comum', '1'),
  ('dispenser_proxima_pref', '1')
on conflict (chave) do nothing;

alter table senhas drop constraint if exists senhas_numero_por_dia;
alter table senhas add constraint senhas_numero_por_dia unique (data, numero, preferencial);

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

grant execute on function reservar_numero(boolean) to anon, authenticated;

create or replace function proxima_da_fila(p_tipo_id uuid, p_data date, p_exceto uuid default null)
returns uuid
language plpgsql
as $$
declare
  regra text;
  escolhida uuid;
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
    order by coalesce(nao_respondeu, 0),
             preferencial desc,
             coalesce(hora_recepcao, hora_chegada, created_at),
             numero
    for update skip locked
    limit 1;
    return escolhida;
  end if;

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
end;
$$;

grant execute on function proxima_da_fila(uuid, date, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
