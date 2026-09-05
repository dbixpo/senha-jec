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
let rascunhoChegada = {
  chamado: false,
  horaIso: null,
  preferencialTipo: "",
  nome: "",
  tipoId: "",
  processo: "",
};
let dashFiltro = { tipo: "", status: "todos", pref: "todos", pessoa: "" };
let relFiltro = { senha: "", nome: "", tipo: "", status: "todos", pref: "todos", pessoa: "" };
let tipoEditandoId = null;
let carregarTimer = 0;
let carregarSeq = 0;
let focarAtenderId = null;

const PREF_TIPOS = [
  { id: "cadeira", nome: "Deficiência" },
  { id: "idoso", nome: "60 anos ou mais" },
  { id: "gestante", nome: "Gestante" },
  { id: "bebe", nome: "Criança de colo" },
  { id: "obesidade", nome: "Obesidade" },
  { id: "autismo", nome: "Autismo" },
];

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
  if (!input) return;
  if (!ehAdmin()) {
    input.value = hojeISO();
    input.disabled = true;
    input.title = "A fila do dia. Só administrador consulta outros dias.";
  } else {
    if (!input.value) input.value = hojeISO();
    input.disabled = false;
    input.title = "Filtrar a fila por dia";
  }
}

function preencherQuem() {
  const el = document.getElementById("quem");
  if (!el) return;
  if (!sessao) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<strong class="quem-nome">${escapar((sessao.nome || "").toUpperCase())}</strong><span class="quem-papel">${ehAdmin() ? "Administrador" : "Operador"}</span>`;
}

function aplicarTopoSessao() {
  const actions = document.querySelector(".top-actions");
  if (!sessao) {
    actions?.classList.add("hidden");
    const quem = document.getElementById("quem");
    if (quem) quem.innerHTML = "";
    document.getElementById("cfg-wrap")?.classList.add("hidden");
    return;
  }
  actions?.classList.remove("hidden");
  aplicarDiaSessao();
  preencherQuem();
  document.getElementById("cfg-wrap")?.classList.remove("hidden");
  document.querySelectorAll(".cfg-admin").forEach((el) => el.classList.toggle("hidden", !ehAdmin()));
  document.getElementById("btn-cfg")?.classList.toggle("on", aba === "tipos" || aba === "operadores" || aba === "relatorio");
  document.getElementById("cfg-menu")?.querySelectorAll("[data-cfg]").forEach((btn) => {
    btn.classList.toggle("on", aba === btn.dataset.cfg);
  });
}

function ehAdmin() {
  return sessao?.papel === "admin";
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

function abrirAviso({ titulo = "Atenção", texto }) {
  const box = document.getElementById("aviso");
  const tit = document.getElementById("aviso-titulo");
  const p = document.getElementById("aviso-texto");
  if (!box || !tit || !p) return;
  tit.textContent = titulo;
  p.textContent = texto;
  box.classList.remove("hidden");
  document.getElementById("aviso-ok")?.focus();
}

function fecharAviso() {
  document.getElementById("aviso")?.classList.add("hidden");
}

function abrirSobre() {
  document.getElementById("sobre")?.classList.remove("hidden");
  document.getElementById("sobre-ok")?.focus();
}

function fecharSobre() {
  document.getElementById("sobre")?.classList.add("hidden");
}

function mostrarErro(msg) {
  abrirAviso({ titulo: "Atenção", texto: msg });
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

function prefTipo(id) {
  return PREF_TIPOS.find((p) => p.id === id) || null;
}

function rascunhoEhPref() {
  return !!rascunhoChegada.preferencialTipo;
}

function iconePref(id, extra = "") {
  const p = prefTipo(id);
  if (!p) return "";
  return `<img class="pref-ico ${extra}" src="img/pref/${p.id}.png" alt="${escapar(p.nome)}" title="${escapar(p.nome)}" width="22" height="22">`;
}

function botoesPrefForm() {
  return `<div class="pref-tipos" role="group" aria-label="Preferencial">
    ${PREF_TIPOS.map((p) => {
      const on = rascunhoChegada.preferencialTipo === p.id;
      return `<button type="button" class="btn-pref${p.id === "autismo" ? " colorido" : ""}${on ? " on" : ""}" data-pref="${p.id}" data-tip="${escapar(p.nome)}" title="${escapar(p.nome)}" aria-pressed="${on ? "true" : "false"}" aria-label="${escapar(p.nome)}">
        <img src="img/pref/${p.id}.png" alt="">
      </button>`;
    }).join("")}
  </div>`;
}

function pintarPrefBotoes() {
  document.querySelectorAll("#form-chegada [data-pref]").forEach((btn) => {
    const on = btn.getAttribute("data-pref") === rascunhoChegada.preferencialTipo;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function estaFinalizada(s) {
  return s.status === "resolvido" || !!s.hora_fim;
}

function estaEmAtendimento(s) {
  return s.status === "em_atendimento" && !estaFinalizada(s);
}

function estaNaFila(s) {
  return !estaEmAtendimento(s) && !estaFinalizada(s);
}

function filtrarLista(lista) {
  if (verTudo) return lista;
  return lista.filter((s) => !estaFinalizada(s));
}

function naFila(lista = senhas) {
  return lista.filter(estaNaFila).length;
}

function ordenarFila(lista) {
  return [...lista].sort((a, b) => {
    const ea = estaEmAtendimento(a) ? 0 : estaFinalizada(a) ? 2 : 1;
    const eb = estaEmAtendimento(b) ? 0 : estaFinalizada(b) ? 2 : 1;
    if (ea !== eb) return ea - eb;
    const sa = Number(a.nao_respondeu) || 0;
    const sb = Number(b.nao_respondeu) || 0;
    if (sa !== sb) return sa - sb;
    if (!!a.preferencial !== !!b.preferencial) return a.preferencial ? -1 : 1;
    return (a.numero || 0) - (b.numero || 0);
  });
}

function estaEditando() {
  const el = document.activeElement;
  if (!el || !el.matches("input, select, textarea")) return false;
  return !!(el.closest(".planilha-wrap") || el.closest("#form-chegada") || el.closest(".form-atender"));
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
    sessao = null;
    aplicarTopoSessao();
    box.classList.remove("hidden");
    document.getElementById("login-usuario")?.focus();
    return false;
  }
  box.classList.add("hidden");
  aplicarTopoSessao();
  return true;
}

async function carregar(opts = {}) {
  if (!sessao) return;
  const seq = ++carregarSeq;
  const soFila = !!opts.soFila && tipos.length;
  const data = diaAtual();
  const inicioDia = new Date(`${data}T00:00:00-03:00`).toISOString();
  const ops = [
    soFila
      ? Promise.resolve({ data: tipos, error: null })
      : sb.from("tipos_atendimento").select("*").order("ordem"),
    sb.from("senhas").select("*").eq("data", data).order("numero"),
    soFila
      ? Promise.resolve({ data: operadores, error: null })
      : sb.from("operadores").select(ehAdmin()
        ? "id, usuario, nome, papel, ativo, ultimo_acesso, created_at, updated_at"
        : "id, nome").order("nome"),
    sb.from("historico_chamadas").select("*").gte("chamado_em", inicioDia).order("chamado_em"),
  ];
  const resultados = await Promise.all(ops);
  if (seq !== carregarSeq) return;
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) {
    mostrarErro(erro.message);
    return;
  }
  if (!soFila) {
    tipos = resultados[0].data || [];
    operadores = resultados[2]?.data || [];
  }
  senhas = resultados[1].data || [];
  chamadas = resultados[3].data || [];
  const porSenha = new Map();
  for (const c of chamadas) {
    const lista = porSenha.get(c.senha_id) || [];
    lista.push(c);
    porSenha.set(c.senha_id, lista);
  }
  for (const s of senhas) {
    s.chamadas = porSenha.get(s.id) || [];
  }
  if (!estaEditando()) desenhar();
}

function agendarCarregar() {
  clearTimeout(carregarTimer);
  carregarTimer = setTimeout(() => carregar({ soFila: true }), 220);
}

function mesclarSenha(row) {
  if (!row || !row.id) return;
  const idx = senhas.findIndex((s) => s.id === row.id);
  const prev = idx >= 0 ? senhas[idx] : {};
  const merged = { ...prev, ...row, chamadas: prev.chamadas || [] };
  if (idx >= 0) senhas[idx] = merged;
  else senhas.push(merged);
}

function escutar() {
  if (canal) sb.removeChannel(canal);
  canal = sb
    .channel("senha-jec-ao-vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => agendarCarregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "historico_chamadas" }, () => agendarCarregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "tipos_atendimento" }, () => carregar())
    .subscribe();
}

function contarTipo(tipoId) {
  return senhas.filter((s) => s.tipo_id === tipoId && estaNaFila(s)).length;
}

function desenharAbas() {
  const nav = document.getElementById("tabs");
  const abas = [];
  if (ehAdmin()) {
    abas.push({ id: "controle", label: "Dashboard", curto: "Painel", count: senhas.length });
  }
  abas.push({ id: "geral", label: "Senha geral", curto: "Geral", count: naFila() });
  abas.push(
    ...tipos.filter((t) => t.ativo).map((t) => ({
      id: "tipo-" + t.id,
      label: t.nome,
      curto: t.sigla,
      count: contarTipo(t.id),
      cor: t.cor,
    }))
  );
  nav.innerHTML = abas
    .map(
      (item) =>
        `<button type="button" class="tab ${item.id === aba ? "active" : ""}" data-aba="${item.id}">
          ${item.cor ? `<span class="tab-dot" style="background:${escapar(item.cor)}"></span>` : ""}
          <span class="tab-lab-wide">${escapar(item.label)}</span>
          <span class="tab-lab-narrow">${escapar(item.curto || item.label)}</span>
          <span class="count">${item.count}</span>
        </button>`
    )
    .join("");
  aplicarTopoSessao();
}

function checksTipoForm() {
  const ativos = tipos.filter((t) => t.ativo);
  const travado = !rascunhoChegada.chamado;
  if (!ativos.length) return `<p class="muted">${ehAdmin() ? "Cadastre um tipo primeiro, em Opções → Tipos de Atendimento." : "Peça a um administrador para cadastrar um tipo."}</p>`;
  return ativos.map((t) => `
    <label class="chip-check mini" title="${escapar(t.nome)}" style="--tipo:${escapar(t.cor)}">
      <input type="checkbox" name="tipo-chegada" value="${t.id}" ${travado ? "disabled" : ""} ${rascunhoChegada.tipoId === t.id ? "checked" : ""}>
      <span class="chip-check-ui"><i class="tab-dot" style="background:${escapar(t.cor)}"></i>${escapar(t.sigla)}<span class="tipo-nome"> · ${escapar(t.nome)}</span></span>
    </label>`).join("");
}

function badgeTipo(senha) {
  const t = tipoDe(senha.tipo_id);
  if (!t) return `<span class="sigla">—</span>`;
  return `<span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span>`;
}

function htmlHoraDica(quando, linhas) {
  const texto = quando || "—";
  const dica = (linhas || []).filter(Boolean).join("\n");
  if (!dica) return `<span class="hora-lida">${escapar(texto)}</span>`;
  return `<span class="hora-tip" tabindex="0" data-dica="${escapar(dica)}">${escapar(texto)}</span>`;
}

function linhasDicaRecepcao(senha) {
  const quando = hora(senha.hora_recepcao);
  if (!quando) return [];
  const quem = senha.created_by ? nomeOperador(senha.created_by) : "";
  const linhas = [`Recepção ${quando}`, quem ? `por ${quem}` : ""];
  if (senha.hora_encaminhamento) linhas.push(`Encaminhada ${hora(senha.hora_encaminhamento)}`);
  return linhas;
}

function linhasDicaAtendimento(senha) {
  const lista = senha.chamadas || [];
  if (!lista.length) return senha.hora_atendimento ? [`Atendimento ${hora(senha.hora_atendimento)}`] : [];
  return lista.map((c, i) => {
    const quem = c.chamado_por === sessao.id ? "você" : nomeOperador(c.chamado_por);
    const onde = c.local || tipoDe(c.tipo_id)?.nome || "";
    const n = i === 0 ? "1ª chamada" : `${i + 1}ª`;
    return `${n} ${hora(c.chamado_em) || "—"} · ${quem}${onde ? " · " + onde : ""}`;
  });
}

function htmlHistorico(senha) {
  const lista = senha.chamadas || [];
  const quando = hora(senha.hora_atendimento) || hora(lista[0]?.chamado_em);
  const dica = linhasDicaAtendimento(senha);
  const extra = lista.length > 1 ? `<span class="chip pref">${lista.length}x</span>` : "";
  return `<span class="hist-chamadas">${htmlHoraDica(quando || "—", dica)}${extra}</span>`;
}

function botoesAcaoTipo(senha, tipoDestinoId) {
  if (!ehHoje()) return "";
  const minha = estaEmAtendimento(senha) && senha.atendido_por === sessao.id;
  const deOutro = estaEmAtendimento(senha) && senha.atendido_por && senha.atendido_por !== sessao.id;
  if (estaFinalizada(senha)) return "";
  if (deOutro) {
    return `<span class="com-quem">Com ${escapar(nomeOperador(senha.atendido_por))}</span>`;
  }
  if (minha) {
    const encaminha = tipoDestinoId && tipoDestinoId !== senha.tipo_id;
    return `<button type="button" class="btn ok small" data-acao="finalizar-senha" data-id="${senha.id}">${encaminha ? "Encaminhar" : "Finalizar"}</button>
      <button type="button" class="btn stamp small" data-acao="nao-respondeu" data-id="${senha.id}"><span class="lab-wide">Não respondeu</span><span class="lab-narrow">Não veio</span></button>
      <button type="button" class="btn ghost small btn-rechamada" data-acao="chamar-senha" data-id="${senha.id}">Chamar de novo</button>`;
  }
  return `<button type="button" class="btn primary small" data-acao="chamar-senha" data-id="${senha.id}">Chamar</button>`;
}

function checksTipoAtender(senha) {
  return tipos
    .filter((t) => t.ativo)
    .map(
      (t) => `
    <label class="chip-check mini" title="${escapar(t.nome)}" style="--tipo:${escapar(t.cor)}">
      <input type="checkbox" name="tipo-atender" data-campo="tipo_id" data-id="${senha.id}" value="${t.id}" ${senha.tipo_id === t.id ? "checked" : ""}>
      <span class="chip-check-ui"><i class="tab-dot" style="background:${escapar(t.cor)}"></i>${escapar(t.sigla)}<span class="tipo-nome"> · ${escapar(t.nome)}</span></span>
    </label>`
    )
    .join("");
}

function pintarBotaoAtender(form) {
  if (!form) return;
  const destino = form.querySelector("input[name=tipo-atender]:checked")?.value || "";
  const origem = form.dataset.origem || "";
  const btn = form.querySelector("[data-acao=finalizar-senha]");
  if (btn) btn.textContent = destino && destino !== origem ? "Encaminhar" : "Finalizar";
}

function htmlObservacao(texto) {
  const t = String(texto || "").trim();
  if (!t) return "";
  return `<span class="obs-lida">${escapar(t)}</span>`;
}

function linhaAtender(senha) {
  const obs = String(senha.observacao || "").slice(0, 200);
  return `<tr class="em-atendimento linha-atender">
    <td colspan="7">
      <form class="form-chegada form-atender" data-id="${senha.id}" data-origem="${escapar(senha.tipo_id)}">
        <div class="atender-rotulo">
          <strong class="senha-valor">${escapar(rotuloSenha(senha))}</strong>
          ${iconePref(senha.preferencial_tipo, "pref-ico-planilha")}
          <span class="muted">${escapar(hora(senha.hora_atendimento) || "—")}</span>
        </div>
        <label class="campo campo-nome">Nome
          <input type="text" data-campo="nome" data-id="${senha.id}" value="${escapar(senha.nome || "")}" placeholder="Nome" autocomplete="off">
        </label>
        <fieldset class="campo campo-tipos">
          <legend>Tipo</legend>
          <div class="tipo-checks">${checksTipoAtender(senha)}</div>
        </fieldset>
        <label class="campo campo-processo">Nº processo
          <input type="text" data-campo="processo" data-id="${senha.id}" value="${escapar(senha.processo || "")}" placeholder="Nº processo" autocomplete="off">
        </label>
        <label class="campo campo-obs">Observação
          <textarea data-campo="observacao" data-id="${senha.id}" maxlength="200" rows="2" placeholder="O que rolou, o que a próxima fila precisa saber…">${escapar(obs)}</textarea>
          <span class="obs-conta"><span class="obs-n">${obs.length}</span>/200</span>
        </label>
        <div class="chegada-acoes">${botoesAcaoTipo(senha, senha.tipo_id)}</div>
      </form>
    </td>
  </tr>`;
}

function linhaSenha(senha, { chamar = false } = {}) {
  const finalizada = estaFinalizada(senha);
  const emAtend = estaEmAtendimento(senha);
  const faltou = Number(senha.nao_respondeu) > 0;
  const classe = finalizada ? "atendida" : emAtend ? "em-atendimento" : "aguardando";
  const minha = chamar && ehHoje() && emAtend && senha.atendido_por === sessao.id;
  if (minha) return linhaAtender(senha);
  const acao = chamar ? `<td class="cel-acao" data-label="Ação">${botoesAcaoTipo(senha)}</td>` : "";
  return `<tr class="${classe} ${senha.preferencial ? "pref" : ""} ${faltou && !finalizada && !emAtend ? "faltou" : ""}">
    <td class="cel-num col-num" data-label="Senha"><span class="senha-com-ico"><span class="senha-num">${escapar(rotuloSenha(senha))}</span>${iconePref(senha.preferencial_tipo, "pref-ico-planilha")}</span>${faltou ? `<span class="chip ausente">${senha.nao_respondeu}x não resp.</span>` : ""}${emAtend ? `<span class="chip em-atendimento">em atendimento</span>` : ""}</td>
    <td class="cel-rec" data-label="Recepção">${htmlHoraDica(hora(senha.hora_recepcao) || "—", linhasDicaRecepcao(senha))}</td>
    <td class="cel-atend" data-label="Atendimento">${htmlHistorico(senha)}</td>
    <td class="cel-nome" data-label="Nome"><span class="hora-lida">${escapar(senha.nome || "—")}</span>${htmlObservacao(senha.observacao)}</td>
    <td class="cel-tipo" data-label="Tipo">${badgeTipo(senha)}</td>
    <td class="cel-proc" data-label="Processo"><span class="hora-lida">${escapar(senha.processo || "—")}</span></td>
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
    return `<p class="empty">${verTudo ? "Ninguém nesta fila hoje." : "Ninguém na fila agora. Marca Ver tudo para incluir os já finalizados."}</p>`;
  }
  return `<div class="planilha-wrap">
    <table class="planilha">
      <colgroup>
        <col class="col-num">
        <col class="col-rec">
        <col class="col-atend">
        <col class="col-nome">
        <col class="col-tipo">
        <col class="col-proc">
        ${chamar ? `<col class="col-acao">` : ""}
      </colgroup>
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
    if (dica) dica.textContent = verTudo ? "Inclui quem já foi finalizado." : "Só quem ainda está na fila ou em atendimento.";
    desenharAbas();
  });
}

function legendaTipos() {
  return `<ul class="legenda">
    ${tipos.filter((t) => t.ativo).map((t) => `<li><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> ${escapar(t.nome)}</li>`).join("")}
    <li><span class="chip aguardando">espera</span></li>
    <li><span class="chip em-atendimento">em atendimento</span></li>
    <li><span class="chip atendida">finalizado</span></li>
    <li><span class="chip pref">P = preferencial (sobe · senha P01)</span></li>
    <li><span class="chip ausente">não respondeu</span></li>
  </ul>`;
}

function telaGeral() {
  const travado = !rascunhoChegada.chamado;
  const form = ehHoje()
    ? `<form id="form-chegada" class="form-chegada${travado ? " aguardando-chamada" : ""}">
        <input type="hidden" id="campo-tipo" value="${escapar(rascunhoChegada.tipoId)}">
        <div class="senha-com-pref">
          <div class="campo campo-senha-num">
            <span>Senha</span>
            <strong id="campo-senha-rotulo" class="senha-valor">${rotuloProxima(rascunhoEhPref())}</strong>
          </div>
          ${botoesPrefForm()}
        </div>
        <div class="chegada-chamada">
          <button type="button" class="btn primary" id="btn-chamar-recepcao"><span class="n-passo">1</span>Chamar</button>
          <div class="campo campo-hora">
            <span>Hora recepção</span>
            <strong id="campo-hora-rotulo" class="senha-valor senha-hora-dica">${rascunhoChegada.horaIso ? escapar(hora(rascunhoChegada.horaIso)) : "—"}</strong>
          </div>
        </div>
        <label class="campo campo-nome"><span class="n-passo">2</span>Nome
          <input id="campo-nome" type="text" placeholder="Nome" required autocomplete="off" ${travado ? "disabled" : ""} value="${escapar(rascunhoChegada.nome)}">
        </label>
        <fieldset class="campo campo-tipos">
          <legend>Tipo</legend>
          <div class="tipo-checks">${checksTipoForm()}</div>
        </fieldset>
        <label class="campo campo-processo">Nº processo
          <input id="campo-processo" type="text" placeholder="Nº processo" autocomplete="off" ${travado ? "disabled" : ""} value="${escapar(rascunhoChegada.processo)}">
        </label>
        <div class="chegada-acoes">
          <button class="btn primary form-submit" id="btn-registrar" type="submit" ${travado ? "disabled" : ""}><span class="n-passo">3</span>Registrar</button>
          <button type="button" class="btn stamp" id="btn-nao-respondeu-recepcao" ${travado ? "disabled" : ""}><span class="lab-wide">Não respondeu</span><span class="lab-narrow">Não veio</span></button>
        </div>
      </form>
      <p id="form-erro" class="erro hidden"></p>`
    : `<p class="muted form-dica">Consultando ${dataLegivel(diaAtual())}. Para registrar senha, volta a data para hoje.</p>`;
  return `
    <section class="card card-fila">
      <div class="card-topo">
        <div>
          <h2>Senha geral</h2>
          <p class="muted form-dica dica-web">${ehHoje() ? "Chamar anota a hora. Se a pessoa não aparecer, Não respondeu. Se aparecer, preenche e registra." : "Fila de outro dia. Só consulta."}</p>
          <p class="muted form-dica dica-mobile">${ehHoje() ? "1 chama · 2 preenche · 3 registra. Rosa espera · amarelo em atendimento." : "Só consulta."}</p>
        </div>
        <div class="topo-acoes">
          ${legendaTipos()}
          ${barraFiltro()}
        </div>
      </div>
      ${form}
      <div id="fila-lista">${tabelaFila(senhas, { chamar: false })}</div>
    </section>`;
}

function telaTipo(tipo) {
  const lista = senhas.filter((s) => s.tipo_id === tipo.id);
  return `<section class="card card-fila">
    <div class="card-topo">
      <div>
        <h2>${escapar(tipo.nome)}</h2>
        <p class="muted form-dica dica-web">${ehHoje() ? "Chamar na linha coloca em atendimento. Trocar o tipo e <strong>Encaminhar</strong> manda pra outra fila. <strong>Finalizar</strong> encerra neste tipo. A observação (até 200 caracteres) segue com a senha." : `Consultando ${dataLegivel(diaAtual())}. Chamada só no dia de hoje.`}</p>
        <p class="muted form-dica dica-mobile">${ehHoje() ? "Chamar na linha. Troca o tipo e encaminha, ou finaliza. Observação vai junto." : "Só consulta."}</p>
        <p id="fila-dica" class="muted form-dica dica-web">${verTudo ? "Inclui quem já foi finalizado." : "Só quem ainda está na fila ou em atendimento."}</p>
      </div>
      <div class="topo-acoes">
        ${barraFiltro()}
        <span class="sigla grande" style="background:${escapar(tipo.cor)}">${escapar(tipo.sigla)}</span>
      </div>
    </div>
    <div id="fila-lista">${tabelaFila(lista, { chamar: ehHoje() })}</div>
  </section>`;
}

function telaTipos() {
  const editando = tipos.find((t) => t.id === tipoEditandoId) || null;
  return `<section class="card">
    <h2>Tipos de atendimento</h2>
    <p class="muted form-dica">${editando ? `Editando <strong>${escapar(editando.nome)}</strong>. Os tipos já vêm prontos (Triagem, Consulta, Ajuizamento) e você pode mudar nome, sigla e cor.` : "Os tipos já vêm cadastrados. Pode editar, incluir outros ou desativar."}</p>
    <form id="form-tipo" class="form-grid cadastro">
      <input type="hidden" id="tipo-id" value="${editando ? escapar(editando.id) : ""}">
      <label>Nome
        <input id="tipo-nome" required placeholder="Ex.: Triagem" value="${editando ? escapar(editando.nome) : ""}">
      </label>
      <label>Sigla
        <input id="tipo-sigla" required maxlength="3" placeholder="T" value="${editando ? escapar(editando.sigla) : ""}">
      </label>
      <label>Cor
        <input id="tipo-cor" type="color" value="${editando ? escapar(editando.cor) : "#6B3FA0"}">
      </label>
      <button class="btn primary" type="submit">${editando ? "Salvar" : "Incluir tipo"}</button>
      ${editando ? `<button type="button" class="btn ghost" data-acao="cancelar-tipo">Cancelar</button>` : ""}
    </form>
    <p id="tipo-erro" class="erro hidden"></p>
    <table class="table table-cartoes">
      <thead><tr><th>Tipo</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${
          tipos.length
            ? tipos
                .map(
                  (t) => `<tr class="${t.id === tipoEditandoId ? "editando" : ""}">
                    <td data-label="Tipo"><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> <strong>${escapar(t.nome)}</strong>${t.ativo ? "" : " · inativo"}</td>
                    <td class="meta" data-label="Quando">${auditoria(t)}</td>
                    <td class="cel-botoes">
                      <button type="button" class="btn ghost small" data-acao="editar-tipo" data-id="${t.id}">Editar</button>
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

function horaDoTs(ts) {
  if (!ts) return null;
  const parte = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(ts)).find((p) => p.type === "hour");
  const n = Number(parte?.value);
  return Number.isFinite(n) ? n : null;
}

function minutosEntre(a, b) {
  if (!a || !b) return null;
  return Math.max(0, (new Date(b) - new Date(a)) / 60000);
}

function fmtMin(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1) return "< 1 min";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

function senhasDash() {
  return senhas.filter((s) => {
    if (dashFiltro.tipo && s.tipo_id !== dashFiltro.tipo) return false;
    if (dashFiltro.status === "fila" && !estaNaFila(s)) return false;
    if (dashFiltro.status === "atendimento" && !estaEmAtendimento(s)) return false;
    if (dashFiltro.status === "atendidas" && !estaFinalizada(s)) return false;
    if (dashFiltro.pref === "nao" && s.preferencial) return false;
    if (dashFiltro.pref !== "todos" && dashFiltro.pref !== "nao") {
      if (s.preferencial_tipo !== dashFiltro.pref) return false;
    }
    if (dashFiltro.pessoa) {
      const chamou = (s.chamadas || []).some((c) => c.chamado_por === dashFiltro.pessoa);
      if (s.created_by !== dashFiltro.pessoa && s.atendido_por !== dashFiltro.pessoa && !chamou) return false;
    }
    return true;
  });
}

function rotuloStatus(s) {
  if (estaFinalizada(s)) return "Finalizada";
  if (estaEmAtendimento(s)) return "Em atendimento";
  return "Na fila";
}

function bateSenhaBusca(s, q) {
  const t = String(q || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return true;
  const rotulo = rotuloSenha(s).toLowerCase();
  const num = String(s.numero);
  const soNum = t.replace(/^p/, "");
  return rotulo.includes(t) || num === soNum || padSenha(s.numero).includes(soNum);
}

function senhasRelatorio() {
  const nomeQ = String(relFiltro.nome || "").trim().toLowerCase();
  return ordenarFila(senhas.filter((s) => {
    if (!bateSenhaBusca(s, relFiltro.senha)) return false;
    if (nomeQ && !(s.nome || "").toLowerCase().includes(nomeQ)) return false;
    if (relFiltro.tipo && s.tipo_id !== relFiltro.tipo) return false;
    if (relFiltro.status === "fila" && !estaNaFila(s)) return false;
    if (relFiltro.status === "atendimento" && !estaEmAtendimento(s)) return false;
    if (relFiltro.status === "atendidas" && !estaFinalizada(s)) return false;
    if (relFiltro.pref === "nao" && s.preferencial) return false;
    if (relFiltro.pref !== "todos" && relFiltro.pref !== "nao") {
      if (s.preferencial_tipo !== relFiltro.pref) return false;
    }
    if (relFiltro.pessoa) {
      const chamou = (s.chamadas || []).some((c) => c.chamado_por === relFiltro.pessoa);
      if (s.created_by !== relFiltro.pessoa && s.atendido_por !== relFiltro.pessoa && !chamou) return false;
    }
    return true;
  }));
}

function historicoTexto(senha) {
  const lista = senha.chamadas || [];
  if (!lista.length) return "";
  return lista.map((c, i) => {
    const quem = nomeOperador(c.chamado_por);
    const onde = c.local || "";
    return `${i + 1}ª ${hora(c.chamado_em) || "—"} ${quem}${onde ? " " + onde : ""}`;
  }).join(" | ");
}

function htmlRelatorioTabela(lista) {
  if (!lista.length) {
    return `<p class="empty">Nada neste recorte. Limpa os filtros ou troca a data no topo.</p>`;
  }
  return `<div class="rel-wrap">
    <table class="rel-tabela table-cartoes">
      <thead>
        <tr>
          <th>Senha</th>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Situação</th>
          <th>Recepção</th>
          <th>Atendimento</th>
          <th>Finalizou</th>
          <th>Espera</th>
          <th>Chamadas</th>
          <th>Processo</th>
          <th>Observação</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map((s) => {
          const t = tipoDe(s.tipo_id);
          const pref = prefTipo(s.preferencial_tipo);
          const espera = fmtMin(minutosEntre(s.hora_recepcao, s.hora_atendimento));
          return `<tr class="${estaFinalizada(s) ? "atendida" : estaEmAtendimento(s) ? "em-atendimento" : "aguardando"}">
            <td data-label="Senha"><span class="senha-num">${escapar(rotuloSenha(s))}</span>${pref ? ` <span class="meta">${escapar(pref.nome)}</span>` : ""}</td>
            <td data-label="Nome">${escapar(s.nome || "—")}</td>
            <td data-label="Tipo">${t ? `<span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> ${escapar(t.nome)}` : "—"}</td>
            <td data-label="Situação">${escapar(rotuloStatus(s))}${Number(s.nao_respondeu) ? ` · ${s.nao_respondeu}x não resp.` : ""}</td>
            <td data-label="Recepção">${escapar(hora(s.hora_recepcao) || "—")}<div class="meta">${escapar(s.created_by ? nomeOperador(s.created_by) : "")}</div></td>
            <td data-label="Atendimento">${escapar(hora(s.hora_atendimento) || "—")}<div class="meta">${escapar(s.atendido_por ? nomeOperador(s.atendido_por) : "")}</div></td>
            <td data-label="Finalizou">${escapar(hora(s.hora_fim) || "—")}</td>
            <td data-label="Espera">${escapar(espera)}</td>
            <td data-label="Chamadas">${escapar(historicoTexto(s) || "—")}</td>
            <td data-label="Processo">${escapar(s.processo || "—")}</td>
            <td data-label="Observação">${escapar(s.observacao || "—")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

function csvCel(v) {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function baixarRelatorio() {
  const lista = senhasRelatorio();
  const cols = ["Senha", "Nome", "Tipo", "Preferencial", "Situação", "Recepção", "Quem registrou", "Atendimento", "Quem atendeu", "Finalizou", "Espera", "Chamadas", "Não respondeu", "Processo", "Observação"];
  const linhas = lista.map((s) => {
    const t = tipoDe(s.tipo_id);
    const pref = prefTipo(s.preferencial_tipo);
    return [
      rotuloSenha(s),
      s.nome || "",
      t ? `${t.sigla} ${t.nome}` : "",
      pref ? pref.nome : "",
      rotuloStatus(s),
      hora(s.hora_recepcao) || "",
      s.created_by ? nomeOperador(s.created_by) : "",
      hora(s.hora_atendimento) || "",
      s.atendido_por ? nomeOperador(s.atendido_por) : "",
      hora(s.hora_fim) || "",
      fmtMin(minutosEntre(s.hora_recepcao, s.hora_atendimento)),
      historicoTexto(s),
      s.nao_respondeu || 0,
      s.processo || "",
      s.observacao || "",
    ].map(csvCel).join(";");
  });
  const csv = "\uFEFF" + [cols.join(";"), ...linhas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `senha-jec-${diaAtual()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ligarRelatorio() {
  const bind = (id, key) => {
    document.getElementById(id)?.addEventListener("change", (ev) => {
      relFiltro[key] = ev.target.value;
      atualizarRelatorio();
    });
  };
  bind("rel-tipo", "tipo");
  bind("rel-status", "status");
  bind("rel-pref", "pref");
  bind("rel-pessoa", "pessoa");
  document.getElementById("rel-senha")?.addEventListener("input", (ev) => {
    relFiltro.senha = ev.target.value;
    atualizarRelatorio();
  });
  document.getElementById("rel-nome")?.addEventListener("input", (ev) => {
    relFiltro.nome = ev.target.value;
    atualizarRelatorio();
  });
}

function atualizarRelatorio() {
  const lista = senhasRelatorio();
  const box = document.getElementById("rel-lista");
  const qtd = document.getElementById("rel-qtd");
  if (box) box.innerHTML = htmlRelatorioTabela(lista);
  if (qtd) qtd.textContent = `${lista.length} de ${senhas.length} senhas no dia`;
  const qtdPrint = document.getElementById("rel-qtd-print");
  if (qtdPrint) qtdPrint.textContent = lista.length;
}

function telaRelatorio() {
  const lista = senhasRelatorio();
  const optsTipo = tipos.map((t) => `<option value="${t.id}" ${relFiltro.tipo === t.id ? "selected" : ""}>${escapar(t.nome)}</option>`).join("");
  const optsPessoa = operadores
    .filter((o) => o.ativo || senhas.some((s) => s.created_by === o.id || s.atendido_por === o.id))
    .map((o) => `<option value="${o.id}" ${relFiltro.pessoa === o.id ? "selected" : ""}>${escapar(o.nome)}</option>`)
    .join("");
  return `<section class="card rel-card">
    <div class="card-topo">
      <div>
        <h2>Relatório</h2>
        <p class="muted form-dica">Dia ${escapar(dataLegivel(diaAtual()))} na tela. Filtra aqui. A data no topo troca o dia. Imprimir também serve para salvar em PDF.</p>
      </div>
      <div class="topo-acoes rel-acoes">
        <button type="button" class="btn ghost" data-acao="baixar-relatorio">Baixar CSV</button>
        <button type="button" class="btn primary" data-acao="imprimir-relatorio">Imprimir / PDF</button>
      </div>
    </div>
    <p class="so-print">Senha JEC — ${escapar(dataLegivel(diaAtual()))} — <span id="rel-qtd-print">${lista.length}</span> senhas</p>
    <div class="dash-filtros rel-filtros">
      <label>Senha
        <input id="rel-senha" type="text" inputmode="search" placeholder="01 ou P01" value="${escapar(relFiltro.senha)}" autocomplete="off">
      </label>
      <label>Nome
        <input id="rel-nome" type="text" placeholder="Nome" value="${escapar(relFiltro.nome)}" autocomplete="off">
      </label>
      <label>Tipo
        <select id="rel-tipo">
          <option value="">Todos</option>
          ${optsTipo}
        </select>
      </label>
      <label>Situação
        <select id="rel-status">
          <option value="todos" ${relFiltro.status === "todos" ? "selected" : ""}>Todas</option>
          <option value="fila" ${relFiltro.status === "fila" ? "selected" : ""}>Na fila</option>
          <option value="atendimento" ${relFiltro.status === "atendimento" ? "selected" : ""}>Em atendimento</option>
          <option value="atendidas" ${relFiltro.status === "atendidas" ? "selected" : ""}>Finalizadas</option>
        </select>
      </label>
      <label>Preferencial
        <select id="rel-pref">
          <option value="todos" ${relFiltro.pref === "todos" ? "selected" : ""}>Todas</option>
          <option value="nao" ${relFiltro.pref === "nao" ? "selected" : ""}>Sem preferencial</option>
          ${PREF_TIPOS.map((p) => `<option value="${p.id}" ${relFiltro.pref === p.id ? "selected" : ""}>${escapar(p.nome)}</option>`).join("")}
        </select>
      </label>
      <label>Pessoa
        <select id="rel-pessoa">
          <option value="">Todo mundo</option>
          ${optsPessoa}
        </select>
      </label>
    </div>
    <p id="rel-qtd" class="muted form-dica">${lista.length} de ${senhas.length} senhas no dia</p>
    <div id="rel-lista">${htmlRelatorioTabela(lista)}</div>
  </section>`;
}

function svgDonut(fatias) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const r = 15.5;
  const c = 2 * Math.PI * r;
  if (!total) {
    return `<svg class="donut" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="4"></circle></svg>`;
  }
  let acc = 0;
  const rings = fatias
    .filter((f) => f.valor > 0)
    .map((f) => {
      const frac = f.valor / total;
      const html = `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${escapar(f.cor)}" stroke-width="4" stroke-dasharray="${(frac * c).toFixed(2)} ${(c - frac * c).toFixed(2)}" stroke-dashoffset="${(-acc * c).toFixed(2)}" transform="rotate(-90 18 18)"></circle>`;
      acc += frac;
      return html;
    })
    .join("");
  return `<svg class="donut" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="#eef2f6" stroke-width="4"></circle>${rings}</svg>`;
}

function ligarDash() {
  const bind = (id, key) => {
    document.getElementById(id)?.addEventListener("change", (ev) => {
      dashFiltro[key] = ev.target.value;
      desenhar();
    });
  };
  bind("dash-tipo", "tipo");
  bind("dash-status", "status");
  bind("dash-pref", "pref");
  bind("dash-pessoa", "pessoa");
  document.querySelectorAll(".pref-motivo[data-pref]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-pref");
      dashFiltro.pref = dashFiltro.pref === id ? "todos" : id;
      desenhar();
    });
  });
}

function telaControle() {
  const lista = senhasDash();
  const total = lista.length;
  const espera = lista.filter(estaNaFila).length;
  const emAtend = lista.filter(estaEmAtendimento).length;
  const feitas = lista.filter(estaFinalizada).length;
  const prefs = lista.filter((s) => s.preferencial).length;
  const porPref = PREF_TIPOS.map((p) => ({
    p,
    n: lista.filter((s) => s.preferencial_tipo === p.id).length,
  }));
  const prefSemTipo = lista.filter((s) => s.preferencial && !s.preferencial_tipo).length;
  const esperas = lista.map((s) => minutosEntre(s.hora_recepcao, s.hora_atendimento)).filter((n) => n != null);
  const mediaEspera = esperas.length ? esperas.reduce((a, b) => a + b, 0) / esperas.length : null;
  const agora = Date.now();
  const naFilaMin = lista
    .filter((s) => estaNaFila(s) && s.hora_recepcao)
    .map((s) => Math.max(0, (agora - new Date(s.hora_recepcao)) / 60000));
  const maisAntiga = naFilaMin.length ? Math.max(...naFilaMin) : null;

  const porTipo = tipos.map((t) => {
    const doTipo = lista.filter((s) => s.tipo_id === t.id);
    return {
      t,
      total: doTipo.length,
      espera: doTipo.filter(estaNaFila).length,
      feitas: doTipo.filter(estaFinalizada).length,
    };
  });
  const maxTipo = Math.max(1, ...porTipo.map((x) => x.total));
  const donutFatias = porTipo.map((x) => ({ valor: x.total, cor: x.t.cor, nome: x.t.nome }));

  const horasDados = lista.flatMap((s) => [s.hora_recepcao, s.hora_atendimento]).map(horaDoTs).filter((h) => h != null);
  let hMin = 8;
  let hMax = 18;
  if (horasDados.length) {
    hMin = Math.min(hMin, ...horasDados);
    hMax = Math.max(hMax, ...horasDados);
  }
  const horas = [];
  for (let h = hMin; h <= hMax; h += 1) horas.push(h);
  const recPorHora = horas.map((h) => lista.filter((s) => horaDoTs(s.hora_recepcao) === h).length);
  const atPorHora = horas.map((h) => lista.filter((s) => horaDoTs(s.hora_atendimento) === h).length);
  const maxHora = Math.max(1, ...recPorHora, ...atPorHora);
  const picoRec = recPorHora.reduce((melhor, n, i) => (n > (recPorHora[melhor] || 0) ? i : melhor), 0);

  const faixas = [
    { rotulo: "Até 5 min", n: esperas.filter((n) => n <= 5).length },
    { rotulo: "5 a 15 min", n: esperas.filter((n) => n > 5 && n <= 15).length },
    { rotulo: "15 a 30 min", n: esperas.filter((n) => n > 15 && n <= 30).length },
    { rotulo: "Mais de 30", n: esperas.filter((n) => n > 30).length },
  ];

  const idsLista = new Set(lista.map((s) => s.id));
  const chamadasDash = chamadas.filter((c) => idsLista.has(c.senha_id));
  const porPessoa = operadores
    .map((o) => {
      const registrou = lista.filter((s) => s.created_by === o.id).length;
      const chamou = chamadasDash.filter((c) => c.chamado_por === o.id).length;
      return { o, registrou, chamou, total: registrou + chamou };
    })
    .filter((x) => x.total || x.o.ativo)
    .sort((a, b) => b.total - a.total);
  const maxPessoa = Math.max(1, ...porPessoa.map((x) => x.total));

  const optsTipo = tipos.map((t) => `<option value="${t.id}" ${dashFiltro.tipo === t.id ? "selected" : ""}>${escapar(t.nome)}</option>`).join("");
  const optsPessoa = operadores
    .filter((o) => o.ativo || lista.some((s) => s.created_by === o.id || s.atendido_por === o.id))
    .map((o) => `<option value="${o.id}" ${dashFiltro.pessoa === o.id ? "selected" : ""}>${escapar(o.nome)}</option>`)
    .join("");

  return `<section class="card">
    <div class="card-topo">
      <div>
        <h2>Dashboard</h2>
        <p class="muted form-dica">${ehHoje() ? "Produção de hoje, ao vivo." : `Produção de ${dataLegivel(diaAtual())}.`} A data no topo troca o dia. Os filtros abaixo recortam o que está na tela.</p>
      </div>
      <div class="topo-acoes">
        <button type="button" class="btn ghost" data-acao="ir-relatorio">Relatório detalhado</button>
      </div>
    </div>
    <div class="dash-filtros">
      <label>Tipo
        <select id="dash-tipo">
          <option value="">Todos</option>
          ${optsTipo}
        </select>
      </label>
      <label>Situação
        <select id="dash-status">
          <option value="todos" ${dashFiltro.status === "todos" ? "selected" : ""}>Todas</option>
          <option value="fila" ${dashFiltro.status === "fila" ? "selected" : ""}>Na fila</option>
          <option value="atendimento" ${dashFiltro.status === "atendimento" ? "selected" : ""}>Em atendimento</option>
          <option value="atendidas" ${dashFiltro.status === "atendidas" ? "selected" : ""}>Finalizadas</option>
        </select>
      </label>
      <label>Preferencial
        <select id="dash-pref">
          <option value="todos" ${dashFiltro.pref === "todos" ? "selected" : ""}>Todas</option>
          <option value="nao" ${dashFiltro.pref === "nao" ? "selected" : ""}>Sem preferencial</option>
          ${PREF_TIPOS.map((p) => `<option value="${p.id}" ${dashFiltro.pref === p.id ? "selected" : ""}>${escapar(p.nome)}</option>`).join("")}
        </select>
      </label>
      <label>Pessoa
        <select id="dash-pessoa">
          <option value="">Todo mundo</option>
          ${optsPessoa}
        </select>
      </label>
    </div>
    <div class="kpis">
      <div class="kpi"><span>Senhas</span><strong>${total}</strong><small>${senhas.length === total ? "no dia" : `de ${senhas.length} no dia`}</small></div>
      <div class="kpi fila"><span>Na fila</span><strong>${espera}</strong><small>${emAtend ? emAtend + " em atendimento" : maisAntiga == null ? "ninguém esperando" : "mais antiga " + fmtMin(maisAntiga)}</small></div>
      <div class="kpi ok"><span>Finalizadas</span><strong>${feitas}</strong><small>${total ? Math.round((feitas / total) * 100) + "% do recorte" : "—"}</small></div>
      <div class="kpi pref"><span>Preferencial</span><strong>${prefs}</strong><small>${total ? Math.round((prefs / total) * 100) + "% do recorte" : "—"}</small></div>
    </div>
    <div class="pref-motivos" aria-label="Preferencial por motivo">
      ${porPref
        .map(
          (x) => `<button type="button" class="pref-motivo${dashFiltro.pref === x.p.id ? " on" : ""}${x.p.id === "autismo" ? " colorido" : ""}" data-pref="${x.p.id}">
            ${iconePref(x.p.id)}
            <span>${escapar(x.p.nome)}</span>
            <strong>${x.n}</strong>
          </button>`
        )
        .join("")}
      ${
        prefSemTipo
          ? `<div class="pref-motivo">
              <span>Outros</span>
              <strong>${prefSemTipo}</strong>
            </div>`
          : ""
      }
    </div>
  </section>
  <div class="dash-grid">
    <section class="card">
      <h2>Por tipo</h2>
      ${
        total
          ? `<div class="dash-split">
              ${svgDonut(donutFatias)}
              <ul class="dash-legenda">
                ${porTipo
                  .map(
                    (x) => `<li>
                      <i class="dash-dot" style="background:${escapar(x.t.cor)}"></i>
                      <span>${escapar(x.t.sigla)} · ${escapar(x.t.nome)}</span>
                      <strong>${x.total}</strong>
                    </li>`
                  )
                  .join("")}
              </ul>
            </div>
            <div class="bar-h-row">
              ${porTipo
                .map(
                  (x) => `<div>
                    <div class="bar-h-lab"><span>${escapar(x.t.nome)}</span><span>${x.feitas} atend. · ${x.espera} fila</span></div>
                    <div class="bar-h" title="${x.total} senhas">
                      <i style="width:${(x.feitas / maxTipo) * 100}%;background:#19a88b"></i>
                      <i style="width:${(x.espera / maxTipo) * 100}%;background:#e63030"></i>
                    </div>
                  </div>`
                )
                .join("")}
            </div>`
          : `<p class="dash-vazio">Sem senha neste recorte para montar o gráfico.</p>`
      }
    </section>
    <section class="card">
      <h2>Ao longo do dia</h2>
      <p class="dash-chips"><span><i></i>Recepção</span><span><i class="at"></i>Atendimento</span></p>
      ${
        total
          ? `<div class="chart-hours" role="img" aria-label="Senhas por hora">
              ${horas
                .map((h, i) => {
                  const rec = recPorHora[i];
                  const at = atPorHora[i];
                  return `<div class="chart-col">
                    <div class="pares">
                      <span class="bar" style="height:${rec ? Math.max(8, (rec / maxHora) * 100) : 0}%"></span>
                      <span class="bar at" style="height:${at ? Math.max(8, (at / maxHora) * 100) : 0}%"></span>
                    </div>
                    <span>${String(h).padStart(2, "0")}</span>
                  </div>`;
                })
                .join("")}
            </div>
            <p class="muted form-dica" style="margin-top:12px">${recPorHora[picoRec] ? `Pico de chegada às ${String(horas[picoRec]).padStart(2, "0")}h (${recPorHora[picoRec]}).` : "Ainda sem pico de chegada neste recorte."}</p>`
          : `<p class="dash-vazio">Quando as senhas começarem a entrar, o movimento do dia aparece aqui.</p>`
      }
    </section>
  </div>
  <section class="card">
    <h2>Tempo de espera</h2>
    <p class="muted form-dica">Da hora da recepção até a primeira chamada. Só entra quem já foi atendido.</p>
    <div class="kpis">
      <div class="kpi"><span>Média</span><strong>${fmtMin(mediaEspera)}</strong></div>
      <div class="kpi"><span>Atendidas com hora</span><strong>${esperas.length}</strong></div>
      <div class="kpi fila"><span>Ainda na fila</span><strong>${espera}</strong></div>
      <div class="kpi"><span>Mais antiga agora</span><strong>${fmtMin(maisAntiga)}</strong></div>
    </div>
    <div class="espera-faixas">
      ${faixas.map((f) => `<div class="espera-faixa"><span>${escapar(f.rotulo)}</span><strong>${f.n}</strong></div>`).join("")}
    </div>
  </section>
  <section class="card">
    <h2>Por pessoa</h2>
    <table class="table table-cartoes">
      <thead><tr><th>Pessoa</th><th>Perfil</th><th>Registrou</th><th>Chamou</th><th></th></tr></thead>
      <tbody>
        ${
          porPessoa.length
            ? porPessoa
                .map(
                  (x) => `<tr>
                    <td data-label="Pessoa"><strong>${escapar(x.o.nome)}</strong><div class="meta">${escapar(x.o.usuario || "")}${x.o.ativo ? "" : " · inativo"}</div></td>
                    <td data-label="Perfil"><span class="papel-badge ${x.o.papel}">${rotuloPapel(x.o.papel)}</span></td>
                    <td data-label="Registrou">${x.registrou}</td>
                    <td data-label="Chamou">${x.chamou}</td>
                    <td class="cel-barra"><div class="prod-bar"><i style="width:${(x.total / maxPessoa) * 100}%"></i></div></td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="5" class="empty">Nenhuma produção neste recorte.</td></tr>`
        }
      </tbody>
    </table>
  </section>`;
}

function telaOperadores() {
  return `<section class="card">
    <h2>Operadores</h2>
    <p class="muted form-dica">Configurações do sistema. Usuário é o primeiro.segundo nome; a senha é o CPF.</p>
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
    <table class="table table-cartoes">
      <thead><tr><th>Pessoa</th><th>Perfil</th><th>Acesso</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${operadores
          .map(
            (o) => `<tr>
              <td data-label="Pessoa"><strong>${escapar(o.nome)}</strong><div class="meta">${escapar(o.usuario)}${o.ativo ? "" : " · inativo"}</div></td>
              <td data-label="Perfil"><span class="papel-badge ${escapar(o.papel)}">${rotuloPapel(o.papel)}</span></td>
              <td class="meta" data-label="Acesso">${o.ultimo_acesso ? dataHora(o.ultimo_acesso) : "ainda não entrou"}</td>
              <td class="meta" data-label="Quando">${auditoria(o)}</td>
              <td class="cel-botoes">
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
    document.getElementById("form-chegada")?.addEventListener("click", onPrefTipoClick);
    document.getElementById("btn-chamar-recepcao")?.addEventListener("click", onChamarRecepcao);
    document.getElementById("btn-nao-respondeu-recepcao")?.addEventListener("click", onNaoRespondeuRecepcao);
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
    ligarDash();
    return;
  }
  if (aba === "relatorio") {
    app.innerHTML = telaRelatorio();
    ligarRelatorio();
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
    if (focarAtenderId) {
      document.querySelector(`.form-atender[data-id="${focarAtenderId}"] [data-campo=nome]`)?.focus();
      focarAtenderId = null;
    }
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

function limparRascunho() {
  rascunhoChegada = {
    chamado: false,
    horaIso: null,
    preferencialTipo: "",
    nome: "",
    tipoId: "",
    processo: "",
  };
}

function guardarRascunho() {
  rascunhoChegada.nome = document.getElementById("campo-nome")?.value || "";
  rascunhoChegada.processo = document.getElementById("campo-processo")?.value || "";
  rascunhoChegada.tipoId = tipoChegadaSelecionado() || rascunhoChegada.tipoId;
}

function aplicarEstadoChegada() {
  const travado = !rascunhoChegada.chamado;
  const form = document.getElementById("form-chegada");
  form?.classList.toggle("aguardando-chamada", travado);
  document.getElementById("campo-nome")?.toggleAttribute("disabled", travado);
  document.getElementById("campo-processo")?.toggleAttribute("disabled", travado);
  document.getElementById("btn-registrar")?.toggleAttribute("disabled", travado);
  document.getElementById("btn-nao-respondeu-recepcao")?.toggleAttribute("disabled", travado);
  document.querySelectorAll("#form-chegada input[name=tipo-chegada]").forEach((el) => {
    el.disabled = travado;
  });
  const horaEl = document.getElementById("campo-hora-rotulo");
  if (horaEl) horaEl.textContent = rascunhoChegada.horaIso ? hora(rascunhoChegada.horaIso) : "—";
}

function onChamarRecepcao() {
  if (!ehHoje()) return;
  guardarRascunho();
  rascunhoChegada.chamado = true;
  rascunhoChegada.horaIso = new Date().toISOString();
  aplicarEstadoChegada();
  document.getElementById("campo-nome")?.focus();
}

function onNaoRespondeuRecepcao() {
  if (!ehHoje() || !rascunhoChegada.chamado) return;
  limparRascunho();
  document.getElementById("form-chegada")?.reset();
  const hidden = document.getElementById("campo-tipo");
  if (hidden) hidden.value = "";
  document.querySelectorAll("#form-chegada input[name=tipo-chegada]").forEach((box) => {
    box.checked = false;
  });
  const rotulo = document.getElementById("campo-senha-rotulo");
  if (rotulo) rotulo.textContent = rotuloProxima(false);
  pintarPrefBotoes();
  aplicarEstadoChegada();
}

function atualizarChegada() {
  guardarRascunho();
  const hidden = document.getElementById("campo-tipo");
  const rotulo = document.getElementById("campo-senha-rotulo");
  if (hidden) hidden.value = rascunhoChegada.tipoId;
  if (rotulo) rotulo.textContent = rotuloProxima(rascunhoEhPref());
}

function onPrefTipoClick(ev) {
  const btn = ev.target.closest("[data-pref]");
  if (!btn) return;
  ev.preventDefault();
  const id = btn.getAttribute("data-pref");
  rascunhoChegada.preferencialTipo = rascunhoChegada.preferencialTipo === id ? "" : id;
  pintarPrefBotoes();
  atualizarChegada();
}

function onChegadaCampos(ev) {
  const el = ev.target;
  if (el.name === "tipo-chegada") {
    const escolhido = el.value;
    document.querySelectorAll("#form-chegada input[name=tipo-chegada]").forEach((box) => {
      box.checked = box.value === escolhido;
    });
    rascunhoChegada.tipoId = escolhido;
    atualizarChegada();
    return;
  }
  if (el.id === "campo-nome" || el.id === "campo-processo") {
    atualizarChegada();
  }
}

async function onChegada(ev) {
  ev.preventDefault();
  if (enviandoChegada || !ehHoje()) return;
  const erro = document.getElementById("form-erro");
  erro.classList.add("hidden");
  if (!rascunhoChegada.chamado || !rascunhoChegada.horaIso) {
    erro.textContent = "Clica em Chamar para anotar a hora da recepção.";
    erro.classList.remove("hidden");
    return;
  }
  guardarRascunho();
  const nome = rascunhoChegada.nome.trim();
  const tipoId = rascunhoChegada.tipoId;
  const preferencialTipo = rascunhoChegada.preferencialTipo || null;
  const preferencial = !!preferencialTipo;
  const processo = rascunhoChegada.processo.trim();
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
  const btn = document.getElementById("btn-registrar");
  if (btn) btn.disabled = true;
  const payload = {
    data: hojeISO(),
    nome,
    tipo_id: tipoId,
    preferencial,
    preferencial_tipo: preferencialTipo,
    processo,
    hora_recepcao: rascunhoChegada.horaIso,
    status: "na_fila",
    created_by: sessao.id,
    updated_by: sessao.id,
  };
  const { error } = await sb.from("senhas").insert(payload);
  enviandoChegada = false;
  if (error) {
    if (btn) btn.disabled = false;
    erro.textContent = error.code === "23505" ? "Esse número bateu com outra senha. Tenta de novo." : error.message;
    erro.classList.remove("hidden");
    return;
  }
  limparRascunho();
  await carregar();
}

async function onTipo(ev) {
  ev.preventDefault();
  const erro = document.getElementById("tipo-erro");
  erro.classList.add("hidden");
  const nome = document.getElementById("tipo-nome").value.trim();
  const sigla = document.getElementById("tipo-sigla").value.trim().toUpperCase();
  const cor = document.getElementById("tipo-cor").value;
  const id = document.getElementById("tipo-id")?.value || tipoEditandoId;
  let error;
  if (id) {
    ({ error } = await sb.from("tipos_atendimento").update({ nome, sigla, cor }).eq("id", id));
  } else {
    ({ error } = await sb.from("tipos_atendimento").insert({
      nome,
      sigla,
      cor,
      ordem: tipos.length + 1,
    }));
  }
  if (error) {
    erro.textContent = error.code === "23505" ? "Essa sigla já existe. Escolhe outra." : error.message;
    erro.classList.remove("hidden");
    return;
  }
  tipoEditandoId = null;
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

function avisoChamada(res, senha) {
  if (res?.ok) return true;
  if (res?.motivo === "ja_chamada") {
    const rotulo = senha ? rotuloSenha(senha) : "Essa senha";
    abrirAviso({
      titulo: "Já está em atendimento",
      texto: `${rotulo} já foi chamada por ${res.com || "outra pessoa"}.`,
    });
  } else if (res?.motivo === "ja_finalizada") {
    abrirAviso({ titulo: "Já finalizada", texto: "Essa senha já foi finalizada." });
  } else if (res?.motivo === "nao_em_atendimento") {
    abrirAviso({ titulo: "Ainda na fila", texto: "Chama a senha antes de finalizar." });
  } else if (res?.motivo === "nao_e_sua") {
    abrirAviso({
      titulo: "Já está em atendimento",
      texto: senha?.atendido_por
        ? `${rotuloSenha(senha)} já está com ${nomeOperador(senha.atendido_por)}.`
        : "Essa senha está com outra pessoa.",
    });
  } else if (res?.motivo === "fila_vazia") {
    abrirAviso({ titulo: "Fila vazia", texto: "Não tem ninguém esperando neste tipo." });
  } else if (res?.motivo === "nao_chamada") {
    abrirAviso({ titulo: "Ainda na fila", texto: "Chama a senha antes. Não respondeu só vale em atendimento." });
  } else if (res?.motivo === "tipo_invalido") {
    abrirAviso({ titulo: "Tipo inválido", texto: "Esse tipo de atendimento não está ativo." });
  } else if (res?.motivo === "outro_dia") {
    abrirAviso({ titulo: "Outro dia", texto: "Chamada só no dia de hoje. Volta a data no topo." });
  } else {
    abrirAviso({ titulo: "Não deu", texto: "Não deu para pegar essa senha. Atualiza a tela." });
  }
  return false;
}

function aplicarRespostaFila(data, senha) {
  if (!data?.ok) {
    avisoChamada(data, senha || data?.senha);
    return false;
  }
  if (data.senha) mesclarSenha(data.senha);
  if (data.pulada) mesclarSenha(data.pulada);
  if (data.proxima?.senha) mesclarSenha(data.proxima.senha);
  desenhar();
  agendarCarregar();
  return true;
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
  return aplicarRespostaFila(data, senhas.find((s) => s.id === id) || data?.senha);
}

async function rpcLiberar(id) {
  const { data, error } = await sb.rpc("liberar_senha", { p_id: id, p_operador: sessao.id });
  if (error) {
    mostrarErro(error.message);
    await carregar();
    return false;
  }
  return aplicarRespostaFila(data, senhas.find((s) => s.id === id));
}

function podeChamar() {
  return ehHoje() && String(aba).startsWith("tipo-");
}

async function onAcao(ev) {
  const btn = ev.target.closest("[data-acao]");
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if (acao === "ir-relatorio") {
    aba = "relatorio";
    desenhar();
    return;
  }
  if (acao === "baixar-relatorio") {
    baixarRelatorio();
    return;
  }
  if (acao === "imprimir-relatorio") {
    window.print();
    return;
  }

  if (acao === "chamar-senha") {
    if (!podeChamar()) return;
    btn.disabled = true;
    const { data, error } = await sb.rpc("chamar_senha", { p_id: id, p_operador: sessao.id });
    btn.disabled = false;
    if (error) {
      mostrarErro(error.message);
      await carregar();
      return;
    }
    focarAtenderId = id;
    aplicarRespostaFila(data, senhas.find((s) => s.id === id) || data?.senha);
    return;
  }

  if (acao === "finalizar-senha") {
    if (!podeChamar()) return;
    const form = btn.closest(".form-atender");
    const tipoId = form?.querySelector("input[name=tipo-atender]:checked")?.value || "";
    const obs = form?.querySelector("[data-campo=observacao]")?.value || "";
    if (form) {
      const nome = form.querySelector("[data-campo=nome]")?.value ?? "";
      const processo = form.querySelector("[data-campo=processo]")?.value ?? "";
      await sb.from("senhas").update({ nome, processo, ...carimbo() }).eq("id", id);
    }
    btn.disabled = true;
    const { data, error } = await sb.rpc("finalizar_senha", {
      p_id: id,
      p_operador: sessao.id,
      p_tipo_id: tipoId || null,
      p_observacao: String(obs).slice(0, 200),
    });
    btn.disabled = false;
    if (error) {
      mostrarErro(error.message);
      await carregar();
      return;
    }
    aplicarRespostaFila(data, senhas.find((s) => s.id === id) || data?.senha);
    return;
  }

  if (acao === "nao-respondeu") {
    if (!podeChamar()) return;
    btn.disabled = true;
    const { data, error } = await sb.rpc("nao_respondeu_senha", { p_id: id, p_operador: sessao.id });
    btn.disabled = false;
    if (error) {
      mostrarErro(error.message);
      await carregar();
      return;
    }
    aplicarRespostaFila(data, senhas.find((s) => s.id === id));
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
  if (acao === "editar-tipo") {
    if (!ehAdmin()) return;
    tipoEditandoId = id;
    aba = "tipos";
    desenhar();
    document.getElementById("tipo-nome")?.focus();
    return;
  }
  if (acao === "cancelar-tipo") {
    tipoEditandoId = null;
    desenhar();
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
        preencherQuem();
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
    else mostrarErro("Senha atualizada.");
  }
}

async function onCampo(ev) {
  const el = ev.target.closest("[data-campo]");
  if (!el || !el.dataset.id || el.disabled) return;
  const id = el.dataset.id;
  const campo = el.dataset.campo;
  if (campo === "tipo_id") {
    const form = el.closest(".form-atender");
    form?.querySelectorAll("input[name=tipo-atender]").forEach((box) => {
      box.checked = box.value === el.value;
    });
    pintarBotaoAtender(form);
    return;
  }
  if (campo === "observacao") {
    await patch(id, { observacao: String(el.value || "").slice(0, 200) }, false);
    return;
  }
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
  document.getElementById("dia").value = hojeISO();
  aplicarTopoSessao();
  await carregar();
  escutar();
}

function sair() {
  localStorage.removeItem(SESSAO_KEY);
  sessao = null;
  document.getElementById("quem").innerHTML = "";
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

function esconderTipHora() {
  const box = document.getElementById("tip-hora");
  if (!box) return;
  box.classList.add("hidden");
  box.innerHTML = "";
}

function mostrarTipHora(el) {
  const box = document.getElementById("tip-hora");
  const dica = el?.getAttribute("data-dica");
  if (!box || !dica) return;
  box.innerHTML = dica.split("\n").map((l) => `<div>${escapar(l)}</div>`).join("");
  box.classList.remove("hidden");
  const r = el.getBoundingClientRect();
  const h = box.offsetHeight;
  const w = box.offsetWidth;
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  let left = r.left;
  if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
  box.style.top = `${top}px`;
  box.style.left = `${left}px`;
}

function ligarDicasHora() {
  let atual = null;
  document.addEventListener("pointerover", (ev) => {
    const el = ev.target.closest?.(".hora-tip");
    if (!el || el === atual) return;
    atual = el;
    mostrarTipHora(el);
  });
  document.addEventListener("pointerout", (ev) => {
    const el = ev.target.closest?.(".hora-tip");
    if (!el) return;
    const to = ev.relatedTarget;
    if (to && el.contains(to)) return;
    if (atual === el) atual = null;
    esconderTipHora();
  });
  document.addEventListener("focusin", (ev) => {
    const el = ev.target.closest?.(".hora-tip");
    if (el) mostrarTipHora(el);
  });
  document.addEventListener("focusout", (ev) => {
    if (ev.target.closest?.(".hora-tip")) esconderTipHora();
  });
  window.addEventListener("scroll", esconderTipHora, true);
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
  app.addEventListener("input", (ev) => {
    const el = ev.target.closest?.("[data-campo=observacao]");
    if (!el) return;
    if (el.value.length > 200) el.value = el.value.slice(0, 200);
    const n = el.closest(".campo-obs")?.querySelector(".obs-n");
    if (n) n.textContent = String(el.value.length);
  });
  app.addEventListener("submit", (ev) => {
    if (ev.target.closest(".form-atender")) ev.preventDefault();
  });
  app.addEventListener("blur", (ev) => {
    if (ev.target.matches("input[data-campo=nome], input[data-campo=processo], [data-campo=observacao]")) onCampo(ev);
  }, true);
  document.getElementById("dia").addEventListener("change", () => {
    if (!ehAdmin()) document.getElementById("dia").value = hojeISO();
    carregar();
  });
  const cfgBtn = document.getElementById("btn-cfg");
  const cfgMenu = document.getElementById("cfg-menu");
  cfgBtn?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const aberto = !cfgMenu.classList.contains("hidden");
    cfgMenu.classList.toggle("hidden", aberto);
    cfgBtn.setAttribute("aria-expanded", String(!aberto));
  });
  cfgMenu?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const ajuda = ev.target.closest("[data-acao=ajuda]");
    if (ajuda) {
      cfgMenu.classList.add("hidden");
      cfgBtn?.setAttribute("aria-expanded", "false");
      abrirSobre();
      return;
    }
    const item = ev.target.closest("[data-cfg]");
    if (!item) return;
    aba = item.dataset.cfg;
    cfgMenu.classList.add("hidden");
    cfgBtn?.setAttribute("aria-expanded", "false");
    desenhar();
  });
  document.addEventListener("click", () => {
    cfgMenu?.classList.add("hidden");
    cfgBtn?.setAttribute("aria-expanded", "false");
  });
  document.getElementById("btn-sair").addEventListener("click", sair);
  document.getElementById("setup-salvar").addEventListener("click", salvarSetup);
  document.getElementById("form-login").addEventListener("submit", onLogin);
  document.getElementById("form-login").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    if (ev.target?.id !== "login-usuario" && ev.target?.id !== "login-senha") return;
    ev.preventDefault();
    document.getElementById("form-login").requestSubmit();
  });
  document.getElementById("btn-home")?.addEventListener("click", () => {
    if (!sessao) return;
    aba = "geral";
    desenhar();
  });
  document.getElementById("aviso-ok")?.addEventListener("click", fecharAviso);
  document.getElementById("aviso")?.addEventListener("click", (ev) => {
    if (ev.target.id === "aviso") fecharAviso();
  });
  document.getElementById("login-ajuda")?.addEventListener("click", abrirSobre);
  document.getElementById("sobre-ok")?.addEventListener("click", fecharSobre);
  document.getElementById("sobre")?.addEventListener("click", (ev) => {
    if (ev.target.id === "sobre") fecharSobre();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      fecharAviso();
      fecharSobre();
      esconderTipHora();
      cfgMenu?.classList.add("hidden");
      cfgBtn?.setAttribute("aria-expanded", "false");
    }
  });
  ligarDicasHora();
}

async function init() {
  document.getElementById("dia").value = hojeISO();
  ligarEventos();
  if (!(await conectar())) return;
  if (!pedirLogin()) return;
  aplicarTopoSessao();
  await carregar();
  escutar();
}

init();
