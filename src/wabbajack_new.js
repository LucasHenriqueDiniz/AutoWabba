const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { launchWabbajackWithDebug } = require("./launcher");

// Arquivo de configuração para salvar o caminho do Wabbajack
const configFilePath = path.join(process.cwd(), "wabbajack-config.json");

/**
 * Verifica se o Wabbajack está em execução
 * @returns {Promise<boolean>} True se o Wabbajack está rodando
 */
function isWabbajackRunning() {
  return new Promise((resolve) => {
    exec('tasklist /fi "imagename eq Wabbajack.exe" /fo csv /nh', (error, stdout) => {
      if (error) {
        console.log(`Erro ao verificar se Wabbajack está rodando: ${error}`);
        resolve(false);
        return;
      }
      resolve(stdout.includes("Wabbajack.exe"));
    });
  });
}

/**
 * Salva o caminho do Wabbajack no arquivo de configuração
 * @param {string} wabbajackPath - Caminho do Wabbajack
 */
function saveWabbajackPath(wabbajackPath) {
  try {
    const config = {
      wabbajackPath: wabbajackPath,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log(`Caminho do Wabbajack salvo: ${wabbajackPath}`);
  } catch (error) {
    console.error(`Erro ao salvar caminho do Wabbajack: ${error.message}`);
  }
}

/**
 * Carrega o caminho salvo do Wabbajack
 * @returns {string|null} Caminho salvo ou null se não existir
 */
function loadWabbajackPath() {
  try {
    if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath, "utf8");
      const config = JSON.parse(configData);

      if (config.wabbajackPath && fs.existsSync(config.wabbajackPath)) {
        console.log(`Caminho do Wabbajack carregado: ${config.wabbajackPath}`);
        return config.wabbajackPath;
      } else {
        console.log("Caminho salvo do Wabbajack não encontrado ou inválido");
        return null;
      }
    }
  } catch (error) {
    console.error(`Erro ao carregar caminho do Wabbajack: ${error.message}`);
  }

  return null;
}

/**
 * Solicita ao usuário que escolha o caminho do Wabbajack
 * @returns {Promise<string|null>} Caminho escolhido ou null se cancelado
 */
async function promptWabbajackPath() {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n=== Seleção do Wabbajack ===");
    console.log("Por favor, forneça o caminho completo para o Wabbajack.exe");
    console.log("Exemplo: C:\\Users\\Usuario\\Downloads\\Wabbajack.exe");
    console.log("Ou pressione Enter para cancelar\n");

    rl.question("Caminho do Wabbajack: ", (input) => {
      rl.close();

      const path = input.trim();
      if (!path) {
        console.log("Seleção cancelada pelo usuário");
        resolve(null);
        return;
      }

      if (!fs.existsSync(path)) {
        console.log("Arquivo não encontrado. Verifique o caminho.");
        resolve(null);
        return;
      }

      if (!path.toLowerCase().endsWith("wabbajack.exe")) {
        console.log("Arquivo deve ser Wabbajack.exe");
        resolve(null);
        return;
      }

      resolve(path);
    });
  });
}

/**
 * Obtém o caminho do Wabbajack (carregado ou solicitado ao usuário)
 * @returns {Promise<string|null>} Caminho do Wabbajack ou null se não disponível
 */
async function getWabbajackPath() {
  // Primeiro, tenta carregar o caminho salvo
  let wabbajackPath = loadWabbajackPath();

  if (wabbajackPath) {
    return wabbajackPath;
  }

  // Se não há caminho salvo, solicita ao usuário
  console.log("Caminho do Wabbajack não configurado.");
  wabbajackPath = await promptWabbajackPath();

  if (wabbajackPath) {
    saveWabbajackPath(wabbajackPath);
    return wabbajackPath;
  }

  return null;
}

module.exports = {
  isWabbajackRunning,
  getWabbajackPath,
  saveWabbajackPath,
  loadWabbajackPath,
  launchWabbajackWithDebug,
};
