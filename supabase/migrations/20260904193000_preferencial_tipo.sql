-- Motivo do atendimento preferencial (cadeira, 60+, gestante, colo, obesidade, autismo).
alter table senhas
  add column if not exists preferencial_tipo text;

alter table senhas drop constraint if exists senhas_preferencial_tipo_check;
alter table senhas add constraint senhas_preferencial_tipo_check
  check (
    preferencial_tipo is null
    or preferencial_tipo in ('cadeira', 'idoso', 'gestante', 'bebe', 'obesidade', 'autismo')
  );

create index if not exists senhas_dia_pref_tipo_idx on senhas (data, preferencial_tipo);
