-- Quem chamou a senha (produção do atendimento).
alter table senhas add column if not exists atendido_por uuid references operadores (id);
create index if not exists senhas_dia_atendido_idx on senhas (data, atendido_por);
