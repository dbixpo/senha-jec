const STORAGE_KEY = "fila-supabase";
const SESSAO_KEY = "senha-jec-sessao";
const TZ = "America/Sao_Paulo";

let sb = null;
let sessao = null;
let tipos = [];
let operadores = [];
let senhas = [];
let chamadas = [];
let aba = "geral";
let canal = null;
let verTudo = false;
let enviandoChegada = false;

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dataHora(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hora(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function agoraHHMM() {
  return new Date().toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isoDoDia(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return new Date(`${diaAtual()}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).toISOString();
}

function diaAtual() {
  if (!ehAdmin()) return hojeISO();
  return document.getElementById("dia").value || hojeISO();
}

function ehHoje() {
  return diaAtual() === hojeISO();
}

function dataLegivel(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function aplicarDiaSessao() {
  const input = document.getElementById("dia");
  const hoje = document.getElementById("btn-hoje");
  if (!input) return;
  if (!ehAdmin()) {
    input.value = hojeISO();
    input.disabled = true;
    input.title = "A fila do dia. Só administrador consulta outros dias.";
    hoje?.classList.add("hidden");
  } else {
    if (!input.value) input.value = hojeISO();
    input.disabled = false;
    input.title = "Filtrar a fila por dia";
    hoje?.classList.remove("hidden");
  }
}

function ehAdmin() {
  return sessao?.papel === "admin";
}

function textoQuem() {
  if (!sessao) return "";
  return `${sessao.nome} · ${ehAdmin() ? "Administrador" : "Operador"}`;
}

function operadorDe(id) {
  return operadores.find((o) => o.id === id) || null;
}

function nomeOperador(id) {
  return operadorDe(id)?.nome || "—";
}

function lerConfig() {
  if (window.FILA_CONFIG?.supabaseUrl && !window.FILA_CONFIG.supabaseUrl.includes("xxxx")) {
    return window.FILA_CONFIG;
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function lerSessao() {
  try {
    return JSON.parse(localStorage.getItem(SESSAO_KEY) || "null");
  } catch {
    return null;
  }
}

function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mostrarErro(msg) {
  window.alert(msg);
}

function tipoDe(id) {
  return tipos.find((t) => t.id === id) || null;
}

function auditoria(row) {
  return `reg. ${dataHora(row.created_at)}${row.updated_at && row.updated_at !== row.created_at ? " · atual. " + dataHora(row.updated_at) : ""}`;
}

function proximoNumero() {
  const usados = senhas.map((s) => Number(s.numero) || 0);
  return (usados.length ? Math.max(...usados) : 0) + 1;
}

function padSenha(n) {
  return String(n).padStart(2, "0");
}

function rotuloSenha(senha) {
  const n = padSenha(senha.numero);
  return senha.preferencial ? "P" + n : n;
}

function rotuloProxima(preferencial) {
  const n = padSenha(proximoNumero());
  return preferencial ? "P" + n : n;
}

function filtrarLista(lista) {
  if (verTudo) return lista;
  return lista.filter((s) => !s.hora_atendimento);
}

function naFila(lista = senhas) {
  return lista.filter((s) => !s.hora_atendimento).length;
}

function ordenarFila(lista) {
  return [...lista].sort((a, b) => {
    if (!!a.preferencial !== !!b.preferencial) return a.preferencial ? -1 : 1;
    return (a.numero || 0) - (b.numero || 0);
  });
}

function estaEditando() {
  const el = document.activeElement;
  return el && el.closest(".planilha-wrap") && (el.matches("input, select, textarea"));
}

async function conectar() {
  const cfg = lerConfig();
  const setup = document.getElementById("setup");
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    setup.classList.remove("hidden");
    document.getElementById("login").classList.add("hidden");
    return false;
  }
  setup.classList.add("hidden");
  sb = window.supabase.createClient(cfg.supabaseUrl.trim(), cfg.supabaseAnonKey.trim(), {
    auth: { persistSession: false },
  });
  return true;
}

function pedirLogin() {
  sessao = lerSessao();
  const box = document.getElementById("login");
  if (!sessao?.id) {
    box.classList.remove("hidden");
    document.getElementById("login-usuario")?.focus();
    return false;
  }
  box.classList.add("hidden");
  document.getElementById("quem").textContent = textoQuem();
  aplicarDiaSessao();
  return true;
}

async function carregar() {
  if (!sessao) return;
  const data = diaAtual();
  const ops = [
    sb.from("tipos_atendimento").select("*").order("ordem"),
    sb.from("senhas").select("*").eq("data", data).order("numero"),
    sb.from("operadores").select(ehAdmin()
      ? "id, usuario, nome, papel, ativo, ultimo_acesso, created_at, updated_at"
      : "id, nome").order("nome"),
  ];
  const resultados = await Promise.all(ops);
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) {
    mostrarErro(erro.message);
    return;
  }
  tipos = resultados[0].data || [];
  senhas = resultados[1].data || [];
  operadores = resultados[2]?.data || [];
  const ids = senhas.map((s) => s.id);
  if (ids.length) {
    const hist = await sb.from("historico_chamadas").select("*").in("senha_id", ids).order("chamado_em");
    if (hist.error) mostrarErro(hist.error.message);
    chamadas = hist.data || [];
  } else {
    chamadas = [];
  }
  for (const s of senhas) {
    s.chamadas = chamadas.filter((c) => c.senha_id === s.id);
  }
  if (!estaEditando()) desenhar();
}

function escutar() {
  if (canal) sb.removeChannel(canal);
  canal = sb
    .channel("senha-jec-ao-vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => carregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "historico_chamadas" }, () => carregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "tipos_atendimento" }, () => carregar())
    .subscribe((status) => {
      document.getElementById("live").classList.toggle("off", status !== "SUBSCRIBED");
    });
}

function contarTipo(tipoId) {
  return senhas.filter((s) => s.tipo_id === tipoId && !s.hora_atendimento).length;
}

function desenharAbas() {
  const nav = document.getElementById("tabs");
  const abas = [
    { id: "geral", label: "Senha geral", count: naFila() },
    ...tipos.filter((t) => t.ativo).map((t) => ({
      id: "tipo-" + t.id,
      label: t.nome,
      count: contarTipo(t.id),
      cor: t.cor,
    })),
  ];
  if (ehAdmin()) {
    abas.push({ id: "controle", label: "Controle", count: senhas.length });
    abas.push({ id: "tipos", label: "Tipos", count: tipos.filter((t) => t.ativo).length });
    abas.push({ id: "operadores", label: "Operadores", count: operadores.filter((o) => o.ativo).length });
  }
  nav.innerHTML = abas
    .map(
      (item) =>
        `<button type="button" class="tab ${item.id === aba ? "active" : ""}" data-aba="${item.id}">
          ${item.cor ? `<span class="tab-dot" style="background:${escapar(item.cor)}"></span>` : ""}
          ${escapar(item.label)} <span class="count">${item.count}</span>
        </button>`
    )
    .join("");
}

function checksTipoForm() {
  const ativos = tipos.filter((t) => t.ativo);
  if (!ativos.length) return `<p class="muted">${ehAdmin() ? "Cadastre um tipo primeiro, na aba Tipos." : "Peça a um administrador para cadastrar um tipo."}</p>`;
  return ativos.map((t) => `
    <label class="chip-check">
      <input type="checkbox" name="tipo-chegada" value="${t.id}">
      <span class="chip-check-ui"><i class="tab-dot" style="background:${escapar(t.cor)}"></i>${escapar(t.sigla)} · ${escapar(t.nome)}</span>
    </label>`).join("");
}

function badgeTipo(senha) {
  const t = tipoDe(senha.tipo_id);
  if (!t) return `<span class="sigla">—</span>`;
  return `<span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span>`;
}

function htmlHistorico(senha) {
  const lista = senha.chamadas || [];
  if (!lista.length) return `<span class="hora-lida">—</span>`;
  const linhas = lista.map((c) => {
    const quem = c.chamado_por === sessao.id ? "você" : nomeOperador(c.chamado_por);
    const onde = c.local || tipoDe(c.tipo_id)?.nome || "";
    return `<li><time>${escapar(hora(c.chamado_em) || "—")}</time> · ${escapar(quem)}${onde ? " · " + escapar(onde) : ""}</li>`;
  }).join("");
  return `<div class="hist-chamadas">
    <strong>${escapar(hora(senha.hora_atendimento) || hora(lista[0].chamado_em) || "—")}</strong>
    ${lista.length > 1 ? `<span class="chip pref">${lista.length}x</span>` : ""}
    <ul class="hist-lista">${linhas}</ul>
  </div>`;
}

function linhaSenha(senha, { chamar = false } = {}) {
  const atendida = !!senha.hora_atendimento;
  const acao = chamar
    ? `<td class="cel-acao" data-label="Chamar">
        <button type="button" class="btn primary small" data-acao="chamar-senha" data-id="${senha.id}">${atendida ? "Chamar de novo" : "Chamar"}</button>
      </td>`
    : "";
  return `<tr class="${atendida ? "atendida" : "aguardando"} ${senha.preferencial ? "pref" : ""}">
    <td class="cel-num col-num" data-label="Senha"><span class="senha-num">${escapar(rotuloSenha(senha))}</span></td>
    <td class="cel-rec" data-label="Hora da recepção"><span class="hora-lida">${escapar(hora(senha.hora_recepcao) || "—")}</span></td>
    <td class="cel-atend" data-label="Hora do atendimento">${htmlHistorico(senha)}</td>
    <td class="cel-nome" data-label="Nome"><span class="hora-lida">${escapar(senha.nome || "—")}</span></td>
    <td class="cel-tipo" data-label="Tipo">${badgeTipo(senha)}</td>
    <td class="cel-proc" data-label="Nº processo"><span class="hora-lida">${escapar(senha.processo || "—")}</span></td>
    ${acao}
  </tr>`;
}

function barraFiltro() {
  return `<label class="chip-check filtro-tudo">
    <input id="ver-tudo" type="checkbox" ${verTudo ? "checked" : ""}>
    <span class="chip-check-ui">Ver tudo</span>
  </label>`;
}

function tabelaFila(lista, { chamar = false } = {}) {
  const linhas = ordenarFila(filtrarLista(lista));
  if (!linhas.length) {
    return `<p class="empty">${verTudo ? "Ninguém nesta fila hoje." : "Ninguém na fila agora. Marca Ver tudo para incluir os já atendidos."}</p>`;
  }
  return `<div class="planilha-wrap">
    <table class="planilha">
      <thead>
        <tr>
          <th>Senha</th>
          <th>Hora recepção</th>
          <th>Hora atendimento</th>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Nº processo</th>
          ${chamar ? "<th></th>" : ""}
        </tr>
      </thead>
      <tbody>${linhas.map((s) => linhaSenha(s, { chamar })).join("")}</tbody>
    </table>
  </div>`;
}

function ligarFiltro(lista, opts) {
  document.getElementById("ver-tudo")?.addEventListener("change", (ev) => {
    verTudo = ev.target.checked;
    const box = document.getElementById("fila-lista");
    const dica = document.getElementById("fila-dica");
    if (box) box.innerHTML = tabelaFila(lista, opts);
    if (dica) dica.textContent = verTudo ? "Inclui quem já foi atendido." : "Só quem ainda está na fila.";
    desenharAbas();
  });
}

function legendaTipos() {
  return `<ul class="legenda">
    ${tipos.filter((t) => t.ativo).map((t) => `<li><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> ${escapar(t.nome)}</li>`).join("")}
    <li><span class="chip aguardando">espera</span></li>
    <li><span class="chip atendida">já atendido</span></li>
    <li><span class="chip pref">P = preferencial (sobe · senha P01)</span></li>
  </ul>`;
}

function telaGeral() {
  const form = ehHoje()
    ? `<form id="form-chegada" class="form-chegada">
        <input type="hidden" id="campo-tipo" value="">
        <div class="form-linha form-linha-campos">
          <div class="campo campo-senha">
            <span>Senha</span>
            <strong id="campo-senha-rotulo" class="senha-valor">${rotuloProxima(false)}</strong>
          </div>
          <div class="campo campo-hora">
            <span>Hora da recepção</span>
            <strong class="senha-valor senha-hora-dica">ao registrar</strong>
          </div>
          <label class="campo campo-nome">Nome da pessoa
            <input id="campo-nome" type="text" placeholder="Quem está sendo atendido" required autocomplete="off">
          </label>
        </div>
        <div class="form-linha">
          <fieldset class="campo campo-tipos">
            <legend>Tipo de atendimento</legend>
            <div class="tipo-checks">${checksTipoForm()}</div>
          </fieldset>
          <label class="chip-check pref-chegada">
            <input id="campo-pref" type="checkbox">
            <span class="chip-check-ui">Preferencial</span>
          </label>
        </div>
        <div class="form-linha form-linha-campos">
          <label class="campo campo-processo">Nº processo
            <input id="campo-processo" type="text" placeholder="Número, CPF, voltou…" autocomplete="off">
          </label>
          <button class="btn primary form-submit" type="submit">Registrar senha</button>
        </div>
      </form>
      <p id="form-erro" class="erro hidden"></p>`
    : `<p class="muted form-dica">Consultando ${dataLegivel(diaAtual())}. Para registrar senha, volta em <strong>Hoje</strong>.</p>`;
  return `
    <section class="card">
      <div class="card-topo">
        <div>
          <h2>Senha geral</h2>
          <p class="muted form-dica">${ehHoje() ? "Preenche nome e tipo e clica em Registrar senha — o número e a hora da recepção saem na hora. Preferencial vira P01. Para chamar, usa a aba do tipo." : "Fila de outro dia. Só consulta."}</p>
        </div>
        ${legendaTipos()}
      </div>
      ${form}
    </section>
    <section class="card">
      <div class="card-topo">
        <div>
          <h2>Fila ${ehHoje() ? "do dia" : "de " + dataLegivel(diaAtual())}</h2>
          <p id="fila-dica" class="muted form-dica">${verTudo ? "Inclui quem já foi atendido." : "Só quem ainda está na fila."}</p>
        </div>
        ${barraFiltro()}
      </div>
      <div id="fila-lista">${tabelaFila(senhas, { chamar: false })}</div>
    </section>`;
}

function telaTipo(tipo) {
  const lista = senhas.filter((s) => s.tipo_id === tipo.id);
  const comigo = lista.filter((s) => s.atendido_por === sessao.id && s.hora_atendimento);
  const banner = comigo.length
    ? `<div class="minha-chamada">Com você agora: ${comigo.map((s) => `<strong>${escapar(rotuloSenha(s))}</strong> ${escapar(s.nome || "")}`).join(" · ")}</div>`
    : "";
  return `<section class="card">
    <div class="card-topo">
      <div>
        <h2>${escapar(tipo.nome)}</h2>
        <p class="muted form-dica">${ehHoje() ? "O botão <strong>Chamar</strong> grava a hora, quem chamou e o local. Se a pessoa disser que não ouviu, chama de novo — fica no histórico." : `Consultando ${dataLegivel(diaAtual())}. Chamada só no dia de hoje.`}</p>
        <p id="fila-dica" class="muted form-dica">${verTudo ? "Inclui quem já foi atendido." : "Só quem ainda está na fila."}</p>
      </div>
      <div class="topo-acoes">
        ${ehHoje() ? `<button type="button" class="btn primary" data-acao="chamar-proxima" data-tipo="${tipo.id}">Chamar próxima</button>` : ""}
        ${barraFiltro()}
        <span class="sigla grande" style="background:${escapar(tipo.cor)}">${escapar(tipo.sigla)}</span>
      </div>
    </div>
    ${ehHoje() ? banner : ""}
    <div id="fila-lista">${tabelaFila(lista, { chamar: ehHoje() })}</div>
  </section>`;
}

function telaTipos() {
  return `<section class="card">
    <h2>Tipos de atendimento</h2>
    <p class="muted form-dica">Cada tipo vira uma aba. Sigla e cor identificam na planilha.</p>
    <form id="form-tipo" class="form-grid cadastro">
      <label>Nome
        <input id="tipo-nome" required placeholder="Ex.: Triagem">
      </label>
      <label>Sigla
        <input id="tipo-sigla" required maxlength="3" placeholder="T">
      </label>
      <label>Cor
        <input id="tipo-cor" type="color" value="#6B3FA0">
      </label>
      <button class="btn primary" type="submit">Incluir tipo</button>
    </form>
    <p id="tipo-erro" class="erro hidden"></p>
    <table class="table">
      <thead><tr><th>Tipo</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${
          tipos.length
            ? tipos
                .map(
                  (t) => `<tr>
                    <td><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> <strong>${escapar(t.nome)}</strong>${t.ativo ? "" : " · inativo"}</td>
                    <td class="meta">${auditoria(t)}</td>
                    <td>
                      <button type="button" class="btn ghost small" data-acao="toggle-tipo" data-id="${t.id}" data-ativo="${t.ativo ? "1" : "0"}">${t.ativo ? "Desativar" : "Ativar"}</button>
                    </td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="3" class="empty">Nenhum tipo ainda.</td></tr>`
        }
      </tbody>
    </table>
  </section>`;
}

function rotuloPapel(papel) {
  return papel === "admin" ? "Administrador" : "Operador";
}

function telaControle() {
  const total = senhas.length;
  const espera = naFila();
  const feitas = total - espera;
  const prefs = senhas.filter((s) => s.preferencial).length;
  const porTipo = tipos.map((t) => {
    const lista = senhas.filter((s) => s.tipo_id === t.id);
    return {
      t,
      total: lista.length,
      espera: lista.filter((s) => !s.hora_atendimento).length,
      feitas: lista.filter((s) => s.hora_atendimento).length,
    };
  });
  const porPessoa = operadores
    .map((o) => {
      const registrou = senhas.filter((s) => s.created_by === o.id).length;
      const chamou = chamadas.filter((c) => c.chamado_por === o.id).length;
      return { o, registrou, chamou };
    })
    .filter((x) => x.registrou || x.chamou || x.o.ativo)
    .sort((a, b) => b.registrou + b.chamou - (a.registrou + a.chamou));

  return `<section class="card">
    <div class="card-topo">
      <div>
        <h2>Controle da produção</h2>
        <p class="muted form-dica">${ehHoje() ? "Acompanha o dia de todo mundo." : `Produção de ${dataLegivel(diaAtual())}.`} Administrador também registra senha na aba Senha geral, no dia de hoje.</p>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>Senhas do dia</span><strong>${total}</strong></div>
      <div class="kpi"><span>Na fila</span><strong>${espera}</strong></div>
      <div class="kpi"><span>Atendidas</span><strong>${feitas}</strong></div>
      <div class="kpi"><span>Preferencial</span><strong>${prefs}</strong></div>
    </div>
  </section>
  <section class="card">
    <h2>Por pessoa</h2>
    <table class="table">
      <thead><tr><th>Pessoa</th><th>Perfil</th><th>Registrou</th><th>Chamou</th></tr></thead>
      <tbody>
        ${
          porPessoa.length
            ? porPessoa
                .map(
                  (x) => `<tr>
                    <td><strong>${escapar(x.o.nome)}</strong><div class="meta">${escapar(x.o.usuario)}${x.o.ativo ? "" : " · inativo"}</div></td>
                    <td><span class="papel-badge ${x.o.papel}">${rotuloPapel(x.o.papel)}</span></td>
                    <td>${x.registrou}</td>
                    <td>${x.chamou}</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="4" class="empty">Nenhuma produção neste dia.</td></tr>`
        }
      </tbody>
    </table>
  </section>
  <section class="card">
    <h2>Por tipo</h2>
    <table class="table">
      <thead><tr><th>Tipo</th><th>Total</th><th>Na fila</th><th>Atendidas</th></tr></thead>
      <tbody>
        ${porTipo
          .map(
            (x) => `<tr>
              <td><span class="sigla" style="background:${escapar(x.t.cor)}">${escapar(x.t.sigla)}</span> ${escapar(x.t.nome)}</td>
              <td>${x.total}</td>
              <td>${x.espera}</td>
              <td>${x.feitas}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </section>`;
}

function telaOperadores() {
  return `<section class="card">
    <h2>Operadores</h2>
    <form id="form-operador" class="form-grid cadastro">
      <label>Usuário
        <input id="op-usuario" required placeholder="primeiro.segundo" autocomplete="off">
      </label>
      <label>Nome completo
        <input id="op-nome" required>
      </label>
      <label>Senha (CPF)
        <input id="op-senha" required>
      </label>
      <label>Perfil
        <select id="op-papel">
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <button class="btn primary" type="submit">Incluir</button>
    </form>
    <p id="op-erro" class="erro hidden"></p>
    <table class="table">
      <thead><tr><th>Pessoa</th><th>Perfil</th><th>Acesso</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${operadores
          .map(
            (o) => `<tr>
              <td><strong>${escapar(o.nome)}</strong><div class="meta">${escapar(o.usuario)}${o.ativo ? "" : " · inativo"}</div></td>
              <td><span class="papel-badge ${escapar(o.papel)}">${rotuloPapel(o.papel)}</span></td>
              <td class="meta">${o.ultimo_acesso ? dataHora(o.ultimo_acesso) : "ainda não entrou"}</td>
              <td class="meta">${auditoria(o)}</td>
              <td>
                <button type="button" class="btn ghost small" data-acao="papel-op" data-id="${o.id}" data-papel="${escapar(o.papel)}">${o.papel === "admin" ? "Virar operador" : "Virar admin"}</button>
                <button type="button" class="btn ghost small" data-acao="toggle-op" data-id="${o.id}" data-ativo="${o.ativo ? "1" : "0"}">${o.ativo ? "Desativar" : "Ativar"}</button>
                <button type="button" class="btn ghost small" data-acao="senha-op" data-id="${o.id}">Trocar senha</button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </section>`;
}

function desenhar() {
  desenharAbas();
  const app = document.getElementById("app");
  if (aba === "geral") {
    app.innerHTML = telaGeral();
    document.getElementById("form-chegada")?.addEventListener("submit", onChegada);
    document.getElementById("form-chegada")?.addEventListener("change", onChegadaCampos);
    ligarFiltro(senhas, { chamar: false });
    return;
  }
  if (aba === "controle") {
    if (!ehAdmin()) {
      aba = "geral";
      desenhar();
      return;
    }
    app.innerHTML = telaControle();
    return;
  }
  if (aba === "tipos") {
    if (!ehAdmin()) {
      aba = "geral";
      desenhar();
      return;
    }
    app.innerHTML = telaTipos();
    document.getElementById("form-tipo")?.addEventListener("submit", onTipo);
    return;
  }
  if (aba === "operadores") {
    if (!ehAdmin()) {
      aba = "geral";
      desenhar();
      return;
    }
    app.innerHTML = telaOperadores();
    document.getElementById("form-operador")?.addEventListener("submit", onOperador);
    return;
  }
  if (aba.startsWith("tipo-")) {
    const tipo = tipos.find((t) => t.id === aba.slice(5));
    app.innerHTML = tipo ? telaTipo(tipo) : "<p>Tipo não encontrado.</p>";
    if (tipo) ligarFiltro(senhas.filter((s) => s.tipo_id === tipo.id), { chamar: ehHoje() });
    return;
  }
  aba = "geral";
  desenhar();
}

function carimbo() {
  return { updated_by: sessao.id };
}

function tipoChegadaSelecionado() {
  return document.querySelector("#form-chegada input[name=tipo-chegada]:checked")?.value || "";
}

function atualizarChegada() {
  const tipoId = tipoChegadaSelecionado();
  const pref = document.getElementById("campo-pref")?.checked;
  const hidden = document.getElementById("campo-tipo");
  const rotulo = document.getElementById("campo-senha-rotulo");
  if (hidden) hidden.value = tipoId;
  if (rotulo) rotulo.textContent = rotuloProxima(pref);
}

function onChegadaCampos(ev) {
  const el = ev.target;
  if (el.name === "tipo-chegada") {
    const escolhido = el.value;
    document.querySelectorAll("#form-chegada input[name=tipo-chegada]").forEach((box) => {
      box.checked = box.value === escolhido;
    });
    atualizarChegada();
    return;
  }
  if (el.id === "campo-pref") atualizarChegada();
}

async function onChegada(ev) {
  ev.preventDefault();
  if (enviandoChegada || !ehHoje()) return;
  const erro = document.getElementById("form-erro");
  erro.classList.add("hidden");
  const nome = document.getElementById("campo-nome").value.trim();
  const tipoId = tipoChegadaSelecionado() || document.getElementById("campo-tipo").value;
  const preferencial = document.getElementById("campo-pref").checked;
  const processo = document.getElementById("campo-processo").value.trim();
  if (!tipoId) {
    erro.textContent = "Marca o tipo de atendimento para gerar a senha.";
    erro.classList.remove("hidden");
    return;
  }
  if (!nome) {
    erro.textContent = "Coloca o nome de quem está sendo atendido.";
    erro.classList.remove("hidden");
    return;
  }
  enviandoChegada = true;
  const btn = ev.target.querySelector("[type=submit]");
  if (btn) btn.disabled = true;
  const payload = {
    data: hojeISO(),
    nome,
    tipo_id: tipoId,
    preferencial,
    processo,
    hora_recepcao: new Date().toISOString(),
    status: "na_fila",
    created_by: sessao.id,
    updated_by: sessao.id,
  };
  const { error } = await sb.from("senhas").insert(payload);
  enviandoChegada = false;
  if (btn) btn.disabled = false;
  if (error) {
    erro.textContent = error.code === "23505" ? "Esse número bateu com outra senha. Tenta de novo." : error.message;
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  document.getElementById("campo-tipo").value = "";
  document.getElementById("campo-senha-rotulo").textContent = rotuloProxima(false);
  await carregar();
}

async function onTipo(ev) {
  ev.preventDefault();
  const erro = document.getElementById("tipo-erro");
  erro.classList.add("hidden");
  const { error } = await sb.from("tipos_atendimento").insert({
    nome: document.getElementById("tipo-nome").value.trim(),
    sigla: document.getElementById("tipo-sigla").value.trim().toUpperCase(),
    cor: document.getElementById("tipo-cor").value,
    ordem: tipos.length + 1,
  });
  if (error) {
    erro.textContent = error.message;
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  await carregar();
}

async function onOperador(ev) {
  ev.preventDefault();
  const erro = document.getElementById("op-erro");
  erro.classList.add("hidden");
  const { data, error } = await sb.rpc("criar_operador", {
    p_usuario: document.getElementById("op-usuario").value.trim().toLowerCase(),
    p_nome: document.getElementById("op-nome").value.trim(),
    p_senha: document.getElementById("op-senha").value.trim(),
    p_papel: document.getElementById("op-papel")?.value || "operador",
  });
  if (error || !data) {
    erro.textContent = error?.message || "Não deu para criar. Confere se o usuário já existe.";
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  await carregar();
}

async function patch(id, valores, redesenhar = true) {
  const { error } = await sb.from("senhas").update({ ...valores, ...carimbo() }).eq("id", id);
  if (error) {
    mostrarErro(error.code === "23505" ? "Esse número de senha já existe neste dia." : error.message);
    return;
  }
  const idx = senhas.findIndex((s) => s.id === id);
  if (idx >= 0) Object.assign(senhas[idx], valores);
  if (redesenhar) await carregar();
}

function avisoChamada(res) {
  if (res?.ok) return true;
  if (res?.motivo === "ja_chamada") mostrarErro(`Essa senha já está com ${res.com}.`);
  else if (res?.motivo === "fila_vazia") mostrarErro("Não tem ninguém esperando neste tipo.");
  else if (res?.motivo === "nao_e_sua") mostrarErro("Essa senha está com outra pessoa.");
  else if (res?.motivo === "outro_dia") mostrarErro("Chamada só no dia de hoje. Volta a data no topo.");
  else mostrarErro("Não deu para pegar essa senha. Atualiza a tela.");
  return false;
}

async function rpcChamar(id, horaIso) {
  const args = { p_id: id, p_operador: sessao.id };
  if (horaIso) args.p_hora = horaIso;
  const { data, error } = await sb.rpc("chamar_senha", args);
  if (error) {
    mostrarErro(error.message);
    await carregar();
    return false;
  }
  const ok = avisoChamada(data);
  await carregar();
  return ok;
}

async function rpcLiberar(id) {
  const { data, error } = await sb.rpc("liberar_senha", { p_id: id, p_operador: sessao.id });
  if (error) {
    mostrarErro(error.message);
    await carregar();
    return false;
  }
  const ok = avisoChamada(data);
  await carregar();
  return ok;
}

function podeChamar() {
  return ehHoje() && String(aba).startsWith("tipo-");
}

async function onAcao(ev) {
  const btn = ev.target.closest("[data-acao]");
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if (acao === "chamar-senha") {
    if (!podeChamar()) return;
    btn.disabled = true;
    const { data, error } = await sb.rpc("chamar_senha", { p_id: id, p_operador: sessao.id });
    btn.disabled = false;
    if (error) mostrarErro(error.message);
    else if (avisoChamada(data) && data.senha) {
      const n = rotuloSenha(data.senha);
      const nome = data.senha.nome || "";
      if (data.primeira) {
        mostrarErro(`Chamou a senha ${n}${nome ? " — " + nome : ""}.`);
      } else {
        mostrarErro(`Chamada de novo registrada: senha ${n}${nome ? " — " + nome : ""}.`);
      }
    }
    await carregar();
    return;
  }

  if (acao === "chamar-proxima") {
    if (!podeChamar()) return;
    btn.disabled = true;
    const { data, error } = await sb.rpc("chamar_proxima", {
      p_tipo_id: btn.dataset.tipo,
      p_operador: sessao.id,
      p_data: diaAtual(),
    });
    btn.disabled = false;
    if (error) mostrarErro(error.message);
    else if (avisoChamada(data) && data.senha) {
      const n = rotuloSenha(data.senha);
      const nome = data.senha.nome || "";
      mostrarErro(`Você pegou a senha ${n}${nome ? " — " + nome : ""}.`);
    }
    await carregar();
    return;
  }

  if (acao === "agora") {
    const campo = btn.dataset.campo;
    if (campo === "hora_atendimento") {
      if (!podeChamar()) return;
      await rpcChamar(id, isoDoDia(agoraHHMM()));
      return;
    }
    const hhmm = agoraHHMM();
    const input = btn.parentElement.querySelector("input[type=time]");
    if (input) input.value = hhmm;
    await patch(id, { [campo]: isoDoDia(hhmm) });
    return;
  }
  if (acao === "toggle-atendimento") {
    if (!podeChamar()) return;
    if (btn.checked) await rpcChamar(id);
    else await rpcLiberar(id);
    return;
  }
  if (acao === "corrigir") {
    const senha = senhas.find((s) => s.id === id);
    const novo = window.prompt("Corrigir número da senha:", senha?.numero ?? "");
    if (novo == null || novo === "") return;
    const bruto = String(novo).replace(/^[A-Za-z]+/, "").trim();
    const numero = Number(bruto);
    if (!numero) {
      mostrarErro("Número inválido.");
      return;
    }
    await patch(id, { numero });
    return;
  }
  if (acao === "toggle-tipo") {
    if (!ehAdmin()) return;
    const { error } = await sb.from("tipos_atendimento").update({ ativo: btn.dataset.ativo !== "1" }).eq("id", id);
    if (error) mostrarErro(error.message);
    else await carregar();
    return;
  }
  if (acao === "toggle-op") {
    if (!ehAdmin()) return;
    const { error } = await sb.from("operadores").update({ ativo: btn.dataset.ativo !== "1" }).eq("id", id);
    if (error) mostrarErro(error.message);
    else await carregar();
    return;
  }
  if (acao === "papel-op") {
    if (!ehAdmin()) return;
    const atual = btn.dataset.papel;
    const novo = atual === "admin" ? "operador" : "admin";
    if (id === sessao.id && novo === "operador") {
      const outrosAdmins = operadores.filter((o) => o.id !== id && o.papel === "admin" && o.ativo).length;
      if (!outrosAdmins) {
        mostrarErro("Não dá para tirar o último administrador.");
        return;
      }
    }
    const { error } = await sb.from("operadores").update({ papel: novo }).eq("id", id);
    if (error) mostrarErro(error.message);
    else {
      if (id === sessao.id) {
        sessao.papel = novo;
        localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
        document.getElementById("quem").textContent = textoQuem();
      }
      await carregar();
    }
    return;
  }
  if (acao === "senha-op") {
    if (!ehAdmin()) return;
    const nova = window.prompt("Nova senha (CPF do operador):");
    if (!nova) return;
    const { error } = await sb.rpc("definir_senha_operador", { p_id: id, p_senha: nova });
    if (error) mostrarErro(error.message);
    else window.alert("Senha atualizada.");
  }
}

async function onCampo(ev) {
  const el = ev.target.closest("[data-campo]");
  if (!el || !el.dataset.id || el.disabled) return;
  const id = el.dataset.id;
  const campo = el.dataset.campo;
  let valor;
  if (el.type === "checkbox") valor = el.checked;
  else if (el.type === "time") valor = isoDoDia(el.value);
  else valor = el.value;
  if (campo === "hora_atendimento") {
    if (!podeChamar()) return;
    if (!valor) await rpcLiberar(id);
    else await rpcChamar(id, valor);
    return;
  }
  await patch(id, { [campo]: valor }, ev.type !== "blur");
}

async function onLogin(ev) {
  ev.preventDefault();
  const erro = document.getElementById("login-erro");
  erro.classList.add("hidden");
  const { data, error } = await sb.rpc("login_operador", {
    p_usuario: document.getElementById("login-usuario").value.trim().toLowerCase(),
    p_senha: document.getElementById("login-senha").value.trim(),
  });
  if (error || !data) {
    erro.textContent = "Usuário ou senha não conferem.";
    erro.classList.remove("hidden");
    return;
  }
  sessao = data;
  localStorage.setItem(SESSAO_KEY, JSON.stringify(data));
  document.getElementById("login").classList.add("hidden");
  document.getElementById("quem").textContent = textoQuem();
  document.getElementById("dia").value = hojeISO();
  aplicarDiaSessao();
  await carregar();
  escutar();
}

function sair() {
  localStorage.removeItem(SESSAO_KEY);
  sessao = null;
  document.getElementById("quem").textContent = "";
  pedirLogin();
}

async function salvarSetup() {
  const url = document.getElementById("setup-url").value.trim();
  const key = document.getElementById("setup-key").value.trim();
  const erro = document.getElementById("setup-erro");
  erro.classList.add("hidden");
  if (!url || !key) {
    erro.textContent = "Cola a URL e a chave anon.";
    erro.classList.remove("hidden");
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }));
  if (await conectar()) pedirLogin();
}

function ligarEventos() {
  document.getElementById("tabs").addEventListener("click", (ev) => {
    const tab = ev.target.closest("[data-aba]");
    if (!tab) return;
    aba = tab.dataset.aba;
    desenhar();
  });
  const app = document.getElementById("app");
  app.addEventListener("click", onAcao);
  app.addEventListener("change", onCampo);
  app.addEventListener("blur", (ev) => {
    if (ev.target.matches("input[data-campo=nome], input[data-campo=processo]")) onCampo(ev);
  }, true);
  document.getElementById("dia").addEventListener("change", () => {
    if (!ehAdmin()) document.getElementById("dia").value = hojeISO();
    carregar();
  });
  document.getElementById("btn-hoje").addEventListener("click", () => {
    document.getElementById("dia").value = hojeISO();
    carregar();
  });
  document.getElementById("btn-sair").addEventListener("click", sair);
  document.getElementById("setup-salvar").addEventListener("click", salvarSetup);
  document.getElementById("form-login").addEventListener("submit", onLogin);
}

async function init() {
  document.getElementById("dia").value = hojeISO();
  ligarEventos();
  if (!(await conectar())) return;
  if (!pedirLogin()) return;
  aplicarDiaSessao();
  await carregar();
  escutar();
}

init();
