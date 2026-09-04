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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  if (standalone) return;

  function ehIOS() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPod/i.test(ua)) return true;
    if (/iPad/i.test(ua)) return true;
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function ehCelular() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return true;
    return window.matchMedia("(max-width: 800px) and (pointer: coarse)").matches;
  }

  const dismissed = localStorage.getItem(DISMISS_KEY) === "1";

  function esconder() {
    bar.classList.add("hidden");
    document.body.classList.remove("com-pwa");
  }

  function mostrar(msg, comBotao) {
    if (!ehCelular() || standalone) return;
    texto.textContent = msg;
    btnInstalar.classList.toggle("hidden", !comBotao);
    bar.classList.remove("hidden");
    document.body.classList.add("com-pwa");
  }

  function sugerir() {
    if (!ehCelular() || dismissed || standalone) return;
    if (ehIOS()) {
      mostrar("No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.", false);
      return;
    }
    mostrar("Quer o Senha JEC na tela inicial? Fica igual um aplicativo.", true);
  }

  btnFechar.addEventListener("click", () => {
    esconder();
    localStorage.setItem(DISMISS_KEY, "1");
  });

  btnInstalar.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      esconder();
      return;
    }
    mostrar("No Chrome: toque no menu ⋮ e depois em Instalar app.", false);
  });

  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    if (!ehCelular()) return;
    deferred = ev;
    if (!dismissed) sugerir();
  });

  window.addEventListener("appinstalled", esconder);

  sugerir();
})();
