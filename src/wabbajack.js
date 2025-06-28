const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { dialog } = require("electron");

// Common locations where Wabbajack might be installed
const possibleWabbajackPaths = [
  path.join(process.env.LOCALAPPDATA, "Wabbajack", "Wabbajack.exe"),
  path.join("C:", "Program Files", "Wabbajack", "Wabbajack.exe"),
  path.join("C:", "Program Files (x86)", "Wabbajack", "Wabbajack.exe"),
  path.join(process.env.USERPROFILE, "Downloads", "Wabbajack", "Wabbajack.exe"),
  path.join(process.env.APPDATA, "Wabbajack", "Wabbajack.exe"),
];

/**
 * Check if Wabbajack is running
 * @returns {Promise<boolean>} True if Wabbajack is running
 */
function isWabbajackRunning() {
  return new Promise((resolve) => {
    exec('tasklist /fi "imagename eq Wabbajack.exe" /fo csv /nh', (error, stdout) => {
      if (error) {
        console.error(`Error checking if Wabbajack is running: ${error}`);
        resolve(false);
        return;
      }

      resolve(stdout.includes("Wabbajack.exe"));
    });
  });
}

/**
 * Launch Wabbajack
 * @returns {Promise<boolean>} True if launched successfully or already running
 */
async function launchWabbajack() {
  try {
    // Verificar se o Wabbajack já está em execução
    const isRunning = await isWabbajackRunning();
    if (isRunning) {
      console.log("Wabbajack is already running");
      return true;
    }

    // Tenta encontrar o caminho do Wabbajack ou pedir ao usuário
    let wabbajackPath;
    try {
      wabbajackPath = await findWabbajackPath();
    } catch (error) {
      console.log(`Error finding Wabbajack: ${error.message}`);
      return false;
    }

    if (!wabbajackPath) {
      console.log("Wabbajack executable not found");
      return false;
    }

    // Usa o launcher com debug flag em vez do método direto
    const { launchWabbajackWithDebug } = require("./launcher");
    const success = await launchWabbajackWithDebug(wabbajackPath);

    if (!success) {
      console.log("Failed to launch Wabbajack with debug wrapper");
      // Fallback para o método tradicional se o wrapper falhar
      return new Promise((resolve) => {
        exec(`start "" "${wabbajackPath}"`, (error) => {
          if (error) {
            console.log(`Could not auto-launch Wabbajack: ${error}`);
            resolve(false);
          } else {
            console.log("Wabbajack launched with fallback method");
            setTimeout(async () => {
              const nowRunning = await isWabbajackRunning();
              resolve(nowRunning);
            }, 2000);
          }
        });
      });
    }

    console.log("Wabbajack launch initiated with debug wrapper");

    // Verificar se o processo está realmente rodando após um tempo
    return new Promise((resolve) => {
      setTimeout(async () => {
        const nowRunning = await isWabbajackRunning();
        resolve(nowRunning);
      }, 3000);
    });
  } catch (error) {
    console.log(`Error in launchWabbajack: ${error}`);
    return false;
  }
}

module.exports = {
  isWabbajackRunning,
  findWabbajackPath,
  launchWabbajack,
};
