# Senha JEC

Fila de recepção para um balcão pequeno: senha de papel, nome, tipo de atendimento e quem está chamando. Feito para o Juizado Especial Cível de Sorocaba, **sem ser sistema oficial do Tribunal**.

- Código: https://github.com/dbixpo/senha-jec
- Licença: [MIT](LICENSE)

O repositório é o **programa**. O banco Postgres de quem já usa no balcão **não está aqui** — nem URL, nem chave, nem senha. Quem for usar monta o **próprio** projeto no Supabase, cola o `supabase/schema.sql` e aponta o `js/config.js` local para esse projeto.

Qualquer núcleo, cartório ou recepção parecida pode copiar, hospedar o seu e adaptar os tipos.

## O que isto não é

Não é sistema do TJ, não substitui o SAJ/eSAJ, não emite senha oficial e não deve usar brasão nem identidade do Tribunal. É um painel interno de quem está na fila **hoje**, no mesmo espírito de uma planilha compartilhada.

## Como funciona

Três papéis na prática:

1. **Recepção (Senha geral)** chama a pessoa na porta, anota e manda para um tipo.
2. **Atendimento (Triagem, Consulta, Ajuizamento…)** chama a senha daquele tipo, atende e finaliza.
3. **Admin** vê o dashboard do dia, cadastra tipos e operadores.

Tudo é do **dia** escolhido no topo. Chamada, finalizar e não respondeu só valem **hoje**. Dia anterior é consulta.

### Recepção — Senha geral

1. **Chamar** — anota a hora. Ainda não grava no banco.
2. Preenche nome, tipo (T / C / A) e, se quiser, nº de processo. Preferencial acende o ícone (cadeira, idoso, gestante, colo, obesidade, autismo) e a senha vira P01, P02…
3. **Registrar** — grava na fila daquele tipo.
4. **Não veio** (na recepção) — descarta o rascunho, sem criar senha.

A numeração é uma sequência só no dia: 01, 02, 03… Preferencial usa o mesmo número com prefixo P, e **sobe** na fila do tipo.

### Atendimento — aba do tipo

Cada linha da planilha é uma senha.

| Botão | O que faz |
|---|---|
| **Chamar** / **Chamar próxima** | A senha fica *em atendimento* com você. A hora da primeira chamada é a hora de atendimento. |
| **Finalizar** | Encerra. Sai da fila. |
| **Não respondeu** / **Não veio** | Devolve para a fila (conta como não respondeu) e chama a próxima daquele tipo. |
| **Chamar de novo** | Nova entrada no histórico, continua com você. |

Se outra pessoa já chamou aquela senha, o sistema avisa e não deixa pegar.

Cores da linha:

- Rosa — esperando
- Amarelo — em atendimento
- Azul — finalizada

## Regras da fila

- **Uma senha, um atendente.** Quem chamou é dono até finalizar ou devolver.
- **Preferencial primeiro**, na ordem do número. Quem não respondeu volta para o fim da prioridade daquele grupo.
- **Chamada só no dia de hoje.** Trocar a data no topo é para olhar o histórico, não para chamar.
- **Usuário** é sempre `primeiro.sobrenome` (ponto no meio). **Senha de acesso** nesta instalação é o CPF — no seu fork, use o que fizer sentido e **nunca** commite CPF nem hash no GitHub público.
- Operador comum não cadastra tipo nem gente. Admin sim.

## Telas

| Aba | Quem usa | Para quê |
|---|---|---|
| Dashboard / Painel | Admin | Volume do dia, espera, preferencial, produção por pessoa |
| Senha geral | Recepção | Registrar quem chegou |
| T, C, A (ou os tipos que você cadastrar) | Quem atende | Chamar, finalizar, não respondeu |
| Configurações → Tipos | Admin | Nome, sigla, cor, ativar/desativar |
| Configurações → Operadores | Admin | Incluir, perfil, senha, ativar/desativar |

No celular o site vira PWA: no Android o Chrome oferece **Instalar**; no iPhone é Compartilhar → Adicionar à Tela de Início. No computador o convite de instalar não aparece.

## Subir o seu

Cada instalação tem o **seu** Supabase. Não existe banco compartilhado neste repositório.

1. Crie um projeto no [Supabase](https://supabase.com).
2. SQL Editor: rode `supabase/schema.sql` inteiro (tabelas, RLS, RPCs). Esse arquivo **pode** (e deve) ser usado: é o esquema, não os dados de ninguém.
3. Crie **os seus** operadores no SQL Editor, por exemplo:

```sql
insert into operadores (usuario, nome, senha_hash, papel)
values
  ('maria.silva', 'Maria Silva', crypt('senha-que-voce-escolher', gen_salt('bf')), 'admin');
```

Não use seed de outra mesa. `supabase/seed.sql` e `js/config.js`, se existirem na máquina de alguém, estão no `.gitignore` de propósito.

4. Em **Project Settings → API**, copie a URL e a chave **anon** (pode ser a publishable) **do projeto que você criou**.
5. Copie `js/config.example.js` para `js/config.js` e cole **a sua** URL e chave. Esse arquivo não vai para o Git.
6. Publique a pasta (GitHub Pages, Netlify, pasta num servidor). Abra o site e entre com o usuário criado.

A senha do **Postgres** (Settings → Database) também não vai para o repositório. Script local de manutenção usa `manutencao.env`, igual ao `.env.example`.

Realtime: em Database → Replication, as tabelas `senhas`, `historico_chamadas` e `tipos_atendimento` precisam estar no publication `supabase_realtime` (o `schema.sql` já tenta ligar).

## Stack

- Front estático: HTML, CSS, JS (sem build)
- [`@supabase/supabase-js`](https://supabase.com/docs) no CDN
- Postgres no Supabase: `senhas`, `historico_chamadas`, `tipos_atendimento`, `operadores`
- RPCs (`chamar_senha`, `chamar_proxima`, `finalizar_senha`, `nao_respondeu_senha`, `login_operador`…) com `FOR UPDATE` para dois atendentes não pegarem a mesma senha
- Service worker + `manifest.json` para PWA
- Fuso `America/Sao_Paulo`

Identidade visual: Inter; topbar `#FFD32C`; texto e botões escuros `#0D3B5E`; fundo `#F4F6F9`; faixa no login `#E63030` → `#FFD32C` → `#1A82B8`.

## Desenvolvimento

```bash
python -m http.server 8765
```

Abra `http://127.0.0.1:8765/`. Mudança de CSS/JS: suba o `?v=` no `index.html` e o nome do cache em `sw.js`, senão o PWA entrega arquivo velho.

Migrações extras ficam em `supabase/migrations/`. O arquivo canônico para um banco novo é `supabase/schema.sql`.

## Contribuir

Issue e PR no GitHub são bem-vindos: fila, acessibilidade no celular, tipos, dashboard. Não abra PR com senha, CPF, `.env`, `manutencao.env`, `js/config.js` nem URL de banco de ninguém.

Se for usar em outro órgão, troque o nome na interface e os tipos — e deixe claro que **não é sistema oficial**.
