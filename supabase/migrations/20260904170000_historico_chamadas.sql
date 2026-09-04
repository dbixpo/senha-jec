-- Histórico auditável de chamadas + Chamar pode repetir (não ouviu).

create table if not exists historico_chamadas (
  id uuid primary key default gen_random_uuid(),
  senha_id uuid not null references senhas (id) on delete cascade,
  tipo_id uuid references tipos_atendimento (id),
  chamado_por uuid references operadores (id),
  chamado_em timestamptz not null default now(),
  local text not null default ''
);

create index if not exists historico_senha_idx on historico_chamadas (senha_id, chamado_em);

alter table historico_chamadas enable row level security;
drop policy if exists historico_publico on historico_chamadas;
create policy historico_publico on historico_chamadas for all using (true) with check (true);
alter table historico_chamadas replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table historico_chamadas;
  exception when duplicate_object then null;
  end;
end $$;

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
