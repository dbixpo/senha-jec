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

Tudo da **fila** (chamar, finalizar, não respondeu) e o **dashboard** são do **dia** escolhido no topo (**DD/MM/AAAA**, mesmo se o Windows estiver em inglês). Chamada só vale **hoje**. Dia anterior na fila é consulta.

**Relatórios** (Opções → Relatórios) é outra tela: some a data do topo e as abas da fila. O período (de/até, ou atalhos de 7 dias, 30 dias e o mês) vale para todos os relatórios. Hoje dá para ver em **Painel** (gráficos) ou **Lista** (senha a senha).

**Painel da TV** (Opções → Painel da TV, ou o atalho na tela de login) pergunta se abre **nesta aba** ou em **outra**. Este aparelho vira a televisão da espera. No topo, no centro, tem data e relógio. Cada TV escolhe as fontes (Senha geral e/ou tipos). O fundo é um YouTube (padrão sem som) ou só o símbolo do Senha JEC, um pouco menor e embaçado, se o YouTube estiver bloqueado ou para economizar banda. Imagens de qualquer proporção (A4, retrato, paisagem, quadrado) ficam no banco (até 30, valem para todas as TVs). Cada TV informa a espera de fundo até a foto surgir (padrão **300** s) e quanto ela fica na tela (padrão **20** s); depois o vídeo **volta**. Retrato entra inteiro de um lado, com senha e histórico do outro; paisagem ou quadrado viram **cartão** no meio e a faixa desce para baixo. O som do YouTube continua, se estiver ligado. Serve em Full HD, 4:3 (tipo 800×600) e tablet. A voz padrão é a feminina do **Google** neste aparelho; nas neurais ficam Dii, Cadu, Faber e Edresson. As chamadas entram numa fila com intervalo padrão de **3 segundos**, para uma não falar em cima da outra. O que a voz fala (requisitante, senha, local, guichê, atendente) se configura em **Configurações da TV** (e também em Opções → Configurações), arrastando a ordem. Em local e atendente, **Fala detalhada** (ligada por padrão) vira a frase longa; sem o visto, só o tipo ou o nome.

### Recepção — Senha geral

1. **Chamar** — escolhe o guichê, se a recepção tiver, e anota a hora. Ainda não grava no banco.
2. Preenche nome, tipo (T / C / A) e, se quiser, nº de processo. Preferencial acende o ícone (cadeira, idoso, gestante, colo, obesidade, autismo) e a senha vira P01, P02…
3. **Registrar** — grava na fila daquele tipo.
4. **Não veio** (na recepção) — descarta o rascunho, sem criar senha.

A numeração pode vir do dispenser de papel (um rolo ou dois) ou, se não usa dispenser, começa no 01 todo dia. Preferencial no rolo único usa o mesmo número com prefixo P. A **ordem de chamada** (Opções → Configurações) é *Chamar P preferenciais para cada N senhas normais* (padrão **1 para 2**), começando pelas **normais**. Dá para marcar **Começar com as preferenciais**. A chegada dentro de cada grupo não muda. Em **O que a TV fala** (Configurações e também no Painel da TV) marca Fala/Não fala e arrasta a ordem (padrão: requisitante, senha, local, guichê; atendente desligado). Em local e atendente, **Fala detalhada** (ligada por padrão) vira “Por favor, dirija-se a” e o tipo, ou “Atendimento por” e o primeiro nome; sem o visto, só o tipo ou o nome. Ordem, voz e dispenser só entram no sistema depois de **Salvar**. Em **Tipos de atendimento** a **Senha geral** já vem cadastrada (não apaga, não muda nome/sigla/cor). Cada tipo — inclusive a recepção — informa se **tem guichês** e quantos; se tiver, na aba escolhe o guichê antes de chamar.

### Atendimento — aba do tipo

Cada linha da planilha é uma senha.

| Botão | O que faz |
|---|---|
| **Chamar próximo** | No topo da aba. Pega o **primeiro** da fila daquele tipo, na proporção configurada (quem não respondeu vai para o fim da espera). Só chama se o guichê daquele tipo já estiver escolhido. |
| **Chamar** | Na linha. A senha fica *em atendimento* com você. Se **não** for o próximo, o sistema avisa quem deveria ser e pergunta se quer chamar fora de ordem. Só chama se confirmar. Também precisa do guichê. |
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
- **Preferencial na ordem configurada.** O padrão é **1 preferencial para cada 2 normais**, começando pelas comuns (01, 02, P04…). Marca **Começar com as preferenciais** se quiser a P no começo do ciclo. Quem chegou primeiro dentro de cada grupo continua na frente. Quem não respondeu volta para o fim da espera.
- **Fora de ordem só com confirmação.** Chamar na linha uma senha que não é a próxima abre um aviso com quem deveria ser; Cancelar não chama.
- **Chamada só no dia de hoje.** Trocar a data no topo (DD/MM/AAAA) é para olhar o histórico, não para chamar.
- **Usuário** é sempre `primeiro.sobrenome` (ponto no meio). **Senha de acesso** nesta instalação é o CPF — no seu fork, use o que fizer sentido e **nunca** commite CPF nem hash no GitHub público.
- Operador comum não cadastra tipo nem gente. Admin sim.

## Telas

| Aba | Quem usa | Para quê |
|---|---|---|
| Dashboard / Painel | Admin | Volume, espera, preferencial e produção por pessoa **do dia do topo** |
| Relatórios | Todo mundo | Tela própria: período compartilhado, Painel ou Lista; imprimir e CSV |
| Senha geral | Recepção | Chamar na porta (com guichê, se houver) e registrar quem chegou |
| T, C, A (ou os tipos que você cadastrar) | Quem atende | Chamar próximo, chamar na linha, finalizar, cancelar, não respondeu |
| Configurações → Tipos | Admin | Senha geral é fixa (só guichês). Os outros: nome, sigla, cor, guichês, ativar/desativar |
| Configurações → Operadores | Admin | Incluir, perfil, senha, ativar/desativar |
| Configurações | Admin | Ordem de chamada, o que a TV fala, dispenser de papel e próxima senha do rolo — só vale depois de Salvar |
| Painel da TV | Todo mundo | Tela da espera neste aparelho: fontes, YouTube ou símbolo, imagens, voz, o que ela fala e relógio |

### Configurações (admin)

Vale para **todo o sistema**, não só para um computador. O rascunho só entra depois de **Salvar**.

- **Ordem de chamada.** *Chamar P preferenciais para cada N senhas normais* (padrão 1 para 2). O ciclo começa pelas **normais**, a não ser que marque **Começar com as preferenciais**. A chegada dentro de cada grupo não muda — o 03 não passa o 01, o P08 não passa o P04. Preferencial que já é a próxima da fila não espera. O exemplo na tela mostra a ordem. Com 0 preferenciais, fica só chegada; com 0 normais, as P sobem primeiro. Quem não respondeu continua no fim.
- **O que a TV fala.** Lista arrastável: Requisitante, Senha, Local de atendimento, Guichê e Atendente. Em cada um escolhe **Fala** ou **Não fala**. Padrão: os quatro primeiros ligados; atendente desligado. Em local e atendente há **Fala detalhada** (ligada por padrão): local vira “Por favor, dirija-se a” e o tipo; atendente vira “Atendimento por” e o primeiro nome. Sem o visto, só o tipo ou o nome. A mesma lista está em **Painel da TV → Configurações**.
- **Dispenser**
  - *Nenhum*: todo dia a numeração começa no 01.
  - *Rolo único*: um bloco de senhas; preferencial usa o mesmo número com P (P01, 02, P03…).
  - *Dois rolos*: comum e preferencial têm numeração própria. Informe a **próxima** senha de cada rolo **antes** de abrir o dia.

### Painel da TV

Vale **neste aparelho** (salvo no navegador), com um **Salvar** próprio. Outra TV pode mostrar outros tipos, outro vídeo e outra voz — marcar Consulta numa não muda a outra. As **imagens** e **o que ela fala** são a exceção: ficam no Postgres e valem para todas as TVs. Fechar e Salvar ficam no rodapé; a grade de fotos tem rolagem própria.

O botão **Painel da TV** (no login e em Opções) pergunta se o painel abre **nesta aba** ou em **nova aba**. Clique fora ou Escape cancela.

- **O que esta TV chama.** Senha geral e/ou os tipos. Uma TV pode ficar com tudo; outra, só com Consulta.
- **Vídeo de fundo.** Live ou vídeo do YouTube (padrão sem som). Dá para voltar o link padrão. **Sem vídeo** usa o símbolo do Senha JEC, menor e embaçado — serve se o YouTube estiver bloqueado ou para economizar banda.
- **Voz.** Duas listas: **Vozes Padrão** (as do aparelho; a feminina do Google é a recomendada) e **Vozes Neurais** (Dii, Cadu, Faber, Edresson — as três últimas são as da Vivver). Na primeira vez a neural baixa uns 60 MB e guarda neste aparelho. Velocidade, volume e **intervalo entre chamadas** (padrão 3 s). **O que ela fala** (requisitante, senha, local, guichê, atendente) fica nessa mesma tela, para todas as TVs; só o administrador altera. Em local e atendente, **Fala detalhada** (ligada por padrão) usa a frase longa; sem o visto, só o tipo ou o primeiro nome. Se várias pessoas chamarem ao mesmo tempo, a TV fala uma por vez e descarta o excesso da fila (no máximo 10 à espera).
- **Imagens.** Até 30 fotos no banco, em qualquer proporção (A4, retrato, paisagem, quadrado). Envia direto, sem recorte — dá para selecionar várias de uma vez. *Surge uma imagem a cada* é a espera de fundo (padrão 300 s) até entrar a foto; *fica em amostra* é quanto a foto permanece (padrão 20 s). Depois a foto **sempre** sai e o vídeo volta, mesmo se os dois tempos forem iguais. Retrato (mais alta que larga) fica **inteira de um lado**, senha e histórico do outro. Paisagem ou quadrado viram **cartão** no meio, com folga em volta; senha e histórico descem para a faixa de baixo. Se o som do YouTube estiver ligado, ele não é cortado. O layout se ajeita em Full HD, monitor 4:3 (800×600) e tablet.
- **Relógio.** No topo, no centro: data DD/MM/AAAA e hora HH:MM:SS (fuso de São Paulo).

No celular o site vira PWA: no Android o Chrome oferece **Instalar**; no iPhone é Compartilhar → Adicionar à Tela de Início. No computador o convite de instalar não aparece.

Na planilha, recepção e atendimento mostram só a hora. Passa o mouse (ou toca) para ver quem registrou e cada chamada. O detalhe fica em **Opções → Relatórios**: tela só de levantamento, com período, Painel ou Lista, filtro por senha, nome, tipo, situação, preferencial e pessoa; dá para imprimir ou baixar CSV.

## Subir o seu

Cada instalação tem o **seu** Supabase. Não existe banco compartilhado neste repositório.

1. Crie um projeto no [Supabase](https://supabase.com). Na região, escolha a mais perto de quem vai usar (no JEC, **South America (São Paulo)** / `sa-east-1`). A região não muda depois: para trocar, é projeto novo e copiar os dados.
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
6. Publique a pasta (GitHub Pages, Netlify, pasta num servidor). Neste repositório, um push em `main` dispara o workflow de Pages, que injeta `js/config.js` a partir dos secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Abra o site e entre com o usuário criado.

## Produção deste repositório

- Tela: [GitHub Pages](https://dbixpo.github.io/senha-jec/) (HTML, CSS e JS num CDN).
- Banco: projeto Supabase **Free** na região **West US (Oregon)** / `us-west-2`.

O GitHub Pages **não** é o que deixa a fila “pensando”. Ele só entrega o programa, em geral rápido depois do primeiro carregamento (e o PWA guarda o casco no aparelho). Cada **Chamar**, **Finalizar** e atualização ao vivo vai do navegador em Sorocaba até o Postgres no Oregon e volta — uns 180–250 ms por ida, somados à CPU compartilhada do plano gratuito (500 MB de RAM). No PC local o `tools/servidor_local.py` fala com o Postgres **neste computador**, por isso parece instantâneo.

Trocar o Pages por Netlify ou uma pasta no servidor quase não muda essa espera. O que encurta o caminho de verdade:

1. **Projeto novo em São Paulo** (`sa-east-1`) e apontar os secrets da Pages para ele — maior ganho, mas a região do projeto atual não se altera: é copiar dados e operadores.
2. Plano **Pro** (CPU reservada), se o Free estiver engasgando no horário de pico.
3. No Free, projeto **pausa depois de 1 semana sem uso**; a primeira abertura depois disso pode demorar enquanto o banco acorda. Uso todo dia no balcão evita a pausa.

As fotos da TV (até 30) ficam **dentro** do Postgres. A primeira abertura do painel baixa todas; isso também pesa mais na produção do que no local.

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
| `20260920120000_ordem_proporcao.sql` | Proporção N normais para P preferenciais (padrão 2 para 1) |
| `20260920123000_ordem_ciclo_pref.sql` | Ciclo começa pela preferencial (P, depois N comuns) |
| `20260920124500_ordem_comecar_pref.sql` | Checkbox *Começar com as preferenciais* (padrão desligado) |
| `20260920133000_voz_guiches.sql` | Guichês no tipo, `voz_script`, colunas no painel; `chamar_senha` / `chamar_proxima` com guichê |
| `20260920140000_senha_geral_fixo.sql` | Tipo fixo Senha geral (não apaga nem muda nome); só configura guichês |

## Contribuir

Issue e PR no GitHub são bem-vindos: fila, acessibilidade no celular, tipos, dashboard. Não abra PR com senha, CPF, `.env`, `manutencao.env`, `js/config.js` nem URL de banco de ninguém.

Se for usar em outro órgão, troque o nome na interface e os tipos.
