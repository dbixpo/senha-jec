# Senha JEC

Sisteminha interno de fila (não é oficial do Tribunal). Recepção anota **senha de papel + nome + serviço**, encaminha para 4 setores, cada um registra o que se resolveu. Tem cadastro de serviços, gestão de operadores e data/hora em tudo que salva.

- Site: https://dbixpo.github.io/senha-jec/
- Código: https://github.com/dbixpo/senha-jec
- Banco: projeto Supabase **Senha JEC** (organização DBixpo)

A senha do banco **não** vai neste repositório (ele é público). Fica em `manutencao.env` neste PC e no secret `SUPABASE_DB_PASSWORD` do GitHub.

## Ligar o banco

1. Espera o projeto **Senha JEC** ficar Ready.
2. SQL Editor: cola `supabase/schema.sql` → Run.
3. SQL Editor: cola `supabase/seed.sql` (arquivo só neste PC, no `.gitignore`) → Run. Isso cria os dois admins.
4. Project Settings → API: copia **Project URL** e **anon public**.
5. Abre o site, cola as duas chaves uma vez.

Login: `diego.bispo` e `flavia.abes`. A senha de cada um é o CPF.

## No balcão

- **Recepção:** número da senha, nome de quem está sendo atendido e o serviço. Encaminha na hora ou depois.
- **Serviços:** cadastro do que se faz lá dentro. A primeira fila precisa disso para registrar a pessoa.
- **Operadores:** só admin inclui gente no formato `primeiro.segundo`.
- Cada registro guarda data/hora de criação e da última alteração.
- O dia no topo é o histórico.

## Identidade

Amarelo **#FFD32C**. Sem brasão do Tribunal, para ninguém achar que é sistema oficial.
