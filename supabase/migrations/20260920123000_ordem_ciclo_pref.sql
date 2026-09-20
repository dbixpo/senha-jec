-- Ciclo da proporção começa pela preferencial: P, depois N comuns.
-- Preferencial que já está na frente da fila não espera.

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
  fase text := 'pref';
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
      if fase = 'pref' then
        p_count := p_count + 1;
        if p_quota <= 0 or p_count >= p_quota then
          n_count := 0;
          p_count := 0;
          fase := case when n_quota > 0 then 'normais' else 'pref' end;
        end if;
      end if;
    else
      n_count := n_count + 1;
      if n_quota > 0 and n_count >= n_quota then
        n_count := 0;
        p_count := 0;
        fase := case when p_quota > 0 then 'pref' else 'normais' end;
      elsif n_quota > 0 then
        fase := 'normais';
      end if;
    end if;
  end loop;

  if p_exceto is not null then
    select preferencial into eh_pref from senhas where id = p_exceto;
    if found then
      if eh_pref then
        if fase = 'pref' then
          p_count := p_count + 1;
          if p_quota <= 0 or p_count >= p_quota then
            n_count := 0;
            p_count := 0;
            fase := case when n_quota > 0 then 'normais' else 'pref' end;
          end if;
        end if;
      else
        n_count := n_count + 1;
        if n_quota > 0 and n_count >= n_quota then
          n_count := 0;
          p_count := 0;
          fase := case when p_quota > 0 then 'pref' else 'normais' end;
        elsif n_quota > 0 then
          fase := 'normais';
        end if;
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
    and fase = 'pref';

  if adianta then
    return ids[pref_i];
  end if;

  return ids[1];
end;
$$;

grant execute on function proxima_da_fila(uuid, date, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
