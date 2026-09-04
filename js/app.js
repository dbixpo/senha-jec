const STORAGE_KEY = "fila-supabase";
const TZ = "America/Sao_Paulo";

const STATUS = {
  recepcao: "Na recepção",
  na_fila: "Na fila",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

let sb = null;
let setores = [];
let senhas = [];
let aba = "recepcao";
let resolvendoId = null;
let canal = null;

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hora(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaAtual() {
  return document.getElementById("dia").value || hojeISO();
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

async function conectar() {
  const cfg = lerConfig();
  const setup = document.getElementById("setup");
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    setup.classList.remove("hidden");
    return false;
  }
  setup.classList.add("hidden");
  sb = window.supabase.createClient(cfg.supabaseUrl.trim(), cfg.supabaseAnonKey.trim(), {
    auth: { persistSession: false },
  });
  return true;
}

async function carregar() {
  const data = diaAtual();
  const [{ data: st, error: e1 }, { data: sn, error: e2 }] = await Promise.all([
    sb.from("setores").select("*").order("ordem"),
    sb.from("senhas").select("*").eq("data", data).order("hora_chegada"),
  ]);
  if (e1 || e2) {
    mostrarErro((e1 || e2).message);
    return;
  }
  setores = st || [];
  senhas = sn || [];
  desenhar();
}

function escutar() {
  if (canal) sb.removeChannel(canal);
  canal = sb
    .channel("fila-ao-vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => carregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "setores" }, () => carregar())
    .subscribe((status) => {
      document.getElementById("live").classList.toggle("off", status !== "SUBSCRIBED");
    });
}

function contar(filtro) {
  return senhas.filter(filtro).length;
}

function desenharAbas() {
  const nav = document.getElementById("tabs");
  const recepcaoN = contar((s) => s.status === "recepcao");
  const abas = [
    { id: "recepcao", label: "Recepção", count: recepcaoN },
    ...setores.map((setor) => ({
      id: "setor-" + setor.id,
      label: setor.nome,
      count: contar((s) => s.setor_id === setor.id && (s.status === "na_fila" || s.status === "em_atendimento")),
    })),
  ];
  nav.innerHTML = abas
    .map(
      (item) =>
        `<button type="button" class="tab ${item.id === aba ? "active" : ""}" data-aba="${item.id}">
          ${escapar(item.label)} <span class="count">${item.count}</span>
        </button>`
    )
    .join("");
}

function botoesSetor(senha, prefixo) {
  return setores
    .map(
      (setor) =>
        `<button type="button" class="setor-btn" style="background:${escapar(setor.cor)}" data-acao="${prefixo}" data-id="${senha.id}" data-setor="${setor.id}">${escapar(setor.nome)}</button>`
    )
    .join("");
}

function cardSenha(senha, acoesHtml) {
  const nome = senha.nome?.trim() ? senha.nome : "sem nome";
  return `<article class="ticket">
    <div class="num" title="Clique para corrigir o número">
      <button type="button" class="btn ghost small" data-acao="corrigir" data-id="${senha.id}">${String(senha.numero).padStart(2, "0")}</button>
    </div>
    <div>
      <div class="nome">${escapar(nome)}</div>
      <div class="meta">chegou ${hora(senha.hora_chegada)}${senha.hora_encaminhamento ? " · encaminhada " + hora(senha.hora_encaminhamento) : ""}${senha.hora_inicio ? " · início " + hora(senha.hora_inicio) : ""}${senha.hora_fim ? " · fim " + hora(senha.hora_fim) : ""}</div>
      ${senha.resolucao ? `<div class="meta">${escapar(senha.resolucao)}</div>` : ""}
    </div>
    <div class="acoes">${acoesHtml}</div>
  </article>`;
}

function lista(titulo, itens, vazio, renderer) {
  return `<section class="card">
    <h3 class="col-title">${escapar(titulo)}</h3>
    <div class="lista">
      ${itens.length ? itens.map(renderer).join("") : `<p class="empty">${escapar(vazio)}</p>`}
    </div>
  </section>`;
}

function telaRecepcao() {
  const naRecepcao = senhas.filter((s) => s.status === "recepcao");
  const encaminhadas = senhas.filter((s) => s.status !== "recepcao" && s.status !== "cancelado");
  return `
    <section class="card">
      <h2>Quem chegou</h2>
      <form id="form-chegada" class="form-grid">
        <label>Nº da senha
          <input class="numero-input" id="campo-numero" type="number" min="1" step="1" required autofocus>
        </label>
        <label>Nome
          <input id="campo-nome" type="text" placeholder="Nome da pessoa" autocomplete="off">
        </label>
        <label>Encaminhar
          <select id="campo-setor">
            <option value="">Depois</option>
            ${setores.map((s) => `<option value="${s.id}">${escapar(s.nome)}</option>`).join("")}
          </select>
        </label>
        <button class="btn primary" type="submit">Registrar</button>
      </form>
      <p id="form-erro" class="erro hidden"></p>
    </section>
    ${lista(
      "Aguardando encaminhamento",
      naRecepcao,
      "Ninguém esperando na recepção.",
      (s) =>
        cardSenha(
          s,
          `${botoesSetor(s, "encaminhar")}<button type="button" class="btn ghost small" data-acao="cancelar" data-id="${s.id}">Saiu</button>`
        )
    )}
    ${lista(
      "Já encaminhadas hoje",
      encaminhadas,
      "Ainda não encaminhou ninguém hoje.",
      (s) => {
        const setor = setores.find((x) => x.id === s.setor_id);
        return cardSenha(
          s,
          `<span class="meta">${escapar(setor?.nome || "—")} · ${STATUS[s.status]}</span>`
        );
      }
    )}`;
}

function telaSetor(setor) {
  const fila = senhas.filter((s) => s.setor_id === setor.id && s.status === "na_fila");
  const agora = senhas.filter((s) => s.setor_id === setor.id && s.status === "em_atendimento");
  const feitos = senhas.filter((s) => s.setor_id === setor.id && s.status === "resolvido");
  return `<div class="cols">
    ${lista(
      "Fila",
      fila,
      "Fila vazia.",
      (s) =>
        cardSenha(
          s,
          `<button type="button" class="btn primary small" data-acao="chamar" data-id="${s.id}">Chamar</button>
           ${botoesSetor(s, "mover")}
           <button type="button" class="btn ghost small" data-acao="cancelar" data-id="${s.id}">Saiu</button>`
        )
    )}
    ${lista(
      "Em atendimento",
      agora,
      "Ninguém sendo atendido.",
      (s) =>
        cardSenha(
          s,
          `<button type="button" class="btn stamp small" data-acao="resolver" data-id="${s.id}">Resolver</button>
           <button type="button" class="btn ghost small" data-acao="voltar-fila" data-id="${s.id}">Voltar à fila</button>`
        )
    )}
    ${lista(
      "Resolvidos no dia",
      feitos,
      "Nada resolvido ainda.",
      (s) => cardSenha(s, `<span class="meta">fim ${hora(s.hora_fim)}</span>`)
    )}
  </div>`;
}

function desenhar() {
  desenharAbas();
  const app = document.getElementById("app");
  if (aba === "recepcao") {
    app.innerHTML = telaRecepcao();
    document.getElementById("form-chegada")?.addEventListener("submit", onChegada);
    document.getElementById("campo-numero")?.focus();
    return;
  }
  const id = Number(aba.replace("setor-", ""));
  const setor = setores.find((s) => s.id === id);
  app.innerHTML = setor ? telaSetor(setor) : "<p>Setor não encontrado.</p>";
}

async function onChegada(ev) {
  ev.preventDefault();
  const erro = document.getElementById("form-erro");
  erro.classList.add("hidden");
  const numero = Number(document.getElementById("campo-numero").value);
  const nome = document.getElementById("campo-nome").value.trim();
  const setorId = document.getElementById("campo-setor").value;
  if (!numero) return;

  const payload = {
    data: diaAtual(),
    numero,
    nome,
    status: setorId ? "na_fila" : "recepcao",
    setor_id: setorId ? Number(setorId) : null,
    hora_encaminhamento: setorId ? new Date().toISOString() : null,
  };

  const { error } = await sb.from("senhas").insert(payload);
  if (error) {
    erro.textContent = error.code === "23505" ? `A senha ${numero} já está neste dia.` : error.message;
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  document.getElementById("campo-numero").focus();
  await carregar();
}

async function patch(id, valores) {
  const { error } = await sb.from("senhas").update(valores).eq("id", id);
  if (error) {
    mostrarErro(error.code === "23505" ? "Esse número de senha já existe neste dia." : error.message);
    return;
  }
  await carregar();
}

async function onAcao(ev) {
  const btn = ev.target.closest("[data-acao]");
  if (!btn) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;
  const agora = new Date().toISOString();

  if (acao === "encaminhar" || acao === "mover") {
    await patch(id, {
      setor_id: Number(btn.dataset.setor),
      status: "na_fila",
      hora_encaminhamento: agora,
      hora_inicio: null,
      hora_fim: null,
      resolucao: null,
    });
    return;
  }
  if (acao === "chamar") {
    await patch(id, { status: "em_atendimento", hora_inicio: agora });
    return;
  }
  if (acao === "voltar-fila") {
    await patch(id, { status: "na_fila", hora_inicio: null });
    return;
  }
  if (acao === "cancelar") {
    if (!confirm("Marcar que a pessoa saiu?")) return;
    await patch(id, { status: "cancelado", hora_fim: agora });
    return;
  }
  if (acao === "resolver") {
    resolvendoId = id;
    const senha = senhas.find((s) => s.id === id);
    document.getElementById("dlg-resolucao-meta").textContent =
      `Senha ${senha?.numero ?? ""} · ${senha?.nome || "sem nome"}`;
    document.getElementById("resolucao-texto").value = senha?.resolucao || "";
    document.getElementById("dlg-resolucao").showModal();
    return;
  }
  if (acao === "corrigir") {
    const senha = senhas.find((s) => s.id === id);
    const novo = window.prompt("Corrigir número da senha de papel:", senha?.numero ?? "");
    if (novo == null || novo === "") return;
    const numero = Number(novo);
    if (!numero) {
      mostrarErro("Número inválido.");
      return;
    }
    await patch(id, { numero });
  }
}

async function salvarResolucao(ev) {
  ev.preventDefault();
  const id = resolvendoId;
  const texto = document.getElementById("resolucao-texto").value.trim();
  document.getElementById("dlg-resolucao").close();
  if (!id) return;
  await patch(id, {
    status: "resolvido",
    resolucao: texto,
    hora_fim: new Date().toISOString(),
  });
  resolvendoId = null;
}

function abrirSetores() {
  document.getElementById("setores-campos").innerHTML = setores
    .map(
      (s) => `<label>${escapar("Setor " + s.id)}
        <input name="setor-${s.id}" value="${escapar(s.nome)}" required>
      </label>`
    )
    .join("");
  document.getElementById("dlg-setores").showModal();
}

async function salvarSetores(ev) {
  ev.preventDefault();
  const form = ev.target;
  await Promise.all(
    setores.map((s) => {
      const nome = form.querySelector(`[name="setor-${s.id}"]`).value.trim();
      return sb.from("setores").update({ nome }).eq("id", s.id);
    })
  );
  document.getElementById("dlg-setores").close();
  await carregar();
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
  if (await conectar()) {
    try {
      await carregar();
      escutar();
    } catch (e) {
      erro.textContent = "Não conectou. Confere se o SQL já rodou e se as chaves estão certas.";
      erro.classList.remove("hidden");
      document.getElementById("setup").classList.remove("hidden");
    }
  }
}

function ligarEventos() {
  document.getElementById("tabs").addEventListener("click", (ev) => {
    const tab = ev.target.closest("[data-aba]");
    if (!tab) return;
    aba = tab.dataset.aba;
    desenhar();
  });
  document.getElementById("app").addEventListener("click", onAcao);
  document.getElementById("dia").addEventListener("change", carregar);
  document.getElementById("btn-hoje").addEventListener("click", () => {
    document.getElementById("dia").value = hojeISO();
    carregar();
  });
  document.getElementById("btn-setores").addEventListener("click", abrirSetores);
  document.getElementById("form-setores").addEventListener("submit", salvarSetores);
  document.getElementById("dlg-setores-fechar").addEventListener("click", () => document.getElementById("dlg-setores").close());
  document.getElementById("form-resolucao").addEventListener("submit", salvarResolucao);
  document.getElementById("dlg-resolucao-fechar").addEventListener("click", () => document.getElementById("dlg-resolucao").close());
  document.getElementById("setup-salvar").addEventListener("click", salvarSetup);
}

async function init() {
  document.getElementById("dia").value = hojeISO();
  ligarEventos();
  if (await conectar()) {
    await carregar();
    escutar();
  }
}

init();
