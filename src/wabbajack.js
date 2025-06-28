const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Get the directory where the executable is located
function getExecutableDir() {
  // Check if we're in development mode
  const isDev =
    process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV || process.execPath.includes("node.exe") || process.execPath.includes("electron.exe");

  if (isDev) {
    // In development, use current directory
    return process.cwd();
  }

  // In production (packaged app), use the directory where the .exe is located
  return path.dirname(process.execPath);
}

// Configuration file to store the Wabbajack path
const configFilePath = path.join(getExecutableDir(), "wabbajack-config.json");

/**
 * Check if Wabbajack is running
 * @returns {Promise<boolean>} True if Wabbajack is running
 */
function isWabbajackRunning() {
  return new Promise((resolve) => {
    // Use a more robust approach that works in different shells
    const command = process.platform === "win32" ? 'tasklist /FI "IMAGENAME eq Wabbajack.exe"' : "ps aux | grep Wabbajack";

    exec(command, { shell: true }, (error, stdout) => {
      if (error) {
        console.log(`Error checking if Wabbajack is running: ${error}`);
        resolve(false);
        return;
      }

      // Check if the output contains Wabbajack.exe
      const isRunning = stdout.includes("Wabbajack.exe");
      console.log(`Wabbajack running check: ${isRunning ? "YES" : "NO"}`);
      console.log(`Command output: ${stdout.trim()}`);
      resolve(isRunning);
    });
  });
}

/**
 * Save the Wabbajack path to configuration file
 * @param {string} wabbajackPath - Path to Wabbajack
 */
function saveWabbajackPath(wabbajackPath) {
  try {
    const config = {
      wabbajackPath: wabbajackPath,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`Saving config to: ${configFilePath}`);
    console.log(`Executable dir: ${getExecutableDir()}`);
    console.log(`Current working dir: ${process.cwd()}`);

    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log(`Wabbajack path saved: ${wabbajackPath}`);
  } catch (error) {
    console.error(`Error saving Wabbajack path: ${error.message}`);
  }
}

/**
 * Load the saved Wabbajack path
 * @returns {string|null} Saved path or null if not found
 */
function loadWabbajackPath() {
  try {
    console.log(`Looking for config at: ${configFilePath}`);
    console.log(`Executable dir: ${getExecutableDir()}`);
    console.log(`Current working dir: ${process.cwd()}`);

    if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath, "utf8");
      const config = JSON.parse(configData);

      if (config.wabbajackPath && fs.existsSync(config.wabbajackPath)) {
        console.log(`Wabbajack path loaded: ${config.wabbajackPath}`);
        return config.wabbajackPath;
      } else {
        console.log("Saved Wabbajack path not found or invalid");
        return null;
      }
    } else {
      console.log("Config file not found");
    }
  } catch (error) {
    console.error(`Error loading Wabbajack path: ${error.message}`);
  }
  return null;
}

/**
 * Get Wabbajack path (loaded or prompt user)
 * @returns {Promise<string|null>} Wabbajack path or null if not available
 */
async function getWabbajackPath() {
  // First, try to load saved path
  let wabbajackPath = loadWabbajackPath();

  if (wabbajackPath) {
    return wabbajackPath;
  }

  // If no saved path, return null (user will select via dialog)
  return null;
}

/**
 * Creates a wrapper script to launch Wabbajack with debugging flag
 * @param {string} wabbajackPath - Path to the Wabbajack executable
 * @returns {Promise<string>} Path to the created script
 */
async function createWabbajackWrapper(wabbajackPath) {
  // Validate path
  if (!wabbajackPath || !fs.existsSync(wabbajackPath)) {
    throw new Error(`Invalid Wabbajack path: ${wabbajackPath}`);
  }

  // Get the Wabbajack directory to place data files nearby
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
echo [INFO] These settings allow AutoWabba to connect to
echo        Wabbajack and automate Nexus Mods downloads.
echo.
echo Starting Wabbajack from: "${wabbajackPath}"
echo Please wait while the application initializes...
echo.
echo [IMPORTANT] You can close this window after Wabbajack starts

rem Create data folder if it doesn't exist
if not exist "%WEBVIEW2_USER_DATA_FOLDER%" mkdir "%WEBVIEW2_USER_DATA_FOLDER%"

rem Launch Wabbajack with the environment variables configured
start "" "${wabbajackPath}"

echo.
echo [TIP] If you have login or CAPTCHA issues:
echo 1. Close Wabbajack and AutoWabba
echo 2. Restart AutoWabba and use 'Launch with Debug' again
echo 3. Previous login should be preserved

rem Wait a bit to ensure user can read the messages
timeout /t 20 /nobreak >nul
exit
`;

  // Write the script to file
  fs.writeFileSync(wrapperPath, scriptContent);

  return wrapperPath;
}

/**
 * Launch Wabbajack with debug settings
 * @param {string} wabbajackPath - Path to Wabbajack executable
 * @returns {Promise<boolean>} True if launched successfully
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
      // Execute wrapper in background to not block
      const child = exec(`"${wrapperPath}"`, (error) => {
        // This callback is only called when wrapper finishes (after 20s)
        // But we don't need to wait for this
      });

      // Wait a bit for Wabbajack to start
      setTimeout(() => {
        console.log("Wrapper executed, Wabbajack should be starting...");
        resolve(true);
      }, 3000); // 3 seconds is enough for Wabbajack to start
    });
  } catch (error) {
    console.error(`Error in launcher: ${error}`);
    return false;
  }
}

module.exports = {
  isWabbajackRunning,
  getWabbajackPath,
  saveWabbajackPath,
  loadWabbajackPath,
  launchWabbajackWithDebug,
};
