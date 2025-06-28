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
const { performClick, hasManyErrorPages } = require("./src/downloader");
const { getWabbajackPath, isWabbajackRunning, launchWabbajackWithDebug, saveWabbajackPath } = require("./src/wabbajack");
const { chromium } = require("playwright");

// Application state
let mainWindow;
let isRunning = false;
let stopRequested = false;
let selectedWabbajackPath = null;
let wabbajackCheckInterval = null;

// Automation variables
let lastClickedUrl = null;
let attempts = 0;
const MAX_ATTEMPTS = 10;
const COOLDOWN_TIME = 10000;
let errorPageCount = 0;
const MAX_ERROR_PAGES = 3;
let downloadCounter = 0;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 400,
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

/**
 * Send status update to renderer
 */
function sendStatusUpdate(status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", { status, ...extra });
  }
}

/**
 * Send browser status to renderer
 */
function sendBrowserStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("browser-status", status);
  }
}

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for Wabbajack to start using tasklist
 */
async function waitForWabbajackToStart() {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const running = await isWabbajackRunning();
    if (running) {
      console.log("Wabbajack detected running");
      return;
    }

    await sleep(1000);
    attempts++;
  }

  throw new Error("Timeout: Wabbajack did not start in 30 seconds");
}

/**
 * Start download automation
 */
async function startDownloadAutomation() {
  isRunning = true;
  stopRequested = false;
  downloadCounter = 0;

  console.log("Automation started");
  sendStatusUpdate("running", { downloadCounter });

  while (isRunning && !stopRequested) {
    try {
      // Check browser availability
      const pages = await checkBrowserAvailability();

      if (!pages) {
        // Browser not available - Wabbajack might not have opened a web page yet
        // Just wait and continue, don't stop automation
        console.log("Browser not available yet, waiting for Wabbajack to open a web page...");
        sendStatusUpdate("waiting_browser", { downloadCounter });
        await sleep(2000);
        continue;
      }

      // Browser is available - we have web pages to work with
      console.log(`Browser available with ${pages.length} pages`);
      sendStatusUpdate("running", { downloadCounter });

      // Check if there are many error pages
      if (errorPageCount >= MAX_ERROR_PAGES) {
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const hasManyErrors = await hasManyErrorPages(browser);
        await browser.close();

        if (hasManyErrors) {
          console.log("Many error pages detected, waiting 30 seconds");
          await sleep(30000);
          errorPageCount = 0;
          continue;
        } else {
          errorPageCount = 0;
        }
      }

      // Find download page
      const targetPage = await findTargetPage(pages);

      if (targetPage) {
        // Check if it's the same URL (download in progress)
        if (lastClickedUrl === targetPage.url) {
          attempts++;
          if (attempts >= MAX_ATTEMPTS) {
            console.log("Download stuck, resetting");
            lastClickedUrl = null;
            attempts = 0;
          } else {
            await sleep(COOLDOWN_TIME * 2);
            continue;
          }
        } else {
          attempts = 0;
        }

        // Execute click
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const clickResult = await performClick(browser, targetPage);
        if (clickResult && clickResult.url) {
          lastClickedUrl = clickResult.url;
          attempts = 0;
          errorPageCount = 0;
          if (clickResult.clickedMain) {
            downloadCounter++;
            sendStatusUpdate("running", { downloadCounter });
          }
          console.log("Download started successfully");
          await browser.close();
          await sleep(COOLDOWN_TIME);
        } else {
          errorPageCount++;
          console.log("Failed to click download button");
          await browser.close();
          await sleep(2000);
        }
      } else {
        // No download page found - might be on a different page
        console.log("No download page found, waiting...");
        await sleep(2000);
      }
    } catch (error) {
      console.error("Automation error:", error.message);
      await sleep(5000);
    }
  }

  isRunning = false;
  sendStatusUpdate("stopped", { downloadCounter });
  console.log("Automation stopped");
}

app.whenReady().then(() => {
  createWindow();

  // Check for saved Wabbajack path on startup
  setTimeout(async () => {
    try {
      const savedPath = await getWabbajackPath();
      if (savedPath) {
        selectedWabbajackPath = savedPath;
        mainWindow.webContents.send("wabbajack-selected", savedPath);
        console.log("Wabbajack path loaded from configuration");
      }

      // Check if Wabbajack is already running
      const wjRunning = await isWabbajackRunning();
      if (wjRunning) {
        console.log("Wabbajack is already running, starting status check");
        startWabbajackStatusCheck();
      } else {
        // Wabbajack not running, check browser availability
        const pages = await checkBrowserAvailability();
        if (!pages) {
          sendBrowserStatus("unavailable");
        } else {
          sendBrowserStatus("available");
        }
      }
    } catch (error) {
      console.error("Error during startup:", error.message);
      sendBrowserStatus("error");
    }
  }, 1000);
});

// Start automation
ipcMain.on("start-automation", async (event) => {
  if (isRunning) {
    return;
  }

  if (!selectedWabbajackPath) {
    return;
  }

  try {
    // Stop the continuous check if it's running
    if (wabbajackCheckInterval) {
      clearInterval(wabbajackCheckInterval);
      wabbajackCheckInterval = null;
    }

    // Check if Wabbajack is already running
    const wjRunning = await isWabbajackRunning();
    if (wjRunning) {
      console.log("Wabbajack is already running, starting automation...");

      // Start automation directly since Wabbajack is already running
      // The automation will wait for browser to be available
      await startDownloadAutomation();
      return;
    }

    console.log("Launching Wabbajack with debug...");
    const launched = await launchWabbajackWithDebug(selectedWabbajackPath);

    if (!launched) {
      console.error("Failed to launch Wabbajack");
      sendStatusUpdate("ready");
      return;
    }

    console.log("Wabbajack launched. Waiting for initialization...");
    await waitForWabbajackToStart();

    // Wait 3 seconds for stabilization
    await sleep(3000);

    // Start automation - it will wait for browser to be available
    await startDownloadAutomation();
  } catch (error) {
    console.error("Error starting automation:", error.message);
    sendStatusUpdate("ready");
  }
});

// Stop automation
ipcMain.on("stop-automation", (event) => {
  if (!isRunning) {
    return;
  }

  stopRequested = true;
  console.log("Stop automation requested");
});

// Select Wabbajack executable
ipcMain.on("select-wabbajack", async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Wabbajack Executable",
      filters: [
        { name: "Executables", extensions: ["exe"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const wjPath = result.filePaths[0];

      if (!wjPath.toLowerCase().endsWith("wabbajack.exe")) {
        return;
      }

      selectedWabbajackPath = wjPath;
      saveWabbajackPath(wjPath);
      mainWindow.webContents.send("wabbajack-selected", wjPath);
      console.log("Wabbajack path selected");
    }
  } catch (error) {
    console.error("Error selecting Wabbajack:", error.message);
  }
});

// Check browser availability
ipcMain.on("check-browser", async (event) => {
  try {
    const pages = await checkBrowserAvailability();
    if (!pages) {
      sendBrowserStatus("unavailable");
    } else {
      sendBrowserStatus("available");
    }
  } catch (error) {
    console.error("Error checking browser:", error.message);
    sendBrowserStatus("error");
  }
});

// Window controls
ipcMain.on("minimize-window", () => {
  mainWindow.minimize();
});

ipcMain.on("close-window", () => {
  app.quit();
});

// GitHub link
ipcMain.on("open-github", () => {
  shell.openExternal("https://github.com/LucasHenriqueDiniz/AutoWabba");
});

// App lifecycle
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Clean up interval
    if (wabbajackCheckInterval) {
      clearInterval(wabbajackCheckInterval);
      wabbajackCheckInterval = null;
    }
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  // Clean up interval
  if (wabbajackCheckInterval) {
    clearInterval(wabbajackCheckInterval);
    wabbajackCheckInterval = null;
  }
});

/**
 * Check Wabbajack status continuously
 */
async function checkWabbajackStatus() {
  try {
    const isRunning = await isWabbajackRunning();
    if (isRunning) {
      // Don't send status update when Wabbajack is running
      // The automation should handle this
    } else {
      // Wabbajack was closed, enable start button
      sendStatusUpdate("ready");
      sendBrowserStatus("unavailable");

      // Stop the interval since Wabbajack is no longer running
      if (wabbajackCheckInterval) {
        clearInterval(wabbajackCheckInterval);
        wabbajackCheckInterval = null;
      }
    }
  } catch (error) {
    console.error("Error checking Wabbajack status:", error.message);
  }
}

/**
 * Start continuous Wabbajack status checking
 */
function startWabbajackStatusCheck() {
  if (wabbajackCheckInterval) {
    clearInterval(wabbajackCheckInterval);
  }

  // Check immediately
  checkWabbajackStatus();

  // Then check every 2 seconds
  wabbajackCheckInterval = setInterval(checkWabbajackStatus, 2000);
}
