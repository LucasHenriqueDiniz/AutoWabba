const http = require("http");

async function checkBrowserAvailability() {
  return new Promise((resolve) => {
    // Set timeout to avoid hanging requests
    const req = http
      .get("http://localhost:9222/json/list", { timeout: 5000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              console.log(`Error connecting to debugging port: Status code ${res.statusCode}`);
              console.log(`Response data: ${data}`);
              resolve(null);
              return;
            }

            const pages = JSON.parse(data);
            console.log(`Found ${pages.length} pages in Edge browser`);
            // Fornecer mais diagnóstico sobre os tipos de páginas detectadas
            if (pages.length > 0) {
              const types = {};
              pages.forEach((p) => {
                types[p.type] = (types[p.type] || 0) + 1;
              });
              console.log(`Page types detected: ${JSON.stringify(types)}`);
            }
            resolve(pages);
          } catch (e) {
            console.error("Error parsing browser response:", e.message);
            console.error(`Raw data received: ${data.substring(0, 100)}...`);
            resolve(null);
          }
        });
      })
      .on("error", (err) => {
        // Mostrar mensagens de erro mais específicas
        if (err.code === "ECONNREFUSED") {
          console.error("Connection refused: Debugging port 9222 is not open or accepting connections");
        } else if (err.code === "ETIMEDOUT") {
          console.error("Connection timed out: Debugging port 9222 might be blocked by firewall or not responding");
        } else {
          console.error(`Connection error (${err.code}): ${err.message}`);
        }
        resolve(null);
      });

    // Garantir que a requisição não fique pendente
    req.on("timeout", () => {
      console.error("Request timed out after 3 seconds");
      req.destroy();
      resolve(null);
    });
  });
}

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
