create or replace function senhas_auto_numero()
returns trigger
language plpgsql
as $$
begin
  if new.data is null then
    new.data := (timezone('America/Sao_Paulo', now()))::date;
  end if;
  if new.numero is null then
    perform pg_advisory_xact_lock(879001, to_char(new.data, 'YYYYMMDD')::int);
    select coalesce(max(numero), 0) + 1
      into new.numero
      from senhas
      where data = new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists senhas_auto_numero on senhas;
create trigger senhas_auto_numero
before insert on senhas
for each row execute procedure senhas_auto_numero();
