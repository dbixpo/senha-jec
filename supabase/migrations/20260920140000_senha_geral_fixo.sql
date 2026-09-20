alter table tipos_atendimento
  add column if not exists codigo text;

create unique index if not exists tipos_codigo_unico
  on tipos_atendimento (codigo)
  where codigo is not null;

do $$
declare
  sigla_g text := 'G';
begin
  if exists (select 1 from tipos_atendimento where codigo = 'geral') then
    update tipos_atendimento
      set nome = 'Senha geral',
          ativo = true,
          ordem = 0
      where codigo = 'geral';
    return;
  end if;
  if exists (select 1 from tipos_atendimento where upper(sigla) = 'G') then
    sigla_g := 'SG';
  end if;
  insert into tipos_atendimento (nome, sigla, cor, ordem, codigo, guiches, ativo)
  values ('Senha geral', sigla_g, '#0D3B5E', 0, 'geral', 1, true);
end $$;

create or replace function tipos_proteger_fixos()
returns trigger
language plpgsql
as $$
begin
  if old.codigo = 'geral' then
    new.nome := old.nome;
    new.sigla := old.sigla;
    new.cor := old.cor;
    new.ordem := old.ordem;
    new.codigo := old.codigo;
    new.ativo := true;
  end if;
  return new;
end;
$$;

drop trigger if exists tipos_proteger_fixos on tipos_atendimento;
create trigger tipos_proteger_fixos
before update on tipos_atendimento
for each row execute procedure tipos_proteger_fixos();

create or replace function tipos_bloquear_delete_fixo()
returns trigger
language plpgsql
as $$
begin
  if old.codigo = 'geral' then
    raise exception 'A Senha geral não pode ser apagada.';
  end if;
  return old;
end;
$$;

drop trigger if exists tipos_bloquear_delete_fixo on tipos_atendimento;
create trigger tipos_bloquear_delete_fixo
before delete on tipos_atendimento
for each row execute procedure tipos_bloquear_delete_fixo();
