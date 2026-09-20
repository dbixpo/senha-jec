create table if not exists painel_imagens (
  id uuid primary key default gen_random_uuid(),
  ordem bigint not null default (extract(epoch from now()) * 1000)::bigint,
  mime text not null default 'image/jpeg',
  conteudo text not null,
  created_at timestamptz not null default now()
);
create index if not exists painel_imagens_ordem_idx on painel_imagens (ordem);

create or replace function painel_imagens_limite()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from painel_imagens) >= 30 then
    raise exception 'Limite de 30 imagens no painel da TV';
  end if;
  return new;
end;
$$;

drop trigger if exists painel_imagens_limite_trg on painel_imagens;
create trigger painel_imagens_limite_trg
before insert on painel_imagens
for each row execute procedure painel_imagens_limite();

alter table painel_imagens enable row level security;
drop policy if exists painel_imagens_publico on painel_imagens;
create policy painel_imagens_publico on painel_imagens for all using (true) with check (true);
do $$
begin
  grant all on table painel_imagens to anon, authenticated;
exception when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
