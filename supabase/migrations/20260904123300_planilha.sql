-- Planilha da Flavinha: tipos T/C/A, preferencial, horários e nº processo.

create table if not exists tipos_atendimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text not null unique,
  cor text not null default '#6B3FA0',
  ordem smallint not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into tipos_atendimento (nome, sigla, cor, ordem) values
  ('Triagem', 'T', '#6B3FA0', 1),
  ('Consulta', 'C', '#7BA83D', 2),
  ('Ajuizamento', 'A', '#D97A9A', 3)
on conflict (sigla) do nothing;

alter table senhas add column if not exists tipo_id uuid references tipos_atendimento (id);
alter table senhas add column if not exists preferencial boolean not null default false;
alter table senhas add column if not exists hora_recepcao timestamptz;
alter table senhas add column if not exists hora_atendimento timestamptz;
alter table senhas add column if not exists processo text not null default '';

update senhas
set hora_recepcao = coalesce(hora_recepcao, hora_chegada)
where hora_recepcao is null and hora_chegada is not null;

create index if not exists senhas_dia_tipo_idx on senhas (data, tipo_id);
create index if not exists senhas_dia_pref_idx on senhas (data, preferencial desc, numero);

drop trigger if exists tipos_updated_at on tipos_atendimento;
create trigger tipos_updated_at
before update on tipos_atendimento
for each row execute procedure set_updated_at();

alter table tipos_atendimento enable row level security;
drop policy if exists tipos_publico on tipos_atendimento;
create policy tipos_publico on tipos_atendimento for all using (true) with check (true);

alter table tipos_atendimento replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table tipos_atendimento;
  exception when duplicate_object then null;
  end;
end;
$$;
