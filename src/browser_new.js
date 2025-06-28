const http = require("http");

/**
 * Verifica se o browser está disponível na porta de debug
 * @returns {Promise<Array|null>} Lista de páginas ou null se não disponível
 */
async function checkBrowserAvailability() {
  return new Promise((resolve) => {
    const req = http
      .get("http://localhost:9222/json/list", { timeout: 5000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              console.log(`Erro ao conectar na porta de debug: Status ${res.statusCode}`);
              resolve(null);
              return;
            }

            const pages = JSON.parse(data);
            console.log(`Encontradas ${pages.length} páginas no browser`);
            resolve(pages);
          } catch (e) {
            console.error("Erro ao processar resposta do browser:", e.message);
            resolve(null);
          }
        });
      })
      .on("error", (err) => {
        if (err.code === "ECONNREFUSED") {
          console.log("Porta de debug 9222 não está disponível");
        } else if (err.code === "ETIMEDOUT") {
          console.log("Timeout na conexão com porta de debug");
        } else {
          console.log(`Erro de conexão (${err.code}): ${err.message}`);
        }
        resolve(null);
      });

    req.on("timeout", () => {
      console.log("Timeout na requisição após 5 segundos");
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Encontra a página de download do Nexus Mods
 * @param {Array} pages - Lista de páginas do browser
 * @returns {Object|null} Página de download ou null se não encontrada
 */
async function findTargetPage(pages) {
  return pages?.find((page) => page.type === "page" && page.url.includes("nexusmods.com") && page.url.includes("tab=files"));
}

module.exports = {
  checkBrowserAvailability,
  findTargetPage,
};
