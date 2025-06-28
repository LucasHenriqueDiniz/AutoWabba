/**
 * AutoWabba - Automatic Download Helper for Wabbajack
 *
 * This application automates the process of downloading mods from Nexus Mods
 * when using Wabbajack mod lists by automatically clicking download buttons.
 *
 * @author Lucas Henrique Diniz
 * @license MIT
 */

// Define WebView2 debug port BEFORE any imports
// This ensures that any WebView2 instance created later will start with this configuration
// Simplificado para usar apenas a porta de depuração, que é o essencial para a funcionalidade
process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222";
process.env.WEBVIEW2_BROWSER_ARGS = "--remote-debugging-port=9222";

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const { checkBrowserAvailability, findTargetPage } = require("./src/browser");
const { performClick } = require("./src/downloader");
const { isWabbajackRunning, launchWabbajack, findWabbajackPath } = require("./src/wabbajack");
const { launchWabbajackWithDebug } = require("./src/launcher");
const { chromium } = require("playwright");

// Application state
let mainWindow;
let isRunning = false;
let stopRequested = false;
let selectedWabbajackPath = null;

// Configuration file to store the Wabbajack path
const configFilePath = path.join(app.getPath("userData"), "autowabba-config.json");

/**
 * Save the Wabbajack path to the configuration file
 * @param {string} wjPath - Path to Wabbajack
 */
function saveWabbajackPath(wjPath) {
  try {
    const config = {
      wabbajackPath: wjPath,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log(`Wabbajack path saved: ${wjPath}`);
  } catch (error) {
    console.error(`Error saving Wabbajack path: ${error.message}`);
  }
}

/**
 * Load the saved Wabbajack path
 * @returns {string|null} The saved Wabbajack path or null if it doesn't exist
 */
function loadWabbajackPath() {
  try {
    if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath, "utf8");
      const config = JSON.parse(configData);

      if (config.wabbajackPath && fs.existsSync(config.wabbajackPath)) {
        console.log(`Loaded Wabbajack path: ${config.wabbajackPath}`);
        return config.wabbajackPath;
      } else {
        console.log("Saved Wabbajack path not found or invalid");
        return null;
      }
    }
  } catch (error) {
    console.error(`Error loading Wabbajack path: ${error.message}`);
  }

  return null;
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 540,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    resizable: false,
    transparent: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#242424",
  });
  mainWindow.loadFile("src/interface.html");

  // Allow opening external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  // Check if Wabbajack is available at startup and try to find its path
  setTimeout(async () => {
    try {
      // First, try to load saved path
      const savedPath = loadWabbajackPath();

      if (savedPath) {
        selectedWabbajackPath = savedPath;
        mainWindow.webContents.send("wabbajack-selected", savedPath);
        mainWindow.webContents.send("log-message", `Wabbajack loaded from configuration: ${savedPath}`);
      } else {
        // If no saved path, try to find automatically
        try {
          const wjPath = await findWabbajackPath();
          if (wjPath) {
            selectedWabbajackPath = wjPath;
            saveWabbajackPath(wjPath);
            mainWindow.webContents.send("wabbajack-selected", wjPath);
            mainWindow.webContents.send("log-message", `Wabbajack found at: ${wjPath}`);
          } else {
            mainWindow.webContents.send("log-message", "Wabbajack not found automatically. Please select the executable manually.");
          }
        } catch (wjError) {
          mainWindow.webContents.send("log-message", "To get started, please select the Wabbajack executable.");
        }
      }

      // Check if browser is available
      const pages = await checkBrowserAvailability();
      if (!pages) {
        mainWindow.webContents.send("log-message", "Debug connection not found. Launch Wabbajack with 'Launch with Debug'.");
        mainWindow.webContents.send("browser-status", "unavailable");
      } else {
        mainWindow.webContents.send("log-message", "Debug connection found! Ready for automation.");
        mainWindow.webContents.send("browser-status", "available");
      }
    } catch (error) {
      mainWindow.webContents.send("log-message", `Error checking browser: ${error.message}`);
      mainWindow.webContents.send("browser-status", "error");
    }
  }, 1000);
});

// Setup Edge in debugging mode
ipcMain.on("setup-browser", async (event) => {
  event.reply("log-message", "Configuring debugging port...");

  // First check if it's already working
  const initialPages = await checkBrowserAvailability();
  if (initialPages) {
    event.reply("log-message", "Debug connection already working! No changes needed.");
    event.reply("browser-status", "available");
    event.reply("setup-complete");
    return;
  }

  // Configurar portas de debug através de registro e variáveis de ambiente
  await setupDebugPort(event);

  // Verificar se é necessário reiniciar os processos do Edge
  event.reply("log-message", "Checking if Edge processes need to be restarted...");

  // Construir comandos que verificam processos em execução
  const checkEdgeCmd = 'tasklist /fi "imagename eq msedge.exe" /fo csv /nh';
  const checkWebviewCmd = 'tasklist /fi "imagename eq msedgewebview2.exe" /fo csv /nh';

  exec(checkEdgeCmd, async (_, stdout) => {
    const edgeRunning = stdout.includes("msedge.exe");

    exec(checkWebviewCmd, async (_, stdout) => {
      const webviewRunning = stdout.includes("msedgewebview2.exe");

      if (edgeRunning || webviewRunning) {
        event.reply("log-message", "Edge processes found. Restarting them to apply debug settings...");

        // If processes exist, close them and restart
        exec("taskkill /f /im msedge.exe /t 2>nul & taskkill /f /im msedgewebview2.exe /t 2>nul", async () => {
          // Launch Edge with debug port
          const edgeLaunch = `start "" microsoft-edge:http://localhost:9222`;
          exec(edgeLaunch);

          event.reply("log-message", "Edge restarted with debug port. Checking connection in 5 seconds...");

          // Verificar após um delay
          setTimeout(async () => {
            const pages = await checkBrowserAvailability();
            if (pages) {
              event.reply("log-message", "Debug connection confirmed! You can now use AutoWabba.");
              event.reply("browser-status", "available");
            } else {
              event.reply("log-message", "Debug connection not detected. Wabbajack may need to be restarted to pick up the changes.");
              event.reply("browser-status", "unavailable");

              // Verificar se Wabbajack está rodando e sugerir reiniciar
              const wjRunning = await isWabbajackRunning();
              if (wjRunning) {
                event.reply("log-message", "Wabbajack is running. Please close and restart it to apply debug settings.");
              }
            }
            event.reply("setup-complete");
          }, 5000);
        });
      } else {
        event.reply("log-message", "No Edge processes found. Launch Wabbajack to use the debug port.");
        event.reply("setup-complete");

        // Verificar diretamente após setup
        setTimeout(async () => {
          const pages = await checkBrowserAvailability();
          event.reply("browser-status", pages ? "available" : "unavailable");
        }, 2000);
      }
    });
  });
});

// Start the automation process
ipcMain.on("start-automation", async (event) => {
  if (isRunning) {
    event.reply("log-message", "Automation is already running");
    return;
  }
  // Check connection before starting
  const pages = await checkBrowserAvailability();
  if (!pages) {
    event.reply("log-message", "Wabbajack not detected. Please make sure Wabbajack is open before starting.");
    return;
  }

  isRunning = true;
  stopRequested = false;
  event.reply("status-update", "running");
  event.reply("log-message", "Starting download automation...");
  let lastClickedUrl = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;
  const COOLDOWN_TIME = 6000;
  let lastBrowserStatus = null;
  while (isRunning && !stopRequested) {
    try {
      const pages = await checkBrowserAvailability();
      // Update browser status to update button state, but only send log message if status changed
      const currentStatus = pages ? "available" : "unavailable";
      if (currentStatus !== lastBrowserStatus) {
        lastBrowserStatus = currentStatus;
        event.reply("browser-status", currentStatus);
        if (!pages) {
          event.reply("log-message", "Browser not found. Checking if Wabbajack is running...");
          // Try to launch Wabbajack if not running
          const wjRunning = await isWabbajackRunning();
          if (!wjRunning) {
            event.reply("log-message", "Wabbajack not running. Attempting to start it...");
            await launchWabbajack();
            event.reply("log-message", "Waiting for Wabbajack to initialize...");
          } else {
            event.reply("log-message", "Wabbajack is running but debugging port not available. Run Setup Browser again.");
          }
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
      }

      const targetPage = await findTargetPage(pages);

      if (targetPage) {
        if (lastClickedUrl === targetPage.url) {
          attempts++;
          if (attempts >= MAX_ATTEMPTS) {
            event.reply("log-message", "Download seems stuck. Resetting and trying again...");
            lastClickedUrl = null;
            attempts = 0;
          } else {
            event.reply("log-message", "Download still in progress... Waiting for completion");
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
        } else {
          attempts = 0;
        }

        event.reply("log-message", "Download page found! Starting download...");
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const clickResult = await performClick(browser, targetPage);

        if (clickResult) {
          lastClickedUrl = clickResult;
          attempts = 0; // Reset attempts when download starts
          event.reply("log-message", `Download started! Waiting ${COOLDOWN_TIME / 1000}s...`);
          await browser.close();
          await new Promise((r) => setTimeout(r, COOLDOWN_TIME));
        } else {
          event.reply("log-message", "Failed to click download button. Trying again...");
          await browser.close();
          await new Promise((r) => setTimeout(r, 2000));
        }
      } else {
        if (lastClickedUrl) {
          const isStillOpen = pages.some((p) => p.url === lastClickedUrl);
          if (isStillOpen) {
            event.reply("log-message", "Download still in progress... Waiting for completion");
          } else {
            lastClickedUrl = null;
            event.reply("log-message", "Waiting for new download page...");
          }
        } else {
          event.reply("log-message", "Waiting for download page...");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      event.reply("log-message", `Error: ${error.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  isRunning = false;
  event.reply("status-update", "stopped");
  event.reply("log-message", "Automation stopped");
});

// Stop the automation
ipcMain.on("stop-automation", (event) => {
  if (!isRunning) {
    event.reply("log-message", "Automation is not running");
    return;
  }

  stopRequested = true;
  event.reply("log-message", "Request to stop automation received");
});

// Custom window event handling
ipcMain.on("minimize-window", () => {
  mainWindow.minimize();
});

ipcMain.on("close-window", () => {
  app.quit();
});

ipcMain.on("open-github", () => {
  shell.openExternal("https://github.com/LucasHenriqueDiniz/AutoWabba");
});

// Check browser availability when requested by renderer
ipcMain.on("check-browser", async (event) => {
  try {
    const pages = await checkBrowserAvailability();
    if (!pages) {
      event.reply("log-message", "Browser not found. Checking if Wabbajack is running...");

      // Check if Wabbajack is running, if not try to launch it
      const wjRunning = await isWabbajackRunning();
      if (!wjRunning) {
        event.reply("log-message", "Wabbajack not detected. Trying to launch it automatically...");
        const launched = await launchWabbajack();
        if (launched) {
          event.reply("log-message", "Wabbajack launched. Waiting for it to initialize...");
          // Wait for Wabbajack to initialize
          setTimeout(async () => {
            const pagesAfterLaunch = await checkBrowserAvailability();
            if (pagesAfterLaunch) {
              event.reply("log-message", "Browser connection established successfully!");
              event.reply("browser-status", "available");
            } else {
              event.reply("log-message", "Browser not found. Please set up the browser first or restart Wabbajack.");
              event.reply("browser-status", "unavailable");
            }
          }, 5000);
        } else {
          event.reply("log-message", "Browser not found and could not launch Wabbajack. Please set up the browser first.");
          event.reply("browser-status", "unavailable");
        }
      } else {
        event.reply("log-message", "Wabbajack is running but browser connection failed. Please set up the browser first.");
        event.reply("browser-status", "unavailable");
      }
    } else {
      event.reply("log-message", "Browser found. Ready to start automation.");
      event.reply("browser-status", "available");
    }
  } catch (error) {
    event.reply("log-message", `Error checking browser: ${error.message}`);
    event.reply("browser-status", "error");
  }
});

// Auto-setup process for browser and Wabbajack
ipcMain.on("auto-setup", async (event) => {
  event.reply("setup-status", "Setting up", "Starting automatic setup process...");

  try {
    // Step 1: Aplicar configurações de debug independente de qualquer coisa
    event.reply("setup-status", "Setting up", "Applying debug port configuration...");
    await setupDebugPort(event);

    // Step 2: Check if browser connection is working (pode funcionar se já estiver configurado)
    const pages = await checkBrowserAvailability();
    if (pages) {
      event.reply("setup-status", "Ready", "Browser already configured and ready.");
      event.reply("browser-status", "available");
      event.reply("setup-complete");
      return;
    }

    // Step 3: Check if Wabbajack is running
    const wjRunning = await isWabbajackRunning();
    if (wjRunning) {
      event.reply("setup-status", "Setting up", "Wabbajack is running but debug port is not available. Restarting Wabbajack...");

      // Close Wabbajack
      exec("taskkill /f /im Wabbajack.exe /t", async (error) => {
        // Wait a moment for process to be fully terminated
        await new Promise((r) => setTimeout(r, 2000));

        // Launch Wabbajack again (as the WebView will inherit our env vars now)
        const launched = await launchWabbajack();
        if (launched) {
          event.reply("setup-status", "Setting up", "Wabbajack launched. Waiting for initialization...");

          // Wait for Wabbajack to initialize and check connection
          await checkConnectionAfterDelay(event, 10000); // 10 second timeout
        } else {
          event.reply("setup-status", "Ready", "Wabbajack not found or couldn't be launched automatically. Please start Wabbajack manually to use AutoWabba.");
          event.reply("setup-complete");
        }
      });
    } else {
      // Wabbajack not running, tentar iniciar
      event.reply("setup-status", "Setting up", "Launching Wabbajack...");
      const launched = await launchWabbajack();

      if (launched) {
        event.reply("setup-status", "Setting up", "Wabbajack launched. Waiting for initialization...");
        await checkConnectionAfterDelay(event, 10000); // 10 second timeout
      } else {
        event.reply("setup-status", "Ready", "Wabbajack not found or couldn't be launched automaticamente. Por favor, inicie o Wabbajack manualmente.");
        event.reply("setup-complete");
      }
    }
  } catch (error) {
    event.reply("log-message", `Error in auto-setup: ${error.message}`);
    event.reply("setup-status", "Error", "Setup failed. Please try again.");
    event.reply("setup-complete");
  }
});

/**
 * Set up the browser debugging port
 * @param {Electron.IpcMainEvent} event - The IPC event
 * @returns {Promise<void>}
 */
async function setupDebugPort(event) {
  return new Promise(async (resolve) => {
    // Check if port is already in use by another process
    const { checkDebuggingPortStatus } = require("./src/browser");
    const portStatus = await checkDebuggingPortStatus();

    if (portStatus.isInUse) {
      event.reply("log-message", `Debug port 9222 is already in use by: ${portStatus.process}. This may cause conflicts.`);
    }

    // Set up the environment variables for this process
    event.reply("log-message", "Configuring WebView2 debugging environment...");

    // Set environment variables for current process
    process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222";
    process.env.WEBVIEW2_BROWSER_ARGS = "--remote-debugging-port=9222"; // Use a persistent directory if Wabbajack path is selected, otherwise use temp directory
    let webview2DataDir;
    if (selectedWabbajackPath) {
      const wabbajackDir = path.dirname(selectedWabbajackPath);
      const appDataDir = path.join(wabbajackDir, "AutoWabba");
      webview2DataDir = path.join(appDataDir, "webview2data");
    } else {
      webview2DataDir = path.join(os.tmpdir(), "autowabba", "webview2data");
    }

    if (!fs.existsSync(webview2DataDir)) {
      fs.mkdirSync(webview2DataDir, { recursive: true });
    }
    process.env.WEBVIEW2_USER_DATA_FOLDER = webview2DataDir;

    event.reply("log-message", "WebView2 debug environment configured for current session.");

    // Check if the port is already available
    checkBrowserAvailability().then((pages) => {
      if (pages) {
        event.reply("log-message", "Debug connection already active with " + pages.length + " pages!");
        resolve(true);
      } else {
        event.reply("log-message", "Debug connection not detected yet. Launch Wabbajack using the 'Launch with Debug' button.");
        resolve(false);
      }
    });
  });
}

/**
 * Check browser connection after a specified delay
 * @param {Electron.IpcMainEvent} event - The IPC event
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<void>}
 */
async function checkConnectionAfterDelay(event, timeout) {
  // Wait for specified time
  await new Promise((r) => setTimeout(r, timeout));

  // Check connection
  const pages = await checkBrowserAvailability();
  if (pages) {
    event.reply("setup-status", "Ready", "Browser connection established successfully!");
    event.reply("browser-status", "available");
    event.reply("setup-complete");
  } else {
    event.reply("setup-status", "Ready", "Browser connection couldn't be established automatically. You may need to set up manually.");
    event.reply("browser-status", "unavailable");
    event.reply("setup-complete");
  }
}

// Manually select the Wabbajack executable
ipcMain.on("select-wabbajack", async (event) => {
  try {
    // Use the findWabbajackPath function to open the file selector
    const wjPath = await findWabbajackPath();

    if (wjPath) {
      selectedWabbajackPath = wjPath;
      event.reply("log-message", `Wabbajack selected: ${wjPath}`);

      // Save the path for future use
      saveWabbajackPath(wjPath);

      // Create the wrapper script
      const { createWabbajackWrapper } = require("./src/launcher");
      const wrapperPath = await createWabbajackWrapper(wjPath);

      event.reply("log-message", "Debug launch script created successfully");
      event.reply("wabbajack-selected", wjPath);
    } else {
      event.reply("log-message", "No Wabbajack executable selected");
    }
  } catch (error) {
    event.reply("log-message", `Erro ao selecionar Wabbajack: ${error.message}`);
  }
});

// Launch Wabbajack with debug settings
ipcMain.on("launch-wabbajack", async (event) => {
  try {
    // First check if Wabbajack is already running
    const isRunning = await isWabbajackRunning();
    if (isRunning) {
      event.reply("log-message", "Wabbajack is already running. Close it first to start with debug settings.");
      return;
    }

    // If path was manually selected, use it. Otherwise, look automatically.
    const wjPath = selectedWabbajackPath || (await findWabbajackPath().catch(() => null));

    if (!wjPath) {
      event.reply("log-message", "Wabbajack path not found. Please select it manually.");
      return;
    }
    event.reply("log-message", `Iniciando Wabbajack com configurações de depuração de: ${wjPath}`);
    event.reply("log-message", "Seus dados de login e CAPTCHAs agora são salvos em um local persistente ao lado do Wabbajack.");
    event.reply("log-message", "Se encontrar problemas, feche tudo e reinicie pelo AutoWabba novamente.");
    const launched = await launchWabbajackWithDebug(wjPath);
    if (launched) {
      event.reply("log-message", "Wabbajack started successfully. Waiting for initialization...");

      // Wait a few seconds and check the connection
      setTimeout(async () => {
        const isNowRunning = await isWabbajackRunning();
        if (!isNowRunning) {
          event.reply("log-message", "Wabbajack doesn't appear to have started correctly. Try again or start it manually.");
          return;
        }

        // Check connection to debug port
        const pages = await checkBrowserAvailability();
        if (pages) {
          event.reply("browser-status", "available");
          event.reply("log-message", "Debug port connection established! AutoWabba ready to use.");
          event.reply("log-message", "You can start automation by clicking Start.");
        } else {
          event.reply("log-message", "Wabbajack started, but couldn't establish connection to debug port.");
          event.reply("log-message", "Try restarting Wabbajack or check if another program is using port 9222.");
          event.reply("browser-status", "unavailable");
        }
      }, 10000); // Increased to 10 seconds to give more initialization time
    } else {
      event.reply("log-message", "Failed to start Wabbajack. Try starting it manually.");
    }
  } catch (error) {
    event.reply("log-message", `Erro ao iniciar Wabbajack: ${error.message}`);
  }
});

// Save the selected Wabbajack path to a file
ipcMain.on("save-wabbajack-path", (event, path) => {
  fs.writeFile("wabbajack-path.txt", path, (err) => {
    if (err) {
      event.reply("log-message", `Erro ao salvar caminho do Wabbajack: ${err.message}`);
    } else {
      event.reply("log-message", "Caminho do Wabbajack salvo com sucesso.");
    }
  });
});

// Load the selected Wabbajack path from a file
ipcMain.on("load-wabbajack-path", (event) => {
  fs.readFile("wabbajack-path.txt", "utf8", (err, data) => {
    if (err) {
      event.reply("log-message", `Erro ao carregar caminho do Wabbajack: ${err.message}`);
    } else {
      selectedWabbajackPath = data.trim();
      event.reply("wabbajack-selected", selectedWabbajackPath);
      event.reply("log-message", `Caminho do Wabbajack carregado: ${selectedWabbajackPath}`);
    }
  });
});
