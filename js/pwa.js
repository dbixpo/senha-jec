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
  if (standalone) return;

  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.MSStream &&
    !navigator.standalone;
  const dismissed = localStorage.getItem(DISMISS_KEY) === "1";

  function mostrar(msg, comBotao) {
    texto.textContent = msg;
    btnInstalar.classList.toggle("hidden", !comBotao);
    bar.classList.remove("hidden");
  }

  btnFechar.addEventListener("click", () => {
    bar.classList.add("hidden");
    localStorage.setItem(DISMISS_KEY, "1");
  });

  btnInstalar.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    bar.classList.add("hidden");
  });

  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    deferred = ev;
    if (dismissed) return;
    mostrar("Quer instalar o Senha JEC na tela inicial? Fica igual um aplicativo.", true);
  });

  window.addEventListener("appinstalled", () => {
    bar.classList.add("hidden");
  });

  if (ios && !dismissed) {
    mostrar("No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.", false);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
