const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");

/**
 * Creates a wrapper script to launch Wabbajack with debugging flag
 * @param {string} wabbajackPath - Path to the Wabbajack executable
 * @returns {Promise<string>} Path to the created script
 */
async function createWabbajackWrapper(wabbajackPath) {
  // Validate path
  if (!wabbajackPath || !fs.existsSync(wabbajackPath)) {
    throw new Error(`Invalid Wabbajack path: ${wabbajackPath}`);
  } // Get the Wabbajack directory to place data files nearby
  const wabbajackDir = path.dirname(wabbajackPath);

  // Create a persistent directory for AutoWabba adjacent to Wabbajack
  const appDataDir = path.join(wabbajackDir, "AutoWabba");
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }

  // Create persistent subdirectory for WebView2 data to save login info
  const webview2DataDir = path.join(appDataDir, "webview2data");
  if (!fs.existsSync(webview2DataDir)) {
    fs.mkdirSync(webview2DataDir, { recursive: true });
  }

  // Create temporary directory for the script
  const tempDir = path.join(os.tmpdir(), "autowabba");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  // Path for the wrapper script with timestamp to avoid conflicts
  const wrapperPath = path.join(tempDir, `launch_wabbajack_${Date.now()}.bat`);

  // Script content with debug options for better compatibility
  const scriptContent = `@echo off
echo ======================================================
echo  AutoWabba Launcher - Wabbajack Debug Edition
echo ======================================================
echo.

rem Set environment variables to configure WebView2
set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
set WEBVIEW2_USER_DATA_FOLDER=${webview2DataDir.replace(/\\/g, "\\\\")}
set WEBVIEW2_BROWSER_ARGS=--remote-debugging-port=9222

echo WebView2 debugging settings:
echo - Debug port: 9222
echo - Data folder: %WEBVIEW2_USER_DATA_FOLDER%
echo.
echo [INFO] Estas configurações permitem que o AutoWabba conecte ao
echo        Wabbajack e automatize os downloads do Nexus Mods.
echo.
echo Iniciando Wabbajack de: "${wabbajackPath}"
echo Por favor aguarde enquanto o aplicativo inicializa...
echo.
echo [IMPORTANTE] Você pode fechar esta janela após o Wabbajack iniciar

rem Create data folder if it doesn't exist
if not exist "%WEBVIEW2_USER_DATA_FOLDER%" mkdir "%WEBVIEW2_USER_DATA_FOLDER%"

rem Launch Wabbajack with the environment variables configured
start "" "${wabbajackPath}"

echo.
echo [DICA] Se tiver problemas com login ou CAPTCHA:
echo 1. Feche o Wabbajack e AutoWabba
echo 2. Reinicie AutoWabba e use 'Launch with Debug' novamente
echo 3. O login anterior deve ser preservado

rem Wait a bit to ensure user can read the messages
timeout /t 20 /nobreak >nul
exit
`;

  // Write the script to file
  fs.writeFileSync(wrapperPath, scriptContent);

  return wrapperPath;
}

/**
 * Launches Wabbajack through the debug wrapper
 * @param {string} wabbajackPath - Path to the Wabbajack executable
 * @returns {Promise<boolean>} true if successfully executed
 */
async function launchWabbajackWithDebug(wabbajackPath) {
  try {
    if (!wabbajackPath) {
      console.error("Wabbajack path not specified");
      return false;
    }

    console.log(`Preparing wrapper for Wabbajack: ${wabbajackPath}`);
    const wrapperPath = await createWabbajackWrapper(wabbajackPath);

    if (!wrapperPath) {
      console.error("Failed to create wrapper for Wabbajack");
      return false;
    }

    console.log(`Executing wrapper from: ${wrapperPath}`);

    return new Promise((resolve) => {
      // Executar o wrapper em background para não bloquear
      const child = exec(`"${wrapperPath}"`, (error) => {
        // Este callback só é chamado quando o wrapper termina (após 20s)
        // Mas não precisamos esperar por isso
      });

      // Aguardar um pouco para o Wabbajack iniciar
      setTimeout(() => {
        console.log("Wrapper executed, Wabbajack should be starting...");
        resolve(true);
      }, 3000); // 3 segundos é suficiente para o Wabbajack começar
    });
  } catch (error) {
    console.error(`Error in launcher: ${error}`);
    return false;
  }
}

module.exports = {
  createWabbajackWrapper,
  launchWabbajackWithDebug,
};
