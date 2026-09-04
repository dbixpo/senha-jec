const STORAGE_KEY = "fila-supabase";
const SESSAO_KEY = "senha-jec-sessao";
const TZ = "America/Sao_Paulo";

const STATUS = {
  recepcao: "Na recepção",
  na_fila: "Na fila",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

let sb = null;
let sessao = null;
let setores = [];
let servicos = [];
let operadores = [];
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

function ehAdmin() {
  return sessao?.papel === "admin";
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

function nomeServico(id) {
  return servicos.find((s) => s.id === id)?.nome || "sem serviço";
}

function auditoria(row) {
  return `reg. ${dataHora(row.created_at)}${row.updated_at && row.updated_at !== row.created_at ? " · atual. " + dataHora(row.updated_at) : ""}`;
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
  document.getElementById("quem").textContent = sessao.nome;
  return true;
}

async function carregar() {
  if (!sessao) return;
  const data = diaAtual();
  const ops = [
    sb.from("setores").select("*").order("ordem"),
    sb.from("servicos").select("*").order("nome"),
    sb.from("senhas").select("*").eq("data", data).order("hora_chegada"),
  ];
  if (ehAdmin()) {
    ops.push(
      sb.from("operadores").select("id, usuario, nome, papel, ativo, ultimo_acesso, created_at, updated_at").order("nome")
    );
  }
  const resultados = await Promise.all(ops);
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) {
    mostrarErro(erro.message);
    return;
  }
  setores = resultados[0].data || [];
  servicos = resultados[1].data || [];
  senhas = resultados[2].data || [];
  operadores = resultados[3]?.data || [];
  desenhar();
}

function escutar() {
  if (canal) sb.removeChannel(canal);
  canal = sb
    .channel("senha-jec-ao-vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => carregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "setores" }, () => carregar())
    .on("postgres_changes", { event: "*", schema: "public", table: "servicos" }, () => carregar())
    .subscribe((status) => {
      document.getElementById("live").classList.toggle("off", status !== "SUBSCRIBED");
    });
}

function contar(filtro) {
  return senhas.filter(filtro).length;
}

function desenharAbas() {
  const nav = document.getElementById("tabs");
  const abas = [
    { id: "recepcao", label: "Recepção", count: contar((s) => s.status === "recepcao") },
    ...setores.map((setor) => ({
      id: "setor-" + setor.id,
      label: setor.nome,
      count: contar((s) => s.setor_id === setor.id && (s.status === "na_fila" || s.status === "em_atendimento")),
    })),
    { id: "servicos", label: "Serviços", count: servicos.filter((s) => s.ativo).length },
  ];
  if (ehAdmin()) abas.push({ id: "operadores", label: "Operadores", count: operadores.filter((o) => o.ativo).length });
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
      <div class="meta">${escapar(nomeServico(senha.servico_id))}</div>
      <div class="meta">chegou ${hora(senha.hora_chegada)}${senha.hora_encaminhamento ? " · encaminhada " + hora(senha.hora_encaminhamento) : ""}${senha.hora_inicio ? " · início " + hora(senha.hora_inicio) : ""}${senha.hora_fim ? " · fim " + hora(senha.hora_fim) : ""}</div>
      <div class="meta">${auditoria(senha)}</div>
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

function opcoesServico(selected) {
  const ativos = servicos.filter((s) => s.ativo);
  if (!ativos.length) return `<option value="">Cadastre um serviço primeiro</option>`;
  return `<option value="">Escolher serviço</option>` + ativos.map((s) =>
    `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${escapar(s.nome)}</option>`
  ).join("");
}

function proximoNumero() {
  const usados = senhas.map((s) => Number(s.numero) || 0);
  return (usados.length ? Math.max(...usados) : 0) + 1;
}

function telaRecepcao() {
  const naRecepcao = senhas.filter((s) => s.status === "recepcao");
  const encaminhadas = senhas.filter((s) => s.status !== "recepcao" && s.status !== "cancelado");
  const proxima = String(proximoNumero()).padStart(2, "0");
  return `
    <section class="card">
      <h2>Quem chegou</h2>
      <form id="form-chegada" class="form-grid">
        <div class="proxima">
          <span class="eyebrow">Próxima senha</span>
          <strong>${proxima}</strong>
          <span class="meta">sai sozinha · clique no número depois se precisar ajustar</span>
        </div>
        <label>Nome da pessoa
          <input id="campo-nome" type="text" placeholder="Nome de quem está sendo atendido" required autocomplete="off">
        </label>
        <label>Serviço
          <select id="campo-servico" required>${opcoesServico()}</select>
        </label>
        <label>Setor
          <select id="campo-setor" required>
            <option value="">Escolher setor</option>
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
        return cardSenha(s, `<span class="meta">${escapar(setor?.nome || "—")} · ${STATUS[s.status]}</span>`);
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

function telaServicos() {
  return `<section class="card">
    <h2>Cadastro de serviços</h2>
    <form id="form-servico" class="form-grid cadastro">
      <label>Nome
        <input id="servico-nome" required placeholder="Ex.: atendimento, certidão...">
      </label>
      <label>Descrição
        <input id="servico-desc" placeholder="Opcional">
      </label>
      <span></span>
      <button class="btn primary" type="submit">Incluir serviço</button>
    </form>
    <p id="servico-erro" class="erro hidden"></p>
    <table class="table">
      <thead><tr><th>Serviço</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${
          servicos.length
            ? servicos
                .map(
                  (s) => `<tr>
                    <td><strong>${escapar(s.nome)}</strong><div class="meta">${escapar(s.descricao || "")}${s.ativo ? "" : " · inativo"}</div></td>
                    <td class="meta">${auditoria(s)}</td>
                    <td>
                      <button type="button" class="btn ghost small" data-acao="toggle-servico" data-id="${s.id}" data-ativo="${s.ativo ? "1" : "0"}">${s.ativo ? "Desativar" : "Ativar"}</button>
                    </td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="3" class="empty">Nenhum serviço ainda. A recepção precisa disso para registrar a pessoa.</td></tr>`
        }
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
      <button class="btn primary" type="submit">Incluir</button>
    </form>
    <p id="op-erro" class="erro hidden"></p>
    <table class="table">
      <thead><tr><th>Pessoa</th><th>Acesso</th><th>Quando</th><th></th></tr></thead>
      <tbody>
        ${operadores
          .map(
            (o) => `<tr>
              <td><strong>${escapar(o.nome)}</strong><div class="meta">${escapar(o.usuario)} · ${escapar(o.papel)}${o.ativo ? "" : " · inativo"}</div></td>
              <td class="meta">${o.ultimo_acesso ? dataHora(o.ultimo_acesso) : "ainda não entrou"}</td>
              <td class="meta">${auditoria(o)}</td>
              <td>
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
  if (aba === "recepcao") {
    app.innerHTML = telaRecepcao();
    document.getElementById("form-chegada")?.addEventListener("submit", onChegada);
    document.getElementById("campo-nome")?.focus();
    return;
  }
  if (aba === "servicos") {
    app.innerHTML = telaServicos();
    document.getElementById("form-servico")?.addEventListener("submit", onServico);
    return;
  }
  if (aba === "operadores") {
    if (!ehAdmin()) {
      aba = "recepcao";
      desenhar();
      return;
    }
    app.innerHTML = telaOperadores();
    document.getElementById("form-operador")?.addEventListener("submit", onOperador);
    return;
  }
  const id = Number(aba.replace("setor-", ""));
  const setor = setores.find((s) => s.id === id);
  app.innerHTML = setor ? telaSetor(setor) : "<p>Setor não encontrado.</p>";
}

function carimbo() {
  return { updated_by: sessao.id };
}

async function onChegada(ev) {
  ev.preventDefault();
  const erro = document.getElementById("form-erro");
  erro.classList.add("hidden");
  const nome = document.getElementById("campo-nome").value.trim();
  const servicoId = document.getElementById("campo-servico").value;
  const setorId = document.getElementById("campo-setor").value;
  if (!nome || !servicoId || !setorId) {
    erro.textContent = "Nome, serviço e setor são obrigatórios.";
    erro.classList.remove("hidden");
    return;
  }

  const payload = {
    data: diaAtual(),
    nome,
    servico_id: servicoId,
    status: "na_fila",
    setor_id: Number(setorId),
    hora_encaminhamento: new Date().toISOString(),
    created_by: sessao.id,
    updated_by: sessao.id,
  };

  const { error } = await sb.from("senhas").insert(payload);
  if (error) {
    erro.textContent = error.code === "23505" ? "Esse número já está neste dia. Ajusta pelo número no cartão." : error.message;
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  document.getElementById("campo-nome").focus();
  await carregar();
}

async function onServico(ev) {
  ev.preventDefault();
  const erro = document.getElementById("servico-erro");
  erro.classList.add("hidden");
  const nome = document.getElementById("servico-nome").value.trim();
  const descricao = document.getElementById("servico-desc").value.trim();
  const { error } = await sb.from("servicos").insert({
    nome,
    descricao,
    created_by: sessao.id,
    updated_by: sessao.id,
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
  const usuario = document.getElementById("op-usuario").value.trim().toLowerCase();
  const nome = document.getElementById("op-nome").value.trim();
  const senha = document.getElementById("op-senha").value.trim();
  const { data, error } = await sb.rpc("criar_operador", {
    p_usuario: usuario,
    p_nome: nome,
    p_senha: senha,
    p_papel: "operador",
  });
  if (error) {
    erro.textContent = error.message;
    erro.classList.remove("hidden");
    return;
  }
  if (!data) {
    erro.textContent = "Não deu para criar. Confere se o usuário já existe.";
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  await carregar();
}

async function patch(id, valores) {
  const { error } = await sb.from("senhas").update({ ...valores, ...carimbo() }).eq("id", id);
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
      `Senha ${senha?.numero ?? ""} · ${senha?.nome || "sem nome"} · ${nomeServico(senha?.servico_id)}`;
    document.getElementById("resolucao-texto").value = senha?.resolucao || "";
    document.getElementById("dlg-resolucao").showModal();
    return;
  }
  if (acao === "corrigir") {
    const senha = senhas.find((s) => s.id === id);
    const novo = window.prompt("Corrigir número da senha:", senha?.numero ?? "");
    if (novo == null || novo === "") return;
    const numero = Number(novo);
    if (!numero) {
      mostrarErro("Número inválido.");
      return;
    }
    await patch(id, { numero });
    return;
  }
  if (acao === "toggle-servico") {
    const { error } = await sb
      .from("servicos")
      .update({ ativo: btn.dataset.ativo !== "1", updated_by: sessao.id })
      .eq("id", id);
    if (error) mostrarErro(error.message);
    else await carregar();
    return;
  }
  if (acao === "toggle-op") {
    const { error } = await sb.from("operadores").update({ ativo: btn.dataset.ativo !== "1" }).eq("id", id);
    if (error) mostrarErro(error.message);
    else await carregar();
    return;
  }
  if (acao === "senha-op") {
    const nova = window.prompt("Nova senha (CPF do operador):");
    if (!nova) return;
    const { error } = await sb.rpc("definir_senha_operador", { p_id: id, p_senha: nova });
    if (error) mostrarErro(error.message);
    else window.alert("Senha atualizada.");
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

async function onLogin(ev) {
  ev.preventDefault();
  const erro = document.getElementById("login-erro");
  erro.classList.add("hidden");
  const usuario = document.getElementById("login-usuario").value.trim().toLowerCase();
  const senha = document.getElementById("login-senha").value.trim();
  const { data, error } = await sb.rpc("login_operador", { p_usuario: usuario, p_senha: senha });
  if (error || !data) {
    erro.textContent = "Usuário ou senha não conferem.";
    erro.classList.remove("hidden");
    return;
  }
  sessao = data;
  localStorage.setItem(SESSAO_KEY, JSON.stringify(data));
  document.getElementById("login").classList.add("hidden");
  document.getElementById("quem").textContent = sessao.nome;
  document.getElementById("dia").value = hojeISO();
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
  document.getElementById("app").addEventListener("click", onAcao);
  document.getElementById("dia").addEventListener("change", carregar);
  document.getElementById("btn-hoje").addEventListener("click", () => {
    document.getElementById("dia").value = hojeISO();
    carregar();
  });
  document.getElementById("btn-setores").addEventListener("click", abrirSetores);
  document.getElementById("btn-sair").addEventListener("click", sair);
  document.getElementById("form-setores").addEventListener("submit", salvarSetores);
  document.getElementById("dlg-setores-fechar").addEventListener("click", () => document.getElementById("dlg-setores").close());
  document.getElementById("form-resolucao").addEventListener("submit", salvarResolucao);
  document.getElementById("dlg-resolucao-fechar").addEventListener("click", () => document.getElementById("dlg-resolucao").close());
  document.getElementById("setup-salvar").addEventListener("click", salvarSetup);
  document.getElementById("form-login").addEventListener("submit", onLogin);
}

async function init() {
  document.getElementById("dia").value = hojeISO();
  ligarEventos();
  if (!(await conectar())) return;
  if (!pedirLogin()) return;
  await carregar();
  escutar();
}

init();
