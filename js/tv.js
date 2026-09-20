const TV_CFG_KEY = "senha-jec-tv";
const TV_YT_PADRAO = "https://www.youtube.com/watch?v=0R7O0hwYBTc";
const TV_DIGITOS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TV_CROP_W = 1280;
const TV_CROP_H = 720;
const TV_IMG_MAX = 30;
const TV_IMG_SEG_PADRAO = 300;
const TV_IMG_DUR_PADRAO = 20;
const TV_INTERVALO_CHAMADA_PADRAO = 3;
const TV_FILA_FALA_MAX = 10;
const TV_PIPER_HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/";
const TV_PIPER_WASM = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/";
const TV_ONNX_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
const TV_VOZES_PIPER = [
  { id: "dii", nome: "Dii", url: "https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_dii/resolve/main/dii_pt-BR.onnx" },
  { id: "cadu", nome: "Cadu", arquivo: "pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx" },
  { id: "faber", nome: "Faber", arquivo: "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx" },
  { id: "edresson", nome: "Edresson", arquivo: "pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx" },
];
const TV_VOZ_PADRAO = "google:auto";

let tvCfg = null;
let tvAtual = null;
let tvVistos = new Set();
let tvCanal = null;
let tvTimer = 0;
let tvSlideTimer = 0;
let tvSlideHideTimer = 0;
let tvAnuncioTimer = 0;
let tvSlideIdx = 0;
let tvImagens = [];
let tvImgAssinatura = "";
let tvImgTimer = 0;
let tvYt = null;
let tvYtPronto = false;
let tvFalando = false;
let tvCrop = null;
let tvCfgAberta = false;
let tvCfgSuja = false;
let tvCfgEdicao = null;
let tvHist = [];
let tvPronto = false;
let tvAudio = null;
let tvAudioCtx = null;
let tvAudioFonte = null;
let tvFalaSeq = 0;
let tvPiperOrt = null;
let tvPiperPhonemize = null;
let tvPiperModelo = null;
let tvFilaFala = [];
let tvFilaTimer = 0;
let tvFalaLivreEm = 0;
let tvRelogioTimer = 0;

function tvSegundos(valor, padrao, min, max) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function tvCfgPadrao() {
  return {
    geral: true,
    tiposTodos: true,
    tipos: [],
    youtube: TV_YT_PADRAO,
    youtubeSom: false,
    youtubeVolume: 25,
    semVideo: false,
    imagensSeg: TV_IMG_SEG_PADRAO,
    imagensDuracao: TV_IMG_DUR_PADRAO,
    intervaloChamada: TV_INTERVALO_CHAMADA_PADRAO,
    vozUri: TV_VOZ_PADRAO,
    vozRate: 0.95,
    vozVolume: 1,
    vozRev: 3,
  };
}

function lerTvCfg() {
  try {
    const bruto = JSON.parse(localStorage.getItem(TV_CFG_KEY) || "null");
    tvCfg = { ...tvCfgPadrao(), ...(bruto || {}) };
  } catch {
    tvCfg = tvCfgPadrao();
  }
  if (!Array.isArray(tvCfg.tipos)) tvCfg.tipos = [];
  if (!tvCfg.youtube) tvCfg.youtube = TV_YT_PADRAO;
  if (tvCfg.tiposTodos == null) tvCfg.tiposTodos = !tvCfg.tipos.length;
  if (tvCfg.semVideo == null) tvCfg.semVideo = false;
  if (!tvCfg.imgRev || tvCfg.imgRev < 2) {
    tvCfg.imagensSeg = TV_IMG_SEG_PADRAO;
    tvCfg.imagensDuracao = TV_IMG_DUR_PADRAO;
    tvCfg.imgRev = 2;
    try { localStorage.setItem(TV_CFG_KEY, JSON.stringify(tvCfg)); } catch { /* quota */ }
  }
  tvCfg.imagensSeg = tvSegundos(tvCfg.imagensSeg, TV_IMG_SEG_PADRAO, 1, 86400);
  tvCfg.imagensDuracao = tvSegundos(tvCfg.imagensDuracao, TV_IMG_DUR_PADRAO, 1, 86400);
  tvCfg.intervaloChamada = tvSegundos(tvCfg.intervaloChamada, TV_INTERVALO_CHAMADA_PADRAO, 0, 120);
  if (!tvCfg.vozRev || tvCfg.vozRev < 3) {
    const rev = tvCfg.vozRev || 0;
    const escolherGoogle = !tvCfg.vozUri
      || tvCfg.vozUri === "piper:dii"
      || tvCfg.vozUri === "piper:jeff"
      || tvCfg.vozUri === "google:auto"
      || /microsoft/i.test(tvCfg.vozUri)
      || (rev < 2 && tvCfg.vozUri === "piper:cadu");
    tvCfg.vozRev = 3;
    if (escolherGoogle) tvCfg.vozUri = tvVozGoogleMulher()?.voiceURI || TV_VOZ_PADRAO;
    try { localStorage.setItem(TV_CFG_KEY, JSON.stringify(tvCfg)); } catch { /* quota */ }
  }
  if (tvCfg.vozUri === "piper:jeff") tvCfg.vozUri = TV_VOZ_PADRAO;
  if (!tvCfg.vozUri) tvCfg.vozUri = TV_VOZ_PADRAO;
  tvAplicarVozPadraoSePreciso();
}

function salvarTvCfg() {
  localStorage.setItem(TV_CFG_KEY, JSON.stringify(tvCfg));
}

function tvTiposAtivos() {
  const ativos = tipos.filter((t) => t.ativo);
  if (tvCfg.tiposTodos) return ativos;
  return ativos.filter((t) => tvCfg.tipos.includes(t.id));
}

function tvAceita(row) {
  if (!row) return false;
  if (row.origem === "geral" || !row.tipo_id) return !!tvCfg.geral;
  return tvTiposAtivos().some((t) => t.id === row.tipo_id);
}

function tvYoutubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "0R7O0hwYBTc";
}

function tvYoutubeEhPadrao(url) {
  return tvYoutubeId(url || tvCfg.youtube) === tvYoutubeId(TV_YT_PADRAO);
}

function tvHoraChamada(row) {
  return (typeof hora === "function" && hora(row?.chamado_em)) || "—";
}

function tvRotulo(row) {
  if (!row) return "—";
  const n = padSenha(row.numero);
  return row.preferencial ? "P" + n : n;
}

function tvLocal(row) {
  if (!row) return "";
  if (row.origem === "geral" || !row.tipo_id) return "Senha geral";
  return tipoDe(row.tipo_id)?.nome || "Atendimento";
}

function tvTextoVoz(row) {
  const n = padSenha(row.numero || 0);
  const falado = n.split("").map((d) => TV_DIGITOS[Number(d)] || d).join(" ");
  const pref = row.preferencial ? "P, " : "";
  if (row.origem === "geral" || !row.tipo_id) return `Senha ${pref}${falado}`;
  return `Senha ${pref}${falado}, ${tvLocal(row)}`;
}

function tvVozesPt() {
  if (!window.speechSynthesis) return [];
  const todas = speechSynthesis.getVoices() || [];
  const pt = todas.filter((v) => /^pt/i.test(v.lang || "") || /portugu|brasil/i.test(v.name || ""));
  const nota = (v) => {
    const n = `${v.name} ${v.lang}`.toLowerCase();
    if (n.includes("google") && (/pt-br|pt_br|brasil/.test(n)) && !/male|homem/.test(n)) return 6;
    if (n.includes("google") && /^pt/i.test(v.lang || "")) return 5;
    if (n.includes("microsoft") && (n.includes("maria") || n.includes("francisca") || n.includes("thalita"))) return 4;
    if (/pt-br|pt_br/.test(n)) return 3;
    if (n.includes("brasil")) return 2;
    return 1;
  };
  return (pt.length ? pt : todas).slice().sort((a, b) => nota(b) - nota(a) || a.name.localeCompare(b.name, "pt"));
}

function tvVozGoogleMulher() {
  const lista = tvVozesPt();
  return lista.find((v) => {
    const n = `${v.name} ${v.lang} ${v.voiceURI}`.toLowerCase();
    return n.includes("google") && (/pt-br|pt_br|brasil/.test(n) || /^pt/i.test(v.lang || "")) && !/male|homem|daniel/.test(n);
  }) || lista.find((v) => /google/i.test(`${v.name} ${v.voiceURI}`) && /^pt/i.test(v.lang || ""))
    || null;
}

function tvVozMulherSistema() {
  return tvVozGoogleMulher()
    || tvVozesPt().find((v) => /maria|francisca|thalita/i.test(v.name))
    || null;
}

function tvAplicarVozPadraoSePreciso() {
  if (!tvCfg) return;
  if (tvCfg.vozUri && tvCfg.vozUri !== TV_VOZ_PADRAO) return;
  const g = tvVozGoogleMulher();
  if (!g) return;
  tvCfg.vozUri = g.voiceURI;
  try { localStorage.setItem(TV_CFG_KEY, JSON.stringify(tvCfg)); } catch { /* quota */ }
}

function tvPiperId() {
  const m = String(tvCfg.vozUri || "").match(/^piper:(.+)$/);
  return m ? m[1] : "";
}

function tvPiperVoz() {
  const id = tvPiperId();
  return TV_VOZES_PIPER.find((v) => v.id === id) || (id ? null : TV_VOZES_PIPER[0]);
}

function tvPiperUrl(voz) {
  return voz.url || TV_PIPER_HF + voz.arquivo;
}

function tvEscolherVoz() {
  const lista = tvVozesPt();
  if (!lista.length) return null;
  if (tvCfg.vozUri === TV_VOZ_PADRAO) return tvVozMulherSistema() || lista[0];
  return lista.find((v) => v.voiceURI === tvCfg.vozUri) || tvVozMulherSistema() || lista[0];
}

function tvVozStatus(msg, erro) {
  const el = document.getElementById("tv-voz-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("erro", !!erro);
}

function tvPararFala() {
  tvFalaSeq += 1;
  if (window.speechSynthesis && (tvFalando || speechSynthesis.speaking)) speechSynthesis.cancel();
  if (tvAudioFonte) {
    try { tvAudioFonte.stop(); } catch { /* já parou */ }
    tvAudioFonte = null;
  }
  if (tvAudio) {
    try {
      tvAudio.pause();
      tvAudio.removeAttribute("src");
      tvAudio.load();
    } catch {
      /* áudio já parado */
    }
    tvAudio = null;
  }
  tvFalando = false;
  tvMuteYt(false);
}

function tvLimparFilaFala() {
  tvFilaFala = [];
  clearTimeout(tvFilaTimer);
  tvFilaTimer = 0;
  tvFalaLivreEm = 0;
}

function tvIntervaloChamadaMs() {
  return tvSegundos(tvCfg?.intervaloChamada, TV_INTERVALO_CHAMADA_PADRAO, 0, 120) * 1000;
}

function tvEnfileirarFala(row) {
  if (!row) return;
  if (row.id) tvFilaFala = tvFilaFala.filter((r) => r.id !== row.id);
  tvFilaFala.push(row);
  while (tvFilaFala.length > TV_FILA_FALA_MAX) tvFilaFala.shift();
  tvTentarFalarProxima();
}

function tvTentarFalarProxima() {
  if (tvFalando || tvFilaTimer) return;
  if (!tvFilaFala.length) return;
  const espera = Math.max(0, tvFalaLivreEm - Date.now());
  if (espera > 0) {
    tvFilaTimer = setTimeout(() => {
      tvFilaTimer = 0;
      tvTentarFalarProxima();
    }, espera);
    return;
  }
  const row = tvFilaFala.shift();
  if (!row) return;
  tvFalarAgora(row);
}

function tvFimFala(seq) {
  if (seq !== tvFalaSeq) return;
  tvFalando = false;
  tvMuteYt(false);
  tvFalaLivreEm = Date.now() + tvIntervaloChamadaMs();
  tvTentarFalarProxima();
}

function tvPodarVistos(ids) {
  const keep = new Set(ids || []);
  if (tvAtual?.id) keep.add(tvAtual.id);
  tvFilaFala.forEach((r) => { if (r.id) keep.add(r.id); });
  for (const id of [...tvVistos]) {
    if (!keep.has(id)) tvVistos.delete(id);
  }
}

function tvCarregarScript(src) {
  return new Promise((ok, falhou) => {
    if (document.querySelector(`script[data-tv-src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.tvSrc = src;
    s.onload = () => ok();
    s.onerror = () => falhou(new Error("Não carregou " + src));
    document.head.appendChild(s);
  });
}

function tvVozDb() {
  return new Promise((ok, falhou) => {
    const req = indexedDB.open("senha-jec-tv-vozes", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("arquivos")) req.result.createObjectStore("arquivos");
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falhou(req.error);
  });
}

async function tvVozCacheGet(chave) {
  const db = await tvVozDb();
  try {
    return await new Promise((ok, falhou) => {
      const req = db.transaction("arquivos").objectStore("arquivos").get(chave);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => falhou(req.error);
    });
  } finally {
    db.close();
  }
}

async function tvVozCachePut(chave, blob) {
  const db = await tvVozDb();
  try {
    await new Promise((ok, falhou) => {
      const tx = db.transaction("arquivos", "readwrite");
      tx.objectStore("arquivos").put(blob, chave);
      tx.oncomplete = () => ok();
      tx.onerror = () => falhou(tx.error);
    });
  } finally {
    db.close();
  }
}

async function tvBaixarVoz(url, onProg) {
  const hit = await tvVozCacheGet(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const total = Number(res.headers.get("content-length") || 0);
  if (!res.body) {
    const blob = await res.blob();
    await tvVozCachePut(url, blob);
    return blob;
  }
  const leitor = res.body.getReader();
  const pedacos = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    pedacos.push(value);
    loaded += value.length;
    if (onProg) onProg(loaded, total);
  }
  const blob = new Blob(pedacos);
  await tvVozCachePut(url, blob);
  return blob;
}

function tvPcmWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const txt = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  txt(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  txt(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function tvPiperOrtPronto() {
  if (tvPiperOrt) return tvPiperOrt;
  await tvCarregarScript(TV_ONNX_WASM + "ort.min.js");
  if (!window.ort) throw new Error("ONNX Runtime não carregou");
  window.ort.env.wasm.wasmPaths = TV_ONNX_WASM;
  window.ort.env.wasm.numThreads = 1;
  tvPiperOrt = window.ort;
  return tvPiperOrt;
}

async function tvPiperPhonemizePronto() {
  if (tvPiperPhonemize) return tvPiperPhonemize;
  await tvCarregarScript(TV_PIPER_WASM + "piper_phonemize.js");
  if (typeof createPiperPhonemize !== "function") throw new Error("Phonemizer não carregou");
  let linhas = [];
  const mod = await createPiperPhonemize({
    print(line) {
      try {
        linhas.push(JSON.parse(line));
      } catch {
        /* log do wasm */
      }
    },
    locateFile: (path) => TV_PIPER_WASM + path,
  });
  tvPiperPhonemize = (textos, lang) => {
    linhas = [];
    const code = mod.callMain([
      "--espeak_data", "/espeak-ng-data",
      "--language", lang,
      "--input", JSON.stringify(textos.map((text) => ({ text }))),
    ]);
    if (code !== 0) throw new Error("phonemize " + code);
    return linhas;
  };
  return tvPiperPhonemize;
}

function tvPiperIds(phonemes, config) {
  const mapa = config.phoneme_id_map || {};
  const ids = [];
  const push = (p) => {
    if (mapa[p]) ids.push(...mapa[p]);
  };
  push("^");
  push("_");
  for (const p of phonemes) {
    if (!mapa[p]) continue;
    push(p);
    push("_");
  }
  push("$");
  return ids;
}

async function tvPiperModeloPronto(voz, onProg) {
  if (tvPiperModelo?.id === voz.id) return tvPiperModelo;
  if (tvPiperModelo?.session) {
    try { await tvPiperModelo.session.release(); } catch { /* sessão velha */ }
  }
  tvPiperModelo = null;
  const url = tvPiperUrl(voz);
  const [modeloBlob, cfgBlob, ort] = await Promise.all([
    tvBaixarVoz(url, onProg),
    tvBaixarVoz(url + ".json"),
    tvPiperOrtPronto(),
  ]);
  const config = JSON.parse(await cfgBlob.text());
  const session = await ort.InferenceSession.create(await modeloBlob.arrayBuffer());
  tvPiperModelo = { id: voz.id, session, config, ort };
  return tvPiperModelo;
}

async function tvPiperSintetizar(texto, onProg) {
  const voz = tvPiperVoz();
  if (!voz) throw new Error("voz piper");
  const nome = voz.nome.replace(/\s*\(.*\)\s*$/, "");
  tvVozStatus(`Carregando voz ${nome}…`);
  const [{ session, config, ort }, phonemize] = await Promise.all([
    tvPiperModeloPronto(voz, (loaded, total) => {
      if (!total) {
        tvVozStatus(`Baixando voz ${nome}… ${(loaded / 1e6).toFixed(0)} MB`);
        return;
      }
      tvVozStatus(`Baixando voz ${nome}… ${Math.round((loaded / total) * 100)}%`);
    }),
    tvPiperPhonemizePronto(),
  ]);
  if (onProg) onProg();
  const lang = config.espeak?.voice || "pt-br";
  const [res] = phonemize([texto.trim()], lang);
  const phonemes = res?.phonemes || [];
  const ids = res?.phoneme_ids || tvPiperIds(phonemes, config);
  if (!ids.length) throw new Error("sem fonemas");
  const inf = config.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([
      inf.noise_scale ?? 0.667,
      inf.length_scale ?? 1,
      inf.noise_w ?? 0.8,
    ]), [3]),
  };
  tvVozStatus("");
  const saida = await session.run(feeds);
  const output = saida.output || Object.values(saida)[0];
  const samples = output.data;
  const rate = config.audio?.sample_rate || 22050;
  return tvPcmWav(samples, rate);
}

function tvTocarWav(blob, seq) {
  return (async () => {
    if (tvAudioCtx) {
      const bruto = await blob.arrayBuffer();
      if (seq !== tvFalaSeq) return;
      const decoded = await tvAudioCtx.decodeAudioData(bruto.slice(0));
      if (seq !== tvFalaSeq) return;
      const src = tvAudioCtx.createBufferSource();
      const gain = tvAudioCtx.createGain();
      gain.gain.value = Math.min(1, Math.max(0, Number(tvCfg.vozVolume) ?? 1));
      src.buffer = decoded;
      src.playbackRate.value = Math.min(1.4, Math.max(0.6, Number(tvCfg.vozRate) || 0.95));
      src.connect(gain).connect(tvAudioCtx.destination);
      tvAudioFonte = src;
      await new Promise((ok) => {
        src.onended = () => {
          if (tvAudioFonte === src) tvAudioFonte = null;
          tvFimFala(seq);
          ok();
        };
        try {
          src.start();
        } catch {
          tvFimFala(seq);
          ok();
        }
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    tvAudio = audio;
    audio.volume = Math.min(1, Math.max(0, Number(tvCfg.vozVolume) ?? 1));
    audio.playbackRate = Math.min(1.4, Math.max(0.6, Number(tvCfg.vozRate) || 0.95));
    await new Promise((ok) => {
      const limpar = () => {
        URL.revokeObjectURL(url);
        if (tvAudio === audio) tvAudio = null;
        tvFimFala(seq);
        ok();
      };
      audio.onended = limpar;
      audio.onerror = limpar;
      audio.play().catch(limpar);
    });
  })();
}

function tvFalarSistema(texto, seq) {
  if (!window.speechSynthesis) {
    tvFimFala(seq);
    return;
  }
  const utt = new SpeechSynthesisUtterance(texto);
  const voz = tvEscolherVoz();
  if (voz) utt.voice = voz;
  utt.lang = voz?.lang || "pt-BR";
  utt.rate = Math.min(1.4, Math.max(0.6, Number(tvCfg.vozRate) || 0.95));
  utt.volume = Math.min(1, Math.max(0, Number(tvCfg.vozVolume) ?? 1));
  utt.pitch = 1;
  utt.onend = () => tvFimFala(seq);
  utt.onerror = () => tvFimFala(seq);
  speechSynthesis.speak(utt);
}

async function tvFalarAgora(row) {
  if (!row) {
    tvTentarFalarProxima();
    return;
  }
  tvDestravarVoz();
  tvPararFala();
  const seq = tvFalaSeq;
  const texto = tvTextoVoz(row);
  tvFalando = true;
  tvMuteYt(true);
  if (tvPiperId()) {
    try {
      const wav = await tvPiperSintetizar(texto);
      if (seq !== tvFalaSeq) return;
      await tvTocarWav(wav, seq);
      return;
    } catch (err) {
      console.warn("voz piper", err);
      tvVozStatus("Não deu para carregar a voz neural. Usando a voz deste aparelho.", true);
      if (seq !== tvFalaSeq) return;
    }
  }
  tvFalarSistema(texto, seq);
}

function tvFalar(row) {
  tvEnfileirarFala(row);
}

function tvPrepararVoz() {
  const voz = tvPiperVoz();
  if (!voz || !tvPiperId()) return;
  Promise.all([
    tvPiperModeloPronto(voz, (loaded, total) => {
      const nome = voz.nome.replace(/\s*\(.*\)\s*$/, "");
      if (!total) tvVozStatus(`Baixando voz ${nome}… ${(loaded / 1e6).toFixed(0)} MB`);
      else tvVozStatus(`Baixando voz ${nome}… ${Math.round((loaded / total) * 100)}%`);
    }),
    tvPiperPhonemizePronto(),
  ]).then(() => tvVozStatus("")).catch((err) => {
    console.warn("voz piper", err);
    tvVozStatus("");
  });
}

function tvMuteYt(duranteFala) {
  if (!tvYt || !tvYtPronto) return;
  try {
    if (duranteFala || !tvCfg.youtubeSom) tvYt.mute();
    else {
      tvYt.unMute();
      tvYt.setVolume(Math.round(Number(tvCfg.youtubeVolume) || 0));
    }
  } catch {
    /* player ainda não aceita comando */
  }
}

function tvBlobDataUrl(blob) {
  return new Promise((ok, falhou) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => falhou(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

function tvUrlImagem(item) {
  return item?.conteudo || "";
}

function tvAssinaturaImagens(lista) {
  return (lista || []).map((r) => `${r.id}:${r.ordem || 0}`).join(",");
}

async function tvCarregarImagens() {
  if (!sb) {
    tvImagens = [];
    tvImgAssinatura = "";
    return;
  }
  const { data, error } = await sb.from("painel_imagens").select("id,ordem,mime,conteudo").order("ordem");
  if (error) {
    console.warn("painel_imagens", error.message);
    return;
  }
  tvImagens = data || [];
  tvImgAssinatura = tvAssinaturaImagens(tvImagens);
}

async function tvSincronizarImagens() {
  if (!sb) return;
  const { data, error } = await sb.from("painel_imagens").select("id,ordem").order("ordem");
  if (error) return;
  const assinatura = tvAssinaturaImagens(data || []);
  if (assinatura === tvImgAssinatura) return;
  await tvCarregarImagens();
  if (ehTv()) {
    tvAtualizarListaImagens();
    tvLigarSlides();
  }
}

async function tvSalvarImagem(blob) {
  if (!sb) return;
  if (tvImagens.length >= TV_IMG_MAX) {
    mostrarErro(`O painel guarda no máximo ${TV_IMG_MAX} imagens.`);
    return;
  }
  const conteudo = await tvBlobDataUrl(blob);
  const { error } = await sb.from("painel_imagens").insert({
    ordem: Date.now(),
    mime: blob.type || "image/jpeg",
    conteudo,
  });
  if (error) {
    const msg = String(error.message || "");
    mostrarErro(msg.includes("30") ? `O painel guarda no máximo ${TV_IMG_MAX} imagens.` : (msg || "Não deu para guardar a imagem."));
    return;
  }
  await tvCarregarImagens();
}

async function tvApagarImagem(id) {
  if (!sb || !id) return;
  const { error } = await sb.from("painel_imagens").delete().eq("id", id);
  if (error) {
    mostrarErro(error.message || "Não deu para tirar a imagem.");
    return;
  }
  await tvCarregarImagens();
}

function tvRotuloFontes() {
  return [
    tvCfg.geral ? "Senha geral" : "",
    ...tvTiposAtivos().map((t) => t.nome),
  ].filter(Boolean).join(" · ");
}

function tvAtualizarFontes() {
  const el = document.getElementById("tv-fontes");
  if (el) el.textContent = tvRotuloFontes() || "Nenhum tipo selecionado";
}

function tvAbrir() {
  irAba("tv");
}

function tvSair() {
  irAba("geral");
}

async function tvEntrar() {
  lerTvCfg();
  await tvCarregarImagens();
  if (window.speechSynthesis) speechSynthesis.getVoices();
  tvPrepararVoz();
  await tvPuxar(false);
  tvEscutar();
}

function tvAbrirCfg() {
  tvPararSlides();
  tvCfgAberta = true;
  tvCfgSuja = false;
  tvCfgEdicao = null;
  if (document.querySelector(".tv-cfg")) return;
  document.querySelector(".tv-shell")?.insertAdjacentHTML("beforeend", htmlTvCfg());
  ligarTvCfg();
}

async function tvFecharCfg() {
  if (tvCfgSuja) {
    const ok = await perguntarConfirmacao({
      titulo: "Sair sem salvar?",
      texto: "As alterações desta TV ainda não foram salvas. Tipos, vídeo e voz só entram depois de Salvar.",
      ok: "Sair sem salvar",
      cancelar: "Continuar editando",
    });
    if (!ok) return;
    lerTvCfg();
  }
  tvCfgAberta = false;
  tvCfgSuja = false;
  tvCfgEdicao = null;
  document.querySelector(".tv-cfg")?.remove();
  tvAtualizarFontes();
  tvAplicarFundo();
  tvLigarSlides();
}

function tvMarcarCfgSuja() {
  tvCfgSuja = true;
  const ok = document.getElementById("tv-cfg-ok");
  if (ok) ok.classList.add("hidden");
  const btn = document.querySelector("[data-tv=salvar-cfg]");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Salvar";
    btn.classList.remove("ok");
  }
}

function tvSalvarCfgTela() {
  tvGuardarCfgTela();
  tvCfgSuja = false;
  tvCfgEdicao = null;
  tvAtualizarFontes();
  tvAplicarFundo();
  tvLigarSlides();
  tvPrepararVoz();
  const ok = document.getElementById("tv-cfg-ok");
  if (ok) ok.classList.remove("hidden");
  const btn = document.querySelector("[data-tv=salvar-cfg]");
  if (btn) {
    btn.textContent = "Salvo";
    btn.classList.add("ok");
  }
}

function tvParar() {
  clearInterval(tvTimer);
  tvPararSlides();
  tvPararRelogio();
  clearInterval(tvImgTimer);
  tvTimer = 0;
  tvImgTimer = 0;
  clearTimeout(tvAnuncioTimer);
  tvAnuncioTimer = 0;
  tvLimparFilaFala();
  if (tvCanal && sb) {
    try { sb.removeChannel(tvCanal); } catch { /* já saiu */ }
  }
  tvCanal = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
  tvPararFala();
  try { tvYt?.destroy(); } catch { /* player velho */ }
  tvYtPronto = false;
  tvYt = null;
  tvCfgAberta = false;
  tvCfgSuja = false;
  tvCfgEdicao = null;
  tvCrop = null;
  tvPronto = false;
}

function tvFiltroSql() {
  return sb.from("painel_chamadas").select("*").eq("data", hojeISO()).order("chamado_em", { ascending: false }).limit(30);
}

async function tvPuxar(falarNovo) {
  if (!sb) return;
  const { data, error } = await tvFiltroSql();
  if (error || !data) return;
  const aceitas = data.filter(tvAceita);
  const novas = aceitas.filter((r) => !tvVistos.has(r.id)).reverse();
  const jaLigada = tvPronto;
  aceitas.forEach((r) => tvVistos.add(r.id));
  tvHist = aceitas.slice(0, 8);
  if (novas.length) tvAtual = novas[novas.length - 1];
  else if (!tvAtual && aceitas[0]) tvAtual = aceitas[0];
  if (ehTv()) tvPintarChamada(!!(falarNovo && jaLigada && novas.length));
  if (falarNovo && jaLigada && novas.length) novas.forEach(tvEnfileirarFala);
  tvPodarVistos(aceitas.map((r) => r.id));
  tvPronto = true;
}

function tvChegou(row) {
  if (!tvAceita(row)) return;
  const novo = !tvVistos.has(row.id);
  tvAtual = row;
  tvVistos.add(row.id);
  tvHist = [row, ...tvHist.filter((h) => h.id !== row.id)].slice(0, 8);
  tvPintarChamada(novo);
  if (novo) tvEnfileirarFala(row);
}

function tvPintarChamada(animar) {
  const num = document.getElementById("tv-numero");
  const local = document.getElementById("tv-local");
  const kicker = document.getElementById("tv-kicker");
  const hist = document.getElementById("tv-historico");
  if (!num) return;
  num.textContent = tvAtual ? tvRotulo(tvAtual) : "—";
  local.textContent = tvAtual ? tvLocal(tvAtual) : "Aguardando chamada";
  if (kicker) kicker.textContent = tvAtual ? "Chamando" : "Painel de senha";
  num.classList.toggle("pref", !!tvAtual?.preferencial);
  if (animar) {
    num.classList.remove("pulse");
    void num.offsetWidth;
    num.classList.add("pulse");
  }
  if (hist) {
    hist.innerHTML = tvHist.length
      ? tvHist.map((r) => `<li class="${r.id === tvAtual?.id ? "on" : ""}"><strong>${escapar(tvRotulo(r))}</strong><span class="tv-hist-dir"><span>${escapar(tvLocal(r))}</span><time datetime="${escapar(r.chamado_em || "")}">${escapar(tvHoraChamada(r))}</time></span></li>`).join("")
      : "<li class='vazio'>Nenhuma senha chamada nesta TV hoje.</li>";
  }
}

function tvEscutar() {
  if (tvCanal && sb) {
    try { sb.removeChannel(tvCanal); } catch { /* ok */ }
  }
  if (!sb) return;
  tvCanal = sb
    .channel("senha-jec-tv")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "painel_chamadas" }, (payload) => {
      const row = payload.new;
      if (row?.data && row.data !== hojeISO()) return;
      tvChegou(row);
    })
    .subscribe();
  clearInterval(tvTimer);
  tvTimer = setInterval(() => tvPuxar(true), 2000);
  clearInterval(tvImgTimer);
  tvImgTimer = setInterval(() => tvSincronizarImagens(), 12000);
}

function tvCarregarYtApi(cb) {
  if (window.YT?.Player) {
    cb();
    return;
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prev === "function") prev();
    cb();
  };
  if (!document.getElementById("tv-yt-api")) {
    const s = document.createElement("script");
    s.id = "tv-yt-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}

function tvUsaVideo() {
  return !tvCfg.semVideo;
}

function tvAplicarFundo() {
  const simbolo = document.querySelector(".tv-fundo-simbolo");
  const video = document.querySelector(".tv-video");
  if (simbolo) simbolo.classList.toggle("hidden", tvUsaVideo());
  if (video) video.classList.toggle("hidden", !tvUsaVideo());
  if (tvUsaVideo()) {
    if (video && !document.getElementById("tv-yt")) video.innerHTML = '<div id="tv-yt"></div>';
    tvLigarYoutube();
  } else {
    try { tvYt?.destroy(); } catch { /* player velho */ }
    tvYt = null;
    tvYtPronto = false;
    if (video) video.innerHTML = '<div id="tv-yt"></div>';
  }
}

function tvLigarYoutube() {
  if (!tvUsaVideo()) return;
  const host = document.getElementById("tv-yt");
  if (!host) return;
  const id = tvYoutubeId(tvCfg.youtube);
  tvCarregarYtApi(() => {
    if (!ehTv() || !document.getElementById("tv-yt")) return;
    try { tvYt?.destroy(); } catch { /* player velho */ }
    tvYtPronto = false;
    tvYt = new YT.Player("tv-yt", {
      videoId: id,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        loop: 1,
        playlist: id,
        origin: location.origin,
      },
      events: {
        onReady: (ev) => {
          tvYtPronto = true;
          try {
            ev.target.mute();
            ev.target.setVolume(Math.round(Number(tvCfg.youtubeVolume) || 0));
            ev.target.playVideo();
            tvMuteYt(false);
          } catch { /* ignore */ }
        },
        onStateChange: (ev) => {
          if (ev.data === 0) {
            try { ev.target.playVideo(); } catch { /* ignore */ }
          }
        },
      },
    });
  });
}

function tvImgIntervaloMs() {
  return tvSegundos(tvCfg.imagensSeg, TV_IMG_SEG_PADRAO, 1, 86400) * 1000;
}

function tvImgDuracaoMs() {
  return tvSegundos(tvCfg.imagensDuracao, TV_IMG_DUR_PADRAO, 1, 86400) * 1000;
}

function tvAgoraSP() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    data: `${map.day}/${map.month}/${map.year}`,
    hora: `${map.hour}:${map.minute}:${map.second}`,
    iso: `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`,
  };
}

function tvPintarRelogio() {
  const el = document.getElementById("tv-relogio");
  if (!el) return;
  const agora = tvAgoraSP();
  const data = el.querySelector(".tv-relogio-data");
  const hora = el.querySelector(".tv-relogio-hora");
  if (data) data.textContent = agora.data;
  if (hora) hora.textContent = agora.hora;
  el.setAttribute("datetime", agora.iso);
}

function tvLigarRelogio() {
  clearInterval(tvRelogioTimer);
  tvPintarRelogio();
  tvRelogioTimer = setInterval(tvPintarRelogio, 250);
}

function tvPararRelogio() {
  clearInterval(tvRelogioTimer);
  tvRelogioTimer = 0;
}

function tvPararSlides() {
  clearTimeout(tvSlideTimer);
  clearInterval(tvSlideTimer);
  clearTimeout(tvSlideHideTimer);
  tvSlideTimer = 0;
  tvSlideHideTimer = 0;
  tvEsconderSlide();
}

function tvEsconderSlide() {
  clearTimeout(tvSlideHideTimer);
  document.getElementById("tv-slide")?.classList.remove("visivel");
  clearTimeout(tvAnuncioTimer);
  tvAnuncioTimer = setTimeout(() => {
    document.querySelector(".tv-shell")?.classList.remove("tv-anuncio");
    tvAnuncioTimer = 0;
  }, 520);
}

function tvMostrarSlide() {
  if (tvCfgAberta || !tvImagens.length) return;
  const el = document.getElementById("tv-slide");
  const img = document.getElementById("tv-slide-img");
  const shell = document.querySelector(".tv-shell");
  if (!el || !img || !shell) return;
  tvSlideIdx = tvSlideIdx % tvImagens.length;
  img.src = tvUrlImagem(tvImagens[tvSlideIdx]);
  const proxima = tvImagens[(tvSlideIdx + 1) % tvImagens.length];
  if (proxima && proxima !== tvImagens[tvSlideIdx]) {
    const preload = new Image();
    preload.src = tvUrlImagem(proxima);
  }
  tvSlideIdx += 1;
  clearTimeout(tvAnuncioTimer);
  tvAnuncioTimer = 0;
  shell.classList.add("tv-anuncio");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("visivel"));
  });
}

function tvLigarSlides() {
  tvPararSlides();
  if (!tvImagens.length || tvCfgAberta) return;
  const aposFoto = () => {
    if (!ehTv() || tvCfgAberta) return;
    tvEsconderSlide();
    tvSlideTimer = setTimeout(proxima, tvImgIntervaloMs());
  };
  const proxima = () => {
    if (!ehTv() || tvCfgAberta || !tvImagens.length) return;
    tvMostrarSlide();
    tvSlideHideTimer = setTimeout(aposFoto, tvImgDuracaoMs());
  };
  tvSlideTimer = setTimeout(proxima, tvImgIntervaloMs());
}

function telaTv() {
  if (tvCfgAberta) {
    const vivo = tvColetarCfgTela();
    if (vivo) tvCfgEdicao = vivo;
  } else {
    tvCfgEdicao = null;
  }
  const atual = tvAtual;
  const rotuloFontes = tvRotuloFontes();
  const agora = tvAgoraSP();
  return `<div class="tv-shell">
    <div class="tv-video${tvUsaVideo() ? "" : " hidden"}" aria-hidden="true"><div id="tv-yt"></div></div>
    <div class="tv-fundo-simbolo${tvUsaVideo() ? " hidden" : ""}" aria-hidden="true">
      <img src="img/simbolo-rolo.png" alt="">
    </div>
    <div id="tv-slide" class="tv-slide" aria-hidden="true">
      <img id="tv-slide-img" alt="">
    </div>
    <div class="tv-velo"></div>
    <header class="tv-top">
      <div class="tv-marca">
        <img src="img/simbolo-rolo.png" alt="">
        <div>
          <strong>Senha JEC</strong>
          <span id="tv-fontes">${escapar(rotuloFontes || "Nenhum tipo selecionado")}</span>
        </div>
      </div>
      <time id="tv-relogio" class="tv-relogio" datetime="${escapar(agora.iso)}">
        <span class="tv-relogio-data">${escapar(agora.data)}</span>
        <span class="tv-relogio-hora">${escapar(agora.hora)}</span>
      </time>
      <div class="tv-acoes">
        <button type="button" class="btn ghost small" data-tv="cfg">Configurar esta TV</button>
        <button type="button" class="btn ghost small" data-tv="cheia">Tela cheia</button>
        <button type="button" class="btn ghost small" data-tv="sair">Voltar à fila</button>
      </div>
    </header>
    <div class="tv-miolo">
      <div class="tv-chamada">
        <p id="tv-kicker" class="tv-kicker">${atual ? "Chamando" : "Painel de senha"}</p>
        <p id="tv-numero" class="tv-numero${atual?.preferencial ? " pref" : ""}">${escapar(atual ? tvRotulo(atual) : "—")}</p>
        <p id="tv-local" class="tv-local">${escapar(atual ? tvLocal(atual) : "Aguardando chamada")}</p>
      </div>
      <ol id="tv-historico" class="tv-historico"></ol>
    </div>
    ${tvCfgAberta ? htmlTvCfg() : ""}
    ${tvCrop ? htmlTvCrop() : ""}
  </div>`;
}

function tvCfgForm() {
  return tvCfgEdicao || tvCfg;
}

function tvOpcoesVoz() {
  const atual = tvCfgForm().vozUri;
  const google = tvVozGoogleMulher();
  const rec = google || tvVozMulherSistema();
  const escolhida = atual === TV_VOZ_PADRAO ? (rec?.voiceURI || "") : atual;
  const piper = TV_VOZES_PIPER.map((v) =>
    `<option value="piper:${v.id}" ${escolhida === `piper:${v.id}` ? "selected" : ""}>${escapar(v.nome)}</option>`
  ).join("");
  const sist = tvVozesPt();
  const extra = sist.length
    ? sist.map((v) => {
      const marca = rec && v.voiceURI === rec.voiceURI ? " (recomendada)" : "";
      return `<option value="${escapar(v.voiceURI)}" ${escolhida === v.voiceURI ? "selected" : ""}>${escapar(v.name)}${marca}</option>`;
    }).join("")
    : "";
  return (extra ? `<optgroup label="Vozes Padrão">${extra}</optgroup>` : "") +
    `<optgroup label="Vozes Neurais">${piper}</optgroup>`;
}

function htmlTvCfg() {
  const cfg = tvCfgForm();
  const tiposHtml = tipos.filter((t) => t.ativo).map((t) => `
    <label class="chip-check">
      <input type="checkbox" data-tv-tipo="${t.id}" ${cfg.tiposTodos || cfg.tipos.includes(t.id) ? "checked" : ""}>
      <span class="chip-check-ui"><i class="tab-dot" style="background:${escapar(t.cor)}"></i>${escapar(t.nome)}</span>
    </label>`).join("");
  const imgs = tvImagens.map((im, i) => `
    <li>
      <img src="${escapar(tvUrlImagem(im))}" alt="Imagem ${i + 1}">
      <button type="button" class="btn ghost small" data-tv-del="${escapar(im.id)}">Tirar</button>
    </li>`).join("");
  return `<div class="tv-cfg" role="dialog" aria-labelledby="tv-cfg-tit">
    <div class="tv-cfg-card">
      <div class="card-topo">
        <div>
          <p class="eyebrow">Esta televisão</p>
          <h2 id="tv-cfg-tit">Configurações da TV</h2>
          <p class="muted form-dica">Vale só neste aparelho. Tipos, vídeo e voz só entram depois de <strong>Salvar</strong>. Outra TV pode mostrar outros tipos, outro vídeo e outra voz.</p>
        </div>
      </div>
      <div class="tv-cfg-grid">
        <section>
          <h3>O que esta TV chama</h3>
          <p class="muted form-dica">Marca Senha geral e os tipos que devem aparecer aqui. Uma TV pode ficar com tudo; outra, só com Consulta e Ajuizamento.</p>
          <div class="tv-checks">
            <label class="chip-check">
              <input id="tv-fonte-geral" type="checkbox" ${cfg.geral ? "checked" : ""}>
              <span class="chip-check-ui">Senha geral</span>
            </label>
            ${tiposHtml}
          </div>
        </section>
        <section>
          <h3>Vídeo de fundo</h3>
          <p class="muted form-dica">Live ou vídeo do YouTube atrás do painel. O padrão é sem som, para a voz da senha aparecer limpa. Sem vídeo, o fundo é o símbolo do Senha JEC — serve se o YouTube estiver bloqueado ou para economizar banda.</p>
          <label class="chip-check">
            <input id="tv-sem-video" type="checkbox" ${cfg.semVideo ? "checked" : ""}>
            <span class="chip-check-ui">Sem vídeo</span>
          </label>
          <div id="tv-yt-campos" class="${cfg.semVideo ? "hidden" : ""}">
          <label>Link do YouTube
            <input id="tv-yt-url" type="url" value="${escapar(cfg.youtube)}" placeholder="${escapar(TV_YT_PADRAO)}">
          </label>
          <button type="button" class="btn ghost small" data-tv="yt-padrao" ${tvYoutubeEhPadrao(cfg.youtube) ? "disabled" : ""}>Voltar link do vídeo padrão</button>
          <label class="chip-check">
            <input id="tv-yt-som" type="checkbox" ${cfg.youtubeSom ? "checked" : ""}>
            <span class="chip-check-ui">Som do vídeo</span>
          </label>
          <label>Volume do vídeo
            <input id="tv-yt-vol" type="range" min="0" max="100" value="${Number(cfg.youtubeVolume) || 0}" ${cfg.youtubeSom ? "" : "disabled"}>
          </label>
          </div>
        </section>
        <section>
          <h3>Voz da chamada</h3>
          <p class="muted form-dica">Padrão: a voz feminina do Google neste aparelho. Se o Google não aparecer, usa a mulher do sistema. Cadu, Faber, Edresson e Dii são neurais (a primeira vez baixa uns 60 MB). Na Senha geral fala só o número; nos tipos, número e o nome do atendimento. Se várias pessoas chamarem ao mesmo tempo, a TV fala uma senha por vez, com o intervalo abaixo, e descarta o excesso da fila.</p>
          <label>Voz
            <select id="tv-voz">${tvOpcoesVoz()}</select>
          </label>
          <p id="tv-voz-status" class="tv-voz-status hidden"></p>
          <label>Velocidade
            <input id="tv-voz-rate" type="range" min="60" max="140" value="${Math.round((Number(cfg.vozRate) || 0.95) * 100)}">
          </label>
          <label>Volume da voz
            <input id="tv-voz-vol" type="range" min="0" max="100" value="${Math.round((Number(cfg.vozVolume) ?? 1) * 100)}">
          </label>
          <label>Intervalo de uma chamada para a outra
            <span class="tv-seg-linha">
              <input id="tv-intervalo-chamada" type="number" min="0" max="120" step="1" inputmode="numeric" value="${tvSegundos(cfg.intervaloChamada, TV_INTERVALO_CHAMADA_PADRAO, 0, 120)}">
              <span>segundos</span>
            </span>
          </label>
          <button type="button" class="btn primary small" data-tv="ouvir">Ouvir exemplo</button>
        </section>
        <section>
          <h3>Imagens sobre o fundo</h3>
          <p class="muted form-dica">Valem para todas as TVs assim que você enviar (ficam no banco). Quando a foto entra, senha e histórico descem para a faixa de baixo — a imagem aparece inteira no molde 16:9, e o som do YouTube continua se estiver ligado. Até <strong>${TV_IMG_MAX}</strong> imagens. Depois da amostra o fundo <strong>sempre</strong> volta; a espera é o tempo de vídeo (ou do símbolo) até a próxima foto.</p>
          <div class="cfg-dupla">
            <label>Surge uma imagem a cada
              <span class="tv-seg-linha">
                <input id="tv-img-seg" type="number" min="1" max="86400" step="1" inputmode="numeric" value="${tvSegundos(cfg.imagensSeg, TV_IMG_SEG_PADRAO, 1, 86400)}">
                <span>segundos</span>
              </span>
            </label>
            <label>Fica em amostra
              <span class="tv-seg-linha">
                <input id="tv-img-dur" type="number" min="1" max="86400" step="1" inputmode="numeric" value="${tvSegundos(cfg.imagensDuracao, TV_IMG_DUR_PADRAO, 1, 86400)}">
                <span>segundos</span>
              </span>
            </label>
          </div>
          <p class="muted form-dica">Padrão: espera 300 segundos (5 minutos) de fundo, 20 segundos em amostra. Com 5 e 5, a foto aparece 5 segundos e o vídeo volta 5 segundos.</p>
          <label class="btn ghost tv-file-btn${tvImagens.length >= TV_IMG_MAX ? " off" : ""}">Enviar imagem 16:9
            <input id="tv-img-file" class="tv-file" type="file" accept="image/*" ${tvImagens.length >= TV_IMG_MAX ? "disabled" : ""}>
          </label>
          <p class="muted form-dica" id="tv-img-conta">${tvImagens.length} / ${TV_IMG_MAX}</p>
          <ul class="tv-img-lista">${imgs || "<li class='muted'>Nenhuma imagem ainda.</li>"}</ul>
        </section>
      </div>
      <div class="tv-cfg-acoes">
        <p id="tv-cfg-ok" class="ok-msg hidden">Configuração desta TV salva.</p>
        <button type="button" class="btn ghost" data-tv="fechar-cfg">Fechar</button>
        <button type="button" class="btn primary" data-tv="salvar-cfg">Salvar</button>
      </div>
    </div>
  </div>`;
}

function htmlTvCrop() {
  return `<div class="tv-crop" role="dialog" aria-labelledby="tv-crop-tit">
    <div class="tv-crop-card">
      <h2 id="tv-crop-tit">Enquadrar na TV (16:9)</h2>
      <p class="muted form-dica">Arrasta a imagem e usa o scroll para aproximar. A janela amarela é o recorte 16:9. Na TV a foto aparece inteira nesse molde; senha e histórico descem para a faixa de baixo, então nada cobre a imagem.</p>
      <div class="tv-crop-view"><canvas id="tv-crop-canvas" width="${TV_CROP_W}" height="${TV_CROP_H}"></canvas></div>
      <div class="topo-acoes">
        <button type="button" class="btn ghost" data-tv="crop-cancelar">Cancelar</button>
        <button type="button" class="btn primary" data-tv="crop-ok">Usar este recorte</button>
      </div>
    </div>
  </div>`;
}

function tvDesenharCrop() {
  const canvas = document.getElementById("tv-crop-canvas");
  if (!canvas || !tvCrop?.img) return;
  const ctx = canvas.getContext("2d");
  const { img, x, y, scale } = tvCrop;
  ctx.fillStyle = "#0d3b5e";
  ctx.fillRect(0, 0, TV_CROP_W, TV_CROP_H);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x, y, w, h);
}

function tvAbrirCrop(file) {
  const img = new Image();
  img.onload = () => {
    const cover = Math.max(TV_CROP_W / img.width, TV_CROP_H / img.height);
    tvCrop = {
      img,
      scale: cover,
      x: (TV_CROP_W - img.width * cover) / 2,
      y: (TV_CROP_H - img.height * cover) / 2,
      arrasto: null,
    };
    if (!document.querySelector(".tv-crop")) {
      document.querySelector(".tv-shell")?.insertAdjacentHTML("beforeend", htmlTvCrop());
    }
    ligarTvCrop();
    document.querySelector("[data-tv=crop-cancelar]")?.addEventListener("click", tvFecharCrop);
    document.querySelector("[data-tv=crop-ok]")?.addEventListener("click", tvConfirmarCrop);
  };
  img.src = URL.createObjectURL(file);
}

function tvFecharCrop() {
  tvCrop = null;
  document.querySelector(".tv-crop")?.remove();
}

async function tvConfirmarCrop() {
  const canvas = document.getElementById("tv-crop-canvas");
  if (!canvas) return;
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
  if (blob) await tvSalvarImagem(blob);
  tvFecharCrop();
  tvAtualizarListaImagens();
}

function tvAtualizarListaImagens() {
  const lista = document.querySelector(".tv-img-lista");
  if (!lista) return;
  lista.innerHTML = tvImagens.length
    ? tvImagens.map((im, i) => `
      <li>
        <img src="${escapar(tvUrlImagem(im))}" alt="Imagem ${i + 1}">
        <button type="button" class="btn ghost small" data-tv-del="${escapar(im.id)}">Tirar</button>
      </li>`).join("")
    : "<li class='muted'>Nenhuma imagem ainda.</li>";
  const conta = document.getElementById("tv-img-conta");
  if (conta) conta.textContent = `${tvImagens.length} / ${TV_IMG_MAX}`;
  const file = document.getElementById("tv-img-file");
  const btn = file?.closest(".tv-file-btn");
  if (file) file.disabled = tvImagens.length >= TV_IMG_MAX;
  if (btn) btn.classList.toggle("off", tvImagens.length >= TV_IMG_MAX);
  lista.querySelectorAll("[data-tv-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await tvApagarImagem(btn.getAttribute("data-tv-del"));
      tvAtualizarListaImagens();
    });
  });
}

function ligarTvCrop() {
  const canvas = document.getElementById("tv-crop-canvas");
  if (!canvas || !tvCrop) return;
  tvDesenharCrop();
  canvas.addEventListener("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    tvCrop.arrasto = { x: ev.clientX, y: ev.clientY, ox: tvCrop.x, oy: tvCrop.y };
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!tvCrop.arrasto) return;
    const dx = ev.clientX - tvCrop.arrasto.x;
    const dy = ev.clientY - tvCrop.arrasto.y;
    const rect = canvas.getBoundingClientRect();
    const k = TV_CROP_W / rect.width;
    tvCrop.x = tvCrop.arrasto.ox + dx * k;
    tvCrop.y = tvCrop.arrasto.oy + dy * k;
    tvDesenharCrop();
  });
  canvas.addEventListener("pointerup", () => { tvCrop.arrasto = null; });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const fator = ev.deltaY < 0 ? 1.08 : 0.92;
    const min = Math.max(TV_CROP_W / tvCrop.img.width, TV_CROP_H / tvCrop.img.height);
    tvCrop.scale = Math.min(8, Math.max(min, tvCrop.scale * fator));
    tvDesenharCrop();
  }, { passive: false });
}

function ligarTv() {
  tvDestravarVoz();
  tvPintarChamada(false);
  tvAplicarFundo();
  tvLigarSlides();
  tvLigarRelogio();
  document.querySelector("[data-tv=cfg]")?.addEventListener("click", tvAbrirCfg);
  document.querySelector("[data-tv=sair]")?.addEventListener("click", tvSair);
  document.querySelector("[data-tv=cheia]")?.addEventListener("click", () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
    tvDestravarVoz();
  });
  if (tvCfgAberta) ligarTvCfg();
  if (tvCrop) {
    ligarTvCrop();
    document.querySelector("[data-tv=crop-cancelar]")?.addEventListener("click", tvFecharCrop);
    document.querySelector("[data-tv=crop-ok]")?.addEventListener("click", tvConfirmarCrop);
  }
}

function tvAtualizarBotaoYtPadrao() {
  const btn = document.querySelector("[data-tv=yt-padrao]");
  const input = document.getElementById("tv-yt-url");
  if (btn) btn.disabled = tvYoutubeEhPadrao(input?.value);
}

function ligarTvCfg() {
  tvPrepararVoz();
  document.querySelector("[data-tv=fechar-cfg]")?.addEventListener("click", tvFecharCfg);
  document.querySelector("[data-tv=salvar-cfg]")?.addEventListener("click", tvSalvarCfgTela);
  document.querySelector("[data-tv=yt-padrao]")?.addEventListener("click", () => {
    const input = document.getElementById("tv-yt-url");
    if (input) input.value = TV_YT_PADRAO;
    tvMarcarCfgSuja();
    tvAtualizarBotaoYtPadrao();
  });
  document.getElementById("tv-yt-url")?.addEventListener("input", () => {
    tvMarcarCfgSuja();
    tvAtualizarBotaoYtPadrao();
  });
  document.querySelector("[data-tv=ouvir]")?.addEventListener("click", () => {
    tvDestravarVoz();
    const rascunho = tvColetarCfgTela();
    if (rascunho) Object.assign(tvCfg, rascunho);
    const tipo = tvTiposAtivos()[0];
    if (tipo) tvFalarAgora({ numero: 3, preferencial: true, origem: "tipo", tipo_id: tipo.id });
    else tvFalarAgora({ numero: 3, preferencial: false, origem: "geral" });
  });
  document.getElementById("tv-img-file")?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (tvImagens.length >= TV_IMG_MAX) {
      mostrarErro(`O painel guarda no máximo ${TV_IMG_MAX} imagens.`);
      return;
    }
    tvAbrirCrop(file);
  });
  tvAtualizarListaImagens();
  ["tv-yt-som", "tv-yt-vol", "tv-voz", "tv-voz-rate", "tv-voz-vol", "tv-intervalo-chamada", "tv-img-seg", "tv-img-dur", "tv-fonte-geral", "tv-sem-video"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      tvMarcarCfgSuja();
      tvAtualizarCamposVideo();
      const vol = document.getElementById("tv-yt-vol");
      if (vol) vol.disabled = !document.getElementById("tv-yt-som")?.checked;
    });
    document.getElementById(id)?.addEventListener("input", tvMarcarCfgSuja);
  });
  document.querySelectorAll("[data-tv-tipo]").forEach((el) => {
    el.addEventListener("change", tvMarcarCfgSuja);
  });
}

function tvDestravarVoz() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!tvAudioCtx) tvAudioCtx = new AC();
      if (tvAudioCtx.state === "suspended") tvAudioCtx.resume();
    }
  } catch {
    /* Autoplay ainda bloqueado */
  }
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tvAtualizarCamposVideo() {
  const box = document.getElementById("tv-yt-campos");
  if (box) box.classList.toggle("hidden", !!document.getElementById("tv-sem-video")?.checked);
}

function tvColetarCfgTela() {
  if (!document.getElementById("tv-fonte-geral") && !document.querySelector("[data-tv-tipo]")) return null;
  const tiposMarcados = [...document.querySelectorAll("[data-tv-tipo]:checked")].map((el) => el.getAttribute("data-tv-tipo"));
  const todos = tipos.filter((t) => t.ativo).map((t) => t.id);
  const r = { ...tvCfg };
  r.geral = !!document.getElementById("tv-fonte-geral")?.checked;
  r.tipos = tiposMarcados;
  r.tiposTodos = !!todos.length && tiposMarcados.length === todos.length;
  if (document.getElementById("tv-sem-video")) r.semVideo = !!document.getElementById("tv-sem-video").checked;
  const url = document.getElementById("tv-yt-url")?.value.trim();
  if (url) r.youtube = url;
  r.youtubeSom = !!document.getElementById("tv-yt-som")?.checked;
  const vol = document.getElementById("tv-yt-vol");
  if (vol) r.youtubeVolume = Number(vol.value);
  const voz = document.getElementById("tv-voz")?.value;
  if (voz != null && voz !== "") {
    const google = tvVozGoogleMulher();
    const rec = google || tvVozMulherSistema();
    if (!google && rec && voz === rec.voiceURI && (!tvCfg.vozUri || tvCfg.vozUri === TV_VOZ_PADRAO || voz === tvCfg.vozUri)) {
      r.vozUri = TV_VOZ_PADRAO;
    } else {
      r.vozUri = voz;
    }
  }
  const rate = document.getElementById("tv-voz-rate");
  if (rate) r.vozRate = Number(rate.value) / 100;
  const vvol = document.getElementById("tv-voz-vol");
  if (vvol) r.vozVolume = Number(vvol.value) / 100;
  const seg = document.getElementById("tv-img-seg");
  if (seg) r.imagensSeg = tvSegundos(seg.value, TV_IMG_SEG_PADRAO, 1, 86400);
  const dur = document.getElementById("tv-img-dur");
  if (dur) r.imagensDuracao = tvSegundos(dur.value, TV_IMG_DUR_PADRAO, 1, 86400);
  const gap = document.getElementById("tv-intervalo-chamada");
  if (gap) r.intervaloChamada = tvSegundos(gap.value, TV_INTERVALO_CHAMADA_PADRAO, 0, 120);
  return r;
}

function tvGuardarCfgTela() {
  const r = tvColetarCfgTela();
  if (!r) return;
  Object.assign(tvCfg, r);
  const vol = document.getElementById("tv-yt-vol");
  if (vol) vol.disabled = !tvCfg.youtubeSom;
  salvarTvCfg();
}

async function publicarPainelGeral() {
  if (!sb || !sessao || !ehHoje()) return;
  const { error } = await sb.from("painel_chamadas").insert({
    data: hojeISO(),
    numero: proximoNumero(),
    preferencial: rascunhoEhPref(),
    tipo_id: null,
    senha_id: null,
    origem: "geral",
    chamado_por: sessao.id,
  });
  if (error) console.warn("painel_chamadas", error.message);
}

if (window.speechSynthesis) {
  speechSynthesis.addEventListener("voiceschanged", () => {
    tvAplicarVozPadraoSePreciso();
    const sel = document.getElementById("tv-voz");
    if (!sel || !tvCfgAberta) return;
    const atual = sel.value || tvCfg.vozUri;
    sel.innerHTML = tvOpcoesVoz();
    const rec = (tvVozGoogleMulher() || tvVozMulherSistema())?.voiceURI;
    const alvo = atual === TV_VOZ_PADRAO ? rec : atual;
    if (alvo && [...sel.options].some((o) => o.value === alvo)) sel.value = alvo;
  });
}
