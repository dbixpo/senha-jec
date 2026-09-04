const STORAGE_KEY = "fila-supabase";
const SESSAO_KEY = "senha-jec-sessao";
const TZ = "America/Sao_Paulo";

let sb = null;
let sessao = null;
let tipos = [];
let operadores = [];
let senhas = [];
let aba = "geral";
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
  if (senha.preferencial) return "P" + n;
  const t = tipoDe(senha.tipo_id);
  return (t?.sigla || "") + n;
}

function rotuloProxima(tipoId, preferencial) {
  if (!tipoId) return "—";
  const n = padSenha(proximoNumero());
  if (preferencial) return "P" + n;
  const t = tipoDe(tipoId);
  return (t?.sigla || "") + n;
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
  document.getElementById("quem").textContent = sessao.nome;
  return true;
}

async function carregar() {
  if (!sessao) return;
  const data = diaAtual();
  const ops = [
    sb.from("tipos_atendimento").select("*").order("ordem"),
    sb.from("senhas").select("*").eq("data", data).order("numero"),
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
  tipos = resultados[0].data || [];
  senhas = resultados[1].data || [];
  operadores = resultados[2]?.data || [];
  if (!estaEditando()) desenhar();
}

function escutar() {
  if (canal) sb.removeChannel(canal);
  canal = sb
    .channel("senha-jec-ao-vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => carregar())
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
    { id: "geral", label: "Senha geral", count: senhas.length },
    ...tipos.filter((t) => t.ativo).map((t) => ({
      id: "tipo-" + t.id,
      label: t.nome,
      count: contarTipo(t.id),
      cor: t.cor,
    })),
    { id: "tipos", label: "Tipos", count: tipos.filter((t) => t.ativo).length },
  ];
  if (ehAdmin()) abas.push({ id: "operadores", label: "Operadores", count: operadores.filter((o) => o.ativo).length });
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
  if (!ativos.length) return `<p class="muted">Cadastre um tipo primeiro, na aba Tipos.</p>`;
  return ativos.map((t) => `
    <label class="chip-check">
      <input type="checkbox" name="tipo-chegada" value="${t.id}">
      <span class="chip-check-ui"><i class="tab-dot" style="background:${escapar(t.cor)}"></i>${escapar(t.sigla)} · ${escapar(t.nome)}</span>
    </label>`).join("");
}

function checksTipoLinha(senha) {
  const ativos = tipos.filter((t) => t.ativo || t.id === senha.tipo_id);
  return `<div class="tipo-mini">${ativos.map((t) => `
    <label class="chip-check mini">
      <input type="radio" name="tipo-${senha.id}" data-campo="tipo_id" data-id="${senha.id}" value="${t.id}" ${t.id === senha.tipo_id ? "checked" : ""}>
      <span class="chip-check-ui" title="${escapar(t.nome)}" style="--tipo:${escapar(t.cor)}">${escapar(t.sigla)}</span>
    </label>`).join("")}</div>`;
}

function badgeTipo(senha) {
  const t = tipoDe(senha.tipo_id);
  if (!t) return `<span class="sigla">—</span>`;
  return `<span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span>`;
}

function celulaHora(senha, campo, comCheck) {
  const valor = hora(senha[campo]);
  const check = comCheck
    ? `<label class="check-hora"><input type="checkbox" data-acao="toggle-atendimento" data-id="${senha.id}" ${senha.hora_atendimento ? "checked" : ""}> Chamou</label>`
    : "";
  return `<div class="hora-cell">
    ${check}
    <input type="time" data-campo="${campo}" data-id="${senha.id}" value="${escapar(valor)}">
    <button type="button" class="btn ghost small" data-acao="agora" data-campo="${campo}" data-id="${senha.id}">Agora</button>
  </div>`;
}

function linhaSenha(senha, { setor = false } = {}) {
  const atendida = !!senha.hora_atendimento;
  return `<tr class="${atendida ? "atendida" : "aguardando"} ${senha.preferencial ? "pref" : ""}">
    <td class="cel-tipo" data-label="Tipo">${setor ? badgeTipo(senha) : checksTipoLinha(senha)}</td>
    <td class="cel-num col-num" data-label="Senha">
      <button type="button" class="btn ghost small num-btn" data-acao="corrigir" data-id="${senha.id}">${escapar(rotuloSenha(senha))}</button>
    </td>
    <td class="cel-pref col-pref" data-label="Preferencial">
      <label class="pref-lab"><input type="checkbox" data-campo="preferencial" data-id="${senha.id}" ${senha.preferencial ? "checked" : ""}> <span class="pref-curto">P</span><span class="pref-longo">Preferencial</span></label>
    </td>
    <td class="cel-rec" data-label="Hora da recepção">${celulaHora(senha, "hora_recepcao", false)}</td>
    <td class="cel-atend" data-label="Hora do atendimento">${celulaHora(senha, "hora_atendimento", setor)}</td>
    <td class="cel-nome" data-label="Nome"><input type="text" data-campo="nome" data-id="${senha.id}" value="${escapar(senha.nome || "")}" placeholder="Nome de quem está sendo atendido"></td>
    <td class="cel-proc" data-label="Nº processo"><input type="text" data-campo="processo" data-id="${senha.id}" value="${escapar(senha.processo || "")}" placeholder="nº processo ou observação"></td>
  </tr>`;
}

function tabelaFila(lista, { setor = false } = {}) {
  const linhas = ordenarFila(lista);
  if (!linhas.length) return `<p class="empty">Ninguém nesta fila hoje.</p>`;
  return `<div class="planilha-wrap">
    <table class="planilha">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Nº senha</th>
          <th>Pref.</th>
          <th>Hora recepção</th>
          <th>Hora atendimento</th>
          <th>Nome</th>
          <th>Nº processo</th>
        </tr>
      </thead>
      <tbody>${linhas.map((s) => linhaSenha(s, { setor })).join("")}</tbody>
    </table>
  </div>`;
}

function legendaTipos() {
  return `<ul class="legenda">
    ${tipos.filter((t) => t.ativo).map((t) => `<li><span class="sigla" style="background:${escapar(t.cor)}">${escapar(t.sigla)}</span> ${escapar(t.nome)}</li>`).join("")}
    <li><span class="chip aguardando">espera</span></li>
    <li><span class="chip atendida">já atendido</span></li>
    <li><span class="chip pref">P = preferencial (sobe)</span></li>
  </ul>`;
}

function telaGeral() {
  return `
    <section class="card">
      <div class="card-topo">
        <div>
          <h2>Senha geral</h2>
          <p class="muted form-dica dica-web">Marca o tipo: sai o número e a hora. Preferencial vira P01, P02… Rosa = esperando · azul = já chamaram.</p>
          <p class="muted form-dica dica-mobile">Marca o tipo → sai a senha e a hora. Se for preferencial, marca o amarelo. Depois coloca o nome e registra.</p>
        </div>
        ${legendaTipos()}
      </div>
      <form id="form-chegada" class="form-chegada">
        <input type="hidden" id="campo-tipo" value="">
        <div class="form-linha">
          <fieldset class="campo campo-tipos">
            <legend><span class="n-passo">1</span> Tipo de atendimento</legend>
            <div class="tipo-checks">${checksTipoForm()}</div>
          </fieldset>
          <label class="chip-check pref-chegada">
            <input id="campo-pref" type="checkbox">
            <span class="chip-check-ui"><span class="n-passo">2</span> Preferencial</span>
          </label>
        </div>
        <div class="form-linha form-linha-campos">
          <div class="campo campo-senha">
            <span><span class="n-passo">3</span> Senha</span>
            <strong id="campo-senha-rotulo" class="senha-valor">—</strong>
          </div>
          <label class="campo campo-hora">Hora da recepção
            <input id="campo-hora-rec" type="time" value="">
          </label>
          <label class="campo campo-nome"><span class="n-passo">4</span> Nome da pessoa
            <input id="campo-nome" type="text" placeholder="Quem está sendo atendido" required autocomplete="off">
          </label>
          <label class="campo campo-processo">Nº processo
            <input id="campo-processo" type="text" placeholder="Número, CPF, voltou…" autocomplete="off">
          </label>
          <button class="btn primary form-submit" type="submit">Registrar senha</button>
        </div>
      </form>
      <p id="form-erro" class="erro hidden"></p>
    </section>
    <section class="card">
      <h2>Fila do dia</h2>
      ${tabelaFila(senhas, { setor: false })}
    </section>`;
}

function telaTipo(tipo) {
  const lista = senhas.filter((s) => s.tipo_id === tipo.id);
  return `<section class="card">
    <div class="card-topo">
      <div>
        <h2>${escapar(tipo.nome)}</h2>
        <p class="muted form-dica">Marca <strong>Chamou</strong> quando chamar a pessoa. A senha geral fica azul.</p>
      </div>
      <span class="sigla grande" style="background:${escapar(tipo.cor)}">${escapar(tipo.sigla)}</span>
    </div>
    ${tabelaFila(lista, { setor: true })}
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
  if (aba === "geral") {
    app.innerHTML = telaGeral();
    document.getElementById("form-chegada")?.addEventListener("submit", onChegada);
    document.getElementById("form-chegada")?.addEventListener("change", onChegadaCampos);
    return;
  }
  if (aba === "tipos") {
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

function atualizarChegada(preencherHora) {
  const tipoId = tipoChegadaSelecionado();
  const pref = document.getElementById("campo-pref")?.checked;
  const hidden = document.getElementById("campo-tipo");
  const rotulo = document.getElementById("campo-senha-rotulo");
  const horaEl = document.getElementById("campo-hora-rec");
  if (hidden) hidden.value = tipoId;
  if (rotulo) rotulo.textContent = rotuloProxima(tipoId, pref);
  if (tipoId && horaEl && (preencherHora || !horaEl.value)) {
    horaEl.value = agoraHHMM();
  }
  if (!tipoId && horaEl && preencherHora) horaEl.value = "";
}

function onChegadaCampos(ev) {
  const el = ev.target;
  if (el.name === "tipo-chegada") {
    const escolhido = el.value;
    document.querySelectorAll("#form-chegada input[name=tipo-chegada]").forEach((box) => {
      box.checked = box.value === escolhido;
    });
    atualizarChegada(true);
    const nome = document.getElementById("campo-nome");
    if (nome && !nome.value) nome.focus();
    return;
  }
  if (el.id === "campo-pref") atualizarChegada(false);
}

async function onChegada(ev) {
  ev.preventDefault();
  const erro = document.getElementById("form-erro");
  erro.classList.add("hidden");
  const nome = document.getElementById("campo-nome").value.trim();
  const tipoId = tipoChegadaSelecionado() || document.getElementById("campo-tipo").value;
  const preferencial = document.getElementById("campo-pref").checked;
  const horaRec = document.getElementById("campo-hora-rec").value;
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
  const payload = {
    data: diaAtual(),
    nome,
    tipo_id: tipoId,
    preferencial,
    processo,
    hora_recepcao: isoDoDia(horaRec) || new Date().toISOString(),
    status: "na_fila",
    created_by: sessao.id,
    updated_by: sessao.id,
  };
  const { error } = await sb.from("senhas").insert(payload);
  if (error) {
    erro.textContent = error.message;
    erro.classList.remove("hidden");
    return;
  }
  ev.target.reset();
  document.getElementById("campo-tipo").value = "";
  document.getElementById("campo-senha-rotulo").textContent = "—";
  document.getElementById("campo-hora-rec").value = "";
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
    p_papel: "operador",
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

async function onAcao(ev) {
  const btn = ev.target.closest("[data-acao]");
  if (!btn) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if (acao === "agora") {
    const campo = btn.dataset.campo;
    const hhmm = agoraHHMM();
    const input = btn.parentElement.querySelector("input[type=time]");
    if (input) input.value = hhmm;
    const extra = campo === "hora_atendimento" ? { status: "em_atendimento" } : {};
    await patch(id, { [campo]: isoDoDia(hhmm), ...extra });
    return;
  }
  if (acao === "toggle-atendimento") {
    if (btn.checked) {
      const hhmm = agoraHHMM();
      await patch(id, { hora_atendimento: isoDoDia(hhmm), status: "em_atendimento" });
    } else {
      await patch(id, { hora_atendimento: null, status: "na_fila" });
    }
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
    const { error } = await sb.from("tipos_atendimento").update({ ativo: btn.dataset.ativo !== "1" }).eq("id", id);
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

async function onCampo(ev) {
  const el = ev.target.closest("[data-campo]");
  if (!el || !el.dataset.id) return;
  const id = el.dataset.id;
  const campo = el.dataset.campo;
  let valor;
  if (el.type === "checkbox") valor = el.checked;
  else if (el.type === "time") valor = isoDoDia(el.value);
  else valor = el.value;
  const extra = {};
  if (campo === "hora_atendimento") extra.status = valor ? "em_atendimento" : "na_fila";
  await patch(id, { [campo]: valor, ...extra }, ev.type !== "blur");
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
  const app = document.getElementById("app");
  app.addEventListener("click", onAcao);
  app.addEventListener("change", onCampo);
  app.addEventListener("blur", (ev) => {
    if (ev.target.matches("input[data-campo=nome], input[data-campo=processo]")) onCampo(ev);
  }, true);
  document.getElementById("dia").addEventListener("change", carregar);
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
  await carregar();
  escutar();
}

init();
