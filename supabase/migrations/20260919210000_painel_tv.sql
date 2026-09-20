-- Painel da TV: cada "Chamar" vira um evento para a tela da espera.

create table if not exists painel_chamadas (
  id uuid primary key default gen_random_uuid(),
  data date not null default (timezone('America/Sao_Paulo', now()))::date,
  numero integer not null,
  preferencial boolean not null default false,
  tipo_id uuid references tipos_atendimento (id),
  senha_id uuid references senhas (id) on delete set null,
  origem text not null default 'tipo'
    check (origem in ('geral', 'tipo')),
  chamado_em timestamptz not null default now(),
  chamado_por uuid references operadores (id)
);

create index if not exists painel_chamadas_dia_idx on painel_chamadas (data, chamado_em desc);

alter table painel_chamadas enable row level security;
drop policy if exists painel_chamadas_publico on painel_chamadas;
create policy painel_chamadas_publico on painel_chamadas for all using (true) with check (true);
alter table painel_chamadas replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table painel_chamadas;
  exception when duplicate_object then null;
             when undefined_object then null;
             when others then null;
  end;
end;
$$;

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

  insert into painel_chamadas (data, numero, preferencial, tipo_id, senha_id, origem, chamado_por)
  values (alvo.data, alvo.numero, alvo.preferencial, alvo.tipo_id, alvo.id, 'tipo', p_operador);

  return json_build_object('ok', true, 'primeira', primeira, 'senha', row_to_json(alvo));
end;
$$;

grant execute on function chamar_senha(uuid, uuid, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
