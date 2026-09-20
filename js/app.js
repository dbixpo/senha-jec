const STORAGE_KEY = "fila-supabase";
const SESSAO_KEY = "senha-jec-sessao";
const TZ = "America/Sao_Paulo";

let sb = null;
let sessao = null;
let tipos = [];
let operadores = [];
let senhas = [];
let chamadas = [];
let senhasLev = [];
let chamadasLev = [];
let periodo = { de: "", ate: "" };
let aba = "geral";
let abaAntesRelatorio = "geral";
const REL_VISTAS = [
  { id: "painel", nome: "Painel" },
  { id: "lista", nome: "Lista" },
];
let relVista = "painel";
let canal = null;
let verTudo = false;
let enviandoChegada = false;
let rascunhoChegada = {
  chamado: false,
  horaIso: null,
  numero: null,
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
let avisoPendencia = null;
const ORDEM_PROPORCAO = "proporcao";
const ORDEM_INTERCALAR = "intercalar";
const ORDEM_PREF_PRIMEIRO = "preferenciais_primeiro";
const DISPENSER_NENHUM = "nenhum";
const DISPENSER_UNICO = "unico";
const DISPENSER_SEPARADO = "separado";
const EX_FILA_ORDEM = [
  { id: "ex01", numero: 1, preferencial: false, nao_respondeu: 0 },
  { id: "ex02", numero: 2, preferencial: false, nao_respondeu: 0 },
  { id: "ex03", numero: 3, preferencial: false, nao_respondeu: 0 },
  { id: "ex04", numero: 4, preferencial: true, nao_respondeu: 0 },
  { id: "ex05", numero: 5, preferencial: false, nao_respondeu: 0 },
  { id: "ex06", numero: 6, preferencial: true, nao_respondeu: 0 },
  { id: "ex07", numero: 7, preferencial: true, nao_respondeu: 0 },
  { id: "ex08", numero: 8, preferencial: true, nao_respondeu: 0 },
  { id: "ex09", numero: 9, preferencial: false, nao_respondeu: 0 },
  { id: "ex10", numero: 10, preferencial: false, nao_respondeu: 0 },
  { id: "ex11", numero: 11, preferencial: false, nao_respondeu: 0 },
  { id: "ex12", numero: 12, preferencial: false, nao_respondeu: 0 },
  { id: "ex13", numero: 13, preferencial: true, nao_respondeu: 0 },
];
let configuracoes = {
  ordem_chamada: ORDEM_PROPORCAO,
  ordem_normais: "2",
  ordem_preferenciais: "1",
  ordem_comecar_pref: "nao",
  voz_script: "",
  dispenser_modo: DISPENSER_NENHUM,
  dispenser_proxima: "1",
  dispenser_proxima_comum: "1",
  dispenser_proxima_pref: "1",
};
let cfgRascunho = null;
let cfgFeedback = "";

const GUICHE_KEY = "senha-jec-guiche";
const VOZ_CAMPOS = [
  { id: "requisitante", nome: "Requisitante" },
  { id: "senha", nome: "Senha" },
  { id: "local", nome: "Local de atendimento" },
  { id: "guiche", nome: "Guichê" },
  { id: "atendente", nome: "Atendente" },
];
const VOZ_SCRIPT_PADRAO = [
  { id: "requisitante", on: true },
  { id: "senha", on: true },
  { id: "local", on: true },
  { id: "guiche", on: true },
  { id: "atendente", on: false },
];

const PREF_TIPOS = [
  { id: "cadeira", nome: "Deficiência" },
  { id: "idoso", nome: "60 anos ou mais" },
  { id: "gestante", nome: "Gestante" },
  { id: "bebe", nome: "Criança de colo" },
  { id: "obesidade", nome: "Obesidade" },
  { id: "autismo", nome: "Autismo" },
];

function ehCelular() {
  return window.matchMedia("(max-width: 800px)").matches;
}

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

function pintarDiaMostra() {
  const el = document.getElementById("dia-mostra");
  const input = document.getElementById("dia");
  if (!el || !input) return;
  el.textContent = dataLegivel(input.value || hojeISO());
}

function ehRelatorio() {
  return aba === "relatorio";
}

function ehTv() {
  return aba === "tv";
}

function hashTv() {
  const h = String(location.hash || "").replace(/^#\/?/, "");
  return h === "tv" || h.startsWith("tv/");
}

function hashVistaRelatorio() {
  const h = String(location.hash || "").replace(/^#\/?/, "");
  if (h !== "relatorio" && !h.startsWith("relatorio/")) return null;
  const vista = h.split("/")[1] || "";
  return REL_VISTAS.some((v) => v.id === vista) ? vista : "painel";
}

function aplicarHashRelatorio() {
  const vista = hashVistaRelatorio();
  if (vista == null) return false;
  aba = "relatorio";
  relVista = vistaRelatorioOk(vista);
  return true;
}

function vistaRelatorioOk(vista) {
  return REL_VISTAS.some((v) => v.id === vista) ? vista : "painel";
}

function irVistaRelatorio(vista) {
  relVista = vistaRelatorioOk(vista);
  sincronizarHash();
  desenhar();
}

function aplicarHashInicial() {
  if (hashTv()) {
    aba = "tv";
    return true;
  }
  return aplicarHashRelatorio();
}

function sincronizarHash() {
  const want = ehTv() ? "#tv" : ehRelatorio() ? `#relatorio/${vistaRelatorioOk(relVista)}` : "";
  const have = hashTv() ? "#tv" : hashVistaRelatorio() != null ? `#relatorio/${hashVistaRelatorio()}` : "";
  if (want === have) return;
  history.replaceState(null, "", `${location.pathname}${location.search}${want}`);
}

function aplicarModoTela() {
  document.body.classList.toggle("tela-relatorio", ehRelatorio());
  document.body.classList.toggle("tela-tv", ehTv());
  if (ehTv()) {
    document.title = "Painel de senha · Senha JEC";
    return;
  }
  if (!ehRelatorio()) {
    document.title = "Senha JEC";
    return;
  }
  const vista = REL_VISTAS.find((v) => v.id === vistaRelatorioOk(relVista));
  document.title = `Relatórios · ${vista?.nome || "Painel"} · Senha JEC`;
}

function somarDiasISO(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function periodoDe() {
  return periodo.de || diaAtual();
}

function periodoAte() {
  return periodo.ate || diaAtual();
}

function periodoEhUmDia() {
  return periodoDe() === periodoAte();
}

function rotuloPeriodo() {
  const de = periodoDe();
  const ate = periodoAte();
  if (de === ate) return dataLegivel(de);
  return `${dataLegivel(de)} a ${dataLegivel(ate)}`;
}

function garantirPeriodo() {
  if (!periodo.de) periodo.de = diaAtual();
  if (!periodo.ate) periodo.ate = diaAtual();
}

function irAba(nova) {
  const eraRel = ehRelatorio();
  const eraTv = ehTv();
  if (nova === "relatorio" && aba !== "relatorio") {
    abaAntesRelatorio = aba && aba !== "relatorio" && aba !== "tv" ? aba : "geral";
    const doHash = hashVistaRelatorio();
    if (doHash) relVista = doHash;
  }
  if (eraTv && nova !== "tv") tvParar();
  if (aba === "configuracoes" && nova !== "configuracoes") {
    cfgRascunho = null;
    cfgFeedback = "";
  }
  aba = nova;
  sincronizarHash();
  aplicarModoTela();
  if (ehRelatorio()) garantirPeriodo();
  if (ehTv()) {
    desenhar();
    tvEntrar();
    return;
  }
  if (eraRel !== ehRelatorio()) carregar();
  else desenhar();
}

function voltarDaRelatorio() {
  const dest = abaAntesRelatorio && abaAntesRelatorio !== "relatorio" ? abaAntesRelatorio : "geral";
  irAba(dest);
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
  pintarDiaMostra();
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
  document.getElementById("btn-cfg")?.classList.toggle("on", aba === "tipos" || aba === "operadores" || aba === "configuracoes" || aba === "relatorio" || aba === "tv");
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

function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function parseVozScript(raw) {
  let lista = [];
  if (Array.isArray(raw)) lista = raw;
  else {
    try { lista = JSON.parse(raw || "[]"); } catch { lista = []; }
  }
  const vistos = new Set();
  const saida = [];
  (lista || []).forEach((item) => {
    const id = item?.id;
    if (!VOZ_CAMPOS.some((c) => c.id === id) || vistos.has(id)) return;
    vistos.add(id);
    const on = item.on === true || item.on === "sim" || item.on === "true" || item.on === 1 || item.on === "1";
    saida.push({ id, on });
  });
  VOZ_SCRIPT_PADRAO.forEach((pad) => {
    if (!vistos.has(pad.id)) saida.push({ id: pad.id, on: pad.on });
  });
  return saida;
}

function vozScriptAtual(vista) {
  const noDom = lerVozListaDom();
  if (noDom) return noDom;
  if (vista?.voz_script != null) return parseVozScript(vista.voz_script);
  if (cfgRascunho?.voz_script != null) return parseVozScript(cfgRascunho.voz_script);
  return parseVozScript(configuracoes.voz_script);
}

function vozNumeroExtenso(n) {
  const x = Math.round(Number(n));
  const uns = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dez = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte"];
  if (!Number.isFinite(x) || x < 0) return "";
  if (x <= 9) return uns[x];
  if (x <= 20) return dez[x - 10];
  return String(x);
}

function vozSenhaExtenso(row) {
  const n = padSenha(row?.numero || 0);
  const falado = n.split("").map((d) => vozNumeroExtenso(d)).join(" ");
  return `senha ${row?.preferencial ? "P, " : ""}${falado}`;
}

function vozLocalTexto(row) {
  if (row?.local_nome) return row.local_nome;
  if (row?.origem === "geral" || !row?.tipo_id) return "Senha geral";
  return tipoDe(row.tipo_id)?.nome || "Atendimento";
}

function vozPeca(id, row) {
  if (id === "requisitante") return String(row?.requisitante || "").trim();
  if (id === "senha") return vozSenhaExtenso(row);
  if (id === "local") return vozLocalTexto(row);
  if (id === "guiche") {
    const g = Number(row?.guiche);
    if (!Number.isFinite(g) || g < 1) return "";
    return `guichê ${vozNumeroExtenso(g)}`;
  }
  if (id === "atendente") {
    const nome = String(row?.atendente || primeiroNome(operadorDe(row?.chamado_por)?.nome) || "").trim();
    if (!nome || nome === "—") return "";
    return primeiroNome(nome);
  }
  return "";
}

function textoVozChamada(row, script) {
  const ordem = script != null ? parseVozScript(script) : vozScriptAtual();
  return ordem.filter((x) => x.on).map((x) => vozPeca(x.id, row)).filter(Boolean).join(", ");
}

function textoVozExemplo(script) {
  return textoVozChamada({
    numero: 4,
    preferencial: false,
    origem: "tipo",
    requisitante: "Maria Silva",
    atendente: "Flávia",
    guiche: 2,
    local_nome: "Consulta",
  }, script);
}

function htmlVozLista(script, opts = {}) {
  const trava = !!opts.trava;
  return `<ul id="cfg-voz-lista" class="cfg-voz-lista${trava ? " travada" : ""}">
    ${parseVozScript(script).map((item) => {
      const campo = VOZ_CAMPOS.find((c) => c.id === item.id);
      return `<li ${trava ? "" : "draggable=\"true\""} data-id="${item.id}">
        <span class="cfg-voz-arrasta" title="Arrasta para mudar a ordem" aria-hidden="true">⋮⋮</span>
        <span class="cfg-voz-nome">${escapar(campo?.nome || item.id)}</span>
        <select data-voz-on aria-label="${escapar(campo?.nome || item.id)} na voz" ${trava ? "disabled" : ""}>
          <option value="sim" ${item.on ? "selected" : ""}>Fala</option>
          <option value="nao" ${item.on ? "" : "selected"}>Não fala</option>
        </select>
      </li>`;
    }).join("")}
  </ul>`;
}

function lerVozListaDom() {
  const itens = [...document.querySelectorAll("#cfg-voz-lista li[data-id]")];
  if (!itens.length) return null;
  return itens.map((li) => ({
    id: li.getAttribute("data-id"),
    on: li.querySelector("[data-voz-on]")?.value === "sim",
  }));
}

function guichesDoTipo(tipo) {
  const n = parseInt(tipo?.guiches, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(20, n) : 0;
}

function mapaGuiche() {
  try {
    return JSON.parse(localStorage.getItem(GUICHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function guicheSalvo(tipoId) {
  const n = parseInt(mapaGuiche()[tipoId], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function salvarGuicheTipo(tipoId, n) {
  const mapa = mapaGuiche();
  if (n) mapa[tipoId] = n;
  else delete mapa[tipoId];
  try { localStorage.setItem(GUICHE_KEY, JSON.stringify(mapa)); } catch { /* quota */ }
}

function guicheAtualDoTipo(tipo) {
  const max = guichesDoTipo(tipo);
  if (!max) return 0;
  const n = guicheSalvo(tipo.id);
  return n >= 1 && n <= max ? n : 0;
}

function tipoDaAba() {
  if (!String(aba).startsWith("tipo-")) return null;
  return tipos.find((t) => t.id === aba.slice(5)) || null;
}

function htmlGuicheTipo(tipo) {
  if (!tipo) return "";
  const max = guichesDoTipo(tipo);
  if (!max || !ehHoje()) return "";
  const atual = guicheAtualDoTipo(tipo);
  const opts = [`<option value="">Escolha o guichê</option>`].concat(
    Array.from({ length: max }, (_, i) => {
      const n = i + 1;
      return `<option value="${n}" ${atual === n ? "selected" : ""}>Guichê ${n}</option>`;
    })
  );
  return `<label class="guiche-sel">
    <span>Seu guichê</span>
    <select id="tipo-guiche" data-tipo="${escapar(tipo.id)}">${opts.join("")}</select>
  </label>`;
}

function chamarPrecisaGuiche(tipo) {
  return guichesDoTipo(tipo) > 0 && !guicheAtualDoTipo(tipo);
}

function garantirGuiche(tipo) {
  if (!chamarPrecisaGuiche(tipo)) return true;
  abrirAviso({
    titulo: "Escolha o guichê",
    texto: "Antes de chamar, escolhe o guichê deste atendimento.",
  });
  return false;
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

function resolverAviso(valor) {
  const fn = avisoPendencia;
  avisoPendencia = null;
  if (fn) fn(valor);
}

function resetAvisoBotoes() {
  const nao = document.getElementById("aviso-nao");
  const ok = document.getElementById("aviso-ok");
  const acoes = document.querySelector(".aviso-acoes");
  if (nao) nao.classList.add("hidden");
  if (ok) ok.textContent = "Entendi";
  acoes?.classList.remove("aviso-duas");
}

function abrirAviso({ titulo = "Atenção", texto, html, okTexto = "Entendi", cancelarTexto = null } = {}) {
  const box = document.getElementById("aviso");
  const tit = document.getElementById("aviso-titulo");
  const p = document.getElementById("aviso-texto");
  const nao = document.getElementById("aviso-nao");
  const ok = document.getElementById("aviso-ok");
  const acoes = document.querySelector(".aviso-acoes");
  if (!box || !tit || !p) return;
  if (avisoPendencia && !cancelarTexto) resolverAviso(false);
  tit.textContent = titulo;
  if (html) p.innerHTML = html;
  else p.textContent = texto || "";
  if (cancelarTexto) {
    nao?.classList.remove("hidden");
    if (nao) nao.textContent = cancelarTexto;
    acoes?.classList.add("aviso-duas");
  } else {
    nao?.classList.add("hidden");
    acoes?.classList.remove("aviso-duas");
  }
  if (ok) ok.textContent = okTexto;
  box.classList.remove("hidden");
  (cancelarTexto ? nao : ok)?.focus();
}

function fecharAviso(confirmou = false) {
  document.getElementById("aviso")?.classList.add("hidden");
  resetAvisoBotoes();
  resolverAviso(!!confirmou);
}

function perguntarConfirmacao({ titulo, texto, html, ok = "Confirmar", cancelar = "Cancelar" }) {
  return new Promise((resolve) => {
    resolverAviso(false);
    avisoPendencia = resolve;
    abrirAviso({ titulo, texto, html, okTexto: ok, cancelarTexto: cancelar });
  });
}

function urlPainelTv() {
  return `${location.pathname}${location.search}#tv`;
}

function fecharPerguntaTv() {
  document.getElementById("tv-abrir")?.classList.add("hidden");
}

function abrirPainelTvNestaAba() {
  fecharPerguntaTv();
  if (!sessao) {
    history.replaceState(null, "", urlPainelTv());
    document.getElementById("login-usuario")?.focus();
    return;
  }
  irAba("tv");
}

function abrirPainelTvNovaAba() {
  fecharPerguntaTv();
  const janela = window.open(urlPainelTv(), "_blank");
  if (janela) janela.opener = null;
  else mostrarErro("O navegador bloqueou a nova aba. Permita pop-ups para este site, ou abra nesta aba.");
}

function perguntarAbrirPainelTv() {
  document.getElementById("tv-abrir")?.classList.remove("hidden");
  document.getElementById("tv-abrir-mesma")?.focus();
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

function ehTipoFixo(tipo) {
  return tipo?.codigo === "geral";
}

function tipoGeral() {
  return tipos.find((t) => t.codigo === "geral") || null;
}

function tiposFila() {
  return tipos.filter((t) => t.ativo && t.codigo !== "geral");
}

function tiposNaLista() {
  return [...tipos].sort((a, b) => {
    if (a.codigo === "geral") return -1;
    if (b.codigo === "geral") return 1;
    return (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });
}

function auditoria(row) {
  return `reg. ${dataHora(row.created_at)}${row.updated_at && row.updated_at !== row.created_at ? " · atual. " + dataHora(row.updated_at) : ""}`;
}

function numeroCfg(chave, padrao = 1) {
  const n = parseInt(configuracoes[chave], 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

function quotaCfgValor(valor, padrao) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n < 0) return padrao;
  return Math.min(99, Math.floor(n));
}

function dispenserModo() {
  const modo = configuracoes.dispenser_modo;
  if (modo === DISPENSER_UNICO || modo === DISPENSER_SEPARADO) return modo;
  return DISPENSER_NENHUM;
}

function usaDispenser() {
  return dispenserModo() !== DISPENSER_NENHUM;
}

function proximoNumero() {
  if (rascunhoChegada.numero) return rascunhoChegada.numero;
  const modo = dispenserModo();
  if (modo === DISPENSER_SEPARADO) {
    return rascunhoEhPref() ? numeroCfg("dispenser_proxima_pref") : numeroCfg("dispenser_proxima_comum");
  }
  if (modo === DISPENSER_UNICO) return numeroCfg("dispenser_proxima");
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
  const travarPref = rascunhoChegada.chamado && dispenserModo() === DISPENSER_SEPARADO;
  return `<div class="pref-tipos" role="group" aria-label="Preferencial">
    ${PREF_TIPOS.map((p) => {
      const on = rascunhoChegada.preferencialTipo === p.id;
      return `<button type="button" class="btn-pref${p.id === "autismo" ? " colorido" : ""}${on ? " on" : ""}" data-pref="${p.id}" data-tip="${escapar(p.nome)}" title="${escapar(p.nome)}" aria-pressed="${on ? "true" : "false"}" aria-label="${escapar(p.nome)}" ${travarPref ? "disabled" : ""}>
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

function ordemChamada() {
  return ORDEM_PROPORCAO;
}

function quotaCfg(chave, padrao) {
  const n = parseInt(configuracoes[chave], 10);
  if (!Number.isFinite(n) || n < 0) return padrao;
  return Math.min(99, Math.floor(n));
}

function quotasOrdem(vista) {
  const src = vista || configuracoes;
  const n = parseInt(src.ordem_normais, 10);
  const p = parseInt(src.ordem_preferenciais, 10);
  const comecar = String(src.ordem_comecar_pref || "").toLowerCase();
  return {
    normais: Number.isFinite(n) && n >= 0 ? Math.min(99, Math.floor(n)) : 2,
    prefs: Number.isFinite(p) && p >= 0 ? Math.min(99, Math.floor(p)) : 1,
    comecarPref: comecar === "sim" || comecar === "true" || comecar === "1" || comecar === "on",
  };
}

function faseInicial(nQuota, pQuota, comecarPref) {
  if (pQuota <= 0) return "normais";
  if (nQuota <= 0 || comecarPref) return "pref";
  return "normais";
}

function avancarCiclo(estado, ehPref) {
  const nQuota = estado.normais;
  const pQuota = estado.prefs;
  let { nCount, pCount, phase } = estado;
  if (ehPref) {
    if (phase !== "pref") return estado;
    pCount += 1;
    if (pQuota <= 0 || pCount >= pQuota) {
      return { ...estado, nCount: 0, pCount: 0, phase: nQuota > 0 ? "normais" : "pref" };
    }
    return { ...estado, pCount, phase: "pref" };
  }
  nCount += 1;
  if (nQuota > 0 && nCount >= nQuota) {
    return { ...estado, nCount: 0, pCount: 0, phase: pQuota > 0 ? "pref" : "normais" };
  }
  return { ...estado, nCount, phase: nQuota > 0 ? "normais" : phase };
}

function deveAdiantarPref(estado, temPref) {
  return !!(temPref && estado.prefs > 0 && estado.phase === "pref");
}

function cicloDeEmitidos(universo, espera) {
  const { normais, prefs, comecarPref } = quotasOrdem();
  const idsEspera = new Set((espera || []).map((s) => s.id));
  let estado = {
    nCount: 0,
    pCount: 0,
    phase: faseInicial(normais, prefs, comecarPref),
    normais,
    prefs,
  };
  const emitidos = (universo || [])
    .filter((s) => s && !idsEspera.has(s.id) && (estaEmAtendimento(s) || estaFinalizada(s)))
    .sort((a, b) => {
      const ta = Date.parse(a.hora_atendimento || a.hora_inicio || a.created_at) || 0;
      const tb = Date.parse(b.hora_atendimento || b.hora_inicio || b.created_at) || 0;
      if (ta !== tb) return ta - tb;
      return (a.numero || 0) - (b.numero || 0);
    });
  for (const s of emitidos) estado = avancarCiclo(estado, !!s.preferencial);
  return estado;
}

function ordenarPorProporcao(espera, ciclo) {
  const nQuota = ciclo?.normais ?? 2;
  const pQuota = ciclo?.prefs ?? 1;
  let estado = {
    nCount: ciclo?.nCount || 0,
    pCount: ciclo?.pCount || 0,
    phase: ciclo?.phase || faseInicial(nQuota, pQuota, ciclo?.comecarPref),
    normais: nQuota,
    prefs: pQuota,
  };
  const remaining = [...espera].sort(porChegada);
  const out = [];
  while (remaining.length) {
    const head = remaining[0];
    const prefIdx = remaining.findIndex((s) => s.preferencial);
    if (head.preferencial) {
      out.push(remaining.shift());
      estado = avancarCiclo(estado, true);
      continue;
    }
    if (prefIdx >= 0 && deveAdiantarPref(estado, true)) {
      out.push(remaining.splice(prefIdx, 1)[0]);
      estado = avancarCiclo(estado, true);
      continue;
    }
    out.push(remaining.shift());
    estado = avancarCiclo(estado, false);
  }
  return out;
}

function rotuloExemploFila(s) {
  const n = String(s.numero).padStart(2, "0");
  return s.preferencial ? `P${n}` : n;
}

function textoExemploProporcao(nQuota, pQuota, comecarPref) {
  const ciclo = {
    nCount: 0,
    pCount: 0,
    phase: faseInicial(nQuota, pQuota, comecarPref),
    normais: nQuota,
    prefs: pQuota,
    comecarPref: !!comecarPref,
  };
  return ordenarPorProporcao(EX_FILA_ORDEM, ciclo).map(rotuloExemploFila).join(" → ");
}

function dicaOrdemChamada(quotas) {
  const n = quotas?.normais ?? 2;
  const p = quotas?.prefs ?? 1;
  const comecar = !!quotas?.comecarPref;
  if (p <= 0) {
    return "Com 0 preferenciais, a fila fica só na ordem de chegada. Preferencial não adianta.";
  }
  if (n <= 0) {
    return "Com 0 senhas normais, as preferenciais sobem primeiro. As comuns só entram quando não restar P na espera.";
  }
  const inicio = comecar
    ? "Começa pelas preferenciais."
    : "Começa pelas senhas normais.";
  return `A ordem de chegada continua valendo: o 03 não passa na frente do 01, nem o P08 na frente do P04. ${inicio} Chama ${p} ${p === 1 ? "preferencial" : "preferenciais"} para cada ${n} ${n === 1 ? "senha normal" : "senhas normais"}. Se a próxima da fila já for preferencial, ela não espera.`;
}

function instanteChegada(s) {
  return Date.parse(s.hora_recepcao || s.hora_chegada || s.created_at) || 0;
}

function porChegada(a, b) {
  const sa = Number(a.nao_respondeu) || 0;
  const sb = Number(b.nao_respondeu) || 0;
  if (sa !== sb) return sa - sb;
  const ta = instanteChegada(a);
  const tb = instanteChegada(b);
  if (ta !== tb) return ta - tb;
  return (a.numero || 0) - (b.numero || 0);
}

function ordenarEspera(espera, universo) {
  const tiposIds = [...new Set((espera || []).map((s) => s.tipo_id).filter(Boolean))];
  if (tiposIds.length > 1) return [...espera].sort(porChegada);
  return ordenarPorProporcao(espera, cicloDeEmitidos(universo || espera, espera));
}

function universoDaLista(lista) {
  const ids = [...new Set(lista.map((s) => s.tipo_id).filter(Boolean))];
  if (ids.length === 1) return senhas.filter((s) => s.tipo_id === ids[0]);
  return senhas;
}

function ordenarFila(lista) {
  const atendimento = lista.filter(estaEmAtendimento).sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const espera = lista.filter(estaNaFila);
  const fim = lista.filter(estaFinalizada).sort((a, b) => (a.numero || 0) - (b.numero || 0));
  return [...atendimento, ...ordenarEspera(espera, universoDaLista(lista)), ...fim];
}

function descreverSenhaFila(senha) {
  if (!senha) return "—";
  const nome = String(senha.nome || "").trim();
  return nome ? `${rotuloSenha(senha)} · ${nome}` : rotuloSenha(senha);
}

function proximaEsperaDoTipo(tipoId) {
  if (!tipoId) return null;
  const universo = senhas.filter((s) => s.tipo_id === tipoId);
  return ordenarEspera(universo.filter(estaNaFila), universo)[0] || null;
}

async function confirmarVoltarFila(senha) {
  if (!senha) return false;
  return perguntarConfirmacao({
    titulo: "Devolver à fila",
    html: `<p>A senha <strong>${escapar(descreverSenhaFila(senha))}</strong> sai do atendimento e volta para a espera, na ordem original.</p>
      <p>Isso não registra falta: é só desfazer a chamada.</p>`,
    ok: "Devolver à fila",
    cancelar: "Seguir atendendo",
  });
}

async function confirmarForaDeOrdem(senha) {
  if (!senha || !estaNaFila(senha)) return true;
  const proxima = proximaEsperaDoTipo(senha.tipo_id);
  if (!proxima || proxima.id === senha.id) return true;
  return perguntarConfirmacao({
    titulo: "Fora da ordem da fila",
    html: `<p>A próxima da fila é outra senha. Se confirmar, esta será atendida antes.</p>
      <span class="aviso-destaque">Próxima da fila: ${escapar(descreverSenhaFila(proxima))}</span>
      <span class="aviso-destaque">Você selecionou: ${escapar(descreverSenhaFila(senha))}</span>
      <p>Deseja chamar mesmo assim?</p>`,
    ok: "Chamar mesmo assim",
    cancelar: "Manter a ordem",
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

function ligarChamadas(lista, hist) {
  const porSenha = new Map();
  for (const c of hist) {
    const item = porSenha.get(c.senha_id) || [];
    item.push(c);
    porSenha.set(c.senha_id, item);
  }
  for (const s of lista) {
    s.chamadas = porSenha.get(s.id) || [];
  }
}

async function buscarPaginas(fazerQuery) {
  const tam = 1000;
  let de = 0;
  const tudo = [];
  for (;;) {
    const { data, error } = await fazerQuery().range(de, de + tam - 1);
    if (error) return { data: null, error };
    const lote = data || [];
    tudo.push(...lote);
    if (lote.length < tam) return { data: tudo, error: null };
    de += tam;
    if (de >= 20000) return { data: tudo, error: null };
  }
}

async function buscarPeriodo(de, ate) {
  const inicio = new Date(`${de}T00:00:00-03:00`).toISOString();
  const fim = new Date(`${somarDiasISO(ate, 1)}T00:00:00-03:00`).toISOString();
  const [sen, hist] = await Promise.all([
    buscarPaginas(() =>
      sb.from("senhas").select("*").gte("data", de).lte("data", ate).order("data").order("numero")
    ),
    buscarPaginas(() =>
      sb.from("historico_chamadas").select("*").gte("chamado_em", inicio).lt("chamado_em", fim).order("chamado_em")
    ),
  ]);
  if (sen.error) return sen;
  if (hist.error) return hist;
  const lista = sen.data || [];
  ligarChamadas(lista, hist.data || []);
  return { data: { senhas: lista, chamadas: hist.data || [] }, error: null };
}

async function carregar(opts = {}) {
  if (!sessao) return;
  const seq = ++carregarSeq;
  const soFila = !!opts.soFila && tipos.length;
  const data = diaAtual();
  const precisaLev = ehRelatorio();
  if (precisaLev) garantirPeriodo();
  const ops = [
    soFila
      ? Promise.resolve({ data: tipos, error: null })
      : sb.from("tipos_atendimento").select("*").order("ordem"),
    buscarPeriodo(data, data),
    soFila
      ? Promise.resolve({ data: operadores, error: null })
      : sb.from("operadores").select(ehAdmin()
        ? "id, usuario, nome, papel, ativo, ultimo_acesso, created_at, updated_at"
        : "id, nome").order("nome"),
    soFila
      ? Promise.resolve({
        data: Object.entries(configuracoes).map(([chave, valor]) => ({ chave, valor: String(valor ?? "") })),
        error: null,
      })
      : sb.from("configuracoes").select("chave, valor"),
  ];
  if (precisaLev && (periodoDe() !== data || periodoAte() !== data)) {
    ops.push(buscarPeriodo(periodoDe(), periodoAte()));
  }
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
  aplicarConfiguracoes(resultados[3]?.data);
  const dia = resultados[1].data || { senhas: [], chamadas: [] };
  senhas = dia.senhas || [];
  chamadas = dia.chamadas || [];
  if (precisaLev && resultados[4]?.data) {
    senhasLev = resultados[4].data.senhas || [];
    chamadasLev = resultados[4].data.chamadas || [];
  } else if (precisaLev) {
    senhasLev = senhas;
    chamadasLev = chamadas;
  }
  if (!estaEditando() && !ehTv()) desenhar();
}

function aplicarConfiguracoes(rows) {
  const mapa = {};
  (rows || []).forEach((r) => {
    if (r?.chave) mapa[r.chave] = r.valor;
  });
  const ordem = mapa.ordem_chamada;
  configuracoes.ordem_chamada = ORDEM_PROPORCAO;
  if (ordem === ORDEM_PREF_PRIMEIRO) {
    configuracoes.ordem_normais = "0";
    configuracoes.ordem_preferenciais = String(Math.max(1, quotaCfgValor(mapa.ordem_preferenciais, 1)));
  } else if (ordem === ORDEM_INTERCALAR) {
    configuracoes.ordem_normais = String(quotaCfgValor(mapa.ordem_normais, 2));
    configuracoes.ordem_preferenciais = "0";
  } else {
    configuracoes.ordem_normais = String(quotaCfgValor(mapa.ordem_normais, 2));
    configuracoes.ordem_preferenciais = String(quotaCfgValor(mapa.ordem_preferenciais, 1));
  }
  const comecar = String(mapa.ordem_comecar_pref || "").toLowerCase();
  configuracoes.ordem_comecar_pref = comecar === "sim" || comecar === "true" || comecar === "1" || comecar === "on" ? "sim" : "nao";
  const modo = mapa.dispenser_modo;
  configuracoes.dispenser_modo = modo === DISPENSER_UNICO || modo === DISPENSER_SEPARADO ? modo : DISPENSER_NENHUM;
  configuracoes.dispenser_proxima = String(mapa.dispenser_proxima || configuracoes.dispenser_proxima || "1");
  configuracoes.dispenser_proxima_comum = String(mapa.dispenser_proxima_comum || configuracoes.dispenser_proxima_comum || "1");
  configuracoes.dispenser_proxima_pref = String(mapa.dispenser_proxima_pref || configuracoes.dispenser_proxima_pref || "1");
  configuracoes.voz_script = mapa.voz_script || configuracoes.voz_script || JSON.stringify(VOZ_SCRIPT_PADRAO);
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
    .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes" }, () => carregar())
    .subscribe();
}

function contarTipo(tipoId) {
  return senhas.filter((s) => s.tipo_id === tipoId && estaNaFila(s)).length;
}

function desenharAbas() {
  aplicarModoTela();
  sincronizarHash();
  const nav = document.getElementById("tabs");
  if (ehRelatorio() || ehTv()) {
    nav.innerHTML = "";
    aplicarTopoSessao();
    return;
  }
  const abas = [];
  if (ehAdmin()) {
    abas.push({ id: "controle", label: "Dashboard", curto: "Painel", count: senhas.length });
  }
  abas.push({ id: "geral", label: "Senha geral", curto: "Geral", count: naFila() });
  abas.push(
    ...tiposFila().map((t) => ({
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
  const ativos = tiposFila();
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
  const quando = hora(senha.hora_atendimento);
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
    const travaGuiche = chamarPrecisaGuiche(tipoDaAba());
    return `<button type="button" class="btn ok small" data-acao="finalizar-senha" data-id="${senha.id}">${encaminha ? "Encaminhar" : "Finalizar"}</button>
      <button type="button" class="btn stamp small" data-acao="nao-respondeu" data-id="${senha.id}"><span class="lab-wide">Não respondeu</span><span class="lab-narrow">Não veio</span></button>
      <button type="button" class="btn ghost small btn-rechamada" data-acao="chamar-senha" data-id="${senha.id}" ${travaGuiche ? "disabled title=\"Escolha o guichê\"" : ""}>Chamar de novo</button>
      <button type="button" class="btn ghost small" data-acao="liberar-senha" data-id="${senha.id}">Cancelar</button>`;
  }
  const travaGuiche = chamarPrecisaGuiche(tipoDaAba());
  return `<button type="button" class="btn primary small" data-acao="chamar-senha" data-id="${senha.id}" ${travaGuiche ? "disabled title=\"Escolha o guichê\"" : ""}>Chamar</button>`;
}

function checksTipoAtender(senha) {
  return tiposFila()
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
    ${tiposFila().map((t) => `<li><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> ${escapar(t.nome)}</li>`).join("")}
    <li><span class="chip aguardando">espera</span></li>
    <li><span class="chip em-atendimento">em atendimento</span></li>
    <li><span class="chip atendida">finalizado</span></li>
    <li><span class="chip pref">P = preferencial · ${quotasOrdem().prefs} para ${quotasOrdem().normais}</span></li>
    <li><span class="chip ausente">não respondeu</span></li>
  </ul>`;
}

function telaGeral() {
  const travado = !rascunhoChegada.chamado;
  const geral = tipoGeral();
  const travaGuiche = ehHoje() && geral && chamarPrecisaGuiche(geral);
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
          <button type="button" class="btn primary" id="btn-chamar-recepcao" ${travaGuiche ? "disabled title=\"Escolha o guichê\"" : ""}><span class="n-passo">1</span>Chamar</button>
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
      <div class="card-topo card-topo-tipo">
        <div class="card-topo-linha">
          <h2>Senha geral</h2>
          <div class="topo-acoes">
            <div class="topo-chamar">
              ${htmlGuicheTipo(geral)}
            </div>
            ${barraFiltro()}
          </div>
        </div>
        <p class="muted form-dica dica-web">${ehHoje()
            ? (dispenserModo() === DISPENSER_SEPARADO
              ? "Com dois rolos, marca preferencial antes de Chamar. Cada Chamar gasta o papel, mesmo se a pessoa não vier."
              : usaDispenser()
                ? "O número é o da boca do dispenser. Cada Chamar gasta aquele papel, mesmo se a pessoa não vier."
                : "Chamar anota a hora. Se a pessoa não aparecer, Não respondeu. Se aparecer, preenche e registra.")
            : "Fila de outro dia. Só consulta."}</p>
        <p class="muted form-dica dica-mobile">${ehHoje() ? "1 chama · 2 preenche · 3 registra. Rosa espera · amarelo em atendimento." : "Só consulta."}</p>
        ${legendaTipos()}
      </div>
      ${form}
      <div id="fila-lista">${tabelaFila(senhas, { chamar: false })}</div>
    </section>`;
}

function telaTipo(tipo) {
  const lista = senhas.filter((s) => s.tipo_id === tipo.id);
  const proxima = ehHoje() ? proximaEsperaDoTipo(tipo.id) : null;
  const rotuloProx = proxima ? escapar(rotuloSenha(proxima)) : "";
  const travaGuiche = ehHoje() && chamarPrecisaGuiche(tipo);
  return `<section class="card card-fila">
    <div class="card-topo card-topo-tipo">
      <div class="card-topo-linha">
        <h2>${escapar(tipo.nome)}</h2>
        <div class="topo-acoes">
          <div class="topo-chamar">
            ${htmlGuicheTipo(tipo)}
            ${ehHoje() ? `<button type="button" class="btn primary" data-acao="chamar-proxima" data-tipo="${escapar(tipo.id)}" ${proxima && !travaGuiche ? "" : "disabled"}${travaGuiche ? " title=\"Escolha o guichê\"" : ""}><span class="lab-wide">Chamar próximo${rotuloProx ? ` · ${rotuloProx}` : ""}</span><span class="lab-narrow">Próximo${rotuloProx ? ` ${rotuloProx}` : ""}</span></button>` : ""}
          </div>
          ${barraFiltro()}
          <span class="sigla grande" style="background:${escapar(tipo.cor)}">${escapar(tipo.sigla)}</span>
        </div>
      </div>
      <p class="muted form-dica dica-web">${ehHoje() ? "<strong>Chamar próximo</strong> pega o primeiro da fila. Chamar na linha coloca em atendimento — se não for o próximo, pede confirmação. Trocar o tipo e <strong>Encaminhar</strong> manda pra outra fila. <strong>Finalizar</strong> encerra neste tipo." : `Consultando ${dataLegivel(diaAtual())}. Chamada só no dia de hoje.`}</p>
      <p class="muted form-dica dica-mobile">${ehHoje() ? "Próximo no topo, ou Chamar na linha. Troca o tipo e encaminha, ou finaliza." : "Só consulta."}</p>
      <p id="fila-dica" class="muted form-dica dica-web">${verTudo ? "Inclui quem já foi finalizado." : "Só quem ainda está na fila ou em atendimento."}</p>
    </div>
    <div id="fila-lista">${tabelaFila(lista, { chamar: ehHoje() })}</div>
  </section>`;
}

function rotuloGuiches(n) {
  const q = Number(n) || 0;
  return q > 0 ? String(q) : "Não tem";
}

function telaTipos() {
  const editando = tipos.find((t) => t.id === tipoEditandoId) || null;
  const fixo = ehTipoFixo(editando);
  const semGuiche = editando ? !guichesDoTipo(editando) : false;
  const dica = editando
    ? (fixo
      ? `A <strong>Senha geral</strong> não muda de nome, sigla nem cor, e não dá para desativar. Só informa se a recepção tem guichês e quantos.`
      : `Editando <strong>${escapar(editando.nome)}</strong>. Pode mudar nome, sigla, cor e os guichês.`)
    : "A Senha geral já vem pronta e não sai da lista. Os outros tipos (Triagem, Consulta, Ajuizamento) você edita, inclui ou desativa.";
  return `<section class="card">
    <h2>Tipos de atendimento</h2>
    <p class="muted form-dica">${dica}</p>
    <form id="form-tipo" class="form-grid cadastro">
      <input type="hidden" id="tipo-id" value="${editando ? escapar(editando.id) : ""}">
      <label>Nome
        <input id="tipo-nome" required placeholder="Ex.: Triagem" value="${editando ? escapar(editando.nome) : ""}" ${fixo ? "readonly" : ""}>
      </label>
      <label>Sigla
        <input id="tipo-sigla" required maxlength="3" placeholder="T" value="${editando ? escapar(editando.sigla) : ""}" ${fixo ? "readonly" : ""}>
      </label>
      <label>Cor
        <input id="tipo-cor" type="color" value="${editando ? escapar(editando.cor) : "#6B3FA0"}" ${fixo ? "disabled" : ""}>
      </label>
      <label class="chip-check tipo-sem-guiche">
        <input type="checkbox" id="tipo-sem-guiches" ${semGuiche ? "checked" : ""}>
        <span class="chip-check-ui">Este local não tem guichês</span>
      </label>
      <label id="tipo-guiches-wrap" class="${semGuiche ? "hidden" : ""}">Quantos guichês
        <input id="tipo-guiches" type="number" min="1" max="20" step="1" inputmode="numeric" value="${editando ? (guichesDoTipo(editando) || 1) : 1}">
      </label>
      <button class="btn primary" type="submit">${editando ? "Salvar" : "Incluir tipo"}</button>
      ${editando ? `<button type="button" class="btn ghost" data-acao="cancelar-tipo">Cancelar</button>` : ""}
    </form>
    <p id="tipo-erro" class="erro hidden"></p>
    <table class="table table-cartoes">
      <thead><tr><th>Tipo</th><th>Guichês</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${
          tiposNaLista().length
            ? tiposNaLista()
                .map(
                  (t) => `<tr class="${t.id === tipoEditandoId ? "editando" : ""}">
                    <td data-label="Tipo"><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> <strong>${escapar(t.nome)}</strong>${ehTipoFixo(t) ? ` <span class="tipo-fixo-tag">fixo</span>` : ""}${t.ativo ? "" : " · inativo"}</td>
                    <td data-label="Guichês">${rotuloGuiches(t.guiches)}</td>
                    <td class="meta" data-label="Quando">${auditoria(t)}</td>
                    <td class="cel-botoes">
                      <button type="button" class="btn ghost small" data-acao="editar-tipo" data-id="${t.id}">${ehTipoFixo(t) ? "Guichês" : "Editar"}</button>
                      ${ehTipoFixo(t) ? "" : `<button type="button" class="btn ghost small" data-acao="toggle-tipo" data-id="${t.id}" data-ativo="${t.ativo ? "1" : "0"}">${t.ativo ? "Desativar" : "Ativar"}</button>`}
                    </td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="4" class="empty">Nenhum tipo ainda.</td></tr>`
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
  return senhasLev.filter((s) => {
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
  }).sort((a, b) => {
    if (a.data !== b.data) return String(a.data).localeCompare(String(b.data));
    return (a.numero || 0) - (b.numero || 0);
  });
}

function periodoAtalhoAtivo() {
  const de = periodoDe();
  const ate = periodoAte();
  const hoje = hojeISO();
  if (de === hoje && ate === hoje) return "hoje";
  if (de === somarDiasISO(hoje, -6) && ate === hoje) return "7";
  if (de === somarDiasISO(hoje, -29) && ate === hoje) return "30";
  if (de === `${hoje.slice(0, 8)}01` && ate === hoje) return "mes";
  return "";
}

function htmlPeriodo() {
  const de = periodoDe();
  const ate = periodoAte();
  const ativo = periodoAtalhoAtivo();
  return `<div class="periodo-wrap">
    <label>De
      <input id="periodo-de" type="date" value="${escapar(de)}">
    </label>
    <label>Até
      <input id="periodo-ate" type="date" value="${escapar(ate)}">
    </label>
    <div class="periodo-atalhos" role="group" aria-label="Atalhos de período">
      <button type="button" class="btn ghost small${ativo === "hoje" ? " on" : ""}" data-periodo="hoje">Hoje</button>
      <button type="button" class="btn ghost small${ativo === "7" ? " on" : ""}" data-periodo="7">7 dias</button>
      <button type="button" class="btn ghost small${ativo === "30" ? " on" : ""}" data-periodo="30">30 dias</button>
      <button type="button" class="btn ghost small${ativo === "mes" ? " on" : ""}" data-periodo="mes">Este mês</button>
    </div>
  </div>`;
}

function htmlVistasRelatorio() {
  return `<div class="rel-vistas" role="tablist" aria-label="Tipo de relatório">
    ${REL_VISTAS.map((v) => `<button type="button" role="tab" class="btn ghost${relVista === v.id ? " on" : ""}" data-acao="rel-vista" data-vista="${v.id}" aria-selected="${relVista === v.id ? "true" : "false"}">${escapar(v.nome)}</button>`).join("")}
  </div>`;
}

function aplicarPeriodo(de, ate) {
  de = de || periodoDe();
  ate = ate || periodoAte();
  if (de > ate) {
    const t = de;
    de = ate;
    ate = t;
  }
  let n = 0;
  for (let d = de; d <= ate; d = somarDiasISO(d, 1)) {
    n += 1;
    if (n > 366) {
      mostrarErro("O período pode ter no máximo 12 meses.");
      return;
    }
  }
  periodo.de = de;
  periodo.ate = ate;
  carregar();
}

function ligarPeriodo() {
  document.getElementById("periodo-de")?.addEventListener("change", (ev) => {
    aplicarPeriodo(ev.target.value, periodoAte());
  });
  document.getElementById("periodo-ate")?.addEventListener("change", (ev) => {
    aplicarPeriodo(periodoDe(), ev.target.value);
  });
  document.querySelectorAll("[data-periodo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hoje = hojeISO();
      const qual = btn.getAttribute("data-periodo");
      if (qual === "hoje") aplicarPeriodo(hoje, hoje);
      else if (qual === "7") aplicarPeriodo(somarDiasISO(hoje, -6), hoje);
      else if (qual === "30") aplicarPeriodo(somarDiasISO(hoje, -29), hoje);
      else if (qual === "mes") aplicarPeriodo(`${hoje.slice(0, 8)}01`, hoje);
    });
  });
}

function htmlPorDia(lista) {
  if (periodoEhUmDia()) return "";
  const dias = [...new Set(lista.map((s) => s.data).filter(Boolean))].sort();
  if (!dias.length) return "";
  const max = Math.max(1, ...dias.map((d) => lista.filter((s) => s.data === d).length));
  return `<section class="card">
    <h2>Por dia</h2>
    <div class="por-dia">
      ${dias.map((d) => {
        const doDia = lista.filter((s) => s.data === d);
        const feitas = doDia.filter(estaFinalizada).length;
        const prefs = doDia.filter((s) => s.preferencial).length;
        return `<div class="por-dia-row">
          <div class="bar-h-lab"><span>${escapar(dataLegivel(d))}</span><span>${doDia.length} senhas · ${feitas} final. · ${prefs} pref.</span></div>
          <div class="bar-h" title="${doDia.length} senhas">
            <i style="width:${(doDia.length / max) * 100}%;background:#1a82b8"></i>
          </div>
        </div>`;
      }).join("")}
    </div>
  </section>`;
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
  const umDia = periodoEhUmDia();
  if (!lista.length) {
    return `<p class="empty">Nada neste recorte. Troca o período ou os filtros.</p>`;
  }
  return `<div class="rel-wrap">
    <table class="rel-tabela table-cartoes">
      <thead>
        <tr>
          ${umDia ? "" : "<th>Data</th>"}
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
            ${umDia ? "" : `<td data-label="Data">${escapar(dataLegivel(s.data))}</td>`}
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
  const cols = ["Data", "Senha", "Nome", "Tipo", "Preferencial", "Situação", "Recepção", "Quem registrou", "Atendimento", "Quem atendeu", "Finalizou", "Espera", "Chamadas", "Não respondeu", "Processo", "Observação"];
  const linhas = lista.map((s) => {
    const t = tipoDe(s.tipo_id);
    const pref = prefTipo(s.preferencial_tipo);
    return [
      s.data || "",
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
  const de = periodoDe();
  const ate = periodoAte();
  a.download = de === ate ? `senha-jec-${de}.csv` : `senha-jec-${de}_${ate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function htmlFiltrosRecorte(prefix, filtro, lista, extras = "") {
  const optsTipo = tiposFila().map((t) => `<option value="${t.id}" ${filtro.tipo === t.id ? "selected" : ""}>${escapar(t.nome)}</option>`).join("");
  const optsPessoa = operadores
    .filter((o) => o.ativo || lista.some((s) => s.created_by === o.id || s.atendido_por === o.id))
    .map((o) => `<option value="${o.id}" ${filtro.pessoa === o.id ? "selected" : ""}>${escapar(o.nome)}</option>`)
    .join("");
  return `<div class="dash-filtros${prefix === "rel" ? " rel-filtros" : ""}">
    ${extras}
    <label>Tipo
      <select id="${prefix}-tipo">
        <option value="">Todos</option>
        ${optsTipo}
      </select>
    </label>
    <label>Situação
      <select id="${prefix}-status">
        <option value="todos" ${filtro.status === "todos" ? "selected" : ""}>Todas</option>
        <option value="fila" ${filtro.status === "fila" ? "selected" : ""}>Na fila</option>
        <option value="atendimento" ${filtro.status === "atendimento" ? "selected" : ""}>Em atendimento</option>
        <option value="atendidas" ${filtro.status === "atendidas" ? "selected" : ""}>Finalizadas</option>
      </select>
    </label>
    <label>Preferencial
      <select id="${prefix}-pref">
        <option value="todos" ${filtro.pref === "todos" ? "selected" : ""}>Todas</option>
        <option value="nao" ${filtro.pref === "nao" ? "selected" : ""}>Sem preferencial</option>
        ${PREF_TIPOS.map((p) => `<option value="${p.id}" ${filtro.pref === p.id ? "selected" : ""}>${escapar(p.nome)}</option>`).join("")}
      </select>
    </label>
    <label>Pessoa
      <select id="${prefix}-pessoa">
        <option value="">Todo mundo</option>
        ${optsPessoa}
      </select>
    </label>
  </div>`;
}

function ligarFiltrosPainel(filtro, prefix, aoMudar) {
  ["tipo", "status", "pref", "pessoa"].forEach((key) => {
    document.getElementById(`${prefix}-${key}`)?.addEventListener("change", (ev) => {
      filtro[key] = ev.target.value;
      aoMudar();
    });
  });
  document.querySelectorAll(".pref-motivo[data-pref]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-pref");
      filtro.pref = filtro.pref === id ? "todos" : id;
      aoMudar();
    });
  });
}

function ligarRelatorio() {
  ligarPeriodo();
  if (relVista === "lista") {
    ligarFiltrosPainel(relFiltro, "rel", atualizarRelatorio);
    document.getElementById("rel-senha")?.addEventListener("input", (ev) => {
      relFiltro.senha = ev.target.value;
      atualizarRelatorio();
    });
    document.getElementById("rel-nome")?.addEventListener("input", (ev) => {
      relFiltro.nome = ev.target.value;
      atualizarRelatorio();
    });
    return;
  }
  ligarFiltrosPainel(relFiltro, "rel", desenhar);
}

function atualizarRelatorio() {
  const lista = senhasRelatorio();
  const box = document.getElementById("rel-lista");
  const qtd = document.getElementById("rel-qtd");
  if (box) box.innerHTML = htmlRelatorioTabela(lista);
  if (qtd) qtd.textContent = `${lista.length} de ${senhasLev.length} senhas no período`;
  const qtdPrint = document.getElementById("rel-qtd-print");
  if (qtdPrint) qtdPrint.textContent = lista.length;
}

function htmlCabecaRelatorio(lista) {
  const naLista = relVista === "lista";
  return `<section class="card rel-cabeca">
    <div class="card-topo">
      <div>
        <h2>Relatórios</h2>
        <p class="muted form-dica">Levantamento de ${escapar(rotuloPeriodo())}. Escolhe o tipo de relatório e o período. Isso não mexe na fila do dia.</p>
      </div>
      <div class="topo-acoes rel-acoes">
        <button type="button" class="btn ghost" data-acao="voltar-fila">Voltar à fila</button>
        ${naLista ? `<button type="button" class="btn ghost" data-acao="baixar-relatorio">Baixar CSV</button>
        <button type="button" class="btn primary" data-acao="imprimir-relatorio">Imprimir / PDF</button>` : `<button type="button" class="btn primary" data-acao="imprimir-relatorio">Imprimir / PDF</button>`}
      </div>
    </div>
    <p class="so-print">Senha JEC — ${escapar(rotuloPeriodo())}${naLista ? ` — <span id="rel-qtd-print">${lista.length}</span> senhas` : ""}</p>
    ${htmlPeriodo()}
    ${htmlVistasRelatorio()}
  </section>`;
}

function htmlRelLista() {
  const lista = senhasRelatorio();
  const extras = `<label>Senha
      <input id="rel-senha" type="text" inputmode="search" placeholder="01 ou P01" value="${escapar(relFiltro.senha)}" autocomplete="off">
    </label>
    <label>Nome
      <input id="rel-nome" type="text" placeholder="Nome" value="${escapar(relFiltro.nome)}" autocomplete="off">
    </label>`;
  return `<section class="card rel-card">
    ${htmlFiltrosRecorte("rel", relFiltro, senhasLev, extras)}
    <p id="rel-qtd" class="muted form-dica">${lista.length} de ${senhasLev.length} senhas no período</p>
    <div id="rel-lista">${htmlRelatorioTabela(lista)}</div>
  </section>`;
}

function telaRelatorio() {
  const lista = senhasRelatorio();
  const corpo = relVista === "lista"
    ? htmlRelLista()
    : htmlPainel(lista, chamadasLev, relFiltro, {
      prefix: "rel",
      base: senhasLev.length,
      rotuloBase: periodoEhUmDia() ? "no dia" : "no período",
      tituloHora: periodoEhUmDia() ? "Ao longo do dia" : "Por horário (dias somados)",
      vazioHora: "Quando houver senha no período, o movimento aparece aqui.",
      porDia: !periodoEhUmDia(),
    });
  return `<div class="rel-hub">${htmlCabecaRelatorio(lista)}${corpo}</div>`;
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
  ligarFiltrosPainel(dashFiltro, "dash", desenhar);
}

function htmlPainel(lista, chamadasFonte, filtro, opts = {}) {
  const prefix = opts.prefix || "dash";
  const base = opts.base ?? lista.length;
  const rotuloBase = opts.rotuloBase || "no dia";
  const tituloHora = opts.tituloHora || "Ao longo do dia";
  const vazioHora = opts.vazioHora || "Quando as senhas começarem a entrar, o movimento do dia aparece aqui.";
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

  const porTipo = tiposFila().map((t) => {
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
  const chamadasDash = (chamadasFonte || []).filter((c) => idsLista.has(c.senha_id));
  const porPessoa = operadores
    .map((o) => {
      const registrou = lista.filter((s) => s.created_by === o.id).length;
      const chamou = chamadasDash.filter((c) => c.chamado_por === o.id).length;
      return { o, registrou, chamou, total: registrou + chamou };
    })
    .filter((x) => x.total || x.o.ativo)
    .sort((a, b) => b.total - a.total);
  const maxPessoa = Math.max(1, ...porPessoa.map((x) => x.total));

  return `<section class="card">
    ${opts.topoHtml || ""}
    ${htmlFiltrosRecorte(prefix, filtro, lista)}
    <div class="kpis">
      <div class="kpi"><span>Senhas</span><strong>${total}</strong><small>${base === total ? rotuloBase : `de ${base} ${rotuloBase}`}</small></div>
      <div class="kpi fila"><span>Na fila</span><strong>${espera}</strong><small>${emAtend ? emAtend + " em atendimento" : maisAntiga == null ? "ninguém esperando" : "mais antiga " + fmtMin(maisAntiga)}</small></div>
      <div class="kpi ok"><span>Finalizadas</span><strong>${feitas}</strong><small>${total ? Math.round((feitas / total) * 100) + "% do recorte" : "—"}</small></div>
      <div class="kpi pref"><span>Preferencial</span><strong>${prefs}</strong><small>${total ? Math.round((prefs / total) * 100) + "% do recorte" : "—"}</small></div>
    </div>
    <div class="pref-motivos" aria-label="Preferencial por motivo">
      ${porPref
        .map(
          (x) => `<button type="button" class="pref-motivo${filtro.pref === x.p.id ? " on" : ""}${x.p.id === "autismo" ? " colorido" : ""}" data-pref="${x.p.id}">
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
  ${opts.porDia ? htmlPorDia(lista) : ""}
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
      <h2>${escapar(tituloHora)}</h2>
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
          : `<p class="dash-vazio">${escapar(vazioHora)}</p>`
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

function telaControle() {
  const lista = senhasDash();
  return htmlPainel(lista, chamadas, dashFiltro, {
    prefix: "dash",
    topoHtml: `<div class="card-topo">
      <div>
        <h2>Dashboard</h2>
        <p class="muted form-dica">${ehHoje() ? "Produção de hoje, ao vivo." : `Produção de ${dataLegivel(diaAtual())}.`} A data no topo troca o dia. Os filtros abaixo recortam o que está na tela.</p>
      </div>
      <div class="topo-acoes">
        <button type="button" class="btn ghost" data-acao="ir-relatorio">Relatórios</button>
      </div>
    </div>`,
    base: senhas.length,
    rotuloBase: "no dia",
    tituloHora: "Ao longo do dia",
    vazioHora: "Quando as senhas começarem a entrar, o movimento do dia aparece aqui.",
  });
}

function cfgVista() {
  if (cfgRascunho) return cfgRascunho;
  return {
    ordem_chamada: ordemChamada(),
    ordem_normais: String(quotaCfg("ordem_normais", 2)),
    ordem_preferenciais: String(quotaCfg("ordem_preferenciais", 1)),
    ordem_comecar_pref: quotasOrdem().comecarPref ? "sim" : "nao",
    voz_script: JSON.stringify(parseVozScript(configuracoes.voz_script)),
    dispenser_modo: dispenserModo(),
    dispenser_proxima: String(numeroCfg("dispenser_proxima")),
    dispenser_proxima_comum: String(numeroCfg("dispenser_proxima_comum")),
    dispenser_proxima_pref: String(numeroCfg("dispenser_proxima_pref")),
  };
}

function cfgNumeroVista(chave) {
  const n = parseInt(cfgVista()[chave], 10);
  return Number.isFinite(n) && n > 0 ? n : numeroCfg(chave);
}

function sincronizarCfgRascunho() {
  const base = { ...cfgVista() };
  base.ordem_chamada = ORDEM_PROPORCAO;
  const modoEl = document.getElementById("cfg-dispenser-modo");
  if (modoEl) {
    const v = modoEl.value;
    base.dispenser_modo = v === DISPENSER_UNICO || v === DISPENSER_SEPARADO ? v : DISPENSER_NENHUM;
  }
  const lerNum = (id, chave) => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseInt(el.value, 10);
    base[chave] = String(Number.isFinite(n) && n >= 1 ? n : 1);
  };
  const lerQuota = (id, chave, padrao) => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseInt(el.value, 10);
    base[chave] = String(Number.isFinite(n) && n >= 0 ? Math.min(99, n) : padrao);
  };
  lerQuota("cfg-ordem-normais", "ordem_normais", 2);
  lerQuota("cfg-ordem-prefs", "ordem_preferenciais", 1);
  const comecarEl = document.getElementById("cfg-ordem-comecar-pref");
  if (comecarEl) base.ordem_comecar_pref = comecarEl.checked ? "sim" : "nao";
  lerNum("cfg-dispenser-proxima", "dispenser_proxima");
  lerNum("cfg-dispenser-comum", "dispenser_proxima_comum");
  lerNum("cfg-dispenser-pref", "dispenser_proxima_pref");
  const vozDom = lerVozListaDom();
  if (vozDom) base.voz_script = JSON.stringify(vozDom);
  cfgRascunho = base;
  cfgFeedback = "";
  document.getElementById("cfg-ok")?.classList.add("hidden");
  document.getElementById("cfg-erro")?.classList.add("hidden");
  const btn = document.getElementById("cfg-salvar");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Salvar configurações";
    btn.classList.remove("ok");
  }
}

function telaConfiguracoes() {
  const vista = cfgVista();
  const quotas = quotasOrdem(vista);
  const modo = vista.dispenser_modo === DISPENSER_UNICO || vista.dispenser_modo === DISPENSER_SEPARADO ? vista.dispenser_modo : DISPENSER_NENHUM;
  return `<section class="card cfg-pagina">
    <h2>Configurações</h2>
    <p class="muted form-dica">Ajustes do balcão. Só administrador muda. Clique em <strong>Salvar configurações</strong> para valer para todo mundo.</p>
    <div class="cfg-bloco">
      <h3>Ordem de chamada</h3>
      <p class="muted form-dica">Quem o sistema chama primeiro na fila do tipo. A sequência de chegada nunca inverte quem é do mesmo grupo: o 03 não passa o 01, o P08 não passa o P04.</p>
      <p class="cfg-frase">
        Chamar
        <input id="cfg-ordem-prefs" type="number" min="0" max="99" step="1" inputmode="numeric" value="${quotas.prefs}">
        preferencial(is) para cada
        <input id="cfg-ordem-normais" type="number" min="0" max="99" step="1" inputmode="numeric" value="${quotas.normais}">
        senha(s) normal(is)
      </p>
      <label class="cfg-check">
        <input id="cfg-ordem-comecar-pref" type="checkbox" ${quotas.comecarPref ? "checked" : ""}>
        Começar com as preferenciais
      </label>
      <p id="cfg-ordem-dica" class="muted form-dica">${dicaOrdemChamada(quotas)}</p>
      <div class="cfg-exemplo" aria-label="Exemplo da ordem">
        <p class="cfg-exemplo-tit">Exemplo na espera: <strong>01</strong>, <strong>02</strong>, <strong>03</strong>, <strong>P04</strong>, <strong>05</strong>, <strong>P06</strong>, <strong>P07</strong>, <strong>P08</strong>, <strong>09</strong>, <strong>10</strong>, <strong>11</strong>, <strong>12</strong>, <strong>P13</strong></p>
        <p class="on" id="cfg-ex-proporcao">${textoExemploProporcao(quotas.normais, quotas.prefs, quotas.comecarPref)}</p>
      </div>
      <p class="muted form-dica">Quem não respondeu volta para o fim da espera. O <strong>Chamar próximo</strong> e o aviso de fora de ordem seguem esta regra.</p>
    </div>
    <div class="cfg-bloco">
      <h3>O que a TV fala</h3>
      <p class="muted form-dica">Marca <strong>Fala</strong> no que entra na voz e arrasta para a ordem. Atendente usa só o primeiro nome. Vale para todas as TVs. A mesma lista aparece em <strong>Painel da TV → Configurações</strong>.</p>
      ${htmlVozLista(vista.voz_script)}
      <p id="cfg-voz-exemplo" class="cfg-exemplo-tit">Exemplo: <strong>${escapar(textoVozExemplo(vista.voz_script) || "—")}</strong></p>
    </div>
    <div class="cfg-bloco">
      <h3>Dispenser de senha de papel</h3>
      <p class="muted form-dica">O sistema acompanha o rolo que está no balcão. Se não usa dispenser, todo dia começa no 01. Se usa, informa qual número está na boca do aparelho antes de começar.</p>
      <label class="cfg-select">Como as senhas saem
        <select id="cfg-dispenser-modo">
          <option value="${DISPENSER_NENHUM}" ${modo === DISPENSER_NENHUM ? "selected" : ""}>Não usa dispenser — todo dia começa no 01</option>
          <option value="${DISPENSER_UNICO}" ${modo === DISPENSER_UNICO ? "selected" : ""}>Um rolo só (comum e preferencial no mesmo dispenser)</option>
          <option value="${DISPENSER_SEPARADO}" ${modo === DISPENSER_SEPARADO ? "selected" : ""}>Dois rolos (um comum e um preferencial)</option>
        </select>
      </label>
      ${modo === DISPENSER_NENHUM ? `<p class="muted form-dica">Sem papel pré-impresso. A primeira senha do dia é 01, a seguinte 02, e preferencial só coloca o P na frente do mesmo número (P02 é a senha 02).</p>` : ""}
      ${modo === DISPENSER_UNICO ? `<p class="muted form-dica">Um dispenser só. Preferencial é o mesmo número com P. Se a boca do aparelho mostra 47, coloca 47. Cada <strong>Chamar</strong> gasta aquele papel, mesmo se a pessoa não vier.</p>
        <label class="cfg-select">Próxima senha no dispenser
          <input id="cfg-dispenser-proxima" type="number" min="1" step="1" value="${cfgNumeroVista("dispenser_proxima")}">
        </label>` : ""}
      ${modo === DISPENSER_SEPARADO ? `<p class="muted form-dica">Dois dispensers. Marca preferencial <strong>antes</strong> de Chamar, para puxar o rolo certo. Os números são independentes: pode existir 05 e P05 no mesmo dia.</p>
        <div class="cfg-dupla">
          <label class="cfg-select">Próxima senha comum
            <input id="cfg-dispenser-comum" type="number" min="1" step="1" value="${cfgNumeroVista("dispenser_proxima_comum")}">
          </label>
          <label class="cfg-select">Próxima senha preferencial
            <input id="cfg-dispenser-pref" type="number" min="1" step="1" value="${cfgNumeroVista("dispenser_proxima_pref")}">
          </label>
        </div>` : ""}
    </div>
    <p id="cfg-erro" class="erro ${cfgFeedback && cfgFeedback !== "ok" ? "" : "hidden"}">${cfgFeedback && cfgFeedback !== "ok" ? escapar(cfgFeedback) : ""}</p>
    <p id="cfg-ok" class="ok-msg ${cfgFeedback === "ok" ? "" : "hidden"}">Configurações salvas. Vale para todo o balcão.</p>
    <div class="cfg-acoes">
      <button type="button" class="btn primary${cfgFeedback === "ok" ? " ok" : ""}" id="cfg-salvar">${cfgFeedback === "ok" ? "Salvo" : "Salvar configurações"}</button>
    </div>
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
  if (aba === "tv") {
    lerTvCfg();
    app.innerHTML = telaTv();
    ligarTv();
    return;
  }
  if (aba === "geral") {
    app.innerHTML = telaGeral();
    document.getElementById("form-chegada")?.addEventListener("submit", onChegada);
    document.getElementById("form-chegada")?.addEventListener("change", onChegadaCampos);
    document.getElementById("form-chegada")?.addEventListener("click", onPrefTipoClick);
    document.getElementById("btn-chamar-recepcao")?.addEventListener("click", onChamarRecepcao);
    document.getElementById("btn-nao-respondeu-recepcao")?.addEventListener("click", onNaoRespondeuRecepcao);
    ligarFiltro(senhas, { chamar: false });
    document.getElementById("tipo-guiche")?.addEventListener("change", (ev) => {
      const tipo = tipoGeral();
      if (!tipo) return;
      const n = parseInt(ev.target.value, 10);
      salvarGuicheTipo(tipo.id, Number.isFinite(n) && n > 0 ? n : 0);
      desenhar();
    });
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
    document.getElementById("tipo-sem-guiches")?.addEventListener("change", (ev) => {
      document.getElementById("tipo-guiches-wrap")?.classList.toggle("hidden", ev.target.checked);
    });
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
  if (aba === "configuracoes") {
    if (!ehAdmin()) {
      aba = "geral";
      desenhar();
      return;
    }
    app.innerHTML = telaConfiguracoes();
    ligarCfgPagina();
    return;
  }
  if (aba.startsWith("tipo-")) {
    const tipo = tipos.find((t) => t.id === aba.slice(5));
    if (ehTipoFixo(tipo)) {
      aba = "geral";
      desenhar();
      return;
    }
    app.innerHTML = tipo ? telaTipo(tipo) : "<p>Tipo não encontrado.</p>";
    if (tipo) {
      ligarFiltro(senhas.filter((s) => s.tipo_id === tipo.id), { chamar: ehHoje() });
      document.getElementById("tipo-guiche")?.addEventListener("change", (ev) => {
        const n = parseInt(ev.target.value, 10);
        salvarGuicheTipo(tipo.id, Number.isFinite(n) && n > 0 ? n : 0);
        desenhar();
      });
    }
    if (focarAtenderId) {
      const form = document.querySelector(`.form-atender[data-id="${focarAtenderId}"]`);
      focarAtenderId = null;
      if (ehCelular()) form?.scrollIntoView({ block: "start", behavior: "smooth" });
      else form?.querySelector("[data-campo=nome]")?.focus();
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
    numero: null,
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

async function onChamarRecepcao() {
  if (!ehHoje()) return;
  if (!garantirGuiche(tipoGeral())) return;
  guardarRascunho();
  if (!rascunhoChegada.chamado) {
    if (usaDispenser()) {
      const { data, error } = await sb.rpc("reservar_numero", { p_preferencial: rascunhoEhPref() });
      if (error || !data?.ok) {
        mostrarErro(error?.message || "Não deu para pegar o número do dispenser.");
        return;
      }
      rascunhoChegada.numero = Number(data.numero) || 1;
      if (data.reservado) {
        if (dispenserModo() === DISPENSER_SEPARADO) {
          const chave = rascunhoEhPref() ? "dispenser_proxima_pref" : "dispenser_proxima_comum";
          configuracoes[chave] = String(rascunhoChegada.numero + 1);
        } else {
          configuracoes.dispenser_proxima = String(rascunhoChegada.numero + 1);
        }
      }
    } else {
      rascunhoChegada.numero = proximoNumero();
    }
  }
  rascunhoChegada.chamado = true;
  rascunhoChegada.horaIso = new Date().toISOString();
  aplicarEstadoChegada();
  const rotulo = document.getElementById("campo-senha-rotulo");
  if (rotulo) rotulo.textContent = rotuloProxima(rascunhoEhPref());
  document.getElementById("campo-nome")?.focus();
  publicarPainelGeral();
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
  if (rascunhoChegada.chamado && dispenserModo() === DISPENSER_SEPARADO) return;
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
  if (rascunhoChegada.numero) payload.numero = rascunhoChegada.numero;
  const { error } = await sb.from("senhas").insert(payload);
  enviandoChegada = false;
  if (error) {
    if (btn) btn.disabled = false;
    erro.textContent = error.code === "23505" ? "Esse número já saiu hoje. Confere a próxima senha em Opções → Configurações." : error.message;
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
  const semGuiche = !!document.getElementById("tipo-sem-guiches")?.checked;
  const guichesRaw = parseInt(document.getElementById("tipo-guiches")?.value, 10);
  const guiches = semGuiche ? 0 : (Number.isFinite(guichesRaw) ? Math.min(20, Math.max(1, guichesRaw)) : 1);
  const id = document.getElementById("tipo-id")?.value || tipoEditandoId;
  const atual = id ? tipos.find((t) => t.id === id) : null;
  let error;
  if (id && ehTipoFixo(atual)) {
    ({ error } = await sb.from("tipos_atendimento").update({ guiches }).eq("id", id));
  } else if (id) {
    ({ error } = await sb.from("tipos_atendimento").update({ nome, sigla, cor, guiches }).eq("id", id));
  } else {
    ({ error } = await sb.from("tipos_atendimento").insert({
      nome,
      sigla,
      cor,
      guiches,
      ordem: tiposFila().length + 1,
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

async function salvarCfg(chave, valor) {
  const corpo = {
    valor: String(valor),
    updated_by: sessao.id,
  };
  const { data, error } = await sb.from("configuracoes").update(corpo).eq("chave", chave).select("chave");
  if (error) return error;
  if (!Array.isArray(data) || data.length) return null;
  const ins = await sb.from("configuracoes").insert({ chave, ...corpo });
  return ins.error;
}

function ligarCfgPagina() {
  ["cfg-ordem-normais", "cfg-ordem-prefs"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", onCfgOrdemPreview);
    el?.addEventListener("change", onCfgOrdemPreview);
  });
  document.getElementById("cfg-ordem-comecar-pref")?.addEventListener("change", onCfgOrdemPreview);
  document.getElementById("cfg-dispenser-modo")?.addEventListener("change", onCfgDispenserModoPreview);
  ["cfg-dispenser-proxima", "cfg-dispenser-comum", "cfg-dispenser-pref"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", sincronizarCfgRascunho);
    el?.addEventListener("change", sincronizarCfgRascunho);
  });
  document.getElementById("cfg-salvar")?.addEventListener("click", salvarConfiguracoesTela);
  ligarCfgVozLista();
}

function ligarCfgVozLista() {
  const lista = document.getElementById("cfg-voz-lista");
  if (!lista || lista.classList.contains("travada")) return;
  let dragEl = null;
  lista.querySelectorAll("li").forEach((li) => {
    li.addEventListener("dragstart", () => {
      dragEl = li;
      li.classList.add("arrastando");
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("arrastando");
      dragEl = null;
      onCfgVozPreview();
    });
    li.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      const over = ev.currentTarget;
      if (!dragEl || over === dragEl) return;
      const rect = over.getBoundingClientRect();
      lista.insertBefore(dragEl, ev.clientY < rect.top + rect.height / 2 ? over : over.nextSibling);
    });
  });
  lista.querySelectorAll("[data-voz-on]").forEach((el) => {
    el.addEventListener("change", onCfgVozPreview);
  });
}

function onCfgVozPreview() {
  if (document.getElementById("cfg-salvar")) sincronizarCfgRascunho();
  const script = lerVozListaDom();
  const ex = document.getElementById("cfg-voz-exemplo");
  if (ex) ex.innerHTML = `Exemplo: <strong>${escapar(textoVozExemplo(script) || "—")}</strong>`;
  if (document.querySelector(".tv-cfg") && typeof tvMarcarCfgSuja === "function") tvMarcarCfgSuja();
}

function onCfgOrdemPreview() {
  sincronizarCfgRascunho();
  const quotas = quotasOrdem(cfgVista());
  const dica = document.getElementById("cfg-ordem-dica");
  if (dica) dica.textContent = dicaOrdemChamada(quotas);
  const exProp = document.getElementById("cfg-ex-proporcao");
  if (exProp) exProp.textContent = textoExemploProporcao(quotas.normais, quotas.prefs, quotas.comecarPref);
}

function onCfgDispenserModoPreview() {
  sincronizarCfgRascunho();
  desenhar();
}

async function salvarConfiguracoesTela() {
  if (!ehAdmin()) return;
  sincronizarCfgRascunho();
  const r = cfgVista();
  const pares = [
    ["ordem_chamada", r.ordem_chamada],
    ["ordem_normais", r.ordem_normais],
    ["ordem_preferenciais", r.ordem_preferenciais],
    ["ordem_comecar_pref", r.ordem_comecar_pref],
    ["voz_script", r.voz_script],
    ["dispenser_modo", r.dispenser_modo],
    ["dispenser_proxima", r.dispenser_proxima],
    ["dispenser_proxima_comum", r.dispenser_proxima_comum],
    ["dispenser_proxima_pref", r.dispenser_proxima_pref],
  ];
  const erro = document.getElementById("cfg-erro");
  const ok = document.getElementById("cfg-ok");
  const btn = document.getElementById("cfg-salvar");
  erro?.classList.add("hidden");
  ok?.classList.add("hidden");
  if (btn) btn.disabled = true;
  for (const [chave, valor] of pares) {
    const error = await salvarCfg(chave, valor);
    if (error) {
      cfgFeedback = error.message || "Não deu para salvar.";
      if (btn) btn.disabled = false;
      if (erro) {
        erro.textContent = cfgFeedback;
        erro.classList.remove("hidden");
      } else mostrarErro(cfgFeedback);
      return;
    }
    configuracoes[chave] = String(valor);
  }
  cfgRascunho = null;
  cfgFeedback = "ok";
  desenhar();
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
    const rotulo = senha ? rotuloSenha(senha) : "Esta senha";
    abrirAviso({
      titulo: "Já em atendimento",
      texto: `${rotulo} já foi chamada por ${res.com || "outra pessoa"}.`,
    });
  } else if (res?.motivo === "ja_finalizada") {
    abrirAviso({ titulo: "Senha encerrada", texto: "Esta senha já foi finalizada." });
  } else if (res?.motivo === "nao_em_atendimento") {
    abrirAviso({ titulo: "Ainda na espera", texto: "Chame a senha antes de finalizar o atendimento." });
  } else if (res?.motivo === "nao_e_sua") {
    abrirAviso({
      titulo: "Já em atendimento",
      texto: senha?.atendido_por
        ? `${rotuloSenha(senha)} já está com ${nomeOperador(senha.atendido_por)}.`
        : "Esta senha já está com outra pessoa.",
    });
  } else if (res?.motivo === "fila_vazia") {
    abrirAviso({ titulo: "Fila vazia", texto: "Não há ninguém aguardando neste tipo de atendimento." });
  } else if (res?.motivo === "nao_chamada") {
    abrirAviso({ titulo: "Ainda na espera", texto: "Chame a senha antes. “Não respondeu” só vale durante o atendimento." });
  } else if (res?.motivo === "sem_guiche") {
    abrirAviso({ titulo: "Escolha o guichê", texto: "Antes de chamar, escolhe o guichê deste atendimento." });
  } else if (res?.motivo === "tipo_invalido") {
    abrirAviso({ titulo: "Tipo inativo", texto: "Este tipo de atendimento não está ativo." });
  } else if (res?.motivo === "outro_dia") {
    abrirAviso({ titulo: "Somente hoje", texto: "Chamadas só valem no dia de hoje. Ajuste a data no topo da tela." });
  } else {
    abrirAviso({ titulo: "Não foi possível", texto: "Não foi possível assumir esta senha. Atualize a tela e tente de novo." });
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
  const tipo = tipoDaAba() || tipoDe(senhas.find((s) => s.id === id)?.tipo_id);
  if (!garantirGuiche(tipo)) return false;
  const args = { p_id: id, p_operador: sessao.id };
  if (horaIso) args.p_hora = horaIso;
  const g = guicheAtualDoTipo(tipo);
  if (g) args.p_guiche = g;
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
  const senha = senhas.find((s) => s.id === id);
  if (data?.ok && senha) {
    Object.assign(senha, {
      hora_atendimento: null,
      hora_inicio: null,
      hora_fim: null,
      status: "na_fila",
      atendido_por: null,
    });
  }
  return aplicarRespostaFila(data, senha);
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
    irAba("relatorio");
    return;
  }
  if (acao === "rel-vista") {
    irVistaRelatorio(btn.dataset.vista);
    return;
  }
  if (acao === "voltar-fila") {
    voltarDaRelatorio();
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
    const senha = senhas.find((s) => s.id === id);
    const tipo = tipoDaAba() || tipoDe(senha?.tipo_id);
    if (!garantirGuiche(tipo)) return;
    if (!(await confirmarForaDeOrdem(senha))) return;
    btn.disabled = true;
    const args = { p_id: id, p_operador: sessao.id };
    const g = guicheAtualDoTipo(tipo);
    if (g) args.p_guiche = g;
    const { data, error } = await sb.rpc("chamar_senha", args);
    btn.disabled = false;
    if (error) {
      mostrarErro(error.message);
      await carregar();
      return;
    }
    focarAtenderId = id;
    aplicarRespostaFila(data, senha || data?.senha);
    return;
  }

  if (acao === "chamar-proxima") {
    if (!podeChamar()) return;
    const tipoId = btn.dataset.tipo;
    if (!tipoId) return;
    const tipo = tipos.find((t) => t.id === tipoId);
    if (!garantirGuiche(tipo)) return;
    btn.disabled = true;
    const args = {
      p_tipo_id: tipoId,
      p_operador: sessao.id,
      p_data: diaAtual(),
    };
    const g = guicheAtualDoTipo(tipo);
    if (g) args.p_guiche = g;
    const { data, error } = await sb.rpc("chamar_proxima", args);
    btn.disabled = false;
    if (error) {
      mostrarErro(error.message);
      await carregar();
      return;
    }
    if (data?.senha?.id) focarAtenderId = data.senha.id;
    aplicarRespostaFila(data, data?.senha);
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

  if (acao === "liberar-senha") {
    if (!podeChamar()) return;
    const senha = senhas.find((s) => s.id === id);
    if (!(await confirmarVoltarFila(senha))) return;
    btn.disabled = true;
    await rpcLiberar(id);
    btn.disabled = false;
    return;
  }

  if (acao === "agora") {
    const campo = btn.dataset.campo;
    if (campo === "hora_atendimento") {
      if (!podeChamar()) return;
      const senha = senhas.find((s) => s.id === id);
      if (!(await confirmarForaDeOrdem(senha))) return;
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
    if (btn.checked) {
      const senha = senhas.find((s) => s.id === id);
      if (!(await confirmarForaDeOrdem(senha))) {
        btn.checked = false;
        return;
      }
      await rpcChamar(id);
    } else await rpcLiberar(id);
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
    const tipo = tipos.find((t) => t.id === id);
    if (ehTipoFixo(tipo)) {
      mostrarErro("A Senha geral não pode ser desativada.");
      return;
    }
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
    else {
      const senha = senhas.find((s) => s.id === id);
      if (!(await confirmarForaDeOrdem(senha))) {
        el.value = hora(senha?.hora_atendimento) || "";
        return;
      }
      await rpcChamar(id, valor);
    }
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
  pintarDiaMostra();
  aplicarHashInicial();
  aplicarTopoSessao();
  aplicarModoTela();
  await carregar();
  escutar();
  if (ehTv()) {
    desenhar();
    tvEntrar();
  }
}

function sair() {
  if (ehTv()) tvParar();
  localStorage.removeItem(SESSAO_KEY);
  sessao = null;
  aba = "geral";
  aplicarModoTela();
  sincronizarHash();
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
    irAba(tab.dataset.aba);
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
  app.addEventListener("focusin", (ev) => {
    if (!ehCelular()) return;
    const campo = ev.target.closest?.(".form-atender input, .form-atender textarea, #form-chegada input, #form-chegada textarea");
    if (!campo) return;
    setTimeout(() => {
      campo.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 350);
  });
  app.addEventListener("submit", (ev) => {
    if (ev.target.closest(".form-atender")) ev.preventDefault();
  });
  app.addEventListener("blur", (ev) => {
    if (ev.target.matches("input[data-campo=nome], input[data-campo=processo], [data-campo=observacao]")) onCampo(ev);
  }, true);
  document.getElementById("dia").addEventListener("input", pintarDiaMostra);
  document.getElementById("dia").addEventListener("change", () => {
    if (!ehAdmin()) document.getElementById("dia").value = hojeISO();
    pintarDiaMostra();
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
    cfgMenu.classList.add("hidden");
    cfgBtn?.setAttribute("aria-expanded", "false");
    if (item.dataset.cfg === "tv") {
      perguntarAbrirPainelTv();
      return;
    }
    irAba(item.dataset.cfg);
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
    irAba("geral");
  });
  window.addEventListener("hashchange", () => {
    if (!sessao) return;
    if (hashTv()) {
      if (aba !== "tv") irAba("tv");
      return;
    }
    if (aba === "tv") {
      irAba("geral");
      return;
    }
    const vista = hashVistaRelatorio();
    if (vista != null) {
      relVista = vistaRelatorioOk(vista);
      if (aba !== "relatorio") irAba("relatorio");
      else desenhar();
      return;
    }
    if (aba === "relatorio") voltarDaRelatorio();
  });
  document.getElementById("aviso-ok")?.addEventListener("click", () => fecharAviso(true));
  document.getElementById("aviso-nao")?.addEventListener("click", () => fecharAviso(false));
  document.getElementById("aviso")?.addEventListener("click", (ev) => {
    if (ev.target.id === "aviso") fecharAviso(false);
  });
  document.getElementById("login-ajuda")?.addEventListener("click", abrirSobre);
  document.getElementById("login-tv")?.addEventListener("click", perguntarAbrirPainelTv);
  document.getElementById("tv-abrir-mesma")?.addEventListener("click", abrirPainelTvNestaAba);
  document.getElementById("tv-abrir-nova")?.addEventListener("click", abrirPainelTvNovaAba);
  document.getElementById("tv-abrir")?.addEventListener("click", (ev) => {
    if (ev.target.id === "tv-abrir") fecharPerguntaTv();
  });
  document.getElementById("sobre-ok")?.addEventListener("click", fecharSobre);
  document.getElementById("sobre")?.addEventListener("click", (ev) => {
    if (ev.target.id === "sobre") fecharSobre();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      fecharAviso();
      fecharSobre();
      fecharPerguntaTv();
      esconderTipHora();
      cfgMenu?.classList.add("hidden");
      cfgBtn?.setAttribute("aria-expanded", "false");
    }
  });
  ligarDicasHora();
}

async function init() {
  document.getElementById("dia").value = hojeISO();
  pintarDiaMostra();
  ligarEventos();
  if (!(await conectar())) return;
  if (!pedirLogin()) return;
  aplicarTopoSessao();
  aplicarHashInicial();
  aplicarModoTela();
  await carregar();
  escutar();
  if (ehTv()) {
    desenhar();
    tvEntrar();
  }
}

init();
