# Controle de fila

Sisteminha pessoal para trocar a planilha: recepção anota **nome + senha de papel**, encaminha para **4 setores**, cada setor vê a própria fila e registra o que se resolveu.

Mesmo esquema do dashboard do Patrick: **Supabase** no banco e **GitHub Pages** no front.

- Site: https://dbixpo.github.io/senha-jec/
- Código: https://github.com/dbixpo/senha-jec

Não fica na prefeitura. Pasta local: `C:\Users\hardr\Projects\controle-fila`.

## 1. Criar o banco (5 minutos)

1. Entra em [https://supabase.com/dashboard](https://supabase.com/dashboard) e cria um projeto (plano grátis serve).
2. Espera o banco ficar `Ready`.
3. Vai em **SQL Editor → New query**, cola o conteúdo de `supabase/schema.sql` e clica **Run**.
4. Em **Project Settings → API**, copia:
   - **Project URL**
   - **anon public** (não use a `service_role`)

## 2. Abrir o sisteminha

Não abre o arquivo no duplo clique (`file://` costuma bloquear a API). Na pasta do projeto:

```powershell
npx --yes serve .
```

Na primeira vez cola URL + chave anon. Fica salvo neste computador.

Se quiser deixar as chaves no código (para a amiga não ter que colar), copia `js/config.example.js` para `js/config.js` e preenche.

## 3. Uso no balcão

- **Recepção:** número da senha de papel + nome. Pode encaminhar na hora ou deixar na recepção e clicar no setor depois.
- **Setor:** chama → atende → anota o que se resolveu. Dá para devolver à fila ou mandar para outro setor se encaminhou errado.
- **Corrigir senha:** o número grande é clicável.
- **Dia:** o seletor de data no topo é o histórico. “Hoje” volta para o dia corrente (fuso de São Paulo).
- **Setores:** botão no topo para renomear os 4 nomes (o histórico não some).

## 4. Front no GitHub Pages

O banco fica no Supabase. O site é o `index.html` deste repositório, publicado em:

**https://dbixpo.github.io/senha-jec/**

É o mesmo modelo do [dashboard de emendas](https://zmaffeisz.github.io/dashboard-emendas/): HTML estático no GitHub, PostgreSQL no Supabase.

Sem login por enquanto: quem tiver o endereço usa. Serve para uso interno. Depois dá para colocar um PIN na porta.

## Backup

No Supabase: **Project Settings → Database** tem backup automático no plano pago; no grátis, de vez em quando **Table Editor** → exporta CSV, ou roda um `select * from senhas`.
