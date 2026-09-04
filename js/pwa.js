(() => {
  const DISMISS_KEY = "senha-jec-pwa-dismiss";
  const bar = document.getElementById("pwa-bar");
  if (!bar) return;

  const texto = bar.querySelector(".pwa-texto");
  const btnInstalar = document.getElementById("pwa-instalar");
  const btnFechar = document.getElementById("pwa-fechar");
  let deferred = null;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (standalone) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    return;
  }

  function ehCelular() {
    const ua = navigator.userAgent || "";
    if (/Android.+Mobile|iPhone|iPod/i.test(ua)) return true;
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
    const ipad = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ipad) return window.matchMedia("(max-width: 900px)").matches;
    return window.matchMedia("(max-width: 800px) and (pointer: coarse)").matches;
  }

  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.MSStream &&
    !navigator.standalone;
  const dismissed = localStorage.getItem(DISMISS_KEY) === "1";

  function mostrar(msg, comBotao) {
    if (!ehCelular()) return;
    texto.textContent = msg;
    btnInstalar.classList.toggle("hidden", !comBotao);
    bar.classList.remove("hidden");
    document.body.classList.add("com-pwa");
  }

  btnFechar.addEventListener("click", () => {
    bar.classList.add("hidden");
    document.body.classList.remove("com-pwa");
    localStorage.setItem(DISMISS_KEY, "1");
  });

  btnInstalar.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    bar.classList.add("hidden");
    document.body.classList.remove("com-pwa");
  });

  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    deferred = ev;
    if (dismissed || !ehCelular()) return;
    mostrar("Quer o Senha JEC na tela inicial? Fica igual um aplicativo.", true);
  });

  window.addEventListener("appinstalled", () => {
    bar.classList.add("hidden");
    document.body.classList.remove("com-pwa");
  });

  if (ios && !dismissed && ehCelular()) {
    mostrar("No celular: toque em Compartilhar e depois em Adicionar à Tela de Início.", false);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
