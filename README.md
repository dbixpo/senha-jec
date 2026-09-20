# Senha JEC

Fila de recepção para um balcão pequeno: senha de papel, nome, tipo de atendimento e quem está chamando. Feito para o Juizado Especial Cível de Sorocaba.

- Código: https://github.com/dbixpo/senha-jec
- Licença: [MIT](LICENSE)

O repositório é o **programa**. O banco Postgres de quem já usa no balcão **não está aqui** — nem URL, nem chave, nem senha. Quem for usar monta o **próprio** projeto no Supabase, cola o `supabase/schema.sql` e aponta o `js/config.js` local para esse projeto.

Qualquer núcleo, cartório ou recepção parecida pode copiar, hospedar o seu e adaptar os tipos.

## Como funciona

Três papéis na prática:

1. **Recepção (Senha geral)** chama a pessoa na porta, anota e manda para um tipo.
2. **Atendimento (Triagem, Consulta, Ajuizamento…)** chama a senha daquele tipo, atende e finaliza.
3. **Admin** vê o dashboard do dia, cadastra tipos e operadores.

Tudo da **fila** (chamar, finalizar, não respondeu) e o **dashboard** são do **dia** escolhido no topo. Chamada só vale **hoje**. Dia anterior na fila é consulta.

**Relatórios** (Opções → Relatórios) é outra tela: some a data do topo e as abas da fila. O período (de/até, ou atalhos de 7 dias, 30 dias e o mês) vale para todos os relatórios. Hoje dá para ver em **Painel** (gráficos) ou **Lista** (senha a senha).

**Painel da TV** (Opções → Painel da TV, ou o atalho na tela de login) vira este aparelho na televisão da espera. No topo, no centro, tem data e relógio. Cada TV escolhe as fontes (Senha geral e/ou tipos). O fundo é um YouTube (padrão sem som) ou só o símbolo do Senha JEC, um pouco menor e embaçado, se o YouTube estiver bloqueado ou para economizar banda. Imagens 16:9 ficam no banco (até 30, valem para todas as TVs). Cada TV informa a espera de fundo até a foto surgir (padrão **300** s) e quanto ela fica na tela (padrão **20** s); depois o vídeo **volta**. Quando a foto entra, senha e histórico descem para uma faixa embaixo — a arte aparece inteira no molde 16:9, em qualquer proporção de tela (Full HD, 4:3 tipo 800×600, tablet). O som do YouTube continua, se estiver ligado. A voz padrão é a feminina do **Google** neste aparelho; nas neurais ficam Dii, Cadu, Faber e Edresson. As chamadas entram numa fila com intervalo padrão de **3 segundos**, para uma não falar em cima da outra. A voz fala o número; nos tipos, também o nome do atendimento. Na Senha geral fala só o número.

### Recepção — Senha geral

1. **Chamar** — anota a hora. Ainda não grava no banco.
2. Preenche nome, tipo (T / C / A) e, se quiser, nº de processo. Preferencial acende o ícone (cadeira, idoso, gestante, colo, obesidade, autismo) e a senha vira P01, P02…
3. **Registrar** — grava na fila daquele tipo.
4. **Não veio** (na recepção) — descarta o rascunho, sem criar senha.

A numeração pode vir do dispenser de papel (um rolo ou dois) ou, se não usa dispenser, começa no 01 todo dia. Preferencial no rolo único usa o mesmo número com prefixo P. A **ordem de chamada** (Opções → Configurações) decide se a fila segue a **chegada** (P13, 14, P18, P20, P21, 22) ou se as preferenciais sobem sempre para o topo. Ordem e dispenser só entram no sistema depois de **Salvar**.

### Atendimento — aba do tipo

Cada linha da planilha é uma senha.

| Botão | O que faz |
|---|---|
| **Chamar próximo** | No topo da aba. Pega o **primeiro** da fila daquele tipo, na ordem configurada (chegada ou preferenciais na frente; quem não respondeu vai para o fim da espera). |
| **Chamar** | Na linha. A senha fica *em atendimento* com você. Se **não** for o próximo, o sistema avisa quem deveria ser e pergunta se quer chamar fora de ordem. Só chama se confirmar. |
| **Finalizar** | Encerra neste tipo. Sai da fila. |
| **Encaminhar** | Se trocar o tipo antes de finalizar, manda a pessoa para a outra fila, com a observação (até 200 caracteres). |
| **Cancelar** | Desfaz a chamada. A senha volta para a espera, na ordem da fila. Não conta como não respondeu. |
| **Não respondeu** / **Não veio** | Devolve para a fila (conta como não respondeu) e chama a próxima daquele tipo. |
| **Chamar de novo** | Nova entrada no histórico, continua com você. |

Se outra pessoa já chamou aquela senha, o sistema avisa e não deixa pegar.

Cores da linha:

- Rosa — esperando
- Amarelo — em atendimento
- Azul — finalizada

## Regras da fila

- **Uma senha, um atendente.** Quem chamou é dono até finalizar ou devolver.
- **Preferencial na ordem configurada.** O padrão é a ordem de **chegada**: quem chegou primeiro é chamado primeiro (o 14 não fica atrás de um P18 que chegou depois). Em Opções → Configurações dá para colocar todas as preferenciais na frente. Quem não respondeu volta para o fim da espera.
- **Fora de ordem só com confirmação.** Chamar na linha uma senha que não é a próxima abre um aviso com quem deveria ser; Cancelar não chama.
- **Chamada só no dia de hoje.** Trocar a data no topo é para olhar o histórico, não para chamar.
- **Usuário** é sempre `primeiro.sobrenome` (ponto no meio). **Senha de acesso** nesta instalação é o CPF — no seu fork, use o que fizer sentido e **nunca** commite CPF nem hash no GitHub público.
- Operador comum não cadastra tipo nem gente. Admin sim.

## Telas

| Aba | Quem usa | Para quê |
|---|---|---|
| Dashboard / Painel | Admin | Volume, espera, preferencial e produção por pessoa **do dia do topo** |
| Relatórios | Todo mundo | Tela própria: período compartilhado, Painel ou Lista; imprimir e CSV |
| Senha geral | Recepção | Registrar quem chegou |
| T, C, A (ou os tipos que você cadastrar) | Quem atende | Chamar próximo, chamar na linha, finalizar, cancelar, não respondeu |
| Configurações → Tipos | Admin | Nome, sigla, cor, ativar/desativar |
| Configurações → Operadores | Admin | Incluir, perfil, senha, ativar/desativar |
| Configurações | Admin | Ordem de chamada, dispenser de papel e próxima senha do rolo — só vale depois de Salvar |
| Painel da TV | Todo mundo | Tela da espera neste aparelho: fontes, YouTube ou símbolo, imagens e voz |

### Configurações (admin)

Vale para **todo o sistema**, não só para um computador. O rascunho só entra depois de **Salvar**.

- **Ordem de chamada**
  - *Ordem de chegada* (padrão): a fila segue quem chegou primeiro. Preferencial e comum se misturam: P13, 14, P18, P20, P21, 22.
  - *Preferenciais sempre na frente*: na espera do tipo, as P sobem; as comuns vêm depois. Quem não respondeu continua no fim.
- **Dispenser**
  - *Nenhum*: todo dia a numeração começa no 01.
  - *Rolo único*: um bloco de senhas; preferencial usa o mesmo número com P (P01, 02, P03…).
  - *Dois rolos*: comum e preferencial têm numeração própria. Informe a **próxima** senha de cada rolo **antes** de abrir o dia.

### Painel da TV

Vale **neste aparelho** (salvo no navegador), com um **Salvar** próprio. Outra TV pode mostrar outros tipos, outro vídeo e outra voz. As **imagens** são a exceção: ficam no Postgres e valem para todas as TVs.

- **O que esta TV chama.** Senha geral e/ou os tipos. Uma TV pode ficar com tudo; outra, só com Consulta.
- **Vídeo de fundo.** Live ou vídeo do YouTube (padrão sem som). Dá para voltar o link padrão. **Sem vídeo** usa o símbolo do Senha JEC, menor e embaçado — serve se o YouTube estiver bloqueado ou para economizar banda.
- **Voz.** Duas listas: **Vozes Padrão** (as do aparelho; a feminina do Google é a recomendada) e **Vozes Neurais** (Dii, Cadu, Faber, Edresson — as três últimas são as da Vivver). Na primeira vez a neural baixa uns 60 MB e guarda neste aparelho. Velocidade, volume e **intervalo entre chamadas** (padrão 3 s). Se várias pessoas chamarem ao mesmo tempo, a TV fala uma por vez e descarta o excesso da fila (no máximo 10 à espera).
- **Imagens.** Até 30 fotos 16:9 no banco. Recorte na janela amarela na hora de enviar. *Surge uma imagem a cada* é a espera de fundo (padrão 300 s) até entrar a foto; *fica em amostra* é quanto a foto permanece (padrão 20 s). Depois a foto sai e o vídeo volta, mesmo se os dois tempos forem iguais. A foto entra no molde; senha e histórico descem para a faixa de baixo, então a arte não fica escondida atrás do painel. Se o som do YouTube estiver ligado, ele não é cortado. O layout se ajeita em Full HD, monitor 4:3 (800×600) e tablet.
- **Relógio.** No topo, no centro: data DD/MM/AAAA e hora HH:MM:SS (fuso de São Paulo).

Na Senha geral a voz fala só o número. Nos tipos, número e o nome do atendimento.

No celular o site vira PWA: no Android o Chrome oferece **Instalar**; no iPhone é Compartilhar → Adicionar à Tela de Início. No computador o convite de instalar não aparece.

Na planilha, recepção e atendimento mostram só a hora. Passa o mouse (ou toca) para ver quem registrou e cada chamada. O detalhe fica em **Opções → Relatórios**: tela só de levantamento, com período, Painel ou Lista, filtro por senha, nome, tipo, situação, preferencial e pessoa; dá para imprimir ou baixar CSV.

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

Realtime: em Database → Replication, as tabelas `senhas`, `historico_chamadas`, `tipos_atendimento`, `configuracoes` e `painel_chamadas` precisam estar no publication `supabase_realtime` (o `schema.sql` já tenta ligar).

## Stack

- Front estático: HTML, CSS, JS (sem build)
- [`@supabase/supabase-js`](https://supabase.com/docs) no CDN
- Postgres no Supabase: `senhas`, `historico_chamadas`, `painel_chamadas`, `painel_imagens`, `tipos_atendimento`, `operadores`, `configuracoes`
- RPCs (`chamar_senha`, `chamar_proxima`, `finalizar_senha`, `nao_respondeu_senha`, `reservar_numero`, `login_operador`…) com `FOR UPDATE` para dois atendentes não pegarem a mesma senha
- Service worker + `manifest.json` para PWA
- Fuso `America/Sao_Paulo`

Identidade visual: Inter; topbar `#FFD32C`; texto e botões escuros `#0D3B5E`; fundo `#F4F6F9`; faixa no login `#E63030` → `#FFD32C` → `#1A82B8`.

## Desenvolvimento

No dia a dia deste repositório o front aponta para um Postgres **local** (`senha_jec`) via `python tools/servidor_local.py` — sobe em `http://127.0.0.1:8765/` um PostgREST-lite + os arquivos estáticos, **sem** falar com o Supabase de produção. O `js/config.js` local (gitignorado) é que escolhe essa URL.

```bash
python tools/servidor_local.py
```

Dá para servir só os arquivos com `python -m http.server 8765`, mas aí precisa de um `js/config.js` apontando para algum Supabase.

Mudança de CSS/JS: suba o `?v=` no `index.html` e o nome do cache em `sw.js`, senão o PWA entrega arquivo velho.

Migrações extras ficam em `supabase/migrations/`. O arquivo canônico para um banco novo é `supabase/schema.sql`. Quem já tem o banco em produção aplica as migrações novas **antes** de publicar o front (GitHub Pages). As desta leva:

| Arquivo | O que entra |
|---|---|
| `20260919200000_ordem_chamada.sql` | Tabela `configuracoes` e chave `ordem_chamada` |
| `20260919210000_painel_tv.sql` | Tabela `painel_chamadas`; o Chamar grava o evento da TV |
| `20260919220000_chegada_e_dispenser.sql` | Ordem por chegada, dispenser, `reservar_numero`, unique `(data, numero, preferencial)` |
| `20260919230000_painel_imagens.sql` | Tabela `painel_imagens` (até 30 fotos) |

## Contribuir

Issue e PR no GitHub são bem-vindos: fila, acessibilidade no celular, tipos, dashboard. Não abra PR com senha, CPF, `.env`, `manutencao.env`, `js/config.js` nem URL de banco de ninguém.

Se for usar em outro órgão, troque o nome na interface e os tipos.
