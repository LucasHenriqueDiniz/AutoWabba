const http = require("http");

/**
 * Check if browser is available on debug port
 * @returns {Promise<Array|null>} List of pages or null if not available
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
              resolve(null);
              return;
            }

            const pages = JSON.parse(data);
            resolve(pages);
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on("error", (err) => {
        resolve(null);
      });

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Find Nexus Mods download page
 * @param {Array} pages - List of browser pages
 * @returns {Object|null} Download page or null if not found
 */
async function findTargetPage(pages) {
  return pages?.find((page) => page.type === "page" && page.url.includes("nexusmods.com") && page.url.includes("tab=files"));
}

/**
 * Verifica se a porta 9222 está em uso ou bloqueada por outro processo
 * @returns {Promise<{isInUse: boolean, process: string|null}>} Resultado da verificação
 */
async function checkDebuggingPortStatus() {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    // Comando para verificar processos usando a porta 9222
    exec('netstat -ano | findstr ":9222"', (error, stdout) => {
      if (error) {
        // Erro ao executar o comando (provavelmente não encontrou nenhuma conexão)
        resolve({ isInUse: false, process: null });
        return;
      }

      const lines = stdout.split("\n").filter(Boolean);
      if (lines.length === 0) {
        // Nenhum processo encontrado usando a porta
        resolve({ isInUse: false, process: null });
        return;
      }

      // Extrair PID do processo usando a porta
      // O formato da saída é algo como: TCP 127.0.0.1:9222 0.0.0.0:0 LISTENING 12345
      try {
        const pidMatches = lines[0].match(/\s+(\d+)\s*$/);
        if (pidMatches && pidMatches[1]) {
          const pid = pidMatches[1].trim();

          // Encontrar o nome do processo
          exec(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, (err, processOutput) => {
            if (err) {
              resolve({ isInUse: true, process: `Unknown (PID: ${pid})` });
              return;
            }

            // Formato: "chrome.exe","12345",...
            const processNameMatch = processOutput.match(/"([^"]+)"/);
            const processName = processNameMatch ? processNameMatch[1] : `Unknown (PID: ${pid})`;

            resolve({ isInUse: true, process: processName });
          });
        } else {
          resolve({ isInUse: true, process: "Unknown" });
        }
      } catch (e) {
        console.error("Error parsing netstat output:", e);
        resolve({ isInUse: true, process: "Error identifying" });
      }
    });
  });
}

module.exports = {
  checkBrowserAvailability,
  findTargetPage,
  checkDebuggingPortStatus,
};
